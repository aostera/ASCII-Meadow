// The field: terrain kinds and grass heights per cell, the trail to the castle, and build(), which sizes
// the grid to the window and rebuilds every baked layer (atlases, castle, flora), with the edited map
// (world/map.js) laid over the generated ground.

// ---------- world ----------
// the trail: winds up from the south edge and straightens as it reaches the castle stair
function pathX(row) {
  const C = cathedral, g = C.trailRow || ROWS * 0.45, d = Math.max(0, Math.min(1, (row - g) / (ROWS - g)));
  const sw = sm(d);
  return COLS * 0.5 + (Math.sin(row * 0.019 + 1.3) * 0.26 + Math.sin(row * 0.047) * 0.09) * VC * sw;
}
// The editor paints the trail in world coordinates, while the old automatic path meandered
// in screen-grid coordinates. Showing both made duplicate roads and a wandering approach to
// the castle, especially after resizing. Keep the painter's trail verbatim and automatically
// join only the *unpainted gaps* between consecutive painted sections.
let authoredRoad = false, roadBridges = [];
function rebuildRoadBridges() {
  const rows = new Map();
  for (const [key, a] of paintChunks) {
    const [bx, bz] = key.split(',').map(Number);
    for (let i = 0; i < a.length; i++) if (a[i] === 7) {
      const z = bz * PCH + (i >> 5), x = bx * PCH + (i & 31);
      const e = rows.get(z);
      if (!e) rows.set(z, [x, x]); else { e[0] = Math.min(e[0], x); e[1] = Math.max(e[1], x); }
    }
  }
  authoredRoad = rows.size > 0; roadBridges = [];
  if (!authoredRoad) return;
  const zs = [...rows.keys()].sort((a, b) => a - b), sections = [];
  let lo = zs[0], hi = lo;
  for (let i = 1; i < zs.length; i++) {
    if (zs[i] === hi + 1) { hi = zs[i]; continue; }
    sections.push([lo, hi]); lo = hi = zs[i];
  }
  sections.push([lo, hi]);
  const edge = z => {
    const e = rows.get(z);
    return { z: (z + 0.5) * PAINT_RES, x: (e[0] + e[1] + 1) * PAINT_RES * 0.5, width: Math.max(8, Math.min(20, (e[1] - e[0] + 1) * PAINT_RES * 0.5)) };
  };
  for (let i = 1; i < sections.length; i++) {
    const from = edge(sections[i - 1][1]), to = edge(sections[i][0]);
    // Do not connect independent faraway roads across the whole world.
    if (to.z - from.z > PAINT_RES && to.z - from.z <= 900) roadBridges.push([from, to]);
  }
}
function guidedRoadAt(row) {
  if (!authoredRoad || !trailOn()) return null;
  const z = -((row + 0.7) * CH - cathedral.oy) / (SINP * WS);
  for (const [a, b] of roadBridges) {
    if (z <= a.z || z >= b.z) continue;
    const t = (z - a.z) / (b.z - a.z), smooth = t * t * (3 - 2 * t);
    const gx = a.x + (b.x - a.x) * smooth, width = a.width + (b.width - a.width) * smooth;
    return [(cathedral.ox + gx * WS) / CW, width * WS / CW];
  }
  return null;
}
function carvePath() {
  rebuildRoadBridges();
  if (!trailOn()) return;   // false: only the exact hand-painted road
  const g = Math.floor(cathedral.trailRow || ROWS * 0.45);
  for (let y = 0; y < ROWS; y++) {
    const guide = guidedRoadAt(y);
    if (authoredRoad && !guide) continue; // no second automatic road over the designer's paint
    if (!authoredRoad && y < g) continue;
    const cx = guide ? guide[0] : pathX(y), hw = guide ? guide[1] : pathHalfWidth(y, g);
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
let terrainSeedOffset = 0; // extra symmetric map border in glyph cells
function groundCell(x, y, i) {
  // Align procedural noise to the old world origin after adding invisible border cells.
  // The authored meadow must not be regenerated just because COLS has increased.
  const sx = x - terrainSeedOffset;
  const n = vnoise(sx * 0.035, y * 0.055) * 0.65 + vnoise(sx * 0.12, y * 0.18) * 0.25 + vnoise(sx * 0.4, y * 0.6) * 0.1;
  const rock = vnoise(sx * 0.09 + 50, y * 0.14 + 50);
  const r = hash(sx + 911, y + 37);
  seed[i] = hash(sx, y); wet[i] = 0;
  height[i] = Math.min(1, Math.max(0.12, n * 1.35 - 0.08 + (r - 0.5) * 0.4));
  let blade = 0;
  if (rock > 0.9 && r > 0.35) kind[i] = 5;                           // stones
  else if (n < 0.24 && r < 0.8) kind[i] = 2;               // bare earth
  else if (r > 0.988) kind[i] = 3;                        // white clover
  else if (r > 0.982 && n > 0.5) kind[i] = 4;             // buttercup
  else if (r > 0.978 && n > 0.6) kind[i] = 6;             // heather
  else { kind[i] = 1; blade = 1; }
  // tall meadow in broad patches: up to four glyphs high, enough to hide a knight's boots and knees
  const tall = Math.max(0, Math.min(1, (vnoise(sx * 0.018 + 9, y * 0.028) - 0.32) / 0.4));
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
  WS = Math.max(0.5, Math.min(1.25, H / 820)) * CASTLE_SCALE;  // map unit → px
  // castle model unit → px; gate ≈ 3.3 knights tall. On a narrow upright screen (a phone held upright) the
  // castle would be ten screens wide: it is drawn smaller there, the map's distances kept (WS).
  MS = WS * (W < H * 0.95 ? Math.max(0.55, Math.pow(W / (H * 0.95), 0.75)) : 1);
  // Authored objects extend to ±1157 map units. Give their full silhouettes a safe margin at every
  // aspect ratio; previously a narrow grid discarded plants near the edge during placeFlora().
  // Add cells equally on both sides. Use an EVEN amount so old glyph centres stay
  // on integer cells, then align procedural hashes to the original coordinate grid.
  // The minimum ±1250 world units includes authored objects at ±1157 with ample margin.
  const classicCols = Math.ceil(Math.max(VC * 2.2, (1800 * WS + W) / CW, 2320 * WS / CW));
  const wantedCols = Math.ceil(Math.max(classicCols, 2500 * WS / CW));
  terrainSeedOffset = Math.ceil((wantedCols - classicCols) / 2);
  COLS = classicCols + terrainSeedOffset * 2;
  // A FIXED southern extent, independent of the current exported list of objects.
  // Resizing ROWS from the content made the editor's world have a different number of
  // ground cells after export/reload (up to 470 extra earth cells in the smoke test).
  // The south edge is past every authored tree and camp object, with room to paint.
  const fixedSouthPx = (2150 + 2400 * SINP + 80) * WS + 40;
  ROWS = Math.ceil(Math.max(2180 * WS + 60 + H * 5, fixedSouthPx) / CH); N = COLS * ROWS;
  ang = new Float32Array(N); vel = new Float32Array(N); flat = new Float32Array(N);
  bshade = new Float32Array(N); bmask = new Uint8Array(N); FR = new Float32Array(N);
  TA = new Float32Array(COLS * 6);
  push = new Float32Array(N); shadow = new Float32Array(N);
  height = new Float32Array(N); seed = new Float32Array(N); kind = new Uint8Array(N); segs = new Uint8Array(N); wet = new Uint8Array(N);
  worldGen++;
  fillTerrain();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  buildAtlas();
  buildMegaAtlas();
  buildWorld();
  carvePath();
  applyPaint();     // world/map.js: brush strokes of the edited map
  buildFlora();
}
