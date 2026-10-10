// Grass: how bodies part the blades, which glyph a blade shows, and how it is lit.

// ---------- simulation ----------
const R_X = 11, R_Y = 6.5;
function brush(bx, by, s, dt) {  // like a foot without the weight: parts the blades, never flattens them
  const rx = R_X * 1.1, ry = R_Y * 1.1;
  const x0 = Math.max(0, Math.floor(bx - rx)), x1 = Math.min(COLS - 1, Math.ceil(bx + rx));
  const y0 = Math.max(0, Math.floor(by - ry)), y1 = Math.min(ROWS - 1, Math.ceil(by + ry * 0.6));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = (x + 0.5 - bx) / rx, dy = (y + 0.5 - by) / ry, d = Math.sqrt(dx * dx + dy * dy);
    if (d >= 1) continue;
    const i = y * COLS + x;
    push[i] += Math.sign(dx || 0.01) * (1 - d) * (1 - d) * 3.2 * s;
    if (d < 0.5 && s > 1) flat[i] = Math.min(0.5, flat[i] + (0.5 - d) * dt * 3 * (s - 1));  // a fast sweep leaves a faint wake that springs back
  }
}
function influence(e, dt) {
  if (jumpPx(e) > 2) return;
  if (e.cls === 'cow') {   // a cow parts the grass along its body; running it shoves hard and leaves a wake
    const run = e.state === 'run', half = cowHalf(), tx = KTX[e.d8 | 0], ty = KTY[e.d8 | 0] * 0.5;
    if (e.state === 'hop' && hopPx(e) > 2) return;
    for (const k of [-0.6, 0, 0.6]) brush(e.x + k * half * tx, e.y + k * half * ty, run ? 1.9 : e.moving ? 1.1 : 0.5, dt);
    return;
  }
  const s = e.moving ? 1 + 0.6 * (e.run || 0) : 0.55;   // a runner shoves the grass harder
  const x0 = Math.max(0, Math.floor(e.x - R_X)), x1 = Math.min(COLS - 1, Math.ceil(e.x + R_X));
  const y0 = Math.max(0, Math.floor(e.y - R_Y)), y1 = Math.min(ROWS - 1, Math.ceil(e.y + 2));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = (x + 0.5 - e.x) / R_X, dy = (y + 0.5 - e.y) / R_Y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d >= 1) continue;
    const i = y * COLS + x;
    push[i] += Math.sign(dx || 0.01) * (1 - d) * (1 - d) * 2.6 * s;
    if (d < 0.12) flat[i] = Math.min(1, flat[i] + dt * 1.4);
    // soft contact shadow, flattened ellipse around the feet
    const sx = (x + 0.5 - e.x) / 7, sy = (y + 0.5 - e.y - 0.3) / 2;
    const sd = sx * sx + sy * sy;
    if (sd < 1) shadow[i] = Math.max(shadow[i], (1 - sd) * 0.7);
  }
}

// ---------- glyphs ----------
const STEM = [CI['|'], CI['|'], CI['l'], CI['!'], CI['|'], CI['i']];
function stemGlyph(b, s, h, f) {
  if (f > 0.72) return s > 0.5 ? CI['_'] : CI['.'];
  if (f > 0.42) return s > 0.6 ? CI['~'] : CI['-'];
  if (h < 0.3) return Math.abs(b) > 0.5 ? (b > 0 ? CI['`'] : CI[',']) : (s > 0.5 ? CI["'"] : CI[',']);
  if (b > 1.0 || b < -1.0) return CI['_'];
  if (b > 0.36) return CI['/'];
  if (b < -0.36) return CI['\\'];
  return STEM[(s * STEM.length) | 0];
}
function tipGlyph(b, s) {
  if (b > 1.1 || b < -1.1) return CI['-'];
  if (b > 0.42) return CI['/'];
  if (b < -0.42) return CI['\\'];
  return s > 0.66 ? CI["'"] : s > 0.33 ? CI['i'] : CI['|'];
}

function light(i, x, y, cloud) {
  const h = height[i], f = flat[i], s = seed[i];
  const front = FR[i];
  let l = 0.24 + h * 0.52 + Math.max(0, ang[i]) * 0.16 + (front > 0.55 ? (front - 0.55) * 0.55 : 0)
        - f * 0.38 - shadow[i] - cloud * 0.75 - bshade[i] + (s - 0.5) * 0.16;
  return l < 0 ? 0 : l > 0.999 ? SH - 1 : (l * SH) | 0;
}

// Forces on the grass in view: cleared each step, then pushed by bodies and the hovering mouse.
function applyGrassForces(dt) {
  // the grass only lives in view: clear just that band, not the whole field
  const x0 = Math.max(0, VX0 - 12), x1 = Math.min(COLS, VX1 + 13), y0 = Math.max(0, VY0 - 10), y1 = Math.min(ROWS, VY1 + 12);
  for (let y = y0; y < y1; y++) { const o = y * COLS; push.fill(0, o + x0, o + x1); shadow.fill(0, o + x0, o + x1); }
  for (const e of ents) influence(e, dt);
  if (mouse.on) {
    const mx = mouse.x / CW + camX, my = mouse.y / CH + camY;
    const v = Math.hypot(mx - mouse.lx, (my - mouse.ly) * CH / CW) / Math.max(dt, 1e-3);
    mouse.sp += (Math.min(1, v / 120) - mouse.sp) * Math.min(1, dt * 10);
    mouse.lx = mx; mouse.ly = my;
    brush(mx, my, 0.75 + mouse.sp * 1.1, dt);
  }
}

// The blades in view: wind waves and fronts plus the pushes, through a damped spring.
function updateGrass(dt) {
  const amp = reduced ? 0.35 : 1;
  const k = 42, damp = Math.exp(-5.5 * dt);
  // the wind waves are sines of (x + y + t): split them with the angle-sum rule so each cell costs a few multiplies
  for (let x = VX0; x <= VX1; x++) {
    const a = x * 0.06 - t * 1.5, b = x * 0.17 - t * 2.3, c = x * 0.028 - t * 0.55, o = x * 6;
    TA[o] = Math.sin(a); TA[o + 1] = Math.cos(a); TA[o + 2] = Math.sin(b); TA[o + 3] = Math.cos(b); TA[o + 4] = Math.sin(c); TA[o + 5] = Math.cos(c);
  }
  for (let y = VY0; y <= Math.min(ROWS - 1, VY1 + 4); y++) {
    const ry = y * 0.035, rf = y * 0.012;
    const s1 = Math.sin(ry), c1 = Math.cos(ry), s2 = Math.sin(-2 * ry), c2 = Math.cos(-2 * ry), s3 = Math.sin(-rf), c3 = Math.cos(-rf);
    for (let x = VX0; x <= VX1; x++) {
      const i = y * COLS + x, kd = kind[i];
      if (kd === 0 || kd === 2 || kd === 5 || kd === 7) continue;
      const h = height[i], o = x * 6;
      const swell = (TA[o] * c1 + TA[o + 1] * s1) * 0.6 + (TA[o + 2] * c2 + TA[o + 3] * s2) * 0.25;
      const front = TA[o + 4] * c3 + TA[o + 5] * s3;
      FR[i] = front;
      const gb = front > 0.55 ? (front - 0.55) * 2.2 : 0;
      const wind = (0.16 + swell * 0.24 + gb * 0.95 + (seed[i] - 0.5) * 0.28) * amp;
      const target = wind * (0.45 + h) + push[i] * (0.55 + h * 0.65);
      vel[i] = (vel[i] + (target - ang[i]) * k * (0.8 + seed[i] * 0.4) * dt) * damp;
      ang[i] += vel[i] * dt;
      if (flat[i] > 0) flat[i] = Math.max(0, flat[i] - dt * 0.2);
    }
  }
}
