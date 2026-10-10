// The castle: a gothic 3D model of boxes, prisms and slabs, ray-cast once into the glyph grid (light,
// shadow, ornament, windows), its walkable surface, and its drawing and occlusion.

// ---------- castle: a large gothic 3D model seen from above, ray-cast once into the grass grid ----------
// Model units are screen pixels at MS = 1. x right, y up, z away from the camera (north).
const PITCH = 0.87, SINP = Math.sin(PITCH), COSP = Math.cos(PITCH);   // camera tilt, ~50°
const LGT = (() => { const v = [-0.45, 0.65, -0.6], m = Math.hypot(...v); return v.map(c => c / m); })();
// letters per surface: front walls, side walls, roofs, spires, openings (empty), rock, steps
const FACESETS = ["0Q@0Q8", "dbqd8b", "=#=+=", "^*^%", "", ",;:o%.", "=_-="];
const solids = [];
let MS = 1;
const CASTLE_SCALE = 2.5;
const P3 = (a, b, c, d) => [a, b, c, d];
const plane = (nx, ny, nz, px, py, pz) => { const m = Math.hypot(nx, ny, nz); nx /= m; ny /= m; nz /= m; return [nx, ny, nz, nx * px + ny * py + nz * pz]; };
function solid(kind, pl, bb, meta) { solids.push({ kind, pl, bb, meta: Object.assign({ c: [(bb[0] + bb[1]) / 2, (bb[4] + bb[5]) / 2] }, meta) }); }
function addBox(x0, x1, y0, y1, z0, z1, kind, meta) {
  solid(kind, [P3(1, 0, 0, x1), P3(-1, 0, 0, -x0), P3(0, 1, 0, y1), P3(0, -1, 0, -y0), P3(0, 0, 1, z1), P3(0, 0, -1, -z0)], [x0, x1, y0, y1, z0, z1], Object.assign({ c: [(x0 + x1) / 2, (z0 + z1) / 2] }, meta));
}
function addPrism(cx, cz, r, n, y0, y1, kind, meta) {
  const apo = r * Math.cos(Math.PI / n), pl = [P3(0, 1, 0, y1), P3(0, -1, 0, -y0)];
  for (let i = 0; i < n; i++) { const a = Math.PI / 2 + i * 2 * Math.PI / n, c = Math.cos(a), s = Math.sin(a); pl.push(P3(c, 0, s, apo + c * cx + s * cz)); }
  solid(kind, pl, [cx - r, cx + r, y0, y1, cz - r, cz + r], Object.assign({ prism: [cx, cz, apo] }, meta));
}
function addCone(cx, cz, r, n, y0, y1, kind, meta) {
  const apo = r * Math.cos(Math.PI / n), h = y1 - y0, pl = [P3(0, -1, 0, -y0)];
  for (let i = 0; i < n; i++) { const a = Math.PI / 2 + i * 2 * Math.PI / n, c = Math.cos(a), s = Math.sin(a); pl.push(plane(c * h, apo, s * h, cx + c * apo, y0, cz + s * apo)); }
  solid(kind, pl, [cx - r, cx + r, y0, y1, cz - r, cz + r], meta);
}
function addGableZ(x0, x1, z0, z1, yb, yr, kind, meta) { // ridge runs north
  const xm = (x0 + x1) / 2;
  solid(kind, [P3(0, -1, 0, -yb), P3(0, 0, 1, z1), P3(0, 0, -1, -z0), plane(-(yr - yb), xm - x0, 0, x0, yb, 0), plane(yr - yb, x1 - xm, 0, x1, yb, 0)], [x0, x1, yb, yr, z0, z1], Object.assign({ c: [xm, (z0 + z1) / 2] }, meta));
}
function addGableX(x0, x1, z0, z1, yb, yr, kind, meta) { // ridge runs east-west
  const zm = (z0 + z1) / 2;
  solid(kind, [P3(0, -1, 0, -yb), P3(1, 0, 0, x1), P3(-1, 0, 0, -x0), plane(0, zm - z0, -(yr - yb), 0, yb, z0), plane(0, z1 - zm, yr - yb, 0, yb, z1)], [x0, x1, yb, yr, z0, z1], Object.assign({ c: [(x0 + x1) / 2, (z0 + z1) / 2] }, meta));
}
const pinnacle = (x, z, y0, h, r) => { addBox(x - r, x + r, y0, y0 + h * 0.45, z - r, z + r, 'wall'); addCone(x, z, r * 1.25, 4, y0 + h * 0.45, y0 + h, 'spire'); };
function merlons(x0, x1, z0, z1, y, alongX) {
  const L = alongX ? x1 - x0 : z1 - z0, n = Math.floor(L / 34);
  for (let k = 0; k < n; k++) { const a = (alongX ? x0 : z0) + k * L / n + 6, b = a + L / n * 0.55; alongX ? addBox(a, b, y, y + 30, z0, z1, 'wall') : addBox(x0, x1, y, y + 30, a, b, 'wall'); }
}

// a slab whose top runs straight from (x0, ya) to (x1, yb): flying buttresses
function addBeam(x0, x1, z0, z1, ya, yb, th, kind, meta) {
  const nx = -(yb - ya), ny = x1 - x0, m = Math.hypot(nx, ny);
  solid(kind, [P3(1, 0, 0, x1), P3(-1, 0, 0, -x0), P3(0, 0, 1, z1), P3(0, 0, -1, -z0),
    [nx / m, ny / m, 0, (nx * x0 + ny * ya) / m], [-nx / m, -ny / m, 0, -(nx * x0 + ny * (ya - th)) / m]],
    [Math.min(x0, x1), Math.max(x0, x1), Math.min(ya, yb) - th, Math.max(ya, yb), z0, z1], Object.assign({ c: [(x0 + x1) / 2, (z0 + z1) / 2] }, meta));
}
// a slab whose top climbs along z: stair cheek walls
function addRamp(x0, x1, z0, z1, ya, yb, kind, meta) {
  const ny = z1 - z0, nz = -(yb - ya), m = Math.hypot(ny, nz);
  solid(kind, [P3(1, 0, 0, x1), P3(-1, 0, 0, -x0), P3(0, 0, 1, z1), P3(0, 0, -1, -z0), P3(0, -1, 0, 0), [0, ny / m, nz / m, (ny * ya + nz * z0) / m]],
    [x0, x1, 0, Math.max(ya, yb), z0, z1], Object.assign({ c: [(x0 + x1) / 2, (z0 + z1) / 2] }, meta));
}
function buildModel() {
  solids.length = 0;
  const Y0 = 120;
  // ---- the mound and the stair: ten treads up to the terrace, walled on both sides
  addBox(-780, 780, 0, 72, 0, 1040, 'rock'); addBox(-640, 640, 72, Y0, 46, 1000, 'rock');
  const SZ0 = -150, SD = 19.6, SN = 10;
  for (let k = 0; k < SN; k++) addBox(-150, 150, 0, (k + 1) * 12, SZ0 + k * SD, 52, 'step', { zf: SZ0 + k * SD, c: [0, 0] });
  for (const sx of [-1, 1]) {
    const x0 = sx < 0 ? -186 : 150, x1 = sx < 0 ? -150 : 186;
    addRamp(x0, x1, SZ0 - 10, 52, 30, Y0 + 30, 'wall', { cheek: 1 });
    for (const [pz, py] of [[SZ0 - 10, 46], [52, Y0 + 46]]) { addBox(sx * 168 - 20, sx * 168 + 20, 0, py, pz - 20, pz + 20, 'wall'); pinnacle(sx * 168, pz, py, 110, 14); }
  }
  // ---- curtain wall: blind arcade below, lancets, a corbel table under the battlements, buttress pinnacles
  const curtain = { courses: [Y0 + 150], arcade: { y0: Y0 + 20, h: 110, w: 34 }, corbels: Y0 + 286, win: [{ y0: Y0 + 175, h: 80, w: 14, sp: 92 }] };
  addBox(-540, 540, Y0, Y0 + 300, 140, 205, 'wall', curtain);
  merlons(-540, 540, 140, 160, Y0 + 300, true);
  for (const bx of [-470, -380, -290, 290, 380, 470]) { addBox(bx - 12, bx + 12, Y0, Y0 + 330, 124, 141, 'wall', { courses: [Y0 + 150, Y0 + 290] }); pinnacle(bx, 132, Y0 + 330, 120, 12); }
  for (const sx of [-1, 1]) { addBox(sx < 0 ? -575 : 515, sx < 0 ? -515 : 575, Y0, Y0 + 280, 180, 860, 'wall', { arcade: { y0: Y0 + 20, h: 100, w: 30 }, corbels: Y0 + 266, win: [{ y0: Y0 + 160, h: 70, w: 12, sp: 110 }] }); merlons(sx < 0 ? -575 : 555, sx < 0 ? -555 : 575, 180, 860, Y0 + 280, false); }
  // ---- gatehouse: the great portal with its doors, a tympanum, a crocketed gable over it, tracery, niches with saints
  addBox(-160, 160, Y0, Y0 + 560, 100, 240, 'wall', { door: { u: 0, y: Y0, w: 150, h: 290 }, niches: { y0: Y0 + 330, h: 90, w: 26, sp: 46, from: -150, to: 150, skip: 60 }, win: [{ y0: Y0 + 440, h: 100, w: 40, sp: 1e9, front: true }], courses: [Y0 + 320, Y0 + 430, Y0 + 545], corbels: Y0 + 548 });
  merlons(-160, 160, 100, 118, Y0 + 560, true);
  addGableX(-120, 120, 120, 230, Y0 + 560, Y0 + 720, 'roof');
  addGableZ(-118, 118, 90, 100, Y0 + 300, Y0 + 530, 'wall', { wimperg: { y0: Y0 + 300, y1: Y0 + 530, hw: 118 } });
  pinnacle(0, 95, Y0 + 528, 90, 9);
  for (const sx of [-1, 1]) {
    addBox(sx * 134 - 14, sx * 134 + 14, Y0, Y0 + 470, 84, 101, 'wall', { courses: [Y0 + 160, Y0 + 320] }); pinnacle(sx * 134, 92, Y0 + 470, 130, 12);   // portal buttresses
    addPrism(sx * 172, 108, 52, 8, Y0, Y0 + 760, 'wall', { win: [{ y0: Y0 + 470, h: 100, w: 12 }, { y0: Y0 + 250, h: 80, w: 10 }], niches: { y0: Y0 + 120, h: 80, w: 22, sp: 1e9, from: -30, to: 30 }, courses: [Y0 + 230, Y0 + 440, Y0 + 740], corbels: Y0 + 744 });
    addCone(sx * 172, 108, 60, 8, Y0 + 760, Y0 + 1120, 'spire', { axis: [sx * 172, 108], n: 8 });
  }
  // ---- corner towers
  for (const [tx, tz, r, top, sp] of [[-560, 170, 100, 760, 620], [560, 170, 100, 760, 620], [-560, 860, 86, 840, 540], [560, 860, 86, 840, 540]]) {
    addPrism(tx, tz, r, 8, Y0, Y0 + top, 'wall', { win: [{ y0: Y0 + top - 210, h: 120, w: 18 }, { y0: Y0 + top - 440, h: 90, w: 12 }], niches: { y0: Y0 + 90, h: 90, w: 26, sp: 1e9, from: -40, to: 40 }, courses: [Y0 + top - 250, Y0 + 230], corbels: Y0 + top - 14 });
    addPrism(tx, tz, r + 12, 8, Y0 + top, Y0 + top + 36, 'wall');
    addCone(tx, tz, r + 8, 8, Y0 + top + 36, Y0 + top + 36 + sp, 'spire', { axis: [tx, tz], n: 8 });
    for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; pinnacle(tx + Math.cos(a) * (r + 4), tz + Math.sin(a) * (r + 4), Y0 + top + 36, 140, 10); }
  }
  // ---- the cathedral behind the wall: nave, aisles, flying buttresses
  const KZ = 330;
  addBox(-175, 175, Y0, Y0 + 640, KZ + 40, 860, 'wall', { win: [{ y0: Y0 + 380, h: 190, w: 30, sp: 80 }], arcade: { y0: Y0 + 300, h: 60, w: 18 } });
  addGableZ(-188, 188, KZ + 40, 860, Y0 + 640, Y0 + 880, 'roof');
  for (const sx of [-1, 1]) {
    const a0 = sx < 0 ? -290 : 175, a1 = sx < 0 ? -175 : 290;
    addBox(a0, a1, Y0, Y0 + 360, KZ + 80, 830, 'wall', { win: [{ y0: Y0 + 130, h: 170, w: 28, sp: 75 }] });
    for (let z = KZ + 110; z <= 800; z += 75) {
      const b0 = sx < 0 ? -322 : 290, b1 = sx < 0 ? -290 : 322, bx = (b0 + b1) / 2;
      addBox(b0, b1, Y0, Y0 + 430, z - 11, z + 11, 'wall', { courses: [Y0 + 200, Y0 + 360] }); pinnacle(bx, z, Y0 + 430, 150, 14);
      addBeam(bx - sx * 14, sx * 176, z - 7, z + 7, Y0 + 420, Y0 + 590, 22, 'wall');                 // flying buttress
      addBeam(bx - sx * 14, sx * 176, z - 7, z + 7, Y0 + 330, Y0 + 470, 18, 'wall');
    }
  }
  // ---- west front: three portals, a gallery of kings, the rose, twin towers with tall crocketed spires
  addBox(-175, 175, Y0, Y0 + 800, KZ, KZ + 40, 'wall', { rose: { u: 0, y: Y0 + 580, r: 110 }, door: { u: 0, y: Y0, w: 110, h: 250 }, niches: { y0: Y0 + 330, h: 80, w: 22, sp: 34, from: -170, to: 170 }, courses: [Y0 + 320, Y0 + 420, Y0 + 720], corbels: Y0 + 785 });
  addGableX(-175, 175, KZ, KZ + 40, Y0 + 800, Y0 + 990, 'wall');
  for (const sx of [-1, 1]) {
    const x0 = sx < 0 ? -335 : 175, x1 = sx < 0 ? -175 : 335, cx = (x0 + x1) / 2;
    addBox(x0, x1, Y0, Y0 + 1100, KZ - 30, KZ + 130, 'wall', { door: { u: 0, y: Y0, w: 70, h: 180 }, niches: { y0: Y0 + 330, h: 80, w: 22, sp: 34, from: -80, to: 80 }, win: [{ y0: Y0 + 840, h: 210, w: 26, sp: 52 }, { y0: Y0 + 480, h: 230, w: 42, sp: 1e9 }], courses: [Y0 + 320, Y0 + 420, Y0 + 780, Y0 + 1080], arcade: { y0: Y0 + 730, h: 40, w: 16 }, corbels: Y0 + 1086 });
    addCone(cx, KZ + 50, 92, 8, Y0 + 1100, Y0 + 1800, 'spire', { axis: [cx, KZ + 50], n: 8 });
    for (const [px, pz] of [[x0, KZ - 30], [x1, KZ - 30], [x0, KZ + 130], [x1, KZ + 130]]) pinnacle(px, pz, Y0 + 1100, 220, 14);
    for (const px of [x0 + 4, x1 - 4]) { addBox(px - 13, px + 13, Y0, Y0 + 920, KZ - 54, KZ - 28, 'wall', { courses: [Y0 + 320, Y0 + 620] }); addCone(px, KZ - 41, 18, 4, Y0 + 920, Y0 + 1040, 'spire'); }
  }
  // ---- transept, crossing tower and the great spire
  addBox(-400, 400, Y0, Y0 + 620, 650, 760, 'wall', { win: [{ y0: Y0 + 260, h: 230, w: 60, sp: 1e9 }], arcade: { y0: Y0 + 40, h: 120, w: 34 } });
  addGableX(-412, 412, 650, 760, Y0 + 620, Y0 + 820, 'roof');
  addPrism(0, 705, 118, 8, Y0 + 600, Y0 + 1140, 'wall', { win: [{ y0: Y0 + 880, h: 200, w: 30 }], courses: [Y0 + 860, Y0 + 1120] });
  addCone(0, 705, 126, 8, Y0 + 1140, Y0 + 2100, 'spire', { axis: [0, 705], n: 8 });
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; pinnacle(Math.cos(a) * 128, 705 + Math.sin(a) * 128, Y0 + 1140, 190, 11); }
  // ---- apse
  addPrism(0, 870, 150, 8, Y0, Y0 + 580, 'wall', { win: [{ y0: Y0 + 230, h: 230, w: 30 }] });
  addCone(0, 870, 158, 8, Y0 + 580, Y0 + 760, 'roof');
  solids.forEach((s, i) => { const b = s.bb; s.id = i; s.cx = (b[0] + b[1]) / 2; s.cy = (b[2] + b[3]) / 2; s.cz = (b[4] + b[5]) / 2; });
}

function boxT(b, ox, oy, oz, ix, iy, iz) {
  let t0 = (b[0] - ox) * ix, t1 = (b[1] - ox) * ix; if (t0 > t1) { const q = t0; t0 = t1; t1 = q; }
  let u0 = (b[2] - oy) * iy, u1 = (b[3] - oy) * iy; if (u0 > u1) { const q = u0; u0 = u1; u1 = q; }
  if (u0 > t0) t0 = u0; if (u1 < t1) t1 = u1; if (t0 > t1) return false;
  u0 = (b[4] - oz) * iz; u1 = (b[5] - oz) * iz; if (u0 > u1) { const q = u0; u0 = u1; u1 = q; }
  if (u0 > t0) t0 = u0; if (u1 < t1) t1 = u1;
  return t0 <= t1 && t1 > 0;
}
// Primary rays all share one direction, shadow rays another, vertical probes a third: project every
// solid's box onto the plane across each direction once, bin it, and a ray only tests its own bin.
const BINS = {};
function makeBins(e1, e2, cell) {
  const map = new Map(), key = (i, j) => (i + 4096) * 8192 + j + 4096;
  for (const so of solids) {
    const b = so.bb; let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (let k = 0; k < 8; k++) {
      const x = b[k & 1], y = b[2 + ((k >> 1) & 1)], z = b[4 + ((k >> 2) & 1)];
      const u = x * e1[0] + y * e1[1] + z * e1[2], v = x * e2[0] + y * e2[1] + z * e2[2];
      if (u < a0) a0 = u; if (u > a1) a1 = u; if (v < b0) b0 = v; if (v > b1) b1 = v;
    }
    for (let i = Math.floor(a0 / cell); i <= Math.floor(a1 / cell); i++) for (let j = Math.floor(b0 / cell); j <= Math.floor(b1 / cell); j++) {
      const k = key(i, j); let l = map.get(k); if (!l) map.set(k, l = []); l.push(so);
    }
  }
  const none = [];
  return (x, y, z) => map.get(key(Math.floor((x * e1[0] + y * e1[1] + z * e1[2]) / cell), Math.floor((x * e2[0] + y * e2[1] + z * e2[2]) / cell))) || none;
}
function buildBins() {
  BINS.view = makeBins([1, 0, 0], [0, COSP, SINP], 48);                    // along the camera ray
  const L = LGT, a = [L[2], 0, -L[0]], am = Math.hypot(...a), e1 = a.map(c => c / am);
  const e2 = [L[1] * e1[2] - L[2] * e1[1], L[2] * e1[0] - L[0] * e1[2], L[0] * e1[1] - L[1] * e1[0]];
  BINS.sun = makeBins(e1, e2, 48);                                          // along the sun
  BINS.down = makeBins([1, 0, 0], [0, 0, 1], 48);                           // straight down
}
function cast(ox, oy, oz, dx, dy, dz, tmin, list) {
  const ix = 1 / (dx || 1e-9), iy = 1 / (dy || 1e-9), iz = 1 / (dz || 1e-9);
  let best = 1e9, bn = null, bs = null;
  for (const so of list || solids) {
    if (!boxT(so.bb, ox, oy, oz, ix, iy, iz)) continue;
    let t0 = -1e9, t1 = 1e9, n0 = null;
    for (const p of so.pl) {
      const den = p[0] * dx + p[1] * dy + p[2] * dz, dist = p[3] - (p[0] * ox + p[1] * oy + p[2] * oz);
      if (Math.abs(den) < 1e-9) { if (dist < 0) { t0 = 1e9; break; } continue; }
      const tt = dist / den;
      if (den < 0) { if (tt > t0) { t0 = tt; n0 = p; } } else if (tt < t1) t1 = tt;
      if (t0 > t1) break;
    }
    if (t0 <= t1 && t0 > tmin && t0 < best) { best = t0; bn = n0; bs = so; }
  }
  return bn ? { t: best, n: bn, so: bs, kind: bs.kind } : null;
}
function insideAny(x, y, z) {
  for (const so of BINS.down ? BINS.down(x, y, z) : solids) {
    const b = so.bb; if (x < b[0] || x > b[1] || y < b[2] || y > b[3] || z < b[4] || z > b[5]) continue;
    let ok = true; for (const p of so.pl) if (p[0] * x + p[1] * y + p[2] * z > p[3]) { ok = false; break; } if (ok) return true;
  }
  return false;
}

function pointedArch(u, v, cx, w, y0, h) { const du = Math.abs(u - cx) / (w / 2); return du < 1 && v > y0 && v < y0 + h * (1 - 0.55 * (1 - Math.sqrt(Math.max(0, 1 - du * du)))); }
// carving on the stone as a function of the hit point: courses, ashlar, windows, portals, the rose
let ORN_WIN = -1;  // set by ornament when the hit falls in a window opening
function ornament(x, y, z, n, so, base) {
  ORN_WIN = -1;
  const kind = so.kind, M = so.meta;
  let v = base;
  if (kind === 'roof') { if (((y / 16) % 1) < 0.2) v *= 0.55; if ((((x + z) / 34) % 1 + 1) % 1 < 0.08) v *= 0.8; return v; }
  if (kind === 'spire') {
    if (((y / 42) % 1) < 0.12) v *= 0.5;
    if (M.axis) { // crockets: knobs climbing every edge of the spire
      const a = Math.atan2(z - M.axis[1], x - M.axis[0]), step = 2 * Math.PI / M.n;
      const e = Math.abs((((a - Math.PI / 2 - step / 2) % step) + step * 1.5) % step - step / 2);
      if (e < 0.11 && ((y / 38) % 1) < 0.45) return Math.min(1, v * 1.9 + 0.12);
    }
    return v;
  }
  if (kind === 'rock') { v *= 0.5 + 0.75 * vnoise(x * 0.025 + z * 0.012, y * 0.06 + z * 0.01); if (Math.abs(Math.sin(x * 0.045 + y * 0.12 + z * 0.03)) < 0.07) v *= 0.35; return v; }
  if (kind === 'step') { // treads catch the light with a bright nosing, risers stay dark
    if (n[1] > 0.5) return Math.min(1, z - M.zf < 4.5 ? v * 1.6 + 0.25 : v * 0.95 + 0.08);
    if (n[2] < -0.7) return y % 12 > 10.2 ? v * 0.9 : v * 0.22;
    return v * 0.7;
  }
  if (Math.abs(n[1]) > 0.5) return v;
  const tx = -n[2], tz = n[0];
  const cx = M.prism ? M.prism[0] + n[0] * M.prism[2] : M.c[0], cz = M.prism ? M.prism[1] + n[2] * M.prism[2] : M.c[1];
  const u = (x - cx) * tx + (z - cz) * tz, front = n[2] < -0.7;
  const row = Math.floor(y / 18);
  if ((y / 18) % 1 < 0.12 || ((((u + (row & 1) * 16) / 32) % 1) + 1) % 1 < 0.07) v *= 0.62;
  if (M.courses) for (const c of M.courses) { if (Math.abs(y - c) < 4) return Math.min(1, v * 1.6); if (y < c - 4 && y > c - 8) return v * 0.45; }
  if (M.corbels !== undefined && y < M.corbels && y > M.corbels - 22) {   // a row of corbels under the parapet
    const cu = (((u % 22) + 22) % 22) - 11, dy = M.corbels - y;
    return Math.abs(cu) < 5 - dy * 0.15 ? Math.min(1, v * 1.5) : v * 0.3;
  }
  if (M.wimperg && front) {   // the gable over the portal: crocketed edges, a sunk field with a trefoil
    const W = M.wimperg, h = W.y1 - W.y0, edge = W.hw * (1 - (y - W.y0) / h) - Math.abs(u);
    if (edge < 9) return ((y / 20) % 1) < 0.5 ? Math.min(1, v * 1.8) : v * 0.5;
    if (edge < 18) return v * 0.45;
    const d = Math.hypot(u, y - (W.y0 + h * 0.34));
    for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + k * 2 * Math.PI / 3, dd = Math.hypot(u - Math.cos(a) * 18, y - (W.y0 + h * 0.34) - Math.sin(a) * 18); if (Math.abs(dd - 16) < 3) return Math.min(1, v * 1.6); }
    if (d < 46) return v * 0.3;
    return v * 0.75;
  }
  if (M.door && front) {
    const D = M.door, du = u - D.u, hy = y - D.y;
    if (pointedArch(du, y, 0, D.w, D.y, D.h)) {
      const spring = D.h * 0.62;
      if (hy > spring) { // tympanum: carved stone over the lintel
        if (hy < spring + 7) return Math.min(1, v * 1.5);
        const d = Math.hypot(du, hy - spring - (D.h - spring) * 0.42);
        return Math.abs(d - D.w * 0.18) < 3 || Math.abs(d - D.w * 0.09) < 2.5 ? Math.min(1, v * 1.5) : v * 0.55;
      }
      // two oak leaves: planks, iron straps with studs, a seam, ring pulls
      if (Math.abs(du) < 1.8) return 0.02;
      const g = 0.17 + vnoise(du * 0.6, hy * 0.05) * 0.1;
      for (const sy of [0.12, 0.33, 0.54]) { const yy = spring * sy; if (Math.abs(hy - yy) < 4.5) return ((Math.abs(du) % 13) < 3 && Math.abs(hy - yy) < 2.5) ? 0.75 : 0.42; }
      const rd = Math.hypot(Math.abs(du) - 15, hy - spring * 0.45);
      if (Math.abs(rd - 6) < 1.6) return 0.62;
      if (((Math.abs(du) % 11) < 1.1)) return 0.05;
      return g;
    }
    // archivolts: several orders of mouldings, each with voussoir joints and a dark hollow between
    for (let k = 1; k <= 4; k++) {
      if (pointedArch(du, y, 0, D.w + k * 22, D.y, D.h + k * 15)) {
        const r = Math.atan2(hy, du) * (D.w + k * 22) / 6;
        return k & 1 ? ((((r % 1) + 1) % 1) < 0.15 ? v * 0.6 : Math.min(1, v * 1.5)) : v * 0.3;
      }
    }
  }
  if (M.rose && front) {
    const R = M.rose, d = Math.hypot(u - R.u, y - R.y);
    if (d < R.r * 1.12 && d >= R.r) return Math.min(1, v * 1.5);
    if (d < R.r) { const a = Math.atan2(y - R.y, u - R.u); if (d < R.r * 0.15 || Math.abs(d - R.r * 0.58) < R.r * 0.06 || d > R.r * 0.9 || (Math.abs(Math.sin(a * 6)) < 0.15 && d > R.r * 0.15)) return 0.9; ORN_WIN = 1e6; return 0.03; }
  }
  if (M.niches && y > M.niches.y0 - 6 && y < M.niches.y0 + M.niches.h + 14) {   // canopied niches, each with a dark hollow and a pale figure
    const N = M.niches;
    if (u > N.from && u < N.to && !(N.skip && Math.abs(u) < N.skip)) {
      const local = N.sp >= 1e8 ? u : (((u - N.from) % N.sp) + N.sp) % N.sp - N.sp / 2;
      if (pointedArch(local, y, 0, N.w, N.y0, N.h)) {
        const fy = y - N.y0, fig = Math.abs(local) < (fy > N.h * 0.62 ? 3.5 : fy > N.h * 0.55 ? 2 : 5.5 - fy / N.h * 2) && fy < N.h * 0.72 && fy > 4;
        return fig ? Math.min(1, v * 1.3 + 0.08) : v * 0.18;
      }
      if (pointedArch(local, y, 0, N.w + 8, N.y0 - 4, N.h + 14)) return Math.min(1, v * 1.5);
    }
  }
  if (M.win) for (let bi = 0; bi < M.win.length; bi++) {
    const b = M.win[bi];
    if (y < b.y0 - 8 || y > b.y0 + b.h + 8 || (b.front && !front)) continue;
    const sp = b.sp || 1e9, local = sp >= 1e8 ? u : (((u % sp) + sp) % sp) - sp / 2;
    if (pointedArch(local, y, 0, b.w, b.y0, b.h)) {
      if (Math.abs(local) < 1.4 && b.w > 24) return 0.5;
      ORN_WIN = so.id * 997 + bi * 61 + (sp >= 1e8 ? 0 : Math.floor(u / sp + 0.5) & 31) + Math.round(n[0] * 3 + n[2] * 7) * 13;
      return 0.03;
    }
    if (pointedArch(local, y, 0, b.w + 10, b.y0 - 5, b.h + 12)) return Math.min(1, v * 1.5);
  }
  if (M.arcade && y > M.arcade.y0 - 4 && y < M.arcade.y0 + M.arcade.h + 6) {   // blind arcade: shallow pointed arches
    const A = M.arcade, local = (((u % (A.w * 1.4)) + A.w * 1.4) % (A.w * 1.4)) - A.w * 0.7;
    if (pointedArch(local, y, 0, A.w, A.y0, A.h)) return v * 0.55;
    if (pointedArch(local, y, 0, A.w + 6, A.y0 - 3, A.h + 8)) return Math.min(1, v * 1.4);
  }
  return v;
}

const cathedral = { cv: null };
function buildCathedral() {
  buildModel();
  buildBins();
  const ox = COLS * 0.5 * CW, oy = 2150 * MS + 40;  // screen spot of the mound's front foot
  const Dv = [0, -SINP, COSP];
  const cx0 = Math.max(0, Math.floor((ox - 820 * MS) / CW)), cx1 = Math.min(COLS - 1, Math.ceil((ox + 820 * MS) / CW));
  const cy0 = Math.max(0, Math.floor((oy - 2150 * MS) / CH)), cy1 = Math.min(ROWS - 1, Math.ceil((oy + 110 * MS) / CH));
  const BW = cx1 - cx0 + 1, BH2 = cy1 - cy0 + 1;
  const lum = new Float32Array(BW * BH2).fill(-1), dep = new Float32Array(BW * BH2), face = new Uint8Array(BW * BH2), lit = [];
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const sx = (cx + 0.5) * CW, sy = (cy + 0.5) * CH;
    const px = (sx - ox) / MS, py = -(sy - oy) / MS * COSP, pz = -(sy - oy) / MS * SINP;
    const O = [px - Dv[0] * 6000, py - Dv[1] * 6000, pz - Dv[2] * 6000];
    const h = cast(O[0], O[1], O[2], Dv[0], Dv[1], Dv[2], 0, BINS.view(px, py, pz));
    if (!h) continue;
    const hx = O[0] + Dv[0] * h.t, hy = O[1] + Dv[1] * h.t, hz = O[2] + Dv[2] * h.t;
    const n = h.n;
    const diff = Math.max(0, n[0] * LGT[0] + n[1] * LGT[1] + n[2] * LGT[2]);
    const alb = h.kind === 'roof' ? 0.8 : h.kind === 'spire' ? 0.66 : h.kind === 'step' ? 0.85 : h.kind === 'rock' ? 0.5 : 0.74;
    let v = alb * (0.22 + 0.95 * diff);
    if (diff > 0 && cast(hx + n[0] * 0.5, hy + n[1] * 0.5, hz + n[2] * 0.5, LGT[0], LGT[1], LGT[2], 0.01, BINS.sun(hx, hy, hz))) v *= 0.42;
    const plain = v;
    v = ornament(hx, hy, hz, n, h.so, v);
    const ft = v < 0.1 && plain > 0.12 ? 4 : h.kind === 'roof' ? 2 : h.kind === 'step' ? 6 : h.kind === 'rock' ? 5 : h.kind === 'spire' ? 3 : n[2] < -0.7 ? 0 : 1;
    v *= 0.82 + 0.3 * vnoise(hx * 0.03 + hz * 0.02, hy * 0.04) + (hash(cx, cy) - 0.5) * 0.12;
    const k = (cy - cy0) * BW + (cx - cx0);
    lum[k] = Math.max(0.02, v); dep[k] = oy - hz * SINP * MS; face[k] = ft;
    if (ORN_WIN >= 0 && ft === 4 && (ORN_WIN === 1e6 || hash(ORN_WIN, 7) < 0.32)) lit.push(cx, cy, ORN_WIN === 1e6 ? -1 : ORN_WIN);
  }
  for (let y = 1; y < BH2; y++) for (let x = 0; x < BW; x++) { const k = y * BW + x; if (lum[k] >= 0 && lum[k - BW] < 0) lum[k] = Math.min(1, lum[k] + 0.25); }
  const glyph = new Int16Array(BW * BH2), lev = new Uint8Array(BW * BH2), runs = [];
  for (let k = 0; k < lum.length; k++) {
    if (lum[k] < 0) continue;
    const x = k % BW, y = (k / BW) | 0;
    const v = Math.min(0.999, lum[k] + (hash(x * 3, y * 7) - 0.5) * 0.08);
    const set = FACESETS[face[k]];
    if (!set.length || v < 0.06) { glyph[k] = -1; continue; }
    glyph[k] = CI[set[(hash(x * 13 + 1, y * 17 + 3) * set.length) | 0]];
    lev[k] = BL0 + Math.min(BLN - 1, (Math.pow(Math.min(1, v * 1.15), 0.7) * BLN) | 0);
  }
  for (let y = 0; y < BH2; y++) {                 // dark backing, one run per stretch of stone in a row
    const r = []; let s0 = -1;
    for (let x = 0; x <= BW; x++) { const on = x < BW && lum[y * BW + x] >= 0; if (on && s0 < 0) s0 = x; if (!on && s0 >= 0) { r.push(s0, x); s0 = -1; } }
    runs.push(r);
  }
  const cv = true;
  Object.assign(cathedral, { cv, cx0, cy0, BW, BH: BH2, lum, dep, glyph, lev, runs, ox, oy, face, gateRow: (oy + 110 * SINP * MS) / CH, lit });
  // one glow per lit window, at its centre
  const wins = new Map();
  for (let j = 0; j < lit.length; j += 3) { const w = wins.get(lit[j + 2]) || [0, 0, 0]; w[0] += lit[j]; w[1] += lit[j + 1]; w[2]++; wins.set(lit[j + 2], w); }
  cathedral.glows = [...wins].map(([id, w]) => ({ id, x: (w[0] / w[2] + 0.5) * CW, y: (w[1] / w[2] + 0.5) * CH, r: Math.sqrt(w[2]) * CW * (id < 0 ? 2.2 : 3.2) }));
  // two small fires on the terrace, either side of the gate
  braziers.length = 0;
  for (const sx of [-1, 1]) braziers.push({ isFire: true, x: (ox + sx * 108 * MS) / CW, y: (oy - 66 * SINP * MS) / CH - 0.7, lift: 120 * COSP * MS, parts: [], seed: sx });
  // and a campfire by the trail where he starts, so the firelight is a few steps away
  { const sy = ROWS - VR * 0.3 - 5; braziers.push({ isFire: true, ground: true, x: pathX(sy) + 16, y: sy - 0.7, lift: 0, parts: [], seed: 3 }); }
  // footprint (collision), ground shadows and a little contact darkness
  bmask.fill(0); bshade.fill(0);
  const fy0 = Math.max(0, Math.floor((oy - 1060 * SINP * MS) / CH)), fy1 = Math.min(ROWS - 1, Math.ceil((oy + 120 * SINP * MS) / CH));
  for (let cy = fy0; cy <= fy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const gx = ((cx + 0.5) * CW - ox) / MS, gz = -((cy + 0.9) * CH - oy) / (SINP * MS);
    if (insideAny(gx, 2, gz)) { bmask[cy * COLS + cx] = 1; kind[cy * COLS + cx] = 0; }
  }
  const sx1 = Math.min(COLS - 1, Math.ceil((ox + 1400 * MS) / CW));
  for (let cy = fy0; cy <= fy1; cy++) for (let cx = cx0; cx <= sx1; cx++) {
    const i = cy * COLS + cx; if (bmask[i]) continue;
    const gx = ((cx + 0.5) * CW - ox) / MS, gz = -((cy + 0.5) * CH - oy) / (SINP * MS);
    if (cast(gx, 0.5, gz, LGT[0], LGT[1], LGT[2], 0.01, BINS.sun(gx, 0.5, gz))) bshade[i] = 0.38;
  }
  props.length = 0;
  props.push({ spots: [{ x: ox / CW, y: (oy - 74 * SINP * MS) / CH - 0.7, r: 16, need: () => (player.hT || 0) > 100, label: 'push the great gate', use: () => say(player, 'the gate is sealed. something stirs within.') }] });
}

// Grid position → castle model ground point under the feet.
const toModelXZ = (x, y) => [(x * CW - cathedral.ox) / MS, -((y + 0.7) * CH - cathedral.oy) / (SINP * MS)];
// Height of the walkable surface under a point: 0 on the field, the top of rock or stair on the mound,
// Infinity inside walls and towers.
function surfAt(x, y) {
  if (!cathedral.cv) return 0;
  const [gx, gz] = toModelXZ(x, y);
  if (gz < -140 || gz > 1060 || Math.abs(gx) > 800) return 0;
  const h = cast(gx, 5000, gz, 0, -1, 0, 0, BINS.down(gx, 0, gz));
  if (!h) return 0;
  return h.kind === 'rock' || h.kind === 'step' ? 5000 - h.t : Infinity;
}

let castleDraw = null;
function drawCathedral() {
  const C = cathedral;
  if (!C.cv) return;
  const x = C.cx0 * CW, w = C.BW * CW;
  const far = Math.max(0, Math.min(1, ((player.y + 0.7) * CH - C.oy) / (H * 2.4)));
  // visible rows only: backing runs, then glyphs; far away it fades, lightning lifts it a few shades
  const a = 1 - far * 0.55, up = Math.round(flash * 3);
  const y0 = Math.max(0, VY0 - C.cy0), y1 = Math.min(C.BH - 1, VY1 - C.cy0), xa = Math.max(0, VX0 - C.cx0), xb = Math.min(C.BW, VX1 - C.cx0 + 1);
  for (let yy = y0; yy <= y1; yy++) {
    const r = C.runs[yy], py = (C.cy0 + yy) * CH;
    for (let j = 0; j < r.length; j += 2) { const s0 = Math.max(xa, r[j]), s1 = Math.min(xb, r[j + 1]); if (s1 > s0) grect((C.cx0 + s0) * CW - 0.4, py - 0.4, (s1 - s0) * CW + 0.8, CH + 0.8, a); }
    for (let xx = xa, k = yy * C.BW + xa; xx < xb; xx++, k++) { const gl = C.glyph[k]; if (gl >= 0 && C.lum[k] >= 0) gput(gl * NB + Math.min(BL0 + BLN - 1, C.lev[k] + up), (C.cx0 + xx) * CW - 1 / DPR, py - 1 / DPR, a); }
  }
  const mist = ctx.createLinearGradient(0, C.oy - 260 * MS, 0, C.oy + 60 * MS);  // ground mist round the mound
  mist.addColorStop(0, 'rgba(170,170,170,0)'); mist.addColorStop(0.6, `rgba(170,170,170,${0.05 + far * 0.08})`); mist.addColorStop(1, 'rgba(170,170,170,0)');
  ctx.fillStyle = mist; ctx.fillRect(x, C.oy - 260 * MS, w, 320 * MS);
}
// stone that stands between the camera and someone: redraw it over them
function occlude(e) {
  const C = cathedral;
  if (!C.cv) return;
  const feet = (e.y + 0.7) * CH;
  const hw = knightPx() * 0.7 / CW, x0 = Math.max(C.cx0, Math.floor(e.x - hw)), x1 = Math.min(C.cx0 + C.BW - 1, Math.ceil(e.x + hw));
  const top = e.y - (liftPx(e) + knightPx()) / CH - 2;
  const y0 = Math.max(C.cy0, Math.floor(top)), y1 = Math.min(C.cy0 + C.BH - 1, Math.ceil(e.y + 1 - liftPx(e) / CH));
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const k = (cy - C.cy0) * C.BW + (cx - C.cx0);
    if (C.lum[k] < 0 || C.dep[k] <= feet + 1.5) continue;
    gput(SOLID_CELL, cx * CW, cy * CH, 1);
    if (C.glyph[k] >= 0) blit(C.glyph[k], C.lev[k], cx * CW, cy * CH);
  }
}
