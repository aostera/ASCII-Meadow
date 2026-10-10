// Collisions: field edges, castle walls (via the surface height), tree trunks, water and marsh, the campfire and cows.

const STEP_UP = 30;  // a stair tread is 24: anything higher is a wall to climb
function blocked(x, y, e) {
  if (x < 1 || y < 1 || x >= COLS - 1 || y >= ROWS - 1) return true;
  const h = surfAt(x, y);
  if (tmask && tmask[Math.round(y + 0.2) * COLS + Math.round(x)]) return true;  // tree trunks, tents
  if (fmask && fmask[Math.round(y + 0.2) * COLS + Math.round(x)] && !(e && jumpPx(e) > knightPx() * 0.12)) return true;   // a fence: over it only in a jump
  // water and marsh: no way in (yet); but one standing in it (a stroke painted over him) can always wade out
  if (wet && wet[Math.round(y + 0.2) * COLS + Math.round(x)] && !(e && wet[Math.round(e.y + 0.2) * COLS + Math.round(e.x)])) return true;
  for (const b of braziers) if (b.ground && Math.abs(x - b.x) < 3 && Math.abs(y - b.y - 0.7) < 1.2) return true;   // not through the campfire
  if (e === player) for (const c of cows) if (inCow(c, x, y, 0) && !inCow(c, e.x, e.y, -0.5)) return true;   // cows are solid, but never trap him
  return !isFinite(h) || Math.abs(h - (e ? e.hT || 0 : 0)) > STEP_UP;
}
