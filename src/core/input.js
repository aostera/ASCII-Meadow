// Input: keyboard by physical key (any layout), mouse brushing the grass, a floating touch stick, taps.

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
// A mouse drag walks toward the pointer, as before. A finger gets a floating stick instead: it is born
// where the finger lands, the knight walks the way the finger is pushed from there, and pushed past
// STICK.run he runs. Past the rim the stick's centre trails the finger, so turning back is instant.
const STICK = { dead: 10, run: 46, rim: 72 };
const ptrs = new Map();   // pointerId -> { x, y, sx, sy, ox, oy, t, held, kind }
let ptr = null;           // the mouse drag, if any
let stick = null;         // the finger that steers
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId);
  const p = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, ox: e.clientX, oy: e.clientY, t: performance.now(), held: false, kind: e.pointerType };
  ptrs.set(e.pointerId, p);
  if (e.pointerType === 'mouse') ptr = p;
});
// a hovering mouse brushes the grass aside, harder the faster it moves
const mouse = { x: 0, y: 0, sp: 0, on: false, lx: 0, ly: 0 };
cv.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true; } });
cv.addEventListener('pointerleave', () => { mouse.on = false; });
cv.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId);
  if (!p) return;
  p.x = e.clientX; p.y = e.clientY;
  if (!p.held && Math.hypot(p.x - p.sx, p.y - p.sy) > STICK.dead) {
    p.held = true;
    if (p.kind !== 'mouse' && !stick) stick = p;   // the first finger that moves steers; others stay taps
  }
  if (p === stick) {
    const dx = p.x - p.ox, dy = p.y - p.oy, d = Math.hypot(dx, dy);
    if (d > STICK.rim) { p.ox = p.x - dx / d * STICK.rim; p.oy = p.y - dy / d * STICK.rim; }
  }
});
function tap(p) {
  const bx = activeSpot && activeSpot.box;
  if (bx && p.x >= bx[0] && p.x <= bx[0] + bx[2] && p.y >= bx[1] && p.y <= bx[1] + bx[3]) { useSpot(); return; }
  if (stick) { strike(); return; }   // a second finger while walking: the knight is under the thumb, so any tap jumps
  const gx = p.x / CW + camX, gy = p.y / CH + camY;
  if (Math.hypot(gx - player.x, (gy - player.y) * CH / CW) < 10) strike(); else gust(gx, gy);
}
const release = (e, cancelled) => {
  const p = ptrs.get(e.pointerId);
  if (!p) return;
  ptrs.delete(e.pointerId);
  if (p === stick) stick = null;
  if (p === ptr) ptr = null;
  if (!cancelled && !p.held && performance.now() - p.t < 300) tap(p);   // a cancelled touch was the browser's, not a tap
};
cv.addEventListener('pointerup', e => release(e, false));
cv.addEventListener('pointercancel', e => release(e, true));
for (const t of ['blur', 'visibilitychange']) addEventListener(t, () => { ptrs.clear(); ptr = stick = null; });
// Long-press menus, pinch and double-tap zoom would steal the field from the fingers.
cv.addEventListener('contextmenu', e => e.preventDefault());
for (const t of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(t, e => e.preventDefault());
document.addEventListener('touchmove', e => { if (e.target === cv) e.preventDefault(); }, { passive: false });
function strike() { jump(); }

// Where the player wants to go: keys, the touch stick (pushed far, it runs), or a mouse drag (far from the knight, it runs). [mx, my, run]
function moveIntent() {
  if (editing) return [0, 0, false];   // the map editor has the keys and the pointer (editor/editor.js)
  let mx = 0, my = 0;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  if (keys.has('w') || keys.has('arrowup')) my -= 1;
  if (keys.has('s') || keys.has('arrowdown')) my += 1;
  let run = keys.has('shift');
  if (stick) {
    const dx = stick.x - stick.ox, dy = stick.y - stick.oy, d = Math.hypot(dx, dy);
    if (d > STICK.dead) { mx = dx; my = dy; if (d > STICK.run) run = true; }
  } else if (ptr && ptr.held) {
    const dx = ptr.x / CW + camX - player.x, dy = (ptr.y / CH + camY - player.y) * (CH / CW), dd = Math.hypot(dx, dy);
    if (dd > 1.5) { mx = dx; my = dy; }
    if (dd > 28) run = true;   // drag far from the knight to run
  }
  return [mx, my, run];
}

// The touch stick, drawn over the field in the HUD's grey: a ring where the finger landed, a dot under it.
function drawStick() {
  if (!stick || editing) return;
  const dx = stick.x - stick.ox, dy = stick.y - stick.oy, d = Math.hypot(dx, dy), running = d > STICK.run;
  ctx.lineWidth = 1;
  ctx.strokeStyle = `rgba(250,250,250,${running ? 0.32 : 0.18})`;
  ctx.beginPath(); ctx.arc(stick.ox, stick.oy, STICK.rim, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(250,250,250,.08)';
  ctx.beginPath(); ctx.arc(stick.ox, stick.oy, STICK.run, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = `rgba(250,250,250,${running ? 0.5 : 0.32})`;
  ctx.beginPath(); ctx.arc(stick.ox + dx, stick.oy + dy, 14, 0, Math.PI * 2); ctx.fill();
}
