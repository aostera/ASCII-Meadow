// Stage 1: data-driven NPC catalog. No NPC is spawned just by loading this file.
// Coordinates supplied to spawnActor are world units (the same as exported map.js),
// while an active entity lives in the render/physics glyph grid. No new rendering path.
const ACTOR_TYPES = new Map();
let actorSerial = 0;

function registerActorType(id, spec) {
  if (typeof id !== 'string' || !/^[a-z][a-z0-9-]{0,47}$/.test(id)) throw new Error('Invalid actor type: ' + id);
  if (ACTOR_TYPES.has(id)) throw new Error('Duplicate actor type: ' + id);
  if (!spec || typeof spec !== 'object' || typeof spec.name !== 'string' || !spec.name.trim()) throw new Error('Actor name required: ' + id);
  const behavior = spec.behavior || 'wander';
  if (behavior !== 'wander' && behavior !== 'idle') throw new Error('Unknown NPC behavior: ' + behavior);
  const tint = spec.tint || [160, 160, 160];
  if (!Array.isArray(tint) || tint.length !== 3 || tint.some(v => !Number.isInteger(v) || v < 0 || v > 255)) throw new Error('Invalid actor tint: ' + id);
  const lines = spec.lines || [];
  if (!Array.isArray(lines) || lines.some(line => typeof line !== 'string')) throw new Error('Invalid NPC dialogue: ' + id);
  if (spec.speed !== undefined && !(Number.isFinite(spec.speed) && spec.speed >= 0 && spec.speed <= 100)) throw new Error('Invalid actor speed: ' + id);
  const def = Object.freeze({
    name: spec.name,
    renderClass: spec.renderClass || 'human', // 'human' / 'dwarf' use the existing ASCII rig
    tint: Object.freeze(tint.slice()),
    lines: Object.freeze(lines.slice()),
    behavior,
    speed: spec.speed === undefined ? 8 : spec.speed,
    talkRadius: spec.talkRadius === undefined ? 14 : spec.talkRadius,
    wanderRadius: spec.wanderRadius === undefined ? 80 : spec.wanderRadius
  });
  if (!['human', 'dwarf'].includes(def.renderClass)) throw new Error('Actor requires a supported rig: ' + def.renderClass);
  if (!Number.isFinite(def.talkRadius) || def.talkRadius < 0 || !Number.isFinite(def.wanderRadius) || def.wanderRadius < 0) throw new Error('Invalid NPC ranges: ' + id);
  ACTOR_TYPES.set(id, def);
  return def;
}

function spawnActor(type, options = {}) {
  const def = ACTOR_TYPES.get(type);
  if (!def) throw new Error('Unknown actor type: ' + type);
  if (options === null || typeof options !== 'object') throw new Error('Actor options must be an object');
  const world = options.world;
  if (!Array.isArray(world) || world.length !== 2 || !world.every(Number.isFinite)) throw new Error('Actor world position must be [x,z]');
  const id = options.id === undefined ? type + '-' + (++actorSerial) : options.id;
  if (typeof id !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(id)) throw new Error('Invalid actor id: ' + id);
  if (id === 'player' || npcs.some(n => n.actorId === id)) throw new Error('Duplicate actor id: ' + id);
  const [x, y] = mapToCell(world[0], world[1]);
  const lines = options.lines === undefined ? def.lines.slice() : options.lines;
  if (!Array.isArray(lines) || lines.some(line => typeof line !== 'string')) throw new Error('Invalid actor lines');
  const actor = mk(options.name || def.name, def.renderClass, def.tint.slice(), {
    actorId: id, actorType: type, x, y, tx: x, ty: y,
    lines: lines.slice(), aiState: 'idle', behavior: options.behavior || def.behavior,
    speed: options.speed === undefined ? def.speed : options.speed, talkRadius: def.talkRadius,
    wanderRadius: def.wanderRadius, origin: world.slice(), sayT: 0, sayCd: 0
  });
  if (!['idle', 'wander'].includes(actor.behavior) || !Number.isFinite(actor.speed) || actor.speed < 0 || actor.speed > 100) throw new Error('Invalid NPC behavior override');
  npcs.push(actor);
  ents.push(actor); // the existing drawEntity/rig and grass occlusion work unchanged
  return actor;
}

function despawnActor(id) {
  const n = npcs.findIndex(a => a.actorId === id);
  if (n < 0) return false;
  const actor = npcs[n];
  npcs.splice(n, 1);
  const e = ents.indexOf(actor);
  if (e >= 0) ents.splice(e, 1);
  return true;
}

// Snapshot BEFORE build() changes CW/CH, restore AFTER build() reprojects coordinates.
function snapshotActorWorld() {
  return npcs.filter(a => a.actorId).map(a => [a.actorId, toModelXZ(a.x, a.y), toModelXZ(a.tx, a.ty)]);
}
function restoreActorWorld(snapshot) {
  for (const [id, pos, target] of snapshot) {
    const a = npcs.find(n => n.actorId === id);
    if (!a) continue;
    [a.x, a.y] = mapToCell(pos[0], pos[1]);
    [a.tx, a.ty] = mapToCell(target[0], target[1]);
  }
}

function updateRegisteredNpc(n, dt) {
  if (!(dt >= 0) || !Number.isFinite(dt)) return;
  const px = player.x - n.x, py = (player.y - n.y) * (CH / CW), distance = Math.hypot(px, py);
  n.sayCd -= dt; n.sayT -= dt;
  if (n.lines.length && distance < n.talkRadius && n.sayCd <= 0) {
    n.say = n.lines[(Math.random() * n.lines.length) | 0];
    n.sayT = 3; n.sayCd = 10; n.tx = n.x; n.ty = n.y; n.wait = 3;
    n.aiState = 'talk';
  }
  if (n.behavior === 'idle') {
    n.aiState = n.sayT > 0 ? 'talk' : 'idle';
    move(n, 0, 0, dt, 0);
    if (distance < 18) n.face = Math.sign(px) || n.face;
    return;
  }
  const dx = n.tx - n.x, dy = (n.ty - n.y) * (CH / CW);
  if (Math.hypot(dx, dy) < 1) {
    move(n, 0, 0, dt, 0);
    if (distance < 18) n.face = Math.sign(px) || n.face;
    if ((n.wait -= dt) <= 0) {
      // World-unit wander radius stays stable across viewport sizes.
      const [wx, wz] = toModelXZ(n.x, n.y);
      [n.tx, n.ty] = mapToCell(wx + (Math.random() * 2 - 1) * n.wanderRadius,
        wz + (Math.random() * 2 - 1) * n.wanderRadius);
      n.wait = 1.5 + Math.random() * 4;
      n.aiState = 'wander';
    } else n.aiState = n.sayT > 0 ? 'talk' : 'idle';
  } else {
    n.aiState = 'wander';
    move(n, dx, dy, dt, n.speed);
  }
}

// Only map-authored NPCs are recreated when the editor loads a new map.
// Programmatically spawned NPCs remain independent (not accidentally erased).
function syncMapActors() {
  for (const n of [...npcs]) if (n.fromMap) despawnActor(n.actorId);
  const rows = MEADOW_MAP.actors;
  if (!rows) return; // v1 map: no actors; original game is unchanged
  rows.forEach(([id, type, x, z], mi) => {
    const actor = spawnActor(type, { id, world: [x, z] });
    actor.fromMap = true; actor.mi = mi;
    // The game simulates 50 warm-up frames before the first visible frame.
    // Keep map-authored NPCs at their EXACT edited spawn position during that
    // warm-up; wandering begins only after the scene is visible.
    actor.wait = 3; actor.aiState = 'idle';
  });
}

// Sample archetype; it is deliberately NOT spawned in the shipped world.
// A designer can register additional types and call spawnActor(type, { world: [x,z] }).
registerActorType('villager', {
  name: 'Странник', renderClass: 'human', tint: [154, 154, 154],
  behavior: 'wander', speed: 8, lines: ['Доброй дороги.']
});
