// Movement on the grid: speed, sliding along walls, heading (d8), stride distance and climbing treads.

// Directions are the game's d8: 0 S (towards the camera), 1 SW, 2 W, 3 NW, 4 N, 5 NE, 6 E, 7 SE.
const KTX = [0, -0.71, -1, -0.71, 0, 0.71, 1, 0.71], KTY = [1, 0.71, 0, -0.71, -1, -0.71, 0, 0.71];   // d8 → screen heading
// A heading (screen x, y) → d8, by the nearest of eight 45° sectors (0 = towards the camera, +2 = right).
const dirTo = (dx, dy) => ({ 0: 0, 1: 7, 2: 6, 3: 5, 4: 4, '-4': 4, '-1': 1, '-2': 2, '-3': 3 })[Math.round(Math.atan2(dx, dy) / (Math.PI / 4))];

function move(e, mx, my, dt, speed) {
  const len = Math.hypot(mx, my);
  e.moving = len > 0.01;
  if (e.moving) {
    const nx = e.x + mx / len * speed * dt, ny = e.y + my / len * speed * dt * (CW / CH);
    const ox = e.x, oy = e.y;
    if (!blocked(nx, ny, e)) { e.x = nx; e.y = ny; }
    else if (!blocked(nx, e.y, e)) e.x = nx;   // slide along the wall
    else if (!blocked(e.x, ny, e)) e.y = ny;
    e.step += dt * speed * 0.55;
    e.wd = (e.wd || 0) + Math.hypot((e.x - ox) * CW, (e.y - oy) * CH);   // px of ground covered: drives the stride
    if (Math.abs(mx) >= Math.abs(my) * 0.75) { e.dir = 'side'; e.face = Math.sign(mx); }
    else e.dir = my > 0 ? 'down' : 'up';
    if (Math.abs(mx) > len * 0.3) e.face = Math.sign(mx);
    e.d8 = dirTo(mx, my);
  }
  e.x = Math.max(4, Math.min(COLS - 5, e.x));
  e.y = Math.max(8, Math.min(ROWS - 3, e.y));
  const hs = surfAt(e.x, e.y);
  if (isFinite(hs)) e.hT = hs;
  e.h = (e.h || 0) + (e.hT - (e.h || 0)) * Math.min(1, dt * 14);   // climb each tread smoothly
}
const liftPx = e => (e.h || 0) * COSP * MS;
