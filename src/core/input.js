// Input: keyboard by physical key (any layout), mouse brushing the grass, touch drag to walk, taps.

// ---------- input ----------
const keys = new Set();
// Physical keys (e.code), so WASD, E and G work in any keyboard layout (a Russian layout types ц ф ы в)
const keyOf = e => ({ KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyE: 'e', KeyG: 'g' })[e.code] || e.key.toLowerCase();
addEventListener('keydown', e => {
  const k = keyOf(e);
  keys.add(k);
  if (e.code === 'Space') { if (!e.repeat) jump(); e.preventDefault(); }
  if (k === 'g' && !e.repeat) gust(player.x, player.y);
  if (e.key.startsWith('Arrow')) e.preventDefault();
  if (k === 'e' && !e.repeat) useSpot();
});
addEventListener('keyup', e => { keys.delete(keyOf(e)); keys.delete(e.key.toLowerCase()); });
addEventListener('pointerdown', () => window.focus());   // inside an embedded frame, a click hands it the keyboard
addEventListener('visibilitychange', () => keys.clear());
addEventListener('blur', () => keys.clear());
let ptr = null;
cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); ptr = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), held: false }; });
// a hovering mouse brushes the grass aside, harder the faster it moves
const mouse = { x: 0, y: 0, sp: 0, on: false, lx: 0, ly: 0 };
cv.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true; } });
cv.addEventListener('pointerleave', () => { mouse.on = false; });
cv.addEventListener('pointermove', e => { if (ptr) { ptr.x = e.clientX; ptr.y = e.clientY; if (Math.hypot(ptr.x - ptr.sx, ptr.y - ptr.sy) > 12) ptr.held = true; } });
const up = () => { const bx = activeSpot && activeSpot.box; if (ptr && bx && !ptr.held && ptr.x >= bx[0] && ptr.x <= bx[0] + bx[2] && ptr.y >= bx[1] && ptr.y <= bx[1] + bx[3]) { useSpot(); ptr = null; return; } if (ptr && !ptr.held && performance.now() - ptr.t < 250) { const gx = ptr.x / CW + camX, gy = ptr.y / CH + camY; if (Math.hypot(gx - player.x, (gy - player.y) * CH / CW) < 10) strike(); else gust(gx, gy); } ptr = null; };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
function strike() { jump(); }

// Where the player wants to go: keys, or a held drag (far from the knight, it runs). [mx, my, run]
function moveIntent() {
  let mx = 0, my = 0;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  if (keys.has('w') || keys.has('arrowup')) my -= 1;
  if (keys.has('s') || keys.has('arrowdown')) my += 1;
  let run = keys.has('shift');
  if (ptr && ptr.held) {
    const dx = ptr.x / CW + camX - player.x, dy = (ptr.y / CH + camY - player.y) * (CH / CW), dd = Math.hypot(dx, dy);
    if (dd > 1.5) { mx = dx; my = dy; }
    if (dd > 28) run = true;   // drag far from the knight to run
  }
  return [mx, my, run];
}
