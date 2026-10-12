// Standalone distribution must contain exactly the two committed NPC WebP files
// encoded as data URLs. The regular HTTP manifest must remain relative and unchanged.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const root = path.resolve(__dirname, '../..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'meadow-bundle-npc-'));
try {
  for (const body of [false, true]) {
    const target = path.join(temp, body ? 'body.html' : 'standalone.html');
    const result = spawnSync('python3', ['tools/bundle.py', target, ...(body ? ['--body'] : [])],
      { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const html = fs.readFileSync(target, 'utf8');
    const found = Array.from(html.matchAll(/source:\s*['"]data:image\/webp;base64,([A-Za-z0-9+/=]+)['"]/g));
    assert.equal(found.length, 2, 'standalone needs two embedded NPC WebP sprites');
    for (let index = 0; index < 2; index++) {
      const name = ['villager', 'hermit'][index] + '-starter.webp';
      const original = fs.readFileSync(path.join(root, 'assets/npc', name));
      const embedded = Buffer.from(found[index][1], 'base64');
      assert.deepEqual(embedded, original, 'atlas bytes differ: ' + name);
    }
    assert(!/source:\s*['"]assets\/npc\//.test(html),
      'standalone still contains external NPC atlas references');
    assert(!/<script\s+src=/.test(html), 'external script remains in standalone');
    assert(!/href="styles\//.test(html), 'external CSS remains in standalone');
    console.log('PASS ' + (body ? 'body fragment' : 'single-file HTML') +
      ': villager + hermit WebP embedded byte-for-byte');
  }
  const manifest = fs.readFileSync(path.join(root, 'src/data/npc-atlases.js'), 'utf8');
  assert(manifest.includes("source: 'assets/npc/villager-starter.webp'"));
  assert(manifest.includes("source: 'assets/npc/hermit-starter.webp'"));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
