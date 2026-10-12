// Collisions: field edges, castle walls (via the surface height), tree trunks, water and marsh, the campfire and cows.

const STEP_UP = 30;  // a stair tread is 24: anything higher is a wall to climb
// Physical flame/log and brazier-bowl footprints in grid cells (not the much
// larger light halo). All living movers share this test, including jumping knights.
// A segment check prevents fast moves from skipping a fire in one simulation tick.
function fireInside(x, y, b) {
  const rx = b.ground ? 5 : 3.4, ry = b.ground ? 2.4 : 1.7;
  const dx = (x - b.x) / rx, dy = (y - b.y - 0.7) / ry;
  return dx * dx + dy * dy < 1;
}
function fireBlocksMove(x, y, b, e) {
  if (!e || !Number.isFinite(e.x) || !Number.isFinite(e.y)) return fireInside(x, y, b);
  const rx = b.ground ? 5 : 3.4, ry = b.ground ? 2.4 : 1.7;
  const sx = (e.x - b.x) / rx, sy = (e.y - b.y - 0.7) / ry;
  const ex = (x - b.x) / rx, ey = (y - b.y - 0.7) / ry;
  const start = sx * sx + sy * sy, end = ex * ex + ey * ey;
  // A player placed inside a fire by an old save/editor can escape, but not move deeper.
  if (start < 1) return end <= start + 1e-8;
  const dx = ex - sx, dy = ey - sy, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, -(sx * dx + sy * dy) / l2)) : 0;
  const px = sx + dx * t, py = sy + dy * t;
  return px * px + py * py < 1;
}
function blocked(x, y, e) {
  if (x < 1 || y < 1 || x >= COLS - 1 || y >= ROWS - 1) return true;
  const h = surfAt(x, y);
  if (tmask && tmask[Math.round(y + 0.2) * COLS + Math.round(x)]) return true;  // tree trunks, tents
  if (fmask && fmask[Math.round(y + 0.2) * COLS + Math.round(x)] && !(e && jumpPx(e) > knightPx() * 0.12)) return true;   // a fence: over it only in a jump
  // water and marsh: no way in (yet); but one standing in it (a stroke painted over him) can always wade out
  if (wet && wet[Math.round(y + 0.2) * COLS + Math.round(x)] && !(e && wet[Math.round(e.y + 0.2) * COLS + Math.round(e.x)])) return true;
  for (const b of braziers) if (fireBlocksMove(x, y, b, e)) return true;   // campfires and raised braziers are solid for everyone
  if (e === player) for (const c of cows) if (inCow(c, x, y, 0) && !inCow(c, e.x, e.y, -0.5)) return true;   // cows are solid, but never trap him
  return !isFinite(h) || Math.abs(h - (e ? e.hT || 0 : 0)) > STEP_UP;
}
