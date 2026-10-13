// Check the REAL Cloudflare deployment against the checked-out source.
// CI used to validate only the local site: a green run did not establish
// that visitors received the authored map or latest rendering code.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ORIGIN = process.env.MEADOW_PROD_URL || 'https://ascii-meadow.aloster36.workers.dev';
const SHA = process.env.GITHUB_SHA || 'local';
const ROOT = path.resolve(__dirname, '../..');
const FILES = [
  'index.html',
  'build.json',
  'src/data/map.js',
  'src/renderer/render.js',
  'src/world/grass.js',
  'src/world/camp.js',
  'src/world/ruins.js',
  'src/world/flora.js',
  'src/world/shadows.js'
];
const digest = b => crypto.createHash('sha256').update(b).digest('hex').slice(0, 16);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function check() {
  const mismatches = [];
  for (const file of FILES) {
    // index.html is version-stamped during the production build;
    // everything else is copied unchanged (except the generated build.json).
    const builtFile = path.join(ROOT, 'dist', file);
    const expected = fs.readFileSync(file === 'index.html' || file === 'build.json'
      ? builtFile : path.join(ROOT, file));
    const url = ORIGIN + '/' + file + '?rev=' + encodeURIComponent(SHA) + '&check=' + Date.now();
    try {
      const r = await fetch(url, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
        signal: AbortSignal.timeout(15000)
      });
      if (!r.ok) {
        mismatches.push(file + ': HTTP ' + r.status);
        continue;
      }
      const actual = Buffer.from(await r.arrayBuffer());
      if (!actual.equals(expected)) {
        mismatches.push(file + ': local=' + digest(expected) +
          ' deployed=' + digest(actual) + ' (' + expected.length +
          ' vs ' + actual.length + ' bytes)');
      }
    } catch (err) {
      mismatches.push(file + ': ' + err.message);
    }
  }
  return mismatches;
}

(async () => {
  assert(ORIGIN.startsWith('https://'), 'Expected HTTPS production URL');
  const attempts = Number(process.env.MEADOW_PROD_ATTEMPTS || 24);
  for (let n = 1; n <= attempts; n++) {
    const wrong = await check();
    if (!wrong.length) {
      console.log('PASS: Cloudflare serves the EXACT current map and render scripts (' +
        SHA.slice(0, 12) + '), verified over HTTPS');
      return;
    }
    console.log('Production parity attempt ' + n + '/' + attempts +
      ' (' + SHA.slice(0, 12) + '):\n - ' + wrong.join('\n - '));
    if (n < attempts) await sleep(15000);
  }
  throw new Error('Cloudflare production is stale/unreachable. GitHub CI and Cloudflare build success do NOT establish that visitors receive the latest map.');
})().catch(error => { console.error(error); process.exitCode = 1; });
