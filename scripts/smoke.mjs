import http from 'node:http';

const port = Number(process.env.PORT || 5178);

function get(path) {
  return new Promise((resolve, reject) => {
    http
      .get({ hostname: '127.0.0.1', port, path }, (res) => {
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

const v1Css = await get('/artifact-frame/Flight_Deck/onboard001/v1/style.css');
if (v1Css.status !== 200 || !v1Css.body.includes('.masthead')) {
  throw new Error(`artifact frame v1 CSS failed: ${v1Css.status}`);
}

const v2Css = await get('/artifact-frame/Flight_Deck/onboard001/v2/style.css');
if (v2Css.status !== 200 || !v2Css.body.includes('.topline')) {
  throw new Error(`artifact frame v2 CSS failed: ${v2Css.status}`);
}

const traversal = await get('/artifact-frame/Flight_Deck/onboard001/v1/%2e%2e/v2/style.css');
if (traversal.status !== 404) {
  throw new Error(`artifact frame traversal guard failed: ${traversal.status}`);
}

console.log('smoke ok');
