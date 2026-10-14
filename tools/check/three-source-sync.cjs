// Prevent the full-world Three.js migration from silently drifting away from
// the ORIGINAL game load order. Extra experiment modules are permitted, but
// every game script must be present and in the same order as the main page.
const fs=require('node:fs'),assert=require('node:assert/strict');
const main=fs.readFileSync('index.html','utf8');
const parity=fs.readFileSync('experiments/three/parity.html','utf8');
const scripts=html=>[...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m=>m[1]);
const original=scripts(main);
const migrated=scripts(parity).map(s=>s.replace(/^\.\.\/\.\.\//,''));
assert.ok(original.length>=45,'Unexpected incomplete original game');
assert.deepEqual(migrated,original,'Parity migration must use ALL original scripts in the original order');
const landing=scripts(fs.readFileSync('experiments/three/index.html','utf8'))
  .map(s=>s.replace(/^\.\.\/\.\.\//,''));
assert.deepEqual(landing,original,'Default preview must use the full original game, never synthetic scene');
assert.match(fs.readFileSync('experiments/three/procedural.html','utf8'),/src="\.\/app\.js"/,
  'Procedural research demo must remain accessible separately');
assert.match(parity,/<base href="\.\.\/\.\.\/"/);
assert.match(parity,/href="styles\/main\.css"/);
assert.match(parity,/src="src\/data\/map\.js"/);
assert.match(parity,/src="src\/main\.js"/);
assert.match(parity,/src="experiments\/three\/parity\.js"/);
assert.match(parity,/id="parity-three"/);
assert.match(parity,/id="parity-legacy"/);
const productionMap=fs.readFileSync('src/data/map.js','utf8');
assert.match(productionMap,/const MEADOW_MAP/);
const productionRenderer=fs.readFileSync('src/renderer/render.js','utf8');
assert.match(productionRenderer,/function render\(\)/);
assert.doesNotMatch(parity,/src="\.\.\/\.\.\/experiments\/three\/app\.js"/,
  'Synthetic world must not be loaded into the real-map migration path');
console.log('PASS parity: '+original.length+' original game scripts in matching order, exact map & original renderer source.');
