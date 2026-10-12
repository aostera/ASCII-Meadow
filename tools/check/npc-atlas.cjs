// Pure frame-atlas contract; no browser, image files or game state required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const script = fs.readFileSync(path.resolve(__dirname, '../../src/entities/npc-atlas.js'), 'utf8');
class FakeImage {
  naturalWidth = 256;
  naturalHeight = 96;
  onload = null;
  onerror = null;
  set src(value) { this.source = value; }
}
const context = { document: { createElement: () => new FakeImage() }, ACTOR_TYPES: new Map([['villager', {}]]), Math, Object };
vm.createContext(context);
vm.runInContext(script + '\nthis.api = { npcAtlasLayout, npcAtlasAttach, npcAtlasFrame, NPC_ATLASES };', context);
const { npcAtlasLayout, npcAtlasAttach, npcAtlasFrame, NPC_ATLASES } = context.api;
const spec = {
  frameWidth: 32, frameHeight: 32,
  states: {
    idle: { frames: 8, fps: 6, rows: [0] },
    walk: { frames: 4, fps: 10, rows: [1,2,1,2,1,2,1,2] },
    talk: { frames: 6, fps: 6, rows: [2] }
  }
};
const layout = npcAtlasLayout(spec);
assert(Object.isFrozen(layout) && Object.isFrozen(layout.states.walk.rows));
assert.equal(layout.states.walk.rows.length, 8);
spec.states.idle.rows[0] = 100;
assert.equal(layout.states.idle.rows[0], 0, 'mutating user input cannot modify library');
spec.states.idle.rows[0] = 0; // restore fixture before attach; normalized layout above remains frozen
const reject = (text, fn) => assert.throws(fn, /Invalid|Unknown/, text);
reject('unknown state', () => npcAtlasLayout({ ...spec, states: { attack: spec.states.idle } }));
reject('fractional frame size', () => npcAtlasLayout({ ...spec, frameWidth: 32.5 }));
reject('more than 60 frames', () => npcAtlasLayout({ ...spec, states: { idle: { frames: 61, fps: 24, rows: [0] } } }));
reject('invalid direction mapping', () => npcAtlasLayout({ ...spec, states: { idle: { frames: 3, fps: 5, rows: [0, 1] } } }));
reject('remote URL denied', () => npcAtlasAttach('villager', spec, 'https://external.test/atlas.png'));
reject('directory traversal denied', () => npcAtlasAttach('villager', spec, 'assets/npc/../player.png'));
reject('unknown type denied', () => npcAtlasAttach('ghost', spec, 'assets/npc/ghost.png'));
const attached = npcAtlasAttach('villager', spec, 'assets/npc/villager.png');
assert.equal(attached.status, 'loading');
assert.equal(npcAtlasFrame({ actorType: 'villager' }, 'idle'), null, 'no half loaded frames');
attached.image.onload();
assert.equal(attached.status, 'ready');
const a = { actorType: 'villager', d8: 3, actorAnimTime: 0.3 };
const walking = npcAtlasFrame(a, 'walk');
assert.equal(walking.frame, 3);
assert.equal(walking.y, 64, '8-way atlas selects row by d8');
assert.equal(walking.x, 96);
assert.equal(npcAtlasFrame(a, 'idle').y, 0);
assert.equal(npcAtlasFrame(a, 'talk', Math.PI).frame, 3);
assert.equal(npcAtlasFrame(a, 'talk', Math.PI).y, 64);
const exported = npcAtlasExportSettings('villager');
assert.deepEqual(Object.keys(JSON.parse(exported)).sort(), ['layout', 'type', 'version']);
assert(!exported.includes('assets/npc/') && !exported.includes('blob:') && !exported.includes('data:image/'),
  'JSON preset must never contain PNG payload or URLs');
const tuned = JSON.parse(exported);
tuned.layout.states.walk.frames = 2;
tuned.layout.states.walk.fps = 15;
npcAtlasImportSettings('villager', JSON.stringify(tuned));
assert.equal(npcAtlasFrame({ actorType: 'villager', d8: 3, actorAnimTime: 0.2 }, 'walk').frame, 1);
assert.equal(NPC_ATLASES.get('villager').layout.states.walk.fps, 15);
const saved = npcAtlasExportSettings('villager');
const rejectSettings = (why, value) => {
  assert.throws(() => npcAtlasImportSettings('villager', value), /Invalid|exceed|frame|JSON/, why);
  assert.equal(npcAtlasExportSettings('villager'), saved, why + ': invalid data must not partially apply');
};
rejectSettings('wrong NPC identity', { ...tuned, type: 'hermit' });
rejectSettings('unsupported version', { ...tuned, version: 2 });
rejectSettings('too many frames for image', { ...tuned, layout: {
  ...tuned.layout, states: { ...tuned.layout.states, walk: { ...tuned.layout.states.walk, frames: 9 } }
} });
rejectSettings('invalid JSON syntax', '{ invalid');
const incompatible = npcAtlasAttach('villager', spec, 'assets/npc/invalid.png');
incompatible.image.naturalWidth = 100;
incompatible.image.onload();
assert.equal(incompatible.status, 'error');
assert.equal(npcAtlasFrame(a, 'walk'), null, 'rig fallback for missing/corrupt atlas');
const latest = npcAtlasAttach('villager', spec, 'assets/npc/latest.png');
attached.image.onerror();
assert.equal(NPC_ATLASES.get('villager'), latest, 'stale async load must not replace a newer atlas');
console.log('PASS NPC PNG atlas contract: validates dimensions, source, states, directions, frames and fallback');
