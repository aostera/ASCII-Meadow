// The field: terrain kinds and grass heights per cell, the trail to the castle, and build(), which sizes
// the grid to the window and rebuilds every baked layer (atlases, castle, flora), with the edited map
// (world/map.js) laid over the generated ground.

// ---------- world ----------
// the trail: winds up from the south edge and straightens as it reaches the castle stair
function pathX(row) {
  const C = cathedral, g = C.gateRow || ROWS * 0.45, d = Math.max(0, Math.min(1, (row - g) / (ROWS - g)));
  const sw = sm(d);
  return COLS * 0.5 + (Math.sin(row * 0.019 + 1.3) * 0.26 + Math.sin(row * 0.047) * 0.09) * VC * sw;
}
function carvePath() {
  if (!trailOn()) return;   // world/map.js: the map can do without the generated trail
  const g = Math.floor(cathedral.gateRow || ROWS * 0.45);
  for (let y = g; y < ROWS; y++) {
    const cx = pathX(y), hw = pathHalfWidth(y, g);
    for (let x = Math.max(0, Math.floor(cx - hw - 4)); x <= Math.min(COLS - 1, Math.ceil(cx + hw + 4)); x++) carveCell(x, y, cx, hw);
  }
}
const pathHalfWidth = (y, g) => 6 + 2.5 * vnoise(y * 0.05, 3) + Math.max(0, 1 - (y - g) / 40) * 12;
function carveCell(x, y, cx, hw) {
  const i = y * COLS + x, d = Math.abs(x + 0.5 - cx) - hw + (vnoise(x * 0.3, y * 0.4) - 0.5) * 2.5;
  if (bmask[i]) return;
  if (d < 0) { kind[i] = 7; height[i] = Math.max(0, Math.min(1, 0.55 + 0.5 * vnoise(x * 0.11, y * 0.17) - Math.max(0, d + 2) * 0.12)); segs[i] = 0; }
  else if (kind[i] === 1) { segs[i] = 1; height[i] *= 0.35 + d * 0.15; }  // trodden verge
}
// One cell of the generated ground: seed, height, kind and blade length from the noise. Returns 1 for grass.
function groundCell(x, y, i) {
  const n = vnoise(x * 0.035, y * 0.055) * 0.65 + vnoise(x * 0.12, y * 0.18) * 0.25 + vnoise(x * 0.4, y * 0.6) * 0.1;
  const rock = vnoise(x * 0.09 + 50, y * 0.14 + 50);
  const r = hash(x + 911, y + 37);
  seed[i] = hash(x, y);
  height[i] = Math.min(1, Math.max(0.12, n * 1.35 - 0.08 + (r - 0.5) * 0.4));
  let blade = 0;
  if (rock > 0.9 && r > 0.35) kind[i] = 5;                           // stones
  else if (n < 0.24 && r < 0.8) kind[i] = 2;               // bare earth
  else if (r > 0.988) kind[i] = 3;                        // white clover
  else if (r > 0.982 && n > 0.5) kind[i] = 4;             // buttercup
  else if (r > 0.978 && n > 0.6) kind[i] = 6;             // heather
  else { kind[i] = 1; blade = 1; }
  // tall meadow in broad patches: up to four glyphs high, enough to hide a knight's boots and knees
  const tall = Math.max(0, Math.min(1, (vnoise(x * 0.018 + 9, y * 0.028) - 0.32) / 0.4));
  segs[i] = 1 + Math.round(tall * (0.4 + height[i] * 0.6) * 3.4);
  return blade;
}
function fillTerrain() {
  let blades = 0;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) blades += groundCell(x, y, y * COLS + x);
  build.blades = blades;
}
function build() {
  DPR = Math.min(devicePixelRatio || 1, 2);
  W = Math.max(1, innerWidth); H = Math.max(1, innerHeight);
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  if (GL.ok) GL.resize(); else { const gc = document.getElementById('g'); gc.width = cv.width; gc.height = cv.height; }
  FS = Math.max(8, Math.min(11, Math.sqrt(W * H / (0.59 * 24000))));
  CW = FS * 0.6; CH = FS * 0.92;
  VC = W / CW; VR = H / CH;                       // what the camera sees
  MS = Math.max(0.5, Math.min(1.25, H / 820)) * CASTLE_SCALE;  // castle model unit → px; gate ≈ 3.3 knights tall
  COLS = Math.ceil(Math.max(VC * 2.2, (1800 * MS + W) / CW)); ROWS = Math.ceil((2180 * MS + 60 + H * 5) / CH); N = COLS * ROWS; // castle far north, a long walk up to it
  ang = new Float32Array(N); vel = new Float32Array(N); flat = new Float32Array(N);
  bshade = new Float32Array(N); bmask = new Uint8Array(N); FR = new Float32Array(N);
  TA = new Float32Array(COLS * 6);
  push = new Float32Array(N); shadow = new Float32Array(N);
  height = new Float32Array(N); seed = new Float32Array(N); kind = new Uint8Array(N); segs = new Uint8Array(N);
  fillTerrain();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  buildAtlas();
  buildMegaAtlas();
  buildWorld();
  carvePath();
  applyPaint();     // world/map.js: brush strokes of the edited map
  buildFlora();
}
