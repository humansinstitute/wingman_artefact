import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const port = Number(process.env.PORT || 5178);
const root = path.resolve(import.meta.dirname, '..');
const artifactsRoot = path.join(root, 'artifacts');

function firstArtifactPage() {
  for (const project of fs.readdirSync(artifactsRoot)) {
    const projectPath = path.join(artifactsRoot, project);
    if (!fs.statSync(projectPath).isDirectory()) continue;
    for (const artifact of fs.readdirSync(projectPath)) {
      const artifactPath = path.join(projectPath, artifact);
      if (!fs.statSync(artifactPath).isDirectory()) continue;
      for (const version of fs.readdirSync(artifactPath)) {
        const versionPath = path.join(artifactPath, version);
        if (!fs.statSync(versionPath).isDirectory()) continue;
        const page = fs.readdirSync(versionPath).find((file) => file.endsWith('.html'));
        if (page) return { project, artifact, version, page };
      }
    }
  }
  throw new Error('No artifact HTML page found');
}

function get(pathname) {
  return new Promise((resolve, reject) => {
    http
      .get({ hostname: '127.0.0.1', port, path: pathname }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      })
      .on('error', reject);
  });
}

const target = firstArtifactPage();

const health = await get('/healthz');
if (health.status !== 200) throw new Error(`healthz failed: ${health.status}`);

const catalog = await get('/api/catalog');
if (catalog.status !== 200) throw new Error(`catalog failed: ${catalog.status}`);
const parsed = JSON.parse(catalog.body);
if (!Array.isArray(parsed.rows)) throw new Error('catalog rows missing');

const shell = await get(`/artifacts/${target.project}/${target.artifact}/${target.version}/`);
if (shell.status !== 200 || !shell.body.includes('ARTIFACTS_APP')) {
  throw new Error(`artifact shell failed: ${shell.status}`);
}

const appJs = await get('/static/app.js');
if (appJs.status !== 200 || !appJs.body.includes('Private artifact')) {
  throw new Error(`static app JS failed: ${appJs.status}`);
}

const privateFrame = await get(`/artifact-frame/${target.project}/${target.artifact}/${target.version}/${target.page}`);
if (privateFrame.status !== 403) {
  throw new Error(`private frame guard failed: ${privateFrame.status}`);
}

const traversal = await get(`/artifact-frame/${target.project}/${target.artifact}/${target.version}/%2e%2e/${target.page}`);
if (traversal.status !== 404) {
  throw new Error(`artifact frame traversal guard failed: ${traversal.status}`);
}

console.log('smoke ok');
