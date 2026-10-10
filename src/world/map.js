// The edited map (src/data/map.js, MEADOW_MAP) laid over the generated world. Positions are castle ground
// units: px at MS = 1, from the foot of the castle mound, x to the right, z to the north. The cell grid
// follows the window, these units do not, so a map lands in the same place on every screen.
// Fields left null are generated as before; `paint` holds brush strokes over the generated ground.

// The map editor (editor/editor.js) is open to everyone while the world is being built: the button and M.
// When the project is done it goes behind a secret combination again; ?edit=0 turns it off for a page.
const EDIT = !/[?&]edit=0(&|$)/.test(location.search);
let editing = false;        // the editor is open: the knight stands still, the camera is the editor's
let bshadeCastle = null, kindBase = null;   // edit mode only: the castle's shade and the ground before the trees,
                                            // so trees can move without re-casting the castle or regenerating the field

// ground point → grid position of whoever stands there (feet at (y + 0.7) * CH); toModelXZ (castle.js) is the inverse
const mapToCell = (gx, gz) => [(gx * MS + cathedral.ox) / CW, (cathedral.oy - gz * SINP * MS) / CH - 0.7];

// ---------- paint: brush strokes over the generated ground ----------
// A sparse grid of PAINT_RES-unit cells, kept in PCH×PCH chunks; a chunk is stored run-length coded.
const PAINT_RES = 4, PCH = 32;
const PCODES = '.gtserfpxwm';   // none, grass, tall grass, short grass, earth, stones (r), flowers (f), trail, empty ground, water, marsh: paintCell's codes 0-10
const paintChunks = new Map();   // "cx,cz" → Uint8Array(PCH * PCH) of PCODES indices
function rleEncode(a, codes = PCODES) {
  let s = '';
  for (let i = 0; i < a.length;) { let n = 1; while (i + n < a.length && a[i + n] === a[i]) n++; s += codes[a[i]] + (n > 1 ? n : ''); i += n; }
  return s;
}
function rleDecode(s, codes = PCODES) {
  const a = new Uint8Array(PCH * PCH);
  for (let k = 0, i = 0; k < s.length && i < a.length;) {
    const c = Math.max(0, codes.indexOf(s[k++]));
    let n = 0; while (k < s.length && s[k] >= '0' && s[k] <= '9') n = n * 10 + s.charCodeAt(k++) - 48;
    n = Math.min(a.length - i, n || 1); a.fill(c, i, i + n); i += n;
  }
  return a;
}
function loadPaint(obj) { paintChunks.clear(); for (const k in obj || {}) paintChunks.set(k, rleDecode(obj[k])); }
function savePaint() { const o = {}; for (const [k, a] of paintChunks) if (a.some(c => c)) o[k] = rleEncode(a); return o; }
loadPaint(MEADOW_MAP.paint);

// ---------- fog: brushed over the generated fog ----------
// The same chunked layer, coarser (FOG_RES units a cell): clear it away, or lay light or dense fog.
const FOG_RES = 16, FCODES = '.cld';   // none (generated), clear, light, dense
const fogChunks = new Map();
function loadFog(obj) { fogChunks.clear(); for (const k in obj || {}) fogChunks.set(k, rleDecode(obj[k], FCODES)); }
function saveFog() { const o = {}; for (const [k, a] of fogChunks) if (a.some(c => c)) o[k] = rleEncode(a, FCODES); return o; }
loadFog(MEADOW_MAP.fog);
function fogCodeAt(gx, gz) {
  const px = Math.floor(gx / FOG_RES), pz = Math.floor(gz / FOG_RES), a = fogChunks.get((px >> 5) + ',' + (pz >> 5));
  return a ? a[(px & 31) + (pz & 31) * PCH] : 0;
}
// Fog density d (generated, 0..1) at world px (wx, wy) once the map's fog is laid over it: the four nearest
// fog cells blend, so a stroke has soft edges, and painted fog rolls with the same slow noise as the rest.
function mapFog(d, wx, wy) {
  const C = cathedral, gx = (wx - C.ox) / MS, gz = -(wy - C.oy) / (SINP * MS), h = FOG_RES * 0.5;
  const roll = 0.72 + 0.4 * vnoise(wx * 0.004 + t * 0.05, wy * 0.006 - t * 0.02);
  let sum = 0;
  for (const [ox, oz] of [[-h, -h], [h, -h], [-h, h], [h, h]]) {
    const c = fogCodeAt(gx + ox, gz + oz);
    sum += c === 1 ? 0 : c === 2 ? Math.max(d, 0.5 * roll) : c === 3 ? Math.max(d, Math.min(1, 0.95 * roll)) : d;
  }
  return sum / 4;
}

// The brush of paint code c on cell i, starting from the generated ground (groundCell) where it keeps the
// grass's own look; seed and noise scatter stones and flowers so a stroke never reads as a stamp.
function paintCell(i, x, y, c) {
  const s = seed[i];
  if (c === 1 || c === 2 || c === 3 || c === 6) {
    groundCell(x, y, i); kind[i] = 1;
    if (c === 2) { height[i] = Math.max(height[i], 0.72); segs[i] = s > 0.4 ? 4 : 3; }   // tall: up to the knight's knees
    else if (c === 3) { height[i] = Math.max(height[i], 0.62 + s * 0.12); segs[i] = 1; }                     // short, mown: one bent tip over the stem, and it catches the light
    else if (c === 6) kind[i] = s > 0.88 ? 3 : s > 0.8 ? 4 : s > 0.72 ? 6 : 1;          // flowers among the grass
  }
  else if (c === 4) kind[i] = 2;                                                       // bare earth
  else if (c === 5) kind[i] = s > 0.45 ? 5 : 2;                                        // stones on earth
  else if (c === 7) { kind[i] = 7; height[i] = Math.max(0, Math.min(1, 0.55 + 0.5 * vnoise(x * 0.11, y * 0.17))); segs[i] = 0; }   // trail
  else if (c === 8) { kind[i] = 0; segs[i] = 0; }                                       // nothing: bare dark ground
  else if (c === 9) { kind[i] = 8; segs[i] = 0; wet[i] = 1; }                            // water
  else if (c === 10) {                                                                  // marsh: water among tussocks and reeds
    wet[i] = 1;
    if (s < 0.16) { groundCell(x, y, i); wet[i] = 1; kind[i] = 1; height[i] = Math.max(height[i], 0.7); segs[i] = 3; }
    else if (s < 0.3) { groundCell(x, y, i); wet[i] = 1; kind[i] = 1; height[i] = Math.min(height[i], 0.5); segs[i] = 1; }
    else {   // open water, and in its still patches lily pads (segs 1 a pad, 3 a pad in flower)
      kind[i] = 8; segs[i] = 0;
      if (s > 0.3 && s < 0.6 && vnoise(x * 0.23 + 3, y * 0.31 - 7) > 0.56 && (x + y * 3) % 4 === 0 && y % 2 === 0) segs[i] = s < 0.36 ? 3 : 1;   // spaced: each pad spans a few cells
    }
  }
}
const trailOn = () => MEADOW_MAP.trail !== false;
const castleOff = () => MEADOW_MAP.castle || [0, 0];   // the castle moved from its place, in ground units ([x, z])   // the generated trail, unless the map turned it off
// Ground point of a cell's centre, and its paint code there.
const cellXZ = (x, y) => [((x + 0.5) * CW - cathedral.ox) / MS, -((y + 0.5) * CH - cathedral.oy) / (SINP * MS)];
function paintAt(gx, gz) {
  const px = Math.floor(gx / PAINT_RES), pz = Math.floor(gz / PAINT_RES), a = paintChunks.get((px >> 5) + ',' + (pz >> 5));
  return a ? a[(px & 31) + (pz & 31) * PCH] : 0;
}
// Every painted chunk, over the cells it covers (each cell's centre lies in exactly one paint cell).
function applyPaint() {
  if (!paintChunks.size) return;
  for (const key of paintChunks.keys()) {
    const [kx, kz] = key.split(',').map(Number), span = PCH * PAINT_RES;
    paintRect(kx * span, kz * span, (kx + 1) * span, (kz + 1) * span);
  }
}
// Re-lay the ground of the cells whose centres fall in a ground rectangle: generated, castle, trail, paint.
// `fresh` regenerates them first (the editor's live strokes); applyPaint paints over a fresh build.
function paintRect(gx0, gz0, gx1, gz1, fresh) {
  const C = cathedral, x0 = Math.max(0, Math.floor((gx0 * MS + C.ox) / CW - 1)), x1 = Math.min(COLS - 1, Math.ceil((gx1 * MS + C.ox) / CW));
  const y0 = Math.max(0, Math.floor((C.oy - gz1 * SINP * MS) / CH - 1)), y1 = Math.min(ROWS - 1, Math.ceil((C.oy - gz0 * SINP * MS) / CH));
  const g = Math.floor(C.trailRow || ROWS * 0.45);
  for (let y = y0; y <= y1; y++) {
    const cx = y >= g ? pathX(y) : 0, hw = y >= g ? pathHalfWidth(y, g) : 0;
    for (let x = x0; x <= x1; x++) {
      const [gx, gz] = cellXZ(x, y);
      if (gx < gx0 || gx >= gx1 || gz < gz0 || gz >= gz1) continue;
      const i = y * COLS + x;
      if (fresh) {
        groundCell(x, y, i);
        if (bmask[i]) kind[i] = 0;
        else if (trailOn() && y >= g && x >= Math.floor(cx - hw - 4) && x <= Math.ceil(cx + hw + 4)) carveCell(x, y, cx, hw);
      }
      if (bmask[i]) continue;
      const c = paintAt(gx, gz);
      if (c) paintCell(i, x, y, c);
      if (fresh && kindBase) kindBase[i] = kind[i];
    }
  }
}

// ---------- objects: fires, cows and the knight's start ----------
// Fires: from the map ([x, z] on the ground, [x, z, h] raised h units, a brazier on the terrace), or the
// generated ones: two on the terrace either side of the gate and a campfire by the trail where he starts.
function placeFires() {
  braziers.length = 0;
  if (!MEADOW_MAP.fires) {
    const C = cathedral;
    for (const sx of [-1, 1]) braziers.push({ isFire: true, x: (C.kx + sx * 108 * MS) / CW, y: (C.ky - 66 * SINP * MS) / CH - 0.7, lift: 120 * COSP * MS, parts: [], seed: sx });
    const sy = ROWS - VR * 0.3 - 5; braziers.push({ isFire: true, ground: true, x: pathX(sy) + 16, y: sy - 0.7, lift: 0, parts: [], seed: 3 });
    return;
  }
  MEADOW_MAP.fires.forEach(([gx, gz, h, kd], mi) => {
    const [x, y] = mapToCell(gx, gz);
    braziers.push(h > 0 ? { isFire: true, x, y, lift: h * COSP * MS, parts: [], seed: 3 + mi, mi } : { isFire: true, ground: true, cook: kd === 'cook', steam: [], x, y, lift: 0, parts: [], seed: 3 + mi, mi });   // 'cook': a pot over it
  });
}

// Everything the map changes, rebuilt without the atlases or the castle's rays (the editor, after loading a map).
function rebuildMap() {
  fillTerrain();
  for (let i = 0; i < N; i++) if (bmask[i]) kind[i] = 0;
  carvePath();
  applyPaint();
  kindBase.set(kind);
  rebuildFlora();
}
// The trees alone, over the ground as it was before them (the editor, after a tree moved).
function rebuildFlora() { kind.set(kindBase); bshade.set(bshadeCastle); placeFlora(); }
