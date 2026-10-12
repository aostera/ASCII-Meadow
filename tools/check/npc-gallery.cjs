const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const script = fs.readFileSync(path.resolve(__dirname, '../../src/editor/npc-gallery.js'), 'utf8');
const sandbox = { Math, Set };
vm.createContext(sandbox);
vm.runInContext(script + '\nthis.samples = edNpcGalleryFrames; this.phase = edNpcGalleryPhase;', sandbox);
const { samples, phase } = sandbox;
const sample = (count, limit) => Array.from(samples(count, limit));
assert.deepEqual(sample(60, 4), [0, 15, 30, 45]);
assert.deepEqual(sample(60, 2), [0, 30]);
assert.deepEqual(sample(8, 4), [0, 2, 4, 6]);
assert.deepEqual(sample(4, 4), [0, 1, 2, 3]);
assert.deepEqual(sample(3, 4), [0, 1, 2]);
assert.deepEqual(sample(1, 4), [0]);
for (let count = 1; count <= 60; count++) for (const limit of [2, 4]) {
  const picked = sample(count, limit);
  assert(picked.length <= limit && picked.length === new Set(picked).size,
    'samples should be unique');
  assert(picked.every(frame => frame >= 0 && frame < count));
  assert.equal(picked[0], 0, 'first frame is always represented');
  for (const frame of picked) {
    const p = phase(frame, count);
    const index = Math.floor(((p % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)) /
      (2 * Math.PI) * count) % count;
    assert.equal(index, frame, 'click should seek to the exact displayed frame');
  }
}
console.log('PASS NPC gallery: bounded contact sheets, 60-frame sample coverage, stable exact-frame selection');
