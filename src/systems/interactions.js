// Reusable interaction system: existing world props and catalog NPCs share one
// proximity query and dispatch. No new UI, assets or default map content.
// Positions and radii are in the existing gameplay cell coordinates.
const INTERACTION_ACTIONS = new Map();
function registerInteractionAction(id, handler) {
  if (typeof id !== 'string' || !/^[a-z][a-z0-9-]{0,47}$/.test(id)) throw new Error('Invalid action id');
  if (typeof handler !== 'function' || INTERACTION_ACTIONS.has(id)) throw new Error('Duplicate/invalid action handler: ' + id);
  INTERACTION_ACTIONS.set(id, handler);
}
function interactionInRange(spot) {
  if (!spot || !Number.isFinite(spot.x) || !Number.isFinite(spot.y) ||
      !Number.isFinite(spot.r) || spot.r <= 0) return false;
  const dx = spot.x - player.x, dy = (spot.y - player.y) * CH / CW;
  return Math.hypot(dx, dy) < spot.r;
}
function interactionAvailable(spot) {
  return interactionInRange(spot) && (!spot.need || spot.need()) &&
    INTERACTION_ACTIONS.has(spot.action || 'use');
}
function pickInteraction() {
  let nearest = null, best = 1e9;
  for (const p of props) for (const spot of p.spots || []) {
    if (!interactionAvailable(spot)) continue;
    const d = Math.hypot(spot.x - player.x, (spot.y - player.y) * CH / CW);
    if (d < best) { best = d; nearest = spot; }
  }
  // Newly registered NPCs are interactive when they have authored dialogue.
  // No NPC is added to the shipped map by default. Build the candidate only
  // after the distance test, to avoid per-frame allocations for distant actors.
  for (const npc of npcs) {
    if (!npc.actorType || !npc.actorId || !npc.lines || !npc.lines.length) continue;
    const d = Math.hypot(npc.x - player.x, (npc.y - player.y) * CH / CW);
    if (d >= best || d >= npc.talkRadius) continue;
    best = d;
    nearest = { x: npc.x, y: npc.y, r: npc.talkRadius, label: 'talk to ' + npc.name,
      action: 'talk', target: npc, targetId: npc.actorId };
  }
  return nearest;
}
function performInteraction(spot) {
  if (!interactionAvailable(spot)) return false;
  if (spot.targetId && (!spot.target || spot.target.actorId !== spot.targetId ||
      !npcs.includes(spot.target))) return false; // despawned or replaced actor
  const handler = INTERACTION_ACTIONS.get(spot.action || 'use');
  return handler(spot) !== false;
}
// The use action retains the original callback contract for existing props.
// Inspect handles the gate without inventing interiors or new state.
registerInteractionAction('use', spot => {
  if (typeof spot.use !== 'function') return false;
  spot.use();
});
registerInteractionAction('inspect', spot => {
  if (typeof spot.onUse !== 'function') return false;
  spot.onUse();
});
registerInteractionAction('talk', spot => {
  const npc = spot.target;
  if (!npc || !npc.lines?.length) return false;
  const index = npc.dialogIndex || 0;
  say(npc, npc.lines[index % npc.lines.length]);
  npc.dialogIndex = index + 1;
  npc.sayCd = 10;
  npc.tx = npc.x; npc.ty = npc.y; npc.wait = 3;
  npc.aiState = 'talk';
});
// Open, take, trade, attack: register gameplay handlers only once designed,
// rather than claiming no-op actions are implemented.
