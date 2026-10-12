// Production build must publish only the optional NPC atlas directory, not huge concept art.
// Writes a temporary fake WebP, verifies the copy, and restores the checkout.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const directory = path.join(root, 'assets/npc');
const wasPresent = fs.existsSync(directory);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ascii-meadow-assets-'));
const testFile = path.join(directory, '__check_atlas_copy__.webp');
try {
  fs.mkdirSync(directory, { recursive: true });
  assert(!fs.existsSync(testFile), 'CI fixture filename is already occupied');
  const bytes = Buffer.from('RIFFtestWEBP', 'ascii');
  fs.writeFileSync(testFile, bytes);
  const result = spawnSync('sh', ['tools/build_site.sh', temp], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const copied = path.join(temp, 'assets/npc/__check_atlas_copy__.webp');
  assert(fs.existsSync(copied), 'Authored NPC PNG missing from built static site');
  assert.deepEqual(fs.readFileSync(copied), bytes);
  const shipped = path.join(root, 'assets/npc/villager-starter.webp');
  const published = path.join(temp, 'assets/npc/villager-starter.webp');
  assert(fs.existsSync(published), 'Starter NPC asset missing from production site');
  assert.deepEqual(fs.readFileSync(published), fs.readFileSync(shipped),
    'Deployed NPC PNG must match committed artwork byte-for-byte');
  const shippedHermit = path.join(root, 'assets/npc/hermit-starter.webp');
  const publishedHermit = path.join(temp, 'assets/npc/hermit-starter.webp');
  assert(fs.existsSync(publishedHermit), 'Hermit NPC atlas missing from production build');
  assert.deepEqual(fs.readFileSync(publishedHermit), fs.readFileSync(shippedHermit));
  assert(!fs.existsSync(path.join(temp, 'assets/knight_idle_all_directions_atlas.png')),
    'Source concept art must not be copied wholesale into dist');
  assert(fs.existsSync(path.join(temp, 'src/data/npc-atlases.js')), 'Atlas startup manifest missing from dist');
  console.log('PASS published NPC atlas directory, manifest, byte-equivalence and excluded source atlases');
} finally {
  fs.rmSync(testFile, { force: true });
  if (!wasPresent) fs.rmdirSync(directory);
  fs.rmSync(temp, { recursive: true, force: true });
}
