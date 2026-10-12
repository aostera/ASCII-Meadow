// Three volumetric ASCII gothic ruins. Reuses the cathedral's real 3D ray/stone
// shading, but keeps geometry and glyph tiles separate from its castle model.
// Walls have physical ground footprints. The pointed arches are actual empty
// spaces in the mesh and the ONLY traversable entries/exits.
const ruins = [];
const RUIN_DIR = [0, -SINP, COSP];

 // The global game camera is fixed; turn each 3D building itself to expose
 // walls, thickness and roof fragments in an oblique three-quarter view.
 // Both physics and image use this SAME reversible world/model transform.
function ruinWorldXZ(site, x, z) {
  const c = Math.cos(site.yaw || 0), sn = Math.sin(site.yaw || 0);
  return [site.x + x * c + z * sn, site.z - x * sn + z * c];
}
function ruinLocalXZ(site, x, z) {
  const c = Math.cos(site.yaw || 0), sn = Math.sin(site.yaw || 0);
  const dx = x - site.x, dz = z - site.z;
  return [dx * c - dz * sn, dx * sn + dz * c];
}
function ruinRotateMesh(mesh, site) {
  const c = Math.cos(site.yaw || 0), sn = Math.sin(site.yaw || 0);
  const rot = (x, z) => [x * c + z * sn, -x * sn + z * c];
  for (const so of mesh) {
    // Rotating each convex halfspace preserves the actual 3D openings.
    so.pl = so.pl.map(p => {
      const [nx, nz] = rot(p[0], p[2]);
      return [nx, p[1], nz, p[3]];
    });
    const b = so.bb, x = (b[0] + b[1]) / 2, z = (b[4] + b[5]) / 2;
    const hx = (b[1] - b[0]) / 2, hz = (b[5] - b[4]) / 2;
    const [cx, cz] = rot(x, z);
    const rx = Math.abs(c) * hx + Math.abs(sn) * hz;
    const rz = Math.abs(sn) * hx + Math.abs(c) * hz;
    so.bb = [cx - rx, cx + rx, b[2], b[3], cz - rz, cz + rz];
    // Ashlar, window recesses and spire ornament follow the stone normals.
    const m = so.meta;
    if (m.c) m.c = rot(m.c[0], m.c[1]);
    if (m.prism) {
      const [px, pz] = rot(m.prism[0], m.prism[1]);
      m.prism = [px, pz, m.prism[2]];
    }
    if (m.axis) m.axis = rot(m.axis[0], m.axis[1]);
  }
}

function ruinPortalWall(w, z, thickness, height, gateWidth, gateHeight) {
  const x0 = -w / 2, x1 = w / 2, a = gateWidth / 2;
  const zs = [z - thickness / 2, z + thickness / 2];
  const stone = { courses: [height * .33, height * .68] };
  // Cut high lancet windows THROUGH the pier volumes; they aren't a dark decal.
  const piercedPier = (left, right) => {
    const mid = (left + right) / 2, slit = Math.min(8, (right - left) * .16);
    const sill = height * .37, lintel = height * .61;
    addBox(left, mid - slit, 0, height, zs[0], zs[1], 'wall', stone);
    addBox(mid + slit, right, 0, height, zs[0], zs[1], 'wall', stone);
    addBox(mid - slit, mid + slit, 0, sill, zs[0], zs[1], 'wall', stone);
    addBox(mid - slit, mid + slit, lintel, height, zs[0], zs[1], 'wall', stone);
    addGableZ(mid - slit, mid + slit, zs[0], zs[1],
      lintel - 6, lintel + 13, 'wall', stone);
  };
  piercedPier(x0, -a);
  piercedPier(a, x1);
  // Gothic pointed arch: empty below the voussoirs, gradually closes at apex.
  const spring = gateHeight * .65, strips = 7, top = gateHeight;
  for (let j = 0; j < strips; j++) {
    const lo = spring + j * (top - spring) / strips;
    const hi = spring + (j + 1) * (top - spring) / strips;
    const u = (hi - spring) / (top - spring);
    const half = a * (1 - u * u);
    if (half < a) {
      addBox(-a, -half, lo, hi, zs[0], zs[1], 'wall', stone);
      addBox(half, a, lo, hi, zs[0], zs[1], 'wall', stone);
    }
  }
  addBox(-a, a, top, height, zs[0], zs[1], 'wall',
    { win: [{ y0: height - 76, h: 54, w: 22 }], courses: [height - 35] });
}
function ruinSideWalls(w, d, wallHeight, thickness) {
  for (const side of [-1, 1]) {
    const x = side * (w / 2 - thickness / 2);
    // A complete low wall for physics, but staggered stone heights above it.
    addBox(x - thickness / 2, x + thickness / 2, 0, wallHeight * .65,
      -d / 2, d / 2, 'wall', { courses: [wallHeight * .35] });
    const n = 6, bay = d / n;
    for (let k = 0; k < n; k++) {
      const z0 = -d / 2 + bay * k, z1 = z0 + bay;
      const crown = wallHeight *
        ([.98, .83, 1.12, .76, 1.04, .9][(k + (side > 0 ? 2 : 0)) % 6]);
      addBox(x - thickness / 2, x + thickness / 2,
        wallHeight * .65, crown, z0, z1, 'wall', { courses: [wallHeight * .78] });
    }
  }
}
function ruinDetail(site) {
  const { width: w, depth: d, height: h, arch: a, archHeight: ah } = site;
  const th = 14;
  ruinPortalWall(w, -d / 2 + th / 2, th, h * .7, a, ah);
  ruinPortalWall(w,  d / 2 - th / 2, th, Math.max(h * .54, ah + 14), a, ah);
  ruinSideWalls(w, d, h * .39, th);
  if (site.type === 'gate') {
    // Asymmetrically shattered gatehouse: a high left tower, a shorter right
    // broken curtain, crenelated stone ends and irregular capstones.
    addBox(-w / 2 - 9, -w / 2 + 35, 0, h, -d / 2 - 5, -d / 2 + 39, 'wall',
      { win: [{ y0: h * .55, h: 91, w: 18 }], courses: [70, 154, 238] });
    addBox(w / 2 - 32, w / 2 + 7, 0, h * .65, -d / 2 - 5, -d / 2 + 30, 'wall');
    for (const [x, ht] of [[-w / 2 - 4, h * .94], [-w / 2 + 30, h * .87],
      [w / 2 - 15, h * .57], [w / 2 + 4, h * .6]]) {
      addBox(x - 7, x + 7, ht, ht + 18, -d / 2 - 4, -d / 2 + 18, 'wall');
    }
    // Jagged fragments atop the arch, leaving the ground opening intact.
    addGableZ(-w * .28, w * .28, -d / 2, -d / 2 + th, h * .7, h * .88, 'wall');
  } else if (site.type === 'abbey') {
    // Large abbey façade, central open arcade, damaged gable and twin lancets.
    addGableZ(-w * .42, w * .42, -d / 2, -d / 2 + th, h * .7, h, 'wall');
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - 18);
      addPrism(x, -d / 2 + 4, 21, 6, 0, h * .84, 'wall',
        { win: [{ y0: h * .47, h: 80, w: 14 }] });
      addCone(x, -d / 2 + 4, 26, 4, h * .84, h * .98, 'spire');
      addBox(x - 18, x + 18, 0, h * .31, d / 2 - 18, d / 2 + 6, 'wall');
    }
    // Damaged tracery stays well above the passable portal.
    addBox(-33, -23, h * .71, h * .84, -d / 2 - 3, -d / 2 + 7, 'wall');
    addBox(23, 33, h * .71, h * .84, -d / 2 - 3, -d / 2 + 7, 'wall');
  } else {
    // Long ruined cloister: three sequential open pointed arches, broken
    // partial roof ribs and dense wall bays. There are no side entrances.
    ruinPortalWall(w, 0, 12, h * .72, a, ah);
    for (const sx of [-1, 1]) {
      for (const z of [-d * .3, 0, d * .3]) {
        const x = sx * (w / 2 - 7);
        addBox(x - 12, x + 12, 0, h * .58, z - 9, z + 9, 'wall');
        addBox(x - 18, x + 18, h * .56, h * .61, z - 12, z + 12, 'wall');
      }
    }
    // Sparse flying ribs only overhead; no roof blocking a through route.
    for (const z of [-d * .29, d * .29]) {
      addBeam(-w / 2 + 15, -12, z - 7, z + 7, h * .58, h * .89, 12, 'wall');
      addBeam(12, w / 2 - 15, z - 7, z + 7, h * .89, h * .58, 12, 'wall');
    }
    // Far end broken gable silhouette.
    addGableZ(-w * .35, w * .35, d / 2 - th, d / 2, h * .54, h * .81, 'wall');
  }
  ruinArchitecturalRelief(site);
}

function ruinArchitecturalRelief(site) {
  const { width: w, depth: d, height: h, arch: a, archHeight: ah } = site;
  const spring = ah * .65, half = a / 2;
  for (const face of [-1, 1]) {
    const z = face * (d / 2 + 2.5);
    // Double-depth portals and true stone voussoirs tracing the empty opening.
    for (const side of [-1, 1]) {
      const x = side * (half + 5);
      addBox(x - 4, x + 4, 4, spring, z - 3, z + 3, 'wall',
        { courses: [spring * .36, spring * .72] });
      const outside = side * (half + 13);
      addBox(outside - 3, outside + 3, 10, spring * .83,
        z - 1.5, z + 1.5, 'wall');
      for (let k = 0; k < 9; k++) {
        const lo = spring + k * (ah - spring) / 9;
        const hi = spring + (k + 1) * (ah - spring) / 9;
        const u = (hi - spring) / (ah - spring);
        const edge = half * (1 - u * u);
        const x0 = side < 0 ? -edge - 8 : edge + 1;
        const x1 = side < 0 ? -edge - 1 : edge + 8;
        addBox(x0, x1, lo, hi, z - 3, z + 3, 'wall');
      }
      // Small carved tracery projects out of the pierced stone pier.
      const mid = side * (half + (w / 2 - half) * .5);
      const y = h * .7;
      if (w / 2 - half > 32 && y > ah + 5) {
        addBox(mid - 13, mid - 9, y - 16, y + 25, z - 3, z + 3, 'wall');
        addBox(mid + 9, mid + 13, y - 16, y + 25, z - 3, z + 3, 'wall');
        addGableZ(mid - 14, mid + 14, z - 3, z + 3,
          y + 25, y + 40, 'wall');
      }
    }
    addBox(-half - 16, half + 16, ah + 15, ah + 21,
      z - 3, z + 3, 'wall');
    for (const y of [ah + 34, Math.max(ah + 54, h * .52)])
      if (y + 5 < h * .72)
        addBox(-w / 2 + 14, w / 2 - 14, y, y + 5,
          z - 2, z + 2, 'wall');
  }
  // Buttresses and finials are separate physical solids, not strokes.
  // Their low sections are INSIDE the existing wall collision footprints.
  for (const side of [-1, 1]) for (const z of [-d * .32, d * .03, d * .34]) {
    const x = side * (w / 2 - 8);
    const top = h * (site.type === 'cloister' ? .53 : .44);
    addBox(x - 7, x + 7, 0, top * .77,
      z - 12, z + 12, 'wall', { courses: [32, 70] });
    addBox(x - 8, x + 8, top * .76, top * .8,
      z - 14, z + 14, 'wall');
    addGableX(x - 7, x + 7, z - 11, z + 11, top * .79, top, 'wall');
  }
  if (site.type === 'abbey' || site.type === 'cloister') {
    const ribs = site.type === 'cloister' ?
      [-d * .28, d * .04, d * .34] : [-d * .14, d * .28];
    for (const z of ribs) {
      const top = Math.max(ah + 52, h * .72), edge = w * .44;
      const shoulder = Math.max(ah + 14, top * .84);
      // Beam undersides stay ABOVE the standing height at the portal.
      addBeam(-edge, -10, z - 4, z + 4, shoulder, top, 5, 'wall');
      addBeam(10, edge, z - 4, z + 4, top, shoulder, 5, 'wall');
      addBox(-11, 11, top - 3, top + 6, z - 6, z + 6, 'wall');
    }
  }
  // Chipped crenellations / missing wall courses, no full opaque roof.
  for (const side of [-1, 1]) for (let k = 0; k < 4; k++) {
    const z = -d * .37 + k * d * .24, x = side * (w / 2 - 8);
    const y = h * (.42 + .035 * ((k * 3 + (side > 0 ? 2 : 0)) % 4));
    addBox(x - 7, x + 7, y, y + 9, z - 6, z + 8, 'wall');
  }
}
// Keep all authored scenery unchanged on disk; suppress only rendered plants that
// would occupy the interior, arch thresholds or a wall's footings.
// Extra vegetation clearance protects the visible 3D side faces and absorbs
// pixel->world rounding at authored flora placements. The authored map stays
// completely unchanged; only nearby rendered plants are filtered.
const RUIN_FLORA_BUFFER = 72;
function ruinClearing(x, z, pad = 0) {
  return RUIN_SITES.some(r => {
    const [lx, lz] = ruinLocalXZ(r, x, z);
    return Math.abs(lx) < r.width / 2 + 20 + pad &&
      Math.abs(lz) < r.depth / 2 + 26 + pad;
  });
}
function ruinWallRectangles(site) {
  const w = site.width, d = site.depth, a = site.arch / 2, t = 14;
  const segments = [];
  const wall = z => {
    segments.push([-w / 2, -a, z - t / 2, z + t / 2]);
    segments.push([a, w / 2, z - t / 2, z + t / 2]);
  };
  wall(-d / 2 + t / 2);
  wall( d / 2 - t / 2);
  for (const side of [-1, 1])
    segments.push([side < 0 ? -w / 2 : w / 2 - t,
      side < 0 ? -w / 2 + t : w / 2, -d / 2, d / 2]);
  if (site.type === 'cloister') wall(0);
  if (site.type === 'gate') {
    segments.push([-w / 2 - 9, -w / 2 + 35, -d / 2 - 5, -d / 2 + 39]);
    segments.push([w / 2 - 32, w / 2 + 7, -d / 2 - 5, -d / 2 + 30]);
  }
  if (site.type === 'abbey') for (const side of [-1, 1]) {
    const x = side * (w / 2 - 18);
    segments.push([x - 21, x + 21, -d / 2 - 17, -d / 2 + 25]);
  }
  return segments;
}
function buildRuins() {
  ruins.length = 0;
  for (const site of RUIN_SITES) {
    const before = solids.length;
    ruinDetail(site);              // borrow cathedral mesh builder
    const mesh = solids.splice(before); // isolate it from the castle's mesh/bins
    ruinRotateMesh(mesh, site);
    mesh.forEach((so, i) => { so.id = 2000 + i; });
    const cx = cathedral.ox + site.x * WS;
    const cy = cathedral.oy - site.z * SINP * WS;
    const c = Math.cos(site.yaw || 0), sn = Math.sin(site.yaw || 0);
    const halfW = Math.abs(c) * site.width / 2 + Math.abs(sn) * site.depth / 2 + 40;
    const halfD = Math.abs(c) * site.depth / 2 + Math.abs(sn) * site.width / 2 + 18;
    const maxH = site.height * 1.08;
    const x0 = Math.max(0, Math.floor((cx - halfW * WS) / CW));
    const x1 = Math.min(COLS - 1, Math.ceil((cx + halfW * WS) / CW));
    const y0 = Math.max(0, Math.floor((cy - (halfD * SINP + maxH * COSP) * WS - 16) / CH));
    const y1 = Math.min(ROWS - 1, Math.ceil((cy + halfD * SINP * WS + 16) / CH));
    const gridW = x1 - x0 + 1, gridH = y1 - y0 + 1;
    const lum = new Float32Array(gridW * gridH).fill(-1);
    const dep = new Float32Array(gridW * gridH);
    const glyph = new Int16Array(gridW * gridH).fill(-1);
    const lev = new Uint8Array(gridW * gridH);
    const dir = RUIN_DIR;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = ((x + .5) * CW - cx) / WS;
      const t = -((y + .5) * CH - cy) / WS;
      const oy = t * COSP, oz = t * SINP;
      const hit = cast(px - dir[0] * 2200, oy - dir[1] * 2200,
        oz - dir[2] * 2200, dir[0], dir[1], dir[2], 0, mesh);
      if (!hit) continue;
      const hx = px - dir[0] * 2200 + dir[0] * hit.t;
      const hy = oy - dir[1] * 2200 + dir[1] * hit.t;
      const hz = oz - dir[2] * 2200 + dir[2] * hit.t;
      const n = hit.n;
      const diff = Math.max(0, n[0] * LGT[0] + n[1] * LGT[1] + n[2] * LGT[2]);
      const topFace = n[1] > .52, darkSide = n[0] > .52 || n[2] > .52;
      const key = .13 + 1.24 * diff;
      let shade = ornament(hx, hy, hz, n, hit.so,
        (hit.kind === 'spire' ? .7 : .76) *
        (key + (topFace ? .1 : darkSide ? -.025 : .025)));
      // Ray-cast occlusion of the light by neighboring REAL geometry;
      // baked on resize, never computed each animation frame.
      if (diff > .08 && cast(hx + n[0] * 1.5, hy + n[1] * 1.5,
        hz + n[2] * 1.5, LGT[0], LGT[1], LGT[2], .1, mesh))
        shade *= .46;
      shade *= (.82 + .18 * Math.min(1, hy / Math.max(1, site.height * .36))) *
        (.92 + .17 * vnoise(hx * .031 + hz * .021, hy * .035));
      const k = (y - y0) * gridW + x;
      lum[k] = Math.max(.02, Math.min(.999, shade));
      dep[k] = cy - hz * SINP * WS;
      const set = FACESETS[shade < .045 ? 4 : hit.kind === 'spire' ? 3 : n[1] > .6 ? 2 : n[2] < -.65 ? 0 : 1];
      if (set.length) {
        glyph[k] = CI[set[(hash(x * 11 + 7, y * 13 + 3) * set.length) | 0]];
        lev[k] = BL0 + Math.min(BLN - 1,
          (Math.pow(Math.min(1, shade * 1.15), .72) * BLN) | 0);
      }
    }
    ruins.push({ ...site, cx, cy, x0, x1, y0, y1, gridW, gridH,
      lum, dep, glyph, lev, walls: ruinWallRectangles(site),
      meshPieces: mesh.length });
  }
  paintRuinGroundShadows();
}
function drawRuins() {
  const up = Math.round(flash * 3);
  for (const r of ruins) {
    const xa = Math.max(r.x0, VX0), xb = Math.min(r.x1, VX1);
    const ya = Math.max(r.y0, VY0), yb = Math.min(r.y1, VY1);
    if (xa > xb || ya > yb) continue;
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      const k = (y - r.y0) * r.gridW + x;
      if (r.lum[k] < 0) continue;
      const px = x * CW, py = y * CH;
      grect(px - .4, py - .4, CW + .8, CH + .8, .92);
      if (r.glyph[k] >= 0)
        gput(r.glyph[k] * NB + Math.min(BL0 + BLN - 1, r.lev[k] + up), px, py, 1);
    }
  }
}
function ruinCellCovered(x, y, baseY) {
  for (const r of ruins) {
    if (x < r.x0 || x > r.x1 || y < r.y0 || y > r.y1) continue;
    const k = (y - r.y0) * r.gridW + x;
    if (r.lum[k] >= 0 && r.dep[k] > baseY) return true;
  }
  return false;
}
function ruinRowNearby(y) {
  return ruins.some(r => y + 1 >= r.y0 && y - 5 <= r.y1);
}
function occludeRuins(e) {
  if (!ruins.length) return;
  const feet = (e.y + .7) * CH;
  const hw = knightPx() * .7 / CW;
  const top = e.y - (liftPx(e) + knightPx()) / CH - 2;
  for (const r of ruins) {
    const left = Math.max(r.x0, Math.floor(e.x - hw));
    const right = Math.min(r.x1, Math.ceil(e.x + hw));
    const y0 = Math.max(r.y0, Math.floor(top));
    const y1 = Math.min(r.y1, Math.ceil(e.y + 1 - liftPx(e) / CH));
    if (left > right || y0 > y1) continue;
    for (let y = y0; y <= y1; y++) for (let x = left; x <= right; x++) {
      const k = (y - r.y0) * r.gridW + x;
      if (r.lum[k] < 0 || r.dep[k] <= feet + 1.5) continue;
      gput(SOLID_CELL, x * CW, y * CH, 1);
      if (r.glyph[k] >= 0) blit(r.glyph[k], r.lev[k], x * CW, y * CH);
    }
  }
}

 // Grounding: actual wall footprints project low-frequency stone shadows away
 // from the light (same world coordinate basis as the grass), including deep
 // contact shadow at their feet. Baked once on world build / resize.
function paintRuinGroundShadows() {
  if (!bshade || !bshade.length) return;
  for (const r of ruins) {
    const height = r.height * .62;
    const sx = -LGT[0] / LGT[1] * height;
    const sz = -LGT[2] / LGT[1] * height;
    const footprint = [];
    for (const x of [-r.width / 2 - 20, r.width / 2 + 20])
      for (const z of [-r.depth / 2 - 20, r.depth / 2 + 20]) {
        const [wx, wz] = ruinWorldXZ(r, x, z);
        footprint.push(mapToCell(wx, wz));
        footprint.push(mapToCell(wx + sx, wz + sz));
      }
    const x0 = Math.max(1, Math.floor(Math.min(...footprint.map(p => p[0]))));
    const x1 = Math.min(COLS - 2, Math.ceil(Math.max(...footprint.map(p => p[0]))));
    const y0 = Math.max(1, Math.floor(Math.min(...footprint.map(p => p[1]))));
    const y1 = Math.min(ROWS - 2, Math.ceil(Math.max(...footprint.map(p => p[1]))));
    const c = Math.cos(r.yaw || 0), sn = Math.sin(r.yaw || 0);
    const dsx = sx * c - sz * sn, dsz = sx * sn + sz * c;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const [mx, mz] = toModelXZ(x, y);
      const [px, pz] = ruinLocalXZ(r, mx, mz);
      let shadow = 0;
      for (const w of r.walls) for (let step = 0; step <= 4; step++) {
        const t = step / 4;
        const wx = px - dsx * t, wz = pz - dsz * t;
        const dx = Math.max(0, w[0] - wx, wx - w[1]);
        const dz = Math.max(0, w[2] - wz, wz - w[3]);
        const dist = Math.hypot(dx, dz);
        if (dist >= 15) continue;
        const strength = (step === 0 ? .32 : .37 * (1 - t)) *
          Math.max(0, 1 - dist / 15);
        shadow = Math.max(shadow, strength);
      }
      if (shadow > 0) {
        const i = y * COLS + x;
        bshade[i] = Math.min(.7, bshade[i] + shadow);
      }
    }
  }
}
// Swept AABB collision in stable model coordinates; does not depend on camera,
// height or animation, so jumping knights and cows cannot bypass stone walls.
function ruinSegmentRect(x0, z0, x1, z1, rect, radius) {
  const b = [rect[0] - radius, rect[1] + radius,
    rect[2] - radius, rect[3] + radius];
  const inside = (x, z) => x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3];
  if (inside(x0, z0)) {
    // Legacy saved actors inside stone can move outward, never further in.
    if (!inside(x1, z1)) return false;
    return Math.hypot(x1 - (b[0] + b[1]) / 2, z1 - (b[2] + b[3]) / 2) <=
      Math.hypot(x0 - (b[0] + b[1]) / 2, z0 - (b[2] + b[3]) / 2);
  }
  let a = 0, c = 1;
  const dx = x1 - x0, dz = z1 - z0;
  for (const [p, q0, q1] of [[dx, b[0] - x0, b[1] - x0],
    [dz, b[2] - z0, b[3] - z0]]) {
    if (Math.abs(p) < 1e-9) {
      if (q0 > 0 || q1 < 0) return false;
    } else {
      const t0 = q0 / p, t1 = q1 / p;
      a = Math.max(a, Math.min(t0, t1));
      c = Math.min(c, Math.max(t0, t1));
      if (a > c) return false;
    }
  }
  return a <= c && c >= 0 && a <= 1;
}
function ruinsBlockMove(x, y, actor) {
  if (!ruins.length) return false;
  const [mx, mz] = toModelXZ(x, y);
  const [ex, ez] = actor ? toModelXZ(actor.x, actor.y) : [mx, mz];
  // Cows have wider bodies but arch clearances are sized to fit them.
  const radius = (actor && (actor.cls === 'cow' || actor.isCow) ? 2.5 : 1.1) * CW / WS;
  for (const r of ruins) {
    const border = Math.max(r.width, r.depth) / 2 + 20 + radius;
    if (Math.min(mx, ex) > r.x + border ||
      Math.max(mx, ex) < r.x - border ||
      Math.min(mz, ez) > r.z + border ||
      Math.max(mz, ez) < r.z - border) continue;
    const [lx, lz] = ruinLocalXZ(r, ex, ez);
    const [tx, tz] = ruinLocalXZ(r, mx, mz);
    for (const w of r.walls)
      if (ruinSegmentRect(lx, lz, tx, tz, w, radius)) return true;
  }
  return false;
}

 // The ruins are traversable world landmarks, not painted backdrops. Players
 // can inspect them at either arch entrance, but never through solid masonry.
 // Rebuild these spots from stable model coordinates on every resize.
function registerRuinInspections() {
  const text = {
    gate: 'the watchtower is empty. its ancient arch still stands.',
    abbey: 'no prayers remain here, only wind between the stones.',
    cloister: 'the ruined gallery carries footsteps from arch to arch.'
  };
  const label = { gate: 'inspect the broken gate',
    abbey: 'inspect the old abbey', cloister: 'inspect the gothic cloister' };
  for (const site of RUIN_SITES) {
    const spots = [];
    for (const side of [-1, 1]) {
      // The trigger is slightly INSIDE the clear arch footprint, so either
      // approach is reachable without standing in a solid wall.
      const [wx, wz] = ruinWorldXZ(site, 0, side * (site.depth / 2 - 12));
      const [x, y] = mapToCell(wx, wz);
      const spot = {
        id: site.id + (side < 0 ? '-south' : '-north'), x, y,
        r: Math.max(10, Math.min(16, site.arch * WS / CW * .32)),
        label: label[site.type], action: 'inspect',
        // A stale E prompt cannot be used if the player moved behind a pier.
        need: () => !ruinsBlockMove(spot.x, spot.y, player),
        onUse: () => say(player, text[site.type])
      };
      spots.push(spot);
    }
    props.push({ ruinId: site.id, spots });
  }
}
