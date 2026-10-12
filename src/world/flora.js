// Flora: trees, dead trees and bushes baked once in fine dither, swayed by the wind as rigid sprites.

// ---------- flora: trees, dead trees and bushes in fine dither ----------
// Same grain as the knight: tiny glyphs on a fine grid, tone carried by how densely the dots sit.
// Crowns are noise-shaped clouds lit from the upper left with dappled light and gaps you can see
// branches through; bare trees are nets of thin crooked branches. Each variant is baked once.
const fid = (c, l) => KN0 + FCI[c] * KLV + Math.max(0, Math.min(KLV - 1, l));
const VARS = [], flora = [], LILIES = [];   // LILIES: three pads, then two in flower (bakeLily)
let tmask = null, fmask = null, campGround = null, FLMAXR = 0;   // tmask: trunks and tents; fmask: fences, which a jump clears
const fbm3 = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 3.7, y * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3 + 1.3) * 0.15;
function bakeVariant(type, sd) {
  const rnd = (k) => hash(sd * 31 + k, 977);
  const K = knightPx(), fd = charDims(player), fw = fd.fcw, fh = fd.fch;
  const cell = new Map();                            // fine cell → [ci, level, solid]
  const set = (cx, cy, c, l, solid, a = 1) => cell.set((cy + 2000) * 4000 + cx + 2000, [c, l, solid, cx, cy, a]);
  const has = (cx, cy) => cell.get((cy + 2000) * 4000 + cx + 2000);
  // branches: crooked 2D strokes that fork, thinning as they go
  const strokes = [];
  const grow = (x, y, a, len, w, depth, spread) => {
    let px = x, py = y, ang = a;
    const steps = Math.max(2, Math.ceil(len / (fh * 0.7)));
    for (let i = 0; i < steps; i++) {
      ang += (rnd(depth * 97 + i * 13 + x) - 0.5) * 0.35;
      const nx = px + Math.sin(ang) * len / steps, ny = py - Math.cos(ang) * len / steps;
      strokes.push([px, py, nx, ny, w * (1 - i / steps * 0.35)]);
      px = nx; py = ny;
    }
    if (depth <= 0) return;
    const nb = 2 + (rnd(depth * 7 + len) > 0.55 ? 1 : 0);
    for (let k = 0; k < nb; k++) {
      const s = (k - (nb - 1) / 2) * spread + (rnd(depth * 31 + k + len) - 0.5) * 0.5;
      grow(px, py, ang + s, len * (0.62 + rnd(depth * 11 + k) * 0.2), Math.max(fw * 0.7, w * 0.6), depth - 1, spread * 0.95);
    }
  };
  let crown = null, trunkTop = 0, R = 0;
  if (type === 'tree') {
    R = K * (0.55 + rnd(1) * 0.25); const cy = -K * (1.05 + rnd(2) * 0.35);
    crown = { x: (rnd(5) - 0.5) * R * 0.2, y: cy, rx: R, ry: R * 0.78 };
    trunkTop = cy + R * 0.25;
    grow(0, 0, (rnd(4) - 0.5) * 0.15, -trunkTop * 0.85, R * 0.22, 3, 0.55);
  } else if (type === 'dead') {
    R = K * (0.45 + rnd(1) * 0.2);
    grow(0, 0, (rnd(4) - 0.5) * 0.25, K * (0.6 + rnd(2) * 0.25), K * 0.08, 5, 0.7);
  } else {
    R = K * (0.22 + rnd(1) * 0.12);
    crown = { x: 0, y: -R * 0.55, rx: R, ry: R * 0.68 };
  }
  // rasterise strokes: bright lit edge on the left, slope glyphs, dark core
  for (const [ax, ay, bx, by, w] of strokes) {
    if (crown && by < trunkTop && ((bx - crown.x) / crown.rx) ** 2 + ((by - crown.y) / crown.ry) ** 2 > 0.7) continue;  // leafy trees keep their limbs inside the crown
    if (crown && by >= trunkTop && Math.abs(bx) > R * 0.18) continue;                    // and no limbs below it
    const L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(L / (fh * 0.5)));
    const dx = bx - ax, dy = by - ay, sl = Math.abs(dx) < Math.abs(dy) * 0.4 ? '|' : Math.abs(dy) < Math.abs(dx) * 0.4 ? '-' : (dx > 0) === (dy < 0) ? '/' : '\\';
    for (let i = 0; i <= n; i++) {
      const x = ax + dx * i / n, y = ay + dy * i / n, hw = Math.max(fw * 0.5, w / 2);
      for (let o = -hw; o <= hw; o += fw) {
        const cx = Math.round((x + o) / fw), cy = Math.round(y / fh), edge = (o + hw) / (2 * hw);
        // near-black wood with a thin cold rim on the lit side
        const big = w > fw * 2.5, rim = big && edge < 0.22;
        const lit = rim ? 4 : big ? 0 : (hash(cx, cy) > 0.7 ? 2 : 1);
        const c = big ? (rim ? '|' : hash(cx, cy) > 0.75 ? '.' : ' ') : sl;
        set(cx, cy, c, lit, big, rim ? 0.9 : big ? 0.4 : type === 'dead' ? 0.6 + hash(cx, cy) * 0.3 : 0.65);
      }
    }
  }
  // crown: a cloud of dots
  if (crown) {
    const { x: X, y: Y, rx, ry } = crown, s = (type === 'bush' ? 2.2 : 3.2) / R;
    for (let cy = Math.floor((Y - ry * 1.35) / fh); cy <= Math.ceil((Y + ry * 1.25) / fh); cy++) for (let cx = Math.floor((X - rx * 1.35) / fw); cx <= Math.ceil((X + rx * 1.35) / fw); cx++) {
      const px = cx * fw, py = cy * fh, u = (px - X) / rx, w = (py - Y) / ry, r = Math.hypot(u, w);
      const n = fbm3(px * s + sd * 5.1, py * s * 1.15 + sd);
      const dens = (1 - r) * 1.4 + (n - 0.5) * 1.5;
      if (dens <= 0) continue;
      // relief: noise seen from the light, plus the round mass of the crown
      const nl = fbm3((px - R * 0.05) * s + sd * 5.1, (py - R * 0.07) * s * 1.15 + sd);
      const relief = (n - nl) * 4, mass = 0.5 - u * 0.35 - w * 0.45;
      const dapple = Math.max(0, vnoise(px * s * 2.2 + 7, py * s * 2.2) - 0.62) * 1.6;
      // a dark mass: only the top-left shoulder and a few dapples catch any light
      let v = 0.06 + Math.max(0, mass) * 0.4 + relief * 0.45 + dapple * 1.3 + (n - 0.5) * 0.2;
      v *= Math.min(1, dens * 1.8);                 // the edge dissolves into the dark
      v = Math.max(0, v) ** 1.35 * 1.35;            // crush the mids towards black
      if (dens < 0.18 && has(cx, cy)) continue;     // branches show through the gaps
      v = Math.max(0, Math.min(0.95, v + BAYER[(cy & 3) * 4 + (cx & 3)] * 0.4));
      const ci = Math.min(RAMP.length - 1, Math.floor(v * 7));
      set(cx, cy, ci > 0 ? RAMP[ci] : ' ', Math.min(KLV - 2, Math.floor(v * 7)), dens > (type === 'bush' ? 0.3 : 0.12), 0.4 + v * 0.75);
    }
  }
  // flatten into glyphs, dark backing runs, and the coarse grass cells the crown hides
  const list = [], runs = [], rows = new Map();
  let minY = 0;
  for (const [c, l, solid, cx, cy, a] of cell.values()) {
    if (c !== ' ' && a > 0.05) list.push(cx, cy, fid(c, l), Math.round(Math.min(1, a) * 100));
    if (solid) { const r = rows.get(cy) || []; r.push(cx); rows.set(cy, r); }
    if (cy < minY) minY = cy;
  }
  for (const [cy, xs] of rows) {
    xs.sort((a, b) => a - b);
    let s0 = xs[0], p = xs[0];
    for (let k = 1; k <= xs.length; k++) { if (k < xs.length && xs[k] === p + 1) { p = xs[k]; continue; } runs.push(cy, s0, p + 1); if (k < xs.length) s0 = p = xs[k]; }
  }
  const hide = [];
  if (crown) for (let gy = Math.floor((crown.y - crown.ry) / CH); gy < -1; gy++) for (let gx = Math.floor((crown.x - crown.rx) / CW); gx <= Math.ceil((crown.x + crown.rx) / CW); gx++) {
    let all = true;
    for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const c = has(Math.round((gx + ox) * CW / fw), Math.round((gy + oy) * CH / fh)); if (!c || !c[2]) { all = false; break; } }
    if (all) hide.push(gx, gy);
  }
  return { type, list: Int32Array.from(list), runs: Int16Array.from(runs), hide: Int16Array.from(hide), fw, fh, minY, R, Hc: crown ? -crown.y : K * 0.8, crownH: -minY * fh };
}

// A lily pad in the same fine dither: a flat leaf seen at a slant, a wedge cut to its middle, a pale rim on
// the lit edge; in flower, a small cup of pale petals sits on it. Dark, like everything on the marsh.
function bakeLily(flower, sd) {
  const rnd = (k) => hash(sd * 31 + k, 977);
  const K = knightPx(), fd = charDims(player), fw = fd.fcw, fh = fd.fch;
  const rx = K * (0.13 + rnd(1) * 0.06), ry = rx * 0.45, cut = rnd(2) * 6.283, list = [], runs = [];
  for (let cy = Math.floor(-ry * 1.1 / fh); cy <= Math.ceil(ry * 1.1 / fh); cy++) {
    let r0 = 1e9, r1 = -1e9;
    for (let cx = Math.floor(-rx * 1.1 / fw); cx <= Math.ceil(rx * 1.1 / fw); cx++) {
      const u = cx * fw / rx, w = cy * fh / ry, r = Math.hypot(u, w);
      if (r > 1) continue;
      let da = Math.atan2(w, u) - cut; da = Math.abs(Math.atan2(Math.sin(da), Math.cos(da)));
      if (da < 0.32 && r > 0.12) continue;                                  // the notch
      r0 = Math.min(r0, cx); r1 = Math.max(r1, cx);
      const rim = r > 0.72 && u + w < -0.2, vein = Math.abs(Math.sin(Math.atan2(w, u) * 4)) < 0.12 && r < 0.8;
      let v = 0.2 + (rim ? 0.16 : 0) - (vein ? 0.08 : 0) - Math.max(0, u + w) * 0.06;   // dark leaves (the toads on them must read); veins darker still
      v = Math.max(0, Math.min(0.9, v + BAYER[(cy & 3) * 4 + (cx & 3)] * 0.12));
      // a leaf is solid, not dithered air: dense glyphs, the tone carries the light
      list.push(cx, cy, fid(rim ? '@' : vein ? ':' : '%', Math.floor(v * 7)), Math.round(Math.min(1, 0.55 + v * 0.6) * 100));
    }
    if (r1 >= r0) runs.push(cy, r0, r1 + 1);
  }
  if (flower) for (let k = 0; k < 15; k++) {                               // the cup: two rings of pale petals round a brighter heart, up off the leaf
    const ring = k ? (k < 7 ? 1 : 2) : 0, a = k / (ring === 1 ? 6 : 8) * 6.283 + rnd(5) + ring;
    const cx = Math.round(Math.cos(a) * ring * 1.1 - rx * 0.1 / fw), cy = Math.round(Math.sin(a) * ring * 0.6 - ry * 0.9 / fh - (ring === 1 ? 1 : 0));
    list.push(cx, cy, fid(ring ? (ring === 1 ? '#' : '*') : '@', ring === 2 ? 4 : 6), ring === 2 ? 70 : 95);
  }
  let minY = 0; for (let k = 1; k < list.length; k += 4) minY = Math.min(minY, list[k]);
  return { type: 'lily', list: Int32Array.from(list), runs: Int16Array.from(runs), hide: new Int16Array(0), fw, fh, minY, R: rx, Hc: ry, crownH: Math.max(1, -minY * fh) };
}

// Every variant is baked once into the glyph atlas as a picture, cut into horizontal slices.
// A tree is then ~14 quads instead of ~1200 glyphs; each slice shifts with the wind by its height.
const NSL = 14;
function bakeFloraSprites() {
  const A = GB.atlasCv, bd = Math.min(DPR, 2), items = [];
  for (const v of VARS) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    const L = v.list, Rn = v.runs;
    for (let k = 0; k < L.length; k += 4) { x0 = Math.min(x0, L[k]); x1 = Math.max(x1, L[k]); y0 = Math.min(y0, L[k + 1]); y1 = Math.max(y1, L[k + 1]); }
    for (const Q of [Rn, v.shade || []]) for (let k = 0; k < Q.length; k += 3) { y0 = Math.min(y0, Q[k]); y1 = Math.max(y1, Q[k]); x0 = Math.min(x0, Q[k + 1]); x1 = Math.max(x1, Q[k + 2]); }
    const ox = x0 * v.fw - 2, oy = y0 * v.fh - 2, cw = (x1 - x0 + 2) * v.fw + 4, ch = (y1 - y0 + 2) * v.fh + 4;
    const c = document.createElement('canvas'); c.width = Math.ceil(cw * bd); c.height = Math.ceil(ch * bd);
    const g = c.getContext('2d'); g.setTransform(bd, 0, 0, bd, -ox * bd, -oy * bd);
    if (v.shade) { g.fillStyle = 'rgba(6,6,6,0.28)'; const Sh = v.shade; for (let k = 0; k < Sh.length; k += 3) g.fillRect(Sh[k + 1] * v.fw - 0.3, Sh[k] * v.fh - 0.3, (Sh[k + 2] - Sh[k + 1]) * v.fw + 0.6, v.fh + 0.6); }   // a cast shadow on the ground
    g.fillStyle = 'rgba(12,12,12,0.97)';
    for (let k = 0; k < Rn.length; k += 3) g.fillRect(Rn[k + 1] * v.fw - 0.3, Rn[k] * v.fh - 0.3, (Rn[k + 2] - Rn[k + 1]) * v.fw + 0.6, v.fh + 0.6);
    for (let k = 0; k < L.length; k += 4) { const sp = GB.spr[L[k + 2]]; g.globalAlpha = L[k + 3] * 0.01; g.drawImage(A, sp[0], sp[1], sp[2], sp[3], L[k] * v.fw + sp[6], L[k + 1] * v.fh + sp[7], sp[4], sp[5]); }
    items.push({ v, c, ox, oy, cw, ch });
  }
  // shelf-pack the pictures under the existing atlas
  const PW = Math.max(A.width, 2048);
  let x = 0, y = A.height + 2, rowH = 0;
  for (const it of items) { if (x + it.c.width > PW) { x = 0; y += rowH + 2; rowH = 0; } it.px = x; it.py = y; x += it.c.width + 2; rowH = Math.max(rowH, it.c.height); }
  const M = document.createElement('canvas'); M.width = PW; M.height = y + rowH + 2;
  const mg = M.getContext('2d'); mg.drawImage(A, 0, 0);
  for (const it of items) {
    mg.drawImage(it.c, it.px, it.py);
    const v = it.v, hp = it.c.height / NSL, hc = it.ch / NSL;
    v.whole = sprite(it.px, it.py, it.c.width, it.c.height, it.cw, it.ch, it.ox, it.oy);   // lily pads are drawn in one piece
    v.sl = [];
    for (let j = 0; j < NSL; j++) {
      const top = it.oy + j * hc, mid = -(top + hc / 2);
      v.sl.push([sprite(it.px, it.py + j * hp, it.c.width, hp, it.cw, hc + 0.35, it.ox, top), Math.max(0, mid / v.crownH)]);
    }
  }
  GB.atlasCv = M;
  normSprites(M.width, M.height);
  if (GL.ok) GL.upload();
}
function buildFlora() {
  bakeVariants();
  if (EDIT) { bshadeCastle = bshade.slice(); kindBase = kind.slice(); }   // the ground before the trees: the editor re-lays them over it
  placeFlora();
}
// The variants, baked once per window size: pictures in the atlas, cut into slices.
function bakeVariants() {
  VARS.length = 0;
  for (let k = 0; k < 7; k++) VARS.push(bakeTree3D('tree', k + 1));   // world/trees3d.js
  for (let k = 0; k < 4; k++) VARS.push(bakeVariant('dead', k + 21));
  for (let k = 0; k < 6; k++) VARS.push(bakeTree3D('bush', k + 41));
  STONES.length = 0;
  for (let k = 0; k < 9; k++) { const v = bakeStone3D(k % 3, k + 61); STONES.push(v); VARS.push(v); }
  LILIES.length = 0;
  for (let k = 0; k < 5; k++) { const v = bakeLily(k >= 3, k + 81); LILIES.push(v); VARS.push(v); }
  bakeCampVariants(VARS);   // world/camp.js: tents and fences
  FLMAXR = Math.ceil(Math.max(...VARS.map(v => v.crownH / CH))) + 2;
  bakeFloraSprites();
}
const variantsOf = type => VARS.filter(v => v.type === type);
// Where the plants stand: from the edited map when it lists them, otherwise generated. Then each plant
// hides the grass under its crown, blocks the way with its trunk and shades the ground.
function placeFlora() {
  flora.length = 0;
  const trees = variantsOf('tree'), dead = variantsOf('dead'), bush = variantsOf('bush');
  tmask = new Uint8Array(N); fmask = new Uint8Array(N);
  campGround = new Float32Array(N); // rebuilt every time; never mutates the designer's ground map
  if (MEADOW_MAP.flora) MEADOW_MAP.flora.forEach(([type, k, gx, gz], mi) => {
    if (ruinClearing(gx, gz, RUIN_FLORA_BUFFER)) return; // clear the actual 3D silhouette, not only arch feet
    const own = variantsOf(type), set = own.length ? own : trees, v = set[Math.max(0, Math.min(set.length - 1, k | 0))];
    const [x, y] = mapToCell(gx, gz), br = Math.round(y + 0.7);
    if (x < 3 || x > COLS - 4 || br < 2 || br > ROWS - 2) return;
    flora.push({ isFlora: true, v, x, y: br - 0.7, br, ph: hash(Math.round(gx), Math.round(gz)) * 6.28, rust: 0, mi });
  });
  else {   // generated: a jittered grid, thick where the forest noise is high
    const K = knightPx(), C = cathedral;
    const gx = K * 0.8 / CW, gy = K * 0.55 / CH;           // placement grid, in cells
    // Reserve stable world-space margin: generated plants are often baked into
    // the map, and one planted on the final glyph column vanishes on resize.
    const safeX = Math.max(4, Math.ceil(40 * WS / CW));
    const safeY = Math.max(3, Math.ceil(40 * SINP * WS / CH));
    const startY = ROWS - VR * 0.3;
    const pathNear = (x, y, r) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -r; dx <= r; dx += 2) { const i = (Math.round(y) + dy) * COLS + Math.round(x) + dx; if (i >= 0 && i < N && (kind[i] === 7 || bmask[i])) return true; } return false; };
    for (let j = 2; j * gy < ROWS - 2; j++) for (let i = 0; i * gx < COLS; i++) {
      const x = (i + hash(i, j * 3) * 0.8 + 0.1) * gx, y = (j + hash(i * 5, j) * 0.8 + 0.1) * gy;
      if (x < safeX || x > COLS - 1 - safeX || y < safeY || y > ROWS - 1 - safeY) continue;
      const forest = vnoise(x * 0.013 + 3, y * 0.021) * 0.75 + vnoise(x * 0.05, y * 0.07) * 0.25, r = hash(i * 17, j * 29);
      const px = x * CW, py = y * CH, v0R = K * 0.9;
      if (C.cv && py < C.ky + 30 * MS && px > C.cx0 * CW - K * 0.6 && px < (C.cx0 + C.BW) * CW + K * 0.6) continue; // never behind the castle
      if (C.cv && Math.abs(px - C.kx) < 420 * MS + v0R && py < C.ky + 520 * SINP * MS + v0R && py > C.ky - 200 * MS) continue;  // a clear forecourt before the stair
      if (Math.abs(y - startY) < 18 && Math.abs(x - pathX(y)) < 30) continue;
      let v = null;
      if (forest > 0.52 && r < (forest - 0.4) * 1.35) v = r < 0.16 ? dead[(r * 97 | 0) % dead.length] : trees[(r * 131 | 0) % trees.length];
      else if (r < 0.12 + forest * 0.25) v = bush[(r * 211 | 0) % bush.length];
      if (!v) continue;
      // Generated trees persist as their grounded, snapped foot position
      // when the editor first bakes them into explicit map objects. Test the
      // SAME world coordinate here, or a tree at the clearing boundary can
      // disappear on first edit/undo even without moving its saved location.
      if (ruinClearing(...toModelXZ(x, Math.floor(y) - 0.7), RUIN_FLORA_BUFFER)) continue;
      if (pathNear(x, y, Math.ceil((v.type === 'bush' ? v.R * 0.7 : v.R * 0.45) / CW))) continue;
      flora.push({ isFlora: true, v, x, y: Math.floor(y) - 0.7, br: Math.floor(y), ph: hash(i, j) * 6.28, rust: 0 });
    }
  }
  flora.sort((a, b) => a.y - b.y);
  for (const f of flora) {
    const v = f.v, bx = Math.round(f.x), br = f.br;
    for (let k = 0; k < v.hide.length; k += 2) { const cx = bx + v.hide[k], cy = br + v.hide[k + 1]; if (cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS) kind[cy * COLS + cx] = 0; }
    if (v.block) { // tents/fences are solid, but their shadows belong to the GROUND
      const M = v.type === 'fence' ? fmask : tmask;
      for (let k = 0; k < v.block.length; k += 2) {
        const cx = bx + v.block[k], cy = br + v.block[k + 1];
        if (cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS) M[cy * COLS + cx] = 1;
      }
      if (v.grounding) for (let k = 0; k < v.grounding.length; k += 3) {
        const cx = bx + v.grounding[k], cy = br + v.grounding[k + 1];
        if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) continue;
        const i = cy * COLS + cx;
        campGround[i] = Math.max(campGround[i], v.grounding[k + 2] * .01);
      }
      if (v.gshadow) for (let k = 0; k < v.gshadow.length; k += 3) {
        const cx = bx + v.gshadow[k], cy = br + v.gshadow[k + 1];
        if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) continue;
        const i = cy * COLS + cx;
        // Same additive bshade as tree and ruin contact/cast shadows.
        bshade[i] = Math.min(.7, bshade[i] + v.gshadow[k + 2] * .01);
      }
      continue;
    }
    if (v.type !== 'bush') for (let dx = -1; dx <= 1; dx++) { const i = br * COLS + bx + dx; if (i >= 0 && i < N) tmask[i] = 1; }
    if (v.gshadow) {   // world/trees3d.js: the crown's own shadow, cast along the castle's light
      const G = v.gshadow;
      for (let k = 0; k < G.length; k += 3) { const cx = bx + G[k], cy = br + G[k + 1]; if (cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS) { const i = cy * COLS + cx; bshade[i] = Math.min(0.7, bshade[i] + G[k + 2] * 0.01); } }
      continue;
    }
    const sr = v.R / CW, sx = bx + v.Hc * 0.6 / CW, sy = br - v.Hc * 0.55 / CH;
    for (let cy = Math.floor(sy - sr * CW / CH); cy <= Math.ceil(br + 2); cy++) for (let cx = Math.floor(Math.min(bx, sx) - sr); cx <= Math.ceil(Math.max(bx, sx) + sr); cx++) {
      if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) continue;
      const a = ((cx - sx) / sr) ** 2 + ((cy - sy) * CH / CW / sr / 0.75) ** 2, b = ((cx - bx) / (sr * 0.8)) ** 2 + ((cy - br) * CH / CW / (sr * 0.35)) ** 2;
      const s = (a < 1 ? (1 - a) * 0.32 : 0) + (b < 1 ? (1 - b) * 0.3 : 0);
      if (s > 0) { const i = cy * COLS + cx; bshade[i] = Math.min(0.7, bshade[i] + s * (v.type === 'dead' ? 0.5 : 1.4)); }
    }
  }
  build.flora = flora.length;
}

function visibleFlora(out) {
  let lo = 0, hi = flora.length;
  const y0 = VY0 - 2;
  while (lo < hi) { const m = (lo + hi) >> 1; if (flora[m].br < y0) lo = m + 1; else hi = m; }
  const y1 = VY1 + FLMAXR, xa = VX0 - 60, xb = VX1 + 60;
  for (let k = lo; k < flora.length && flora[k].br <= y1; k++) { const f = flora[k]; if (f.x > xa && f.x < xb) out.push(f); }
  return out;
}
// The same wind field the grass feels, sampled at the tree's foot. Trees are heavy: they only follow
// the slow swell and the gust fronts, through a soft spring, and lean as one rigid shape; the fast
// flutter shows up only as single leaves twitching while a gust passes.
function windAt(x, y) {
  const front = Math.sin(x * 0.028 - y * 0.012 - t * 0.55), gb = front > 0.55 ? (front - 0.55) * 2.2 : 0;
  return { lean: 0.16 + Math.sin(x * 0.06 + y * 0.035 - t * 1.5) * 0.22 + Math.sin(x * 0.17 - y * 0.07 - t * 2.3) * 0.06 + gb * 0.95, gust: gb, flut: 0.25 + Math.abs(Math.sin(x * 0.06 + y * 0.035 - t * 1.5)) * 0.25 + gb };
}
function updateFlora(dt) {
  const k = 1 - Math.exp(-dt * 1.6), d = Math.exp(-dt * 2.2);
  for (const f of flora) {
    if (f.br < VY0 - 40 || f.br > VY1 + FLMAXR + 40) continue;   // off screen: nothing to animate
    const w = windAt(f.x, f.br);
    f.vw = ((f.vw || 0) + (w.lean - (f.sw || 0)) * k * 6) * d;    // damped spring: heavy, a little overshoot
    f.sw = (f.sw || 0) + f.vw * dt;
    f.gust = w.gust; f.flut = w.flut;
    if (f.v.type === 'bush') {                                    // leaves rustle when the knight pushes through
      const dd = Math.abs(f.x - player.x) + Math.abs(f.br - player.y - 0.7) * 2;
      f.rust = Math.max((f.rust || 0) * Math.exp(-dt * 3), dd < f.v.R / CW + 2 && player.moving ? 1 : 0);
      if (mouse.on && mouse.sp > 0.1) { const mx = mouse.x / CW + camX, my = mouse.y / CH + camY; if (Math.abs(f.x - mx) < f.v.R / CW && my < f.br + 1 && my > f.br - f.v.crownH / CH) f.rust = Math.max(f.rust, mouse.sp); }
    }
  }
}
function drawFlora(f) {
  const v = f.v, bx = Math.round(f.x) * CW, by = f.br * CH, H = v.crownH, fw = v.fw, fh = v.fh;
  const bush = v.type === 'bush';
  const lean = (f.sw || 0) * (bush ? 2 : v.type === 'dead' ? 6 : 5);   // px at the very top
  const rs = Math.min(1, (bush ? f.rust || 0 : 0) + (f.flut || 0) * 0.3), tick = Math.floor(t * 9);
  // a crown standing between the camera and the knight thins out, so he is never lost behind it
  let fade = 1;
  if (v.type !== 'bush' && f.br > player.y + 0.7) {
    const G = geomOf(player), w = v.R * 1.1;
    if (G.left + G.w * 0.8 > bx - w && G.left + G.w * 0.2 < bx + w && G.top < by && G.gy > by - H) fade = 0.32;
  }
  f.fade = (f.fade || 1) + (fade - (f.fade || 1)) * 0.15;
  const fa = f.fade, L = v.list, Rn = v.runs;
  if (v.solid) { gput(v.whole, bx, by, fa); return; }   // tents and fences stand still
  if (v.sl && !(bush && (f.rust || 0) > 0.05)) {   // a bush being pushed through is drawn leaf by leaf
    // the trunk bends, the crown above it moves as one piece (slices shifted unevenly would tear it)
    const cb = v.gshadow ? Math.max(0.1, Math.min(0.8, (v.Hc - v.R * 0.85) * COSP / v.crownH)) : 0;   // where the crown begins, as a share of the picture's height
    for (const [sid, hf] of v.sl) { const k = cb ? Math.min(1, hf / cb) : hf * Math.sqrt(hf); gput(sid, bx + lean * (cb ? k * k * (3 - 2 * k) : k), by, fa); }
    return;
  }
  for (let k = 0; k < Rn.length; k += 3) {
    const hf = Math.max(0, -Rn[k] * fh / H), sw = lean * hf * Math.sqrt(hf);   // trunk stiff, crown bends
    grect(bx + Rn[k + 1] * fw + sw - 0.3, by + Rn[k] * fh - 0.3, (Rn[k + 2] - Rn[k + 1]) * fw + 0.6, fh + 0.6, 0.97 * fa);
  }
  for (let k = 0; k < L.length; k += 4) {
    const hf = Math.max(0, -L[k + 1] * fh / H);
    // rustle: single leaves twitch by a pixel and dim for a moment, the plant itself stays whole
    const j = rs > 0.02 && hash(k, tick) < rs * 0.3 ? 1 : 0;
    gput(L[k + 2], bx + L[k] * fw + lean * hf * Math.sqrt(hf) + j * (hash(k + 7, tick) - 0.5) * 2.4, by + L[k + 1] * fh + j * (hash(k, tick + 3) - 0.5) * 1.6, fa * L[k + 3] * 0.01 * (1 - j * 0.45));
  }
}
