import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { config } from './config.js';
import { all, db, migrate, one } from './db.js';
import { scanArtifacts } from './scanner.js';

migrate();
scanArtifacts();

const publicDir = path.join(config.rootDir, 'src', 'public');

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    'content-type': typeof body === 'object' && !Buffer.isBuffer(body) ? 'application/json' : 'text/plain; charset=utf-8',
    ...headers
  });
  res.end(payload);
}

function sendJson(res, status, body) {
  send(res, status, body, { 'content-type': 'application/json; charset=utf-8' });
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

function appShell(res) {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${config.appName}</title>
  <link rel="stylesheet" href="/static/app.css">
</head>
<body>
  <div id="app"></div>
  <script>window.ARTIFACTS_APP=${JSON.stringify({ appName: config.appName, ownerNpub: config.ownerNpub })}</script>
  <script type="module" src="/static/app.js"></script>
</body>
</html>`;
  send(res, 200, html, { 'content-type': 'text/html; charset=utf-8' });
}

function injectReviewClient(html) {
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

  if (method === 'POST' && url.pathname === '/api/scan') {
    scanArtifacts();
    return sendJson(res, 200, { ok: true });
  }

  if (method === 'GET' && url.pathname === '/api/catalog') {
    const rows = all(`
      SELECT p.slug project, p.name projectName, a.slug artifact, a.title artifactTitle,
             v.version_slug version, v.entrypoint_path entrypoint, pg.page_path page, pg.title pageTitle,
             COALESCE(ac.mode, 'private') accessMode
      FROM projects p
      JOIN artifacts a ON a.project_id = p.id
      JOIN artifact_versions v ON v.artifact_id = a.id
      JOIN artifact_pages pg ON pg.version_id = v.id
      LEFT JOIN artifact_access ac ON ac.artifact_id = a.id AND ac.version_id = v.id AND ac.page_id = pg.id
      ORDER BY p.slug, a.slug, v.version_slug, pg.page_path
    `);
    return sendJson(res, 200, { appName: config.appName, ownerNpub: config.ownerNpub, rows });
  }

  if (method === 'GET' && parts[0] === 'api' && parts[1] === 'comments') {
    const ctx = artifactContext(parts[2], parts[3], parts[4], url.searchParams.get('page') || 'index.html');
    if (!ctx) return sendJson(res, 404, { error: 'Artifact page not found' });
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
    if (!ctx) return sendJson(res, 404, { error: 'Artifact page not found' });
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
        input.createdByNpub || config.ownerNpub,
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
    const now = new Date().toISOString();
    db.prepare("UPDATE comments SET status = 'resolved', resolved_at = ? WHERE id = ?").run(now, parts[2]);
    return sendJson(res, 200, { ok: true });
  }

  if (method === 'GET' && parts[0] === 'static') {
    const filePath = safeJoin(publicDir, parts.slice(1));
    if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return send(res, 404, 'Not found');
    return send(res, 200, fs.readFileSync(filePath), { 'content-type': contentType(filePath) });
  }

  if (method === 'GET' && parts[0] === 'feedback-assets') {
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
    const filePath = safeJoin(ctx.filesystem_path, [page]);
    if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return send(res, 404, 'Artifact file not found');
    const raw = fs.readFileSync(filePath);
    const body = isHtml ? injectReviewClient(raw.toString('utf8')) : raw;
    return send(res, 200, body, { 'content-type': contentType(filePath) });
  }

  if (method === 'GET' && (url.pathname === '/' || parts[0] === 'artifacts')) return appShell(res);

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
