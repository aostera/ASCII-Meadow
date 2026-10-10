// ---------- the knight: frames from the dark-knight atlases, printed as glyphs ----------
// Direction order is the game's d8: S, SW, W, NW, N, NE, E, SE. The atlases draw the left-facing half;
// the rest is mirrored (tools/build_knight_sheet.py).
//   0-7      idle, one pose per direction (from the idle turntable)
//   8-87     walk, 8 directions × 10 frames: a calm stride whose legs really alternate
//   88-151   run, 8 directions × 8 frames: knee high, cloak flying (legs stepped in code)
//   152-191  jump, 4 rows (S, NW, N, NE) × 10 phases
// Every frame is printed below as ASCII art (tools/to_ascii.py): " .:-=+*#%@" is brightness, "'" is
// dark plate (backing, no glyph), spaces are empty. 104 × 54 cells; torso at column 52, feet on row 51.6.
// The first line of each frame is the number of empty rows above it.
const KG = { cols: 104, rows: 54, fx: 52, fy: 51.6, art: 44.4 };   // art: knight height in cells
// The cloak's outline per pose, traced by hand on the atlas art, in cells: [y0, y1, x, y, x, y, ...].
// y0 is where the cloth hangs from, y1 where it swings fully free. Right-facing walk and run directions are
// the left-facing outlines mirrored, like their frames.
const kmir = r => r && r.map(q => q.map((v, k) => k > 1 && k % 2 === 0 ? 104 - v : v));
const KCLOAK = [
  [[26, 40, 58, 26, 62, 26, 67, 37, 64, 40, 59, 38]],                                                 // S
  [[24, 40, 60, 24, 64, 24, 70, 38, 66, 40, 62, 36]],                                                 // SW
  [[18, 38, 54, 18, 58, 18, 62, 26, 60, 38, 56, 38, 55, 26]],                                         // W
  [[18, 42, 44, 18, 58, 18, 64, 24, 68, 38, 62, 40, 56, 42, 50, 38, 46, 30, 44, 24]],                 // NW
  [[18, 43, 42, 19, 62, 19, 63, 30, 65, 40, 60, 42, 46, 42, 41, 40, 42, 30]],                         // N
  null,                                                                                                // NE: NW mirrored
  [[18, 42, 52, 16, 48, 22, 46, 32, 44, 40, 36, 40, 34, 34, 40, 24]],                                 // E
  [[22, 40, 44, 20, 48, 24, 46, 36, 40, 40, 36, 36]],                                                 // SE
];
KCLOAK[5] = kmir(KCLOAK[3]);
const KCLOAKW = [
  [[24, 40, 58, 24, 62, 24, 66, 38, 62, 40, 59, 36]],                                                 // S
  [[22, 42, 56, 20, 62, 22, 66, 34, 70, 40, 64, 42, 58, 40, 56, 30]],                                 // SW
  [[18, 42, 52, 18, 62, 20, 66, 30, 72, 38, 70, 44, 62, 44, 58, 40, 54, 30]],                         // W
  null,                                                                                                // NW: NE mirrored
  [[16, 42, 46, 15, 58, 15, 60, 22, 54, 28, 50, 40, 44, 43, 36, 42, 32, 38, 36, 28, 38, 22]],         // N
  [[18, 42, 42, 18, 62, 18, 62, 26, 58, 34, 54, 42, 44, 42, 36, 40, 34, 34, 38, 24]],                 // NE
];
KCLOAKW[3] = kmir(KCLOAKW[5]); KCLOAKW[6] = kmir(KCLOAKW[2]); KCLOAKW[7] = kmir(KCLOAKW[1]);
const KCLOAKR = [
  [[26, 38, 60, 26, 64, 26, 66, 36, 62, 38]],                                                         // S
  [[20, 38, 50, 16, 58, 18, 66, 26, 72, 34, 66, 38, 58, 38, 54, 28]],                                 // SW (front-left)
  [[18, 40, 54, 16, 60, 18, 66, 26, 72, 34, 68, 40, 60, 40, 56, 30]],                                 // W (profile: the cloak trails behind)
  [[20, 38, 52, 16, 58, 18, 64, 24, 70, 34, 66, 38, 58, 38, 54, 28]],                                 // NW (back-left)
  [[16, 40, 48, 14, 58, 14, 62, 22, 58, 30, 54, 38, 46, 40, 38, 36, 42, 26, 42, 20]],                 // N (back-right frames)
];
KCLOAKR[5] = KCLOAKR[4]; KCLOAKR[6] = kmir(KCLOAKR[2]); KCLOAKR[7] = kmir(KCLOAKR[1]);
// The mantle round the shoulders seen from the front: coloured with the cloak in firelight, never moved.
const KCOWL = [
  [42, 16, 62, 16, 64, 21, 52, 25, 40, 21],   // S
  [44, 16, 62, 16, 64, 22, 52, 25, 42, 21],   // SW
  null, null, null, null, null,
  [42, 16, 60, 16, 62, 21, 52, 25, 40, 22],   // SE
];
// The tabard hanging in front from the belt between the legs (seen from the front): cloth, coloured with
// the cloak in firelight as in the crimson reference, never moved.
const KTABARD = [
  [45, 28, 59, 28, 58, 36, 55, 41, 52, 42, 49, 41, 46, 36],   // S
  [46, 28, 60, 28, 59, 36, 56, 41, 53, 42, 50, 41, 47, 36],   // SW
  null, null, null, null, null,
  [44, 28, 58, 28, 57, 36, 54, 41, 51, 42, 48, 41, 45, 36],   // SE
];
const KTX = [0, -0.71, -1, -0.71, 0, 0.71, 1, 0.71], KTY = [1, 0.71, 0, -0.71, -1, -0.71, 0, 0.71];   // d8 → screen heading
const JROWI = [0, 3, 4, 5];   // jump row → d8
// Parse once. Every cell keeps its glyph code (ramp index × level, -1 = plate only) and what it
// belongs to: 0 body, 1 left leg, 2 right leg, 3 blade; w is how much cloth it is (0..1), dep how far
// down the leg it sits (0 at the hip, 1 at the foot). The animation only ever moves these cells.
const KFX = 52, KHIP = 41, KFOOT = 51;   // legs are cut below KHIP, under the tabard's hem
function kseg(src, i) {
  const d = i < 8 ? i : i < 88 ? ((i - 8) / 10) | 0 : i < 152 ? (i - 88) >> 3 : JROWI[((i - 152) / 10) | 0], legs = false;
  const lines = src.split('\n'), top = +lines[0], C = [];
  for (let k = 1; k < lines.length; k++) {
    const row = lines[k], cy = top + k - 1;
    for (let cx = 0; cx < row.length; cx++) {
      const ch = row[cx]; if (ch === ' ') continue;
      const ci = " .:-=+*#%@".indexOf(ch);   // same ramp as RAMP below
      C.push({ code: ch === "'" ? -1 : ci * 8 + Math.min(7, Math.floor((ci - 0.5) / 9 * 8)), cx, cy, seg: 0, w: 0, dep: 0 });
    }
  }
  if (KSW[i * 4] >= 0) {
    const x0 = KSW[i * 4] / 10, y0 = KSW[i * 4 + 1] / 10, ux = (KSW[i * 4 + 2] / 10 - x0) * 0.6, uy = (KSW[i * 4 + 3] / 10 - y0) * 0.9, len = Math.hypot(ux, uy) || 1;
    for (const c of C) {
      const px = (c.cx - x0) * 0.6, py = (c.cy - y0) * 0.9, tt = (px * ux + py * uy) / len;
      if (Math.abs(px * uy - py * ux) / len < 1.15 && tt > -1.2 && tt < len + 1.2) c.seg = 3;
    }
  }
  const tx = KTX[d], ty = KTY[d];
  // Cloak membership first (hand-traced outlines, KCLOAK standing / KCLOAKW walking), so the hem that hangs
  // down over the legs stays cloth to its last tatter instead of being taken for a leg.
  const R0 = (i < 8 ? KCLOAK[i] : i < 88 ? KCLOAKW[d] : KCLOAKR[d]) || [], CW0 = KCOWL[d], TB0 = KTABARD[d], sim = i < 152;
  const inPoly = (r, k0, px, py) => { let inside = false; for (let k = k0, l = r.length - 2; k < r.length; l = k, k += 2) { const xk = r[k], yk = r[k + 1], xl = r[l], yl = r[l + 1]; if ((yk > py) !== (yl > py) && px < (xl - xk) * (py - yk) / (yl - yk) + xk) inside = !inside; } return inside; };
  for (const c of C) {
    if (c.seg === 3) continue;
    const px = c.cx + 0.5, py = c.cy + 0.5;
    for (const r of R0) for (const qy of [py, py - 1.5, py - 3]) {   // the tatters just under an outline belong to the hem too
      if (inPoly(r, 2, px, qy)) { c.inC = 1; if (qy === py) c.inS = 1; c.inT = Math.max(c.inT || 0, Math.min(1, Math.max(0, (py - r[0]) / (r[1] - r[0])))); break; }
    }
    if ((CW0 && inPoly(CW0, 0, px, py)) || (TB0 && inPoly(TB0, 0, px, py))) c.cowl = 1;
  }
  let D = 0;
  if (legs) {
    // legs: below the hip, the connected pieces that reach the ground near the body's axis
    const at = new Map(), comp = new Int32Array(C.length).fill(-1), comps = [];
    C.forEach((c, j) => { if (c.cy >= KHIP && c.seg !== 3 && !c.inS) at.set(c.cx * 64 + c.cy, j); });   // under the hem's outline it is cloth; below it, legs
    for (const j0 of at.values()) {
      if (comp[j0] >= 0) continue;
      const id = comps.length, st = [j0], m = []; comp[j0] = id;
      while (st.length) {
        const j = st.pop(), c = C[j]; m.push(j);
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const q = at.get((c.cx + ox) * 64 + c.cy + oy);
          if (q !== undefined && comp[q] < 0) { comp[q] = id; st.push(q); }
        }
      }
      let mx = 0, maxY = 0; for (const j of m) { mx += C[j].cx; maxY = Math.max(maxY, C[j].cy); }
      comps.push({ m, mx: mx / m.length, maxY });
    }
    const L = comps.filter(o => o.maxY >= KFOOT - 5 && Math.abs(o.mx - KFX) < 18 && o.m.length > 6).sort((p, q) => q.m.length - p.m.length).slice(0, 2);
    let parts = [];
    if (L.length === 2) parts = (L[0].mx < L[1].mx ? L : [L[1], L[0]]).map(o => o.m);
    else if (L.length === 1) {
      // both legs in one piece: split where the low rows are thinnest
      const m = L[0].m, h = new Map();
      let x0 = 1e9, x1 = -1e9;
      for (const j of m) { const c = C[j]; if (c.cy >= KFOOT - 7) { h.set(c.cx, (h.get(c.cx) || 0) + 1); x0 = Math.min(x0, c.cx); x1 = Math.max(x1, c.cx); } }
      let cut = (x0 + x1) / 2, bv = 1e9;
      for (let x = Math.round(x0 + (x1 - x0) * 0.25); x <= x0 + (x1 - x0) * 0.75; x++) { const v = (h.get(x) || 0) + 0.3 * ((h.get(x - 1) || 0) + (h.get(x + 1) || 0)); if (v < bv) { bv = v; cut = x; } }
      parts = [m.filter(j => C[j].cx < cut), m.filter(j => C[j].cx >= cut)];
    }
    const fxs = parts.map((p, k) => {
      let fx = 0, n = 0;
      for (const j of p) { const c = C[j]; c.seg = 1 + k; const u = Math.min(1, Math.max(0, (c.cy - KHIP + 0.5) / (KFOOT - KHIP))); c.dep = u * u * (3 - 2 * u); if (c.cy >= KFOOT - 3) { fx += c.cx; n++; } }   // dep: still where the leg meets the body, the foot moving as one
      return n ? fx / n : KFX;
    });
    if (fxs.length === 2) D = fxs[1] - fxs[0];
  }
  // The cloak is its own layer: cells inside the outline are cloth, simulated apart from the body; t runs
  // from where it hangs (y0) to where it swings free (y1). The cowl only takes the cloak's colour.
  // Jump poses keep their drawn cloak and are coloured only.
  for (const c of C) {
    if (c.seg) continue;
    if (c.cowl) c.cl = 1;
    if (c.inC) { c.cl = 1; if (sim) { c.cm = 1; c.w = c.t = c.inT; } }
  }
  if (i >= 152) {   // jumps: the cloak flies wide, so colour by the figure's own top and bottom instead
    let y0 = 99, y1 = 0; for (const c of C) { y0 = Math.min(y0, c.cy); y1 = Math.max(y1, c.cy); }
    const back = i >= 162;   // seen from behind it is nearly all cloak; from the front only the mantle
    for (const c of C) c.cl = c.seg === 3 ? 0 : back ? (c.cy >= y0 + 7 && c.cy <= y1 - 4 ? 1 : 0) : (c.cy >= y0 + 6 && c.cy <= y0 + 13 && Math.abs(c.cx - KFX) <= 11 ? 1 : 0);
  }
  // Soften the seams: cloth beside the body barely moves and gains its freedom
  // over a few glyphs, so it bends away from the body instead of tearing off along a line.
  {
    const GW = 104, GH = 54, dist = new Float32Array(GW * GH).fill(1e9), at = new Int32Array(GW * GH).fill(-1);
    for (let j = 0; j < C.length; j++) { const c = C[j]; if (c.cx >= GW || c.cy >= GH) continue; const q = c.cy * GW + c.cx; at[q] = j; if (!c.seg && !(c.w > 0)) dist[q] = 0; }   // only the body holds the cloth: it may lie over legs and blade
    const relax = (q, r, cost) => { if (r >= 0 && r < GW * GH && at[r] >= 0 && dist[r] + cost < dist[q]) dist[q] = dist[r] + cost; };
    for (let pass = 0; pass < 2; pass++) {   // chamfer distance through the figure, in cell heights (a cell is 0.6 × 0.9)
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const q = y * GW + x; if (at[q] < 0 || !dist[q]) continue;
        if (x > 0) relax(q, q - 1, 0.67); relax(q, q - GW, 1); if (x > 0) relax(q, q - GW - 1, 1.2); if (x < GW - 1) relax(q, q - GW + 1, 1.2); }
      for (let y = GH - 1; y >= 0; y--) for (let x = GW - 1; x >= 0; x--) { const q = y * GW + x; if (at[q] < 0 || !dist[q]) continue;
        if (x < GW - 1) relax(q, q + 1, 0.67); relax(q, q + GW, 1); if (x < GW - 1) relax(q, q + GW + 1, 1.2); if (x > 0) relax(q, q + GW - 1, 1.2); }
    }
    for (let q = 0; q < GW * GH; q++) { const j = at[q]; if (j < 0 || !(C[j].w > 0)) continue; const u = Math.min(1, dist[q] / 3); C[j].w *= u * u * (3 - 2 * u); }
  }
  const n = C.length, side = Math.abs(tx);
  const F = { n, code: new Int16Array(n), cx: new Int16Array(n), cy: new Int16Array(n), seg: new Uint8Array(n), cl: new Uint8Array(n), cm: new Uint8Array(n), w: new Float32Array(n), t: new Float32Array(n), dep: new Float32Array(n),
    // stride half-length in cells: what the pose shows in side views, a set one when walking at the camera
    R: side > 0.5 ? Math.min(12, Math.max(5, D / (2 * side))) : 7, beta: (1 - side) * Math.PI / 2, d };
  C.forEach((c, j) => { F.cl[j] = c.cl || 0; F.cm[j] = c.cm || 0; F.t[j] = c.t || 0; F.code[j] = c.code; F.cx[j] = c.cx; F.cy[j] = c.cy; F.seg[j] = c.seg; F.w[j] = c.w; F.dep[j] = c.dep; });
  return F;
}
const KFR = KNIGHT_ART.map(kseg);
const KWB = [0, 0, 0, 0, 0, 0, 0, 0];   // per direction, the run frame the cycle starts on
const KR = KWB.map(() => 7);
const KFN = KFR.reduce((a, f) => Math.max(a, f.n), 0), KDX = new Float32Array(KFN), KDY = new Float32Array(KFN);   // per-cell offsets, reused
KNIGHT_ART.length = 0;   // the text has done its job
const KS = { ok: true };
const JROW = [0, 0, 1, 1, 2, 3, 3, 0];   // d8 → jump row (S, NW, N, NE)
// jump phases in seconds: crouch, crouch, push off, rise, peak, fall, land, absorb, rise, stand
const JUMP = [0.1, 0.08, 0.08, 0.1, 0.14, 0.1, 0.09, 0.09, 0.08, 0.08];
const JUMP_T = JUMP.reduce((a, d) => a + d, 0), AIR0 = 0.18, AIR1 = 0.18 + 0.08 + 0.1 + 0.14 + 0.1;
function knightFrame(e) {
  const d = e.d8 | 0;
  if (e.jump > 0) {
    let tt = (1 - e.jump) * JUMP_T, c = JUMP.length - 1;
    for (let k = 0; k < JUMP.length; k++) { if (tt < JUMP[k]) { c = k; break; } tt -= JUMP[k]; }
    return 152 + JROW[d] * 10 + c;
  }
  // walking and running, the atlas frames follow the stride phase (one cycle per two steps)
  if (!(e.walk > 0.5)) return d;
  const q = (e.wph || 0) / (2 * Math.PI);
  return (e.run || 0) > 0.5 ? 88 + d * 8 + ((KWB[d] + Math.floor(q * 8)) & 7) : 8 + d * 10 + (Math.floor(q * 10) % 10);
}
// height of the jump arc above the ground, in screen px
const jumpPx = e => { if (!(e.jump > 0)) return 0; const tt = (1 - e.jump) * JUMP_T; return tt > AIR0 && tt < AIR1 ? Math.sin(Math.PI * (tt - AIR0) / (AIR1 - AIR0)) * knightPx() * 0.45 : 0; };
function jump() {
  if (player.jump > 0) return;
  player.jump = 1; player.landed = false;
  const [mx, my] = player.inp || [0, 0], l = Math.hypot(mx, my);
  player.jv = l > 0.01 ? [mx / l, my / l] : null;
  player.jr = l > 0.01 ? player.run || 0 : 0;   // a running jump carries further
}
const knightPx = () => KG.art * charDims(player).fch;   // on-screen height of the standing knight
