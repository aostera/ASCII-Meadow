// Scene descriptor validation and fail-closed route planning.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../../src/systems/scenes.js'), 'utf8');
const env = {};
vm.createContext(env);
vm.runInContext(source + '\nthis.api = { createSceneRegistry, SCENE_REGISTRY };', env);
const { createSceneRegistry, SCENE_REGISTRY } = env.api;
assert.deepEqual([...SCENE_REGISTRY.ids()], ['meadow']);
assert.equal(SCENE_REGISTRY.get('meadow').kind, 'outdoor');
assert.equal(SCENE_REGISTRY.resolve('meadow', 'castle-gate'), null);
const scenes = createSceneRegistry();
const portal = { to: 'crypt', at: 'door' };
const point = [12, -6];
const yard = scenes.register({ id: 'yard', kind: 'outdoor', portals: { arch: portal } });
assert.equal(scenes.resolve('yard', 'arch'), null);
scenes.register({ id: 'crypt', kind: 'interior', entries: { door: point } });
point[0] = 999; portal.to = 'other';
const route = scenes.resolve('yard', 'arch');
assert.equal(route.from, 'yard');
assert.equal(route.to, 'crypt');
assert.equal(route.entry, 'door');
assert.deepEqual([...route.world], [12, -6]);
assert(Object.isFrozen(yard) && Object.isFrozen(yard.portals.arch));
assert(Object.isFrozen(route.world) && Object.isFrozen(route));
assert.equal(scenes.resolve('yard', 'missing'), null);
assert.equal(scenes.resolve('unknown', 'arch'), null);
const before = [...scenes.ids()];
for (const [definition, reason] of [
  [{ id: '../x', kind: 'outdoor' }, /Invalid scene id/],
  [{ id: 'yard', kind: 'outdoor' }, /Duplicate scene id/],
  [{ id: 'bad-kind', kind: 'combat' }, /Invalid scene kind/],
  [{ id: 'bad-entry', kind: 'interior', entries: { spawn: [Infinity, 2] } }, /Invalid scene entry/],
  [{ id: 'bad-size', kind: 'interior', entries: { spawn: [1, 2, 3] } }, /Invalid scene entry/],
  [{ id: 'bad-link', kind: 'outdoor', portals: { arch: { to: 'crypt', at: '../x' } } }, /Invalid scene portal/],
  [{ id: 'bad-portals', kind: 'outdoor', portals: [] }, /Invalid scene portals/]
]) assert.throws(() => scenes.register(definition), reason);
assert.deepEqual([...scenes.ids()], before);
assert.equal(typeof scenes.activate, 'undefined');
console.log('PASS scene registry: valid IDs, immutable entry points, safe unresolved portals');
