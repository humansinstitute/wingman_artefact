import http from 'node:http';

const port = Number(process.env.PORT || 5178);
const base = `http://127.0.0.1:${port}`;

function get(path) {
  return new Promise((resolve, reject) => {
    http
      .get(`${base}${path}`, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      })
      .on('error', reject);
  });
}

const health = await get('/healthz');
if (health.status !== 200) throw new Error(`healthz failed: ${health.status}`);

const catalog = await get('/api/catalog');
if (catalog.status !== 200) throw new Error(`catalog failed: ${catalog.status}`);
const parsed = JSON.parse(catalog.body);
if (!parsed.rows.some((row) => row.project === 'Flight_Deck' && row.artifact === 'onboard001' && row.version === 'v1')) {
  throw new Error('missing Flight_Deck/onboard001/v1 catalog row');
}
if (!parsed.rows.some((row) => row.project === 'Flight_Deck' && row.artifact === 'onboard001' && row.version === 'v2')) {
  throw new Error('missing Flight_Deck/onboard001/v2 catalog row');
}

const route = await get('/artifacts/Flight_Deck/onboard001/v1/');
if (route.status !== 200 || !route.body.includes("Rick's Artifacts")) {
  throw new Error(`artifact route failed: ${route.status}`);
}

const frame = await get('/artifact-frame/Flight_Deck/onboard001/v1/index.html');
if (frame.status !== 200 || !frame.body.includes('/static/review-frame.js')) {
  throw new Error(`artifact frame injection failed: ${frame.status}`);
}

console.log('smoke ok');
