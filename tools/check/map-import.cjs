// Deterministic, dependency-free checks for the editor map import workflow.
// The installed src/data/map.js is validated on every CI run. No files are written.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseExport, digest } = require('../map/import.cjs');

const base = {
  v: 1, res: 4, castle: null, start: [5, -20],
  fires: [[0, 0, 0, 'cook'], [5, 6], [108, 66, 120]],
  trail: null, cows: [[4, -20]], toads: [[3, 2, 'frog']],
  events: [['birds', 10, 20]], flora: [['tree', 0, 30, -40]],
  paint: { '0,0': 'g1024' }, fog: { '-1,-1': 'l1024' }
};
const source = obj => Buffer.from('// map from editor\nconst MEADOW_MAP = ' + JSON.stringify(obj, null, 2) + ';\n', 'utf8');
const original = source(base);
assert.deepEqual(parseExport(original), base);
assert.equal(digest(original), digest(Buffer.from(original)));
let cases = 2;
const invalid = (mutator, expected) => {
  const test = JSON.parse(JSON.stringify(base));
  mutator(test);
  assert.throws(() => parseExport(source(test)), expected);
  cases++;
};
invalid(m => { m.paint['0,0'] = 'g1025'; }, /exceeds 32x32/);
invalid(m => { m.paint['0,0'] = 'g1023'; }, /expected 1024/);
invalid(m => { m.paint['0,0'] = 'z1024'; }, /unknown cell code/);
invalid(m => { m.fog['-1,-1'] = 'l0'; }, /invalid run length/);
invalid(m => { m.start = ['not a number', -20]; }, /finite numbers/);
invalid(m => { m.v = 3; }, /unsupported map format/);
invalid(m => { delete m.flora; }, /missing field/);
invalid(m => { m.cows = [[3, Infinity]]; }, /finite numbers/); // JSON.stringify converts Infinity to null
invalid(m => { m.fires = [[0, 0, 0, 'arbitrary']]; }, /unknown fire kind/);
invalid(m => { m.events = [['birds', 0, 'bad']]; }, /finite numbers/);
assert.throws(() => parseExport(Buffer.from(original.toString() + 'alert("extra code");')), /no extra code/); cases++;
assert.throws(() => parseExport(Buffer.from('const MEADOW_MAP = {"v":1};\n// another assignment')), /no extra code/); cases++;
assert.throws(() => parseExport(Buffer.from('const MEADOW_MAP = {}; </script>')), /cannot be safely bundled/); cases++;

// Maps exported before NPC support must remain byte-for-byte compatible.
const v2 = { ...base, v: 2, actors: [['villager-1', 'villager', -10.5, -60], ['guard-2', 'guard', 15, 7]] };
assert.deepEqual(parseExport(source(v2)), v2); cases++;
const badV2 = (mutator, pattern) => {
  const v = JSON.parse(JSON.stringify(v2));
  mutator(v);
  assert.throws(() => parseExport(source(v)), pattern);
  cases++;
};
badV2(v => { delete v.actors; }, /requires actors array/);
badV2(v => { v.actors[1][0] = 'villager-1'; }, /duplicate id/);
badV2(v => { v.actors[0][2] = 'offmap'; }, /invalid coordinates/);
badV2(v => { v.actors[0][1] = '../secret'; }, /invalid type/);
badV2(v => { v.actors[0] = ['npc-1', 'villager']; }, /expected \[id, type, x, z\]/);
invalid(m => { m.actors = []; }, /v1 map cannot contain actors/);

const installedPath = path.resolve(__dirname, '../../src/data/map.js');
const installed = fs.readFileSync(installedPath);
const map = parseExport(installed);
assert.deepEqual(parseExport(Buffer.from(installed)), map);
cases++;
console.log('Map import checks passed: ' + cases + ' assertions; ' + installed.length + ' original bytes; SHA-256 ' + digest(installed));
