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
