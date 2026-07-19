import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { getPublicKey, nip19, validateEvent, verifyEvent } from 'nostr-tools';
import { config } from './config.js';
import { all, db, migrate, one } from './db.js';
import { scanArtifacts } from './scanner.js';

migrate();
scanArtifacts();

const publicDir = path.join(config.rootDir, 'src', 'public');
const authSecretPath = path.join(config.dataDir, 'auth-secret');
const AUTH_COOKIE = 'artifact_auth';
const CHALLENGE_COOKIE = 'artifact_challenge';
const UNLOCK_COOKIE = 'artifact_unlocks';
const AUTH_TTL_SECONDS = 60 * 60 * 24 * 30;
const CHALLENGE_TTL_SECONDS = 60 * 5;
const UNLOCK_TTL_SECONDS = 60 * 60 * 24 * 30;

function readAuthSecret() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  if (!fs.existsSync(authSecretPath)) {
    fs.writeFileSync(authSecretPath, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  }
  return fs.readFileSync(authSecretPath, 'utf8').trim();
}

const authSecret = readAuthSecret();

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    'content-type': typeof body === 'object' && !Buffer.isBuffer(body) ? 'application/json' : 'text/plain; charset=utf-8',
    ...headers
  });
  res.end(payload);
}

function sendJson(res, status, body, headers = {}) {
  send(res, status, body, { 'content-type': 'application/json; charset=utf-8', ...headers });
}

function safeJoin(base, parts) {
  const root = path.resolve(base);
  const target = path.resolve(root, ...parts);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return target;
}

function decodePathSegments(pathname) {
  try {
    return pathname.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return null;
  }
}

function hasUnsafePathSegment(pathname) {
  const segments = decodePathSegments(pathname);
  return !segments || segments.some((segment) => segment === '.' || segment === '..');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 12_000_000) reject(new Error('Body too large'));
    });
    req.on('end', () => resolve(body ? JSON.parse(body) : {}));
    req.on('error', reject);
  });
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function fromBase64url(input) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function signValue(value) {
  return crypto.createHmac('sha256', authSecret).update(value).digest('base64url');
}

function signedToken(payload, ttlSeconds) {
  const body = base64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  return `${body}.${signValue(body)}`;
}

function verifySignedToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [body, signature] = token.split('.');
  if (!body || !signature || signValue(body) !== signature) return null;
  try {
    const payload = JSON.parse(fromBase64url(body));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || '')
      .split(';')
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const index = cookie.indexOf('=');
        return index === -1 ? [cookie, ''] : [cookie.slice(0, index), decodeURIComponent(cookie.slice(index + 1))];
      })
  );
}

function isSecureRequest(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  let cfVisitorScheme = '';
  try {
    cfVisitorScheme = JSON.parse(String(req.headers['cf-visitor'] || '{}')).scheme || '';
  } catch {
    cfVisitorScheme = '';
  }
  const forwardedSsl = String(req.headers['x-forwarded-ssl'] || '').toLowerCase();
  const host = String(req.headers.host || '').toLowerCase();
  return (
    forwardedProto === 'https' ||
    forwardedSsl === 'on' ||
    cfVisitorScheme === 'https' ||
    host.endsWith('.runwingman.com') ||
    host.endsWith('.otherstuff.ai') ||
    req.socket.encrypted === true
  );
}

function cookieHeader(req, name, value, maxAgeSeconds) {
  const encoded = encodeURIComponent(value);
  const secure = isSecureRequest(req) ? '; Secure' : '';
  return `${name}=${encoded}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${secure}`;
}

function clearCookieHeader(req, name) {
  const secure = isSecureRequest(req) ? '; Secure' : '';
  return `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
}

function currentUser(req) {
  const token = parseCookies(req)[AUTH_COOKIE];
  const payload = verifySignedToken(token);
  if (!payload?.npub || !payload?.pubkey) return null;
  return { npub: payload.npub, pubkey: payload.pubkey };
}

function normalizeNpub(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    if (raw.startsWith('npub1')) {
      const decoded = nip19.decode(raw);
      if (decoded.type !== 'npub') return null;
      return raw;
    }
    if (/^[0-9a-f]{64}$/i.test(raw)) return nip19.npubEncode(raw.toLowerCase());
  } catch {
    return null;
  }
  return null;
}

function npubToHex(npub) {
  try {
    const decoded = nip19.decode(npub);
    return decoded.type === 'npub' ? decoded.data : null;
  } catch {
    return null;
  }
}

function secretKeyFromInput(input) {
  const raw = String(input || '').trim();
  if (raw.startsWith('nsec1')) {
    const decoded = nip19.decode(raw);
    if (decoded.type !== 'nsec') throw new Error('Invalid nsec');
    return decoded.data;
  }
  if (/^[0-9a-f]{64}$/i.test(raw)) return Uint8Array.from(Buffer.from(raw, 'hex'));
  throw new Error('Invalid nsec');
}

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code || '').trim()).digest('hex');
}

function randomUnlockCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function pageGrantKey(ctx) {
  return `${ctx.artifact_id}:${ctx.version_id}:${ctx.page_id}`;
}

function unlockedGrantKeys(req) {
  const payload = verifySignedToken(parseCookies(req)[UNLOCK_COOKIE]);
  return Array.isArray(payload?.grants) ? payload.grants.filter((grant) => typeof grant === 'string') : [];
}

function withUnlock(req, ctx) {
  return [...new Set([...unlockedGrantKeys(req), pageGrantKey(ctx)])];
}

function projectRole(ctx, user) {
  if (!user) return null;
  if (user.npub === config.ownerNpub) return 'edit';
  const row = one(
    `
      SELECT pm.role
      FROM project_members pm
      JOIN artifacts a ON a.project_id = pm.project_id
      WHERE a.id = ? AND pm.npub = ?
    `,
    ctx.artifact_id,
    user.npub
  );
  return row?.role || null;
}

function canManage(ctx, user) {
  return projectRole(ctx, user) === 'edit';
}

function canAccessPage(ctx, req) {
  if (!ctx) return false;
  const mode = ctx.access_mode || 'private';
  if (mode === 'public' || ctx.is_public === 1) return true;
  const user = currentUser(req);
  if (projectRole(ctx, user)) return true;
  if (ctx.allowed_npub && user?.npub === ctx.allowed_npub) return true;
  if (mode === 'code' && unlockedGrantKeys(req).includes(pageGrantKey(ctx))) return true;
  return false;
}

function accessibleVersion(ctx, req) {
  const rows = all(
    `
      SELECT
        p.slug project_slug,
        a.id artifact_id,
        a.slug artifact_slug,
        v.id version_id,
        v.version_slug,
        v.filesystem_path,
        pg.id page_id,
        pg.page_path,
        COALESCE(ac.mode, 'private') access_mode,
        ac.allowed_npub,
        COALESCE(ac.is_public, 0) is_public
      FROM projects p
      JOIN artifacts a ON a.project_id = p.id
      JOIN artifact_versions v ON v.artifact_id = a.id
      JOIN artifact_pages pg ON pg.version_id = v.id
      LEFT JOIN artifact_access ac ON ac.artifact_id = a.id AND ac.version_id = v.id AND ac.page_id = pg.id
      WHERE a.id = ? AND v.id = ?
    `,
    ctx.artifact_id,
    ctx.version_id
  );
  return rows.some((row) => canAccessPage(row, req));
}

function requirePageAccess(req, res, ctx) {
  if (!ctx) {
    sendJson(res, 404, { error: 'Artifact page not found' });
    return false;
  }
  if (!canAccessPage(ctx, req)) {
    sendJson(res, 403, { error: 'Sign in or unlock this private artifact page' });
    return false;
  }
  return true;
}

function artifactContext(project, artifact, version, page = 'index.html') {
  return one(
    `
      SELECT
        p.slug project_slug,
        a.id artifact_id,
        a.slug artifact_slug,
        a.title artifact_title,
        v.id version_id,
        v.version_slug,
        v.filesystem_path,
        v.entrypoint_path,
        pg.id page_id,
        pg.page_path,
        pg.title page_title,
        ac.mode access_mode,
        ac.allowed_npub,
        ac.access_code_hash,
        ac.is_public
      FROM projects p
      JOIN artifacts a ON a.project_id = p.id
      JOIN artifact_versions v ON v.artifact_id = a.id
      JOIN artifact_pages pg ON pg.version_id = v.id
      LEFT JOIN artifact_access ac ON ac.artifact_id = a.id AND ac.version_id = v.id AND ac.page_id = pg.id
      WHERE p.slug = ? AND a.slug = ? AND v.version_slug = ? AND pg.page_path = ?
    `,
    project,
    artifact,
    version,
    page
  );
}

function artifactVersionContext(project, artifact, version) {
  return one(
    `
      SELECT
        p.slug project_slug,
        a.id artifact_id,
        a.slug artifact_slug,
        v.id version_id,
        v.version_slug,
        v.filesystem_path
      FROM projects p
      JOIN artifacts a ON a.project_id = p.id
      JOIN artifact_versions v ON v.artifact_id = a.id
      WHERE p.slug = ? AND a.slug = ? AND v.version_slug = ?
    `,
    project,
    artifact,
    version
  );
}

function appShell(req, res) {
  const user = currentUser(req);
  const assetVersion = String(
    Math.max(
      fs.statSync(path.join(publicDir, 'app.js')).mtimeMs,
      fs.statSync(path.join(publicDir, 'app.css')).mtimeMs
    )
  );
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${config.appName}</title>
  <link rel="stylesheet" href="/static/app.css?v=${assetVersion}">
</head>
<body>
  <div id="app"></div>
  <script>window.ARTIFACTS_APP=${JSON.stringify({ appName: config.appName, ownerNpub: config.ownerNpub, user })}</script>
  <script type="module" src="/static/app.js?v=${assetVersion}"></script>
</body>
</html>`;
  send(res, 200, html, { 'content-type': 'text/html; charset=utf-8' });
}

function injectReviewClient(html, { disabled = false } = {}) {
  if (disabled) return html;
  const script = `<script src="/static/review-frame.js" defer></script>`;
  if (html.includes('</body>')) return html.replace('</body>', `${script}</body>`);
  return `${html}${script}`;
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return (
    {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp'
    }[ext] || 'application/octet-stream'
  );
}

async function uploadAttachment(ctx, attachment) {
  if (!attachment?.dataUrl) return null;
  const match = attachment.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mimeType = match[1];
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('jpeg') ? 'jpg' : 'bin';
  const buffer = Buffer.from(match[2], 'base64');
  const feedbackDir = path.join(ctx.filesystem_path, 'fdback');
  fs.mkdirSync(feedbackDir, { recursive: true });
  const name = `comment-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const filePath = path.join(feedbackDir, name);
  fs.writeFileSync(filePath, buffer);
  return {
    kind: 'screenshot',
    filePath: path.relative(config.rootDir, filePath),
    mimeType,
    sizeBytes: buffer.byteLength
  };
}

async function route(req, res) {
  const rawPathname = (req.url || '/').split('?')[0] || '/';
  if (hasUnsafePathSegment(rawPathname)) return send(res, 404, 'Not found');

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const parts = decodePathSegments(url.pathname);
  if (!parts) return send(res, 404, 'Not found');
  const method = req.method === 'HEAD' ? 'GET' : req.method;

  if (method === 'GET' && url.pathname === '/healthz') {
    return sendJson(res, 200, { ok: true, app: config.appName });
  }

  if (method === 'GET' && url.pathname === '/api/auth/me') {
    return sendJson(res, 200, { user: currentUser(req), ownerNpub: config.ownerNpub });
  }

  if (method === 'POST' && url.pathname === '/api/auth/session') {
    const input = await readBody(req);
    const npub = normalizeNpub(input.npub);
    if (!npub) return sendJson(res, 400, { error: 'Valid npub is required' });
    const pubkey = npubToHex(npub);
    if (!pubkey) return sendJson(res, 400, { error: 'Valid npub is required' });
    return sendJson(
      res,
      200,
      {
        user: { npub, pubkey },
        expiresAt: Math.floor(Date.now() / 1000) + AUTH_TTL_SECONDS
      },
      { 'set-cookie': cookieHeader(req, AUTH_COOKIE, signedToken({ npub, pubkey }, AUTH_TTL_SECONDS), AUTH_TTL_SECONDS) }
    );
  }

  if (method === 'POST' && url.pathname === '/api/auth/challenge') {
    const challenge = crypto.randomBytes(18).toString('base64url');
    const challengeToken = signedToken({ challenge }, CHALLENGE_TTL_SECONDS);
    return sendJson(
      res,
      200,
      { challenge, challengeToken },
      { 'set-cookie': cookieHeader(req, CHALLENGE_COOKIE, challengeToken, CHALLENGE_TTL_SECONDS) }
    );
  }

  if (method === 'POST' && url.pathname === '/api/auth/nostr') {
    const input = await readBody(req);
    const challengePayload =
      verifySignedToken(input.challengeToken) || verifySignedToken(parseCookies(req)[CHALLENGE_COOKIE]);
    if (!challengePayload?.challenge) return sendJson(res, 400, { error: 'Challenge expired' });
    const event = input.event;
    const challenge = event?.tags?.find((tag) => tag[0] === 'challenge')?.[1];
    if (challenge !== challengePayload.challenge) return sendJson(res, 400, { error: 'Challenge mismatch' });
    if (!validateEvent(event) || !verifyEvent(event)) return sendJson(res, 400, { error: 'Invalid Nostr signature' });
    const npub = nip19.npubEncode(event.pubkey);
    return sendJson(
      res,
      200,
      { user: { npub, pubkey: event.pubkey } },
      {
        'set-cookie': [
          cookieHeader(req, AUTH_COOKIE, signedToken({ npub, pubkey: event.pubkey }, AUTH_TTL_SECONDS), AUTH_TTL_SECONDS),
          clearCookieHeader(req, CHALLENGE_COOKIE)
        ]
      }
    );
  }

  if (method === 'POST' && url.pathname === '/api/auth/nsec') {
    const input = await readBody(req);
    let pubkey;
    try {
      pubkey = getPublicKey(secretKeyFromInput(input.nsec));
    } catch {
      return sendJson(res, 400, { error: 'Invalid nsec' });
    }
    const npub = nip19.npubEncode(pubkey);
    return sendJson(
      res,
      200,
      { user: { npub, pubkey } },
      { 'set-cookie': cookieHeader(req, AUTH_COOKIE, signedToken({ npub, pubkey }, AUTH_TTL_SECONDS), AUTH_TTL_SECONDS) }
    );
  }

  if (method === 'POST' && url.pathname === '/api/auth/logout') {
    return sendJson(res, 200, { ok: true }, { 'set-cookie': clearCookieHeader(req, AUTH_COOKIE) });
  }

  if (method === 'POST' && url.pathname === '/api/auth/unlock') {
    const input = await readBody(req);
    const ctx = artifactContext(input.project, input.artifact, input.version, input.page || 'index.html');
    if (!ctx) return sendJson(res, 404, { error: 'Artifact page not found' });
    if ((ctx.access_mode || 'private') !== 'code' || !ctx.access_code_hash) {
      return sendJson(res, 400, { error: 'This artifact page does not have an unlock code' });
    }
    if (hashCode(input.code) !== ctx.access_code_hash) return sendJson(res, 403, { error: 'Incorrect unlock code' });
    const grants = withUnlock(req, ctx);
    return sendJson(
      res,
      200,
      { ok: true },
      { 'set-cookie': cookieHeader(req, UNLOCK_COOKIE, signedToken({ grants }, UNLOCK_TTL_SECONDS), UNLOCK_TTL_SECONDS) }
    );
  }

  if (method === 'POST' && url.pathname === '/api/scan') {
    scanArtifacts();
    return sendJson(res, 200, { ok: true });
  }

  if (method === 'GET' && url.pathname === '/api/catalog') {
    const rows = all(`
      SELECT p.slug project, p.name projectName, a.slug artifact, a.title artifactTitle,
             v.version_slug version, v.entrypoint_path entrypoint, pg.page_path page, pg.title pageTitle,
             COALESCE(ac.mode, 'private') accessMode,
             a.id artifact_id, v.id version_id, pg.id page_id, ac.allowed_npub, COALESCE(ac.is_public, 0) is_public
      FROM projects p
      JOIN artifacts a ON a.project_id = p.id
      JOIN artifact_versions v ON v.artifact_id = a.id
      JOIN artifact_pages pg ON pg.version_id = v.id
      LEFT JOIN artifact_access ac ON ac.artifact_id = a.id AND ac.version_id = v.id AND ac.page_id = pg.id
      ORDER BY p.slug, a.slug, v.version_slug, pg.page_path
    `)
      .filter((row) =>
        canAccessPage(
          {
            artifact_id: row.artifact_id,
            version_id: row.version_id,
            page_id: row.page_id,
            access_mode: row.accessMode,
            allowed_npub: row.allowed_npub,
            is_public: row.is_public
          },
          req
        )
      )
      .map(({ artifact_id, version_id, page_id, allowed_npub, is_public, ...row }) => row);
    return sendJson(res, 200, { appName: config.appName, ownerNpub: config.ownerNpub, user: currentUser(req), rows });
  }

  if (method === 'GET' && parts[0] === 'api' && parts[1] === 'comments') {
    const ctx = artifactContext(parts[2], parts[3], parts[4], url.searchParams.get('page') || 'index.html');
    if (!requirePageAccess(req, res, ctx)) return;
    const comments = all(
      `
        SELECT c.*, COALESCE(json_group_array(json_object(
          'id', ca.id, 'kind', ca.kind, 'filePath', ca.file_path, 'mimeType', ca.mime_type, 'sizeBytes', ca.size_bytes
        )) FILTER (WHERE ca.id IS NOT NULL), '[]') attachments
        FROM comments c
        LEFT JOIN comment_attachments ca ON ca.comment_id = c.id
        WHERE c.artifact_id = ? AND c.version_id = ? AND c.page_id = ?
        GROUP BY c.id
        ORDER BY c.created_at DESC
      `,
      ctx.artifact_id,
      ctx.version_id,
      ctx.page_id
    ).map((row) => ({ ...row, attachments: JSON.parse(row.attachments) }));
    return sendJson(res, 200, { context: ctx, comments });
  }

  if (method === 'POST' && parts[0] === 'api' && parts[1] === 'comments') {
    const ctx = artifactContext(parts[2], parts[3], parts[4], parts[5] || 'index.html');
    if (!requirePageAccess(req, res, ctx)) return;
    const input = await readBody(req);
    if (!input.body?.trim()) return sendJson(res, 400, { error: 'Comment body is required' });
    const now = new Date().toISOString();
    const result = db
      .prepare(
        `
          INSERT INTO comments
            (artifact_id, version_id, page_id, element_selector, element_node_id, element_fingerprint, body, created_by_npub, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        ctx.artifact_id,
        ctx.version_id,
        ctx.page_id,
        input.elementSelector || 'body',
        input.elementNodeId || null,
        input.elementFingerprint || 'body',
        input.body.trim(),
        currentUser(req)?.npub || input.createdByNpub || 'share-code-reviewer',
        now
      );
    const attachment = await uploadAttachment(ctx, input.attachment);
    if (attachment) {
      db.prepare(
        `
          INSERT INTO comment_attachments (comment_id, kind, file_path, mime_type, size_bytes, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `
      ).run(result.lastInsertRowid, attachment.kind, attachment.filePath, attachment.mimeType, attachment.sizeBytes, now);
    }
    return sendJson(res, 201, { ok: true, id: result.lastInsertRowid });
  }

  if (method === 'PATCH' && parts[0] === 'api' && parts[1] === 'comments' && parts[3] === 'resolve') {
    const comment = one(
      `
        SELECT c.*, a.id artifact_id, v.id version_id, pg.id page_id
        FROM comments c
        JOIN artifacts a ON a.id = c.artifact_id
        JOIN artifact_versions v ON v.id = c.version_id
        JOIN artifact_pages pg ON pg.id = c.page_id
        WHERE c.id = ?
      `,
      parts[2]
    );
    if (!comment || !canManage(comment, currentUser(req))) return sendJson(res, 403, { error: 'Edit access required' });
    const now = new Date().toISOString();
    db.prepare("UPDATE comments SET status = 'resolved', resolved_at = ? WHERE id = ?").run(now, parts[2]);
    return sendJson(res, 200, { ok: true });
  }

  if (method === 'POST' && parts[0] === 'api' && parts[1] === 'share' && parts[5]) {
    const ctx = artifactContext(parts[2], parts[3], parts[4], parts[5] || 'index.html');
    if (!ctx) return sendJson(res, 404, { error: 'Artifact page not found' });
    if (!canManage(ctx, currentUser(req))) return sendJson(res, 403, { error: 'Project edit access required' });
    const input = await readBody(req);
    const now = new Date().toISOString();
    const mode = input.mode === 'public' ? 'public' : input.mode === 'private' ? 'private' : 'code';
    const code = mode === 'code' ? randomUnlockCode() : null;
    db.prepare(
      `
        INSERT INTO artifact_access
          (artifact_id, version_id, page_id, mode, allowed_npub, access_code_hash, is_public, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(artifact_id, version_id, page_id) DO UPDATE SET
          mode = excluded.mode,
          access_code_hash = excluded.access_code_hash,
          is_public = excluded.is_public,
          updated_at = excluded.updated_at
      `
    ).run(
      ctx.artifact_id,
      ctx.version_id,
      ctx.page_id,
      mode,
      ctx.allowed_npub || config.ownerNpub,
      code ? hashCode(code) : null,
      mode === 'public' ? 1 : 0,
      now,
      now
    );
    const sharePath = `/artifacts/${encodeURIComponent(parts[2])}/${encodeURIComponent(parts[3])}/${encodeURIComponent(parts[4])}/`;
    return sendJson(res, 200, { ok: true, mode, code, sharePath });
  }

  if (method === 'GET' && parts[0] === 'api' && parts[1] === 'projects' && parts[3] === 'members') {
    const project = one('SELECT id, slug FROM projects WHERE slug = ?', parts[2]);
    if (!project) return sendJson(res, 404, { error: 'Project not found' });
    const syntheticCtx = { artifact_id: one('SELECT id FROM artifacts WHERE project_id = ? LIMIT 1', project.id)?.id || 0 };
    if (currentUser(req)?.npub !== config.ownerNpub && !one('SELECT 1 FROM project_members WHERE project_id = ? AND npub = ? AND role = ? ', project.id, currentUser(req)?.npub || '', 'edit')) {
      return sendJson(res, 403, { error: 'Project edit access required' });
    }
    const members = all('SELECT npub, role, created_at, updated_at FROM project_members WHERE project_id = ? ORDER BY npub', project.id);
    return sendJson(res, 200, { project: project.slug, members });
  }

  if (method === 'POST' && parts[0] === 'api' && parts[1] === 'projects' && parts[3] === 'members') {
    const project = one('SELECT id, slug FROM projects WHERE slug = ?', parts[2]);
    if (!project) return sendJson(res, 404, { error: 'Project not found' });
    if (currentUser(req)?.npub !== config.ownerNpub && !one('SELECT 1 FROM project_members WHERE project_id = ? AND npub = ? AND role = ? ', project.id, currentUser(req)?.npub || '', 'edit')) {
      return sendJson(res, 403, { error: 'Project edit access required' });
    }
    const input = await readBody(req);
    const npub = normalizeNpub(input.npub);
    if (!npub) return sendJson(res, 400, { error: 'Valid npub is required' });
    const role = input.role === 'edit' ? 'edit' : 'read';
    const now = new Date().toISOString();
    db.prepare(
      `
        INSERT INTO project_members (project_id, npub, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(project_id, npub) DO UPDATE SET role = excluded.role, updated_at = excluded.updated_at
      `
    ).run(project.id, npub, role, now, now);
    return sendJson(res, 200, { ok: true, npub, role });
  }

  if (method === 'GET' && parts[0] === 'static') {
    const filePath = safeJoin(publicDir, parts.slice(1));
    if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return send(res, 404, 'Not found');
    return send(res, 200, fs.readFileSync(filePath), {
      'content-type': contentType(filePath),
      'cache-control': 'no-store'
    });
  }

  if (method === 'GET' && parts[0] === 'feedback-assets') {
    const relative = parts.slice(1).join('/');
    const attachmentCtx = one(
      `
        SELECT
          a.id artifact_id,
          v.id version_id,
          pg.id page_id,
          COALESCE(ac.mode, 'private') access_mode,
          ac.allowed_npub,
          COALESCE(ac.is_public, 0) is_public
        FROM comment_attachments ca
        JOIN comments c ON c.id = ca.comment_id
        JOIN artifacts a ON a.id = c.artifact_id
        JOIN artifact_versions v ON v.id = c.version_id
        JOIN artifact_pages pg ON pg.id = c.page_id
        LEFT JOIN artifact_access ac ON ac.artifact_id = a.id AND ac.version_id = v.id AND ac.page_id = pg.id
        WHERE ca.file_path = ?
      `,
      relative
    );
    if (!requirePageAccess(req, res, attachmentCtx)) return;
    const filePath = safeJoin(config.rootDir, parts.slice(1));
    if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return send(res, 404, 'Not found');
    return send(res, 200, fs.readFileSync(filePath), { 'content-type': contentType(filePath) });
  }

  if (method === 'GET' && parts[0] === 'artifact-frame') {
    const [project, artifact, version, ...pageParts] = parts.slice(1);
    const page = pageParts.join('/') || 'index.html';
    const isHtml = path.extname(page).toLowerCase() === '.html';
    const ctx = isHtml ? artifactContext(project, artifact, version, page) : artifactVersionContext(project, artifact, version);
    if (!ctx) return send(res, 404, 'Artifact page not found');
    if (isHtml) {
      if (!requirePageAccess(req, res, ctx)) return;
    } else if (!accessibleVersion(ctx, req)) {
      return send(res, 403, 'Sign in or unlock this private artifact version');
    }
    const filePath = safeJoin(ctx.filesystem_path, [page]);
    if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return send(res, 404, 'Artifact file not found');
    const raw = fs.readFileSync(filePath);
    const body = isHtml
      ? injectReviewClient(raw.toString('utf8'), { disabled: url.searchParams.get('review') === 'disabled' })
      : raw;
    return send(res, 200, body, { 'content-type': contentType(filePath) });
  }

  if (method === 'GET' && (url.pathname === '/' || parts[0] === 'artifacts')) return appShell(req, res);

  return send(res, 404, 'Not found');
}

const server = http.createServer((req, res) => {
  route(req, res).catch((error) => {
    console.error(error);
    sendJson(res, 500, { error: error.message });
  });
});

server.listen(config.port, () => {
  console.log(`${config.appName} listening on http://127.0.0.1:${config.port}`);
});
