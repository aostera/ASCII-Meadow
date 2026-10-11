// Pure contract tests for the new actor catalog; no browser or game render required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../../src/entities/catalog.js'), 'utf8');
let scale = 1, moves = 0;
const player = { x: 0, y: 0 };
const npcs = [], ents = [player];
const env = {
  npcs, ents, player, CW: 5, CH: 10,
  mk: (name, cls, tint, options) => ({ name, cls, tint, moving: false, walk: 0, swing: 0, face: 1, step: 0, wait: 0, ...options }),
  mapToCell: (x, z) => [x * scale + 100, z * scale + 300],
  toModelXZ: (x, y) => [(x - 100) / scale, (y - 300) / scale],
  move: (actor, x, y, dt, speed) => { moves++; actor.moving = Math.hypot(x, y) > 0.01; if (actor.moving) { actor.x += x * dt * speed; actor.y += y * dt * speed; } }
};
vm.createContext(env);
vm.runInContext(source + '\nthis.actorApi = { registerActorType, spawnActor, despawnActor, snapshotActorWorld, restoreActorWorld, updateRegisteredNpc, ACTOR_TYPES };', env);
const api = env.actorApi;
const count = (title, value) => { assert(value, title); console.log('PASS ' + title); };
const reject = (title, fn, expression) => { assert.throws(fn, expression); console.log('PASS ' + title); };
count('no NPC spawned by catalog script', npcs.length === 0 && ents.length === 1);
count('built-in archetype registered', api.ACTOR_TYPES.get('villager').name === 'Странник');
reject('duplicate archetype denied', () => api.registerActorType('villager', { name: 'duplicate' }), /Duplicate/);
reject('invalid archetype denied', () => api.registerActorType('../bad', { name: 'bad' }), /Invalid actor type/);
reject('unsupported render rejected', () => api.registerActorType('bad-render', { name: 'bad', renderClass: 'cow' }), /supported rig/);
reject('unknown behavior rejected', () => api.registerActorType('bad-state', { name: 'bad', behavior: 'attack' }), /Unknown NPC behavior/);
reject('invalid tint rejected', () => api.registerActorType('bad-tint', { name: 'bad', tint: [999, 0, 0] }), /Invalid actor tint/);
reject('invalid speed rejected', () => api.registerActorType('bad-speed', { name: 'bad', speed: -1 }), /Invalid actor speed/);
reject('invalid dialogue rejected', () => api.registerActorType('bad-lines', { name: 'bad', lines: [42] }), /Invalid NPC dialogue/);
reject('missing world position denied', () => api.spawnActor('villager'), /world position/);
reject('invalid world position denied', () => api.spawnActor('villager', { world: [NaN, 0] }), /world position/);
reject('unknown archetype denied', () => api.spawnActor('unlisted', { world: [1, 2] }), /Unknown actor type/);
const a = api.spawnActor('villager', { id: 'npc-1', world: [23, -18], behavior: 'idle' });
count('NPC created in both collections exactly once', npcs.length === 1 && ents.length === 2 && npcs[0] === a && ents[1] === a);
count('spawn uses stable model coordinates', a.x === 123 && a.y === 282);
count('rig and catalog fields initialized', a.cls === 'human' && a.aiState === 'idle' && a.actorId === 'npc-1');
reject('duplicate NPC instance denied', () => api.spawnActor('villager', { id: 'npc-1', world: [0, 0] }), /Duplicate actor id/);
reject('player id reserved', () => api.spawnActor('villager', { id: 'player', world: [0, 0] }), /Duplicate actor id/);
reject('invalid behavior override denied', () => api.spawnActor('villager', { world: [0, 0], behavior: 'attack' }), /behavior override/);
count('invalid options did not leak NPC into collections', npcs.length === 1 && ents.length === 2);
const snapshot = api.snapshotActorWorld();
scale = 1.5;
api.restoreActorWorld(snapshot);
const roundtrip = api.snapshotActorWorld();
count('world coordinates preserved through a grid resize', JSON.stringify(snapshot) === JSON.stringify(roundtrip) && Math.abs(a.x - 134.5) < 1e-6);
player.x = a.x + 2; player.y = a.y;
api.updateRegisteredNpc(a, 1 / 60);
count('NPC with lines can talk to nearby player', a.aiState === 'talk' && a.say === 'Доброй дороги.');
a.sayT = 0;
api.updateRegisteredNpc(a, 1 / 60);
count('stationary NPC transitions to idle', a.aiState === 'idle' && !a.moving);
const b = api.spawnActor('villager', { id: 'npc-2', world: [11, -5], behavior: 'wander', speed: 3 });
b.wait = -1;
api.updateRegisteredNpc(b, 1 / 60);
count('wandering NPC acquires a target', b.aiState === 'wander' && Number.isFinite(b.tx) && Number.isFinite(b.ty));
const moves0 = moves;
api.updateRegisteredNpc(b, 1 / 60);
count('NPC movement delegates to existing physics', moves > moves0);
count('NPC removal detaches both collections', api.despawnActor(a.actorId) && npcs.length === 1 && ents.length === 2);
count('double removal is safe', !api.despawnActor(a.actorId));
api.despawnActor(b.actorId);
count('player remains the only entity after cleanup', npcs.length === 0 && ents.length === 1 && ents[0] === player);
