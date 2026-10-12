// Repository hygiene: prevent accidental reintroduction of obsolete exported
// frames and generated local files. Original master atlases are deliberately
// retained; they are inputs for the offline art tools and are not shipped.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const at = p => path.join(root, p);

const legacy = [
  'assets/v1',
  'assets/cow/die',
  'assets/cow/eat',
  'assets/cow/hurt',
  'assets/cow/idle',
  'assets/cow/run',
  'assets/cow/walk',
];
for (const p of legacy) {
  assert(!fs.existsSync(at(p)), `obsolete export unexpectedly returned: ${p}`);
}
const required = [
  'assets/cow/cow_animation_atlas.webp',
  'assets/cow_v2/cow_eat_atlas.webp',
  'assets/cow_v2/cow_idle_atlas.webp',
  'assets/cow_v2/cow_jump_atlas.webp',
  'assets/cow_v2/cow_run_atlas.webp',
  'assets/cow_v2/cow_walk_atlas.webp',
  'assets/dark_knight/dark_knight_idle_all_directions_atlas.png',
  'assets/crimson_knight/crimson_dark_knight_idle_atlas.png',
  'assets/npc/villager-starter.webp',
  'assets/npc/hermit-starter.webp',
];
for (const p of required)
  assert(fs.existsSync(at(p)), `required production/authoring source missing: ${p}`);

const walk = dir => fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => {
  const file = path.join(dir, e.name);
  if (e.name === '.git' || e.name === 'node_modules' || e.name === 'dist' || e.name === 'shots') return [];
  return e.isDirectory() ? walk(file) : [file];
});
const trackedCandidates = walk(root).map(file => path.relative(root, file).replaceAll(path.sep, '/'));
for (const file of trackedCandidates) {
  assert(!/(^|\/)(?:\.DS_Store|Thumbs\.db|__pycache__|\.env(?:\.|$))/.test(file) && !/\.py[cod]$/.test(file),
    `generated or secret file exists in working tree: ${file}`);
}
const unexpectedPngs = trackedCandidates.filter(p => p.startsWith('assets/') &&
  p.endsWith('.png') && !p.split('/').some(part => part.toLowerCase().includes('knight')));
assert.deepEqual(unexpectedPngs, [], 'All non-knight assets must be WebP');
const pngs = trackedCandidates.filter(p => p.endsWith('.png'));
const total = pngs.reduce((n, p) => n + fs.statSync(at(p)).size, 0);
console.log(`PASS repo hygiene: ${pngs.length} knight/reference PNGs (${(total / 1048576).toFixed(2)} MiB), no obsolete exports; master sources and NPC assets preserved`);
