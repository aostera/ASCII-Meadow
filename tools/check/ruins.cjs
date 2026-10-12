// Pure landmark and swept-collision contract. The game browser suite tests raycast
// geometry and its composition with physics/rendering in both backends.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'src/world/ruins.js'), 'utf8');
const config = fs.readFileSync(path.join(root, 'src/data/ruins.js'), 'utf8');
const world = { Math, Number, SINP: Math.sin(.87), COSP: Math.cos(.87),
  CW: 5, WS: 2, toModelXZ: (x,z) => [x,z] };
vm.createContext(world);
vm.runInContext(config + '\n' + source +
  '\nthis.api = { sites: RUIN_SITES, ruinWallRectangles, ruinsBlockMove, ruinClearing, ruinSegmentRect };' +
  '\nruins.push(...RUIN_SITES.map(site => ({ ...site, walls: ruinWallRectangles(site) })));', world);
const { sites, ruinWallRectangles, ruinsBlockMove, ruinClearing } = world.api;
assert.deepEqual(Array.from(sites, s => s.type), ['gate','abbey','cloister']);
assert.equal(sites.length, 3);
const move = (s, x0, z0, x1, z1, cls='knight') => ruinsBlockMove(s.x+x1,s.z+z1,
  { x:s.x+x0, y:s.z+z0, cls, hT:10000, jump:1 });
for(const s of sites) {
  const outer=s.depth/2+25, safe=s.arch/2-14, stone=s.arch/2+12;
  for(const cls of ['knight','human','dwarf','cow']) {
    // Both ends and the middle of the same arch must be walkable; cows need room.
    assert(!move(s, 0,-outer,0,outer,cls), s.id+': the through-arch must be open for '+cls);
    assert(!move(s,safe,-outer,safe,outer,cls), s.id+': portal must be wide enough for '+cls);
    // Crossing each solid pier, each flanking exterior side, and the back wall
    // must block even a full-wall leap performed in a single physics step.
    assert(move(s,stone,-outer,stone,outer,cls), s.id+': right pier blocked');
    assert(move(s,-stone,-outer,-stone,outer,cls), s.id+': left pier blocked');
    assert(move(s,s.width/2+30,0,0,0,cls), s.id+': right exterior wall blocked');
    assert(move(s,-s.width/2-30,0,0,0,cls), s.id+': left exterior wall blocked');
  }
  assert(ruinClearing(s.x,s.z), 'ruin court must stay free of trees');
  assert(!ruinClearing(s.x+s.width,s.z+s.depth), 'far-away meadow stays planted');
  const walls=ruinWallRectangles(s);
  assert.equal(walls.length,s.type==='cloister'?8:s.type==='gate'?8:8);
  assert(walls.every(w=>w[0]<w[1]&&w[2]<w[3]), 'collision footprints valid');
}
console.log('PASS 3 gothic ruins: stone barriers, 8+ arches, all four actors, high-speed swept collision and clearing');
