// Pure Node test of the same frame-quality diagnostics used by the editor.
// Deliberately no Chromium, filesystem artwork, player/cow atlas or map required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const script = fs.readFileSync(path.resolve(__dirname, '../../src/entities/npc-atlas-audit.js'), 'utf8');
const context = { Math, Object, Set };
vm.createContext(context);
vm.runInContext(script + '\nthis.audit = npcAuditFrames;', context);
const audit = context.audit;
const sample = (x = 2, y = 2, color = 100, transparent = false) => {
  const width = 8, height = 8, data = new Uint8ClampedArray(width * height * 4);
  if (!transparent) for (let j = y; j < y + 3; j++) for (let i = x; i < x + 3; i++) {
    const k = (j * width + i) * 4;
    data[k] = color; data[k + 1] = color; data[k + 2] = color; data[k + 3] = 255;
  }
  return { width, height, data };
};
const getCodes = result => result.findings.map(f => f.code);
const one = { states: { idle: { frames: 2, fps: 6, rows: [0] } } };
let r = audit(one, ({ frame }) => sample(2, 2, 90 + frame * 50));
assert.equal(r.inspected, 2);
assert.equal(r.errors, 0);
assert.equal(r.warnings, 0);
r = audit(one, ({ frame }) => sample(2, 2, 90, frame === 1));
assert(getCodes(r).includes('blank-frame'));
assert.equal(r.empty, 1);
assert.equal(r.errors, 1);
assert.equal(r.findings.find(f => f.code === 'blank-frame').frame, 2);
r = audit(one, () => sample(2, 2, 100, true));
assert(getCodes(r).includes('empty-direction'));
assert.equal(r.empty, 2);
r = audit(one, () => sample(2, 2, 100));
assert(getCodes(r).includes('duplicate-frame'));
assert.equal(r.errors, 0, 'repeated idle keyframes are warnings, not blockers');
const eight = { states: { walk: { frames: 2, fps: 12, rows: [0,1,2,3,4,5,6,7] } } };
r = audit(eight, ({ direction, frame }) => sample(2, 2, 30 + direction * 20 + frame * 3));
assert.equal(r.inspected, 16);
assert(!getCodes(r).includes('duplicate-direction'));
r = audit(eight, ({ frame }) => sample(2, 2, 60 + frame * 10));
assert(getCodes(r).includes('duplicate-direction'));
assert.equal(r.findings.find(f => f.code === 'duplicate-direction').direction, 'all');
const movement = { states: { walk: { frames: 2, fps: 10, rows: [0] } } };
r = audit(movement, ({ frame }) => sample(frame === 0 ? 0 : 5, 2, 90 + frame));
assert(getCodes(r).includes('bounds-jump'));
assert.throws(() => audit(one, () => ({ width: 8, height: 8, data: [] })), /Invalid PNG sample/);
console.log('PASS NPC atlas quality audit: clean, blank, empty direction, repeat, duplicate direction, shape shift, invalid sample');
