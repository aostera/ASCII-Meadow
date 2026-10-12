// Every moving entity uses the same solid fire footprint. Includes fast travel
// across the flame, jumping, and escape from an old save spawned inside one.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src = fs.readFileSync(path.join(__dirname, '../../src/systems/collisions.js'), 'utf8');
const ground = { x: 40, y: 40, ground: true };
const raised = { x: 65, y: 50, lift: 120 };
const env = {
  COLS: 100, ROWS: 100, STEP_UP: 30, tmask: null, fmask: null, wet: null,
  braziers: [ground, raised], player: { x: 5, y: 5 },
  cows: [], inCow: () => false, jumpPx: () => 250, knightPx: () => 140,
  surfAt: () => 0, Math, Number, isFinite,
};
vm.createContext(env);
vm.runInContext(src + '\nthis.api = { blocked, fireInside, fireBlocksMove };', env);
const { blocked, fireInside, fireBlocksMove } = env.api;
for (const b of [ground, raised]) {
  const center = [b.x, b.y + .7];
  assert(fireInside(...center, b), 'fire and raised brazier footprint has solid center');
  assert(blocked(...center, null), 'static placement cannot overlap fire');
  for (const cls of ['knight', 'human', 'cow', 'dwarf']) {
    const actor = { x: b.x + 11, y: b.y + .7, hT: 0, cls, jump: cls === 'knight' ? .5 : 0 };
    assert(blocked(...center, actor), cls + ' cannot enter a fire, jumping or not');
    assert(fireBlocksMove(b.x - 11, b.y + .7, b, actor),
      'high-speed horizontal step may not tunnel across flame');
    assert(fireBlocksMove(b.x, b.y + 10, b,
      { ...actor, x: b.x, y: b.y - 10 }), 'high-speed vertical step may not tunnel across flame');
    assert(!fireBlocksMove(b.x + 11.5, b.y + .7, b, actor),
      'walking around the edge must remain possible');
  }
  const trapped = { x: b.x, y: b.y + .7, hT: 0 };
  assert(!fireBlocksMove(b.x + 0.5, b.y + .7, b, trapped),
    'previously inside character can move outward');
  assert(fireBlocksMove(b.x, b.y + .7, b, trapped), 'staying inside is not new valid movement');
  assert(!blocked(b.x + 10, b.y + .7, null), 'other nearby terrain must stay traversable');
}
console.log('PASS fire solids: campfires + raised braziers, knight/NPC/cow/dwarf, jump, swept motion and escape');
