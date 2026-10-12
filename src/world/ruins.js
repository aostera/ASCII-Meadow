// Three volumetric ASCII gothic ruins. Reuses the cathedral's real 3D ray/stone
// shading, but keeps geometry and glyph tiles separate from its castle model.
// Walls have physical ground footprints. The pointed arches are actual empty
// spaces in the mesh and the ONLY traversable entries/exits.
const ruins = [];
const RUIN_DIR = [0, -SINP, COSP];
function ruinPortalWall(w, z, thickness, height, gateWidth, gateHeight) {
  const x0 = -w / 2, x1 = w / 2, a = gateWidth / 2;
  const zs = [z - thickness / 2, z + thickness / 2];
  const stone = { courses: [height * .33, height * .68] };
  // Permanent solid piers on either side of the only ground-level entrance.
  addBox(x0, -a, 0, height, zs[0], zs[1], 'wall', stone);
  addBox(a, x1, 0, height, zs[0], zs[1], 'wall', stone);
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
    addBox(x - thickness / 2, x + thickness / 2, 0, wallHeight,
      -d / 2, d / 2, 'wall',
      { win: [{ y0: 112, h: 80, w: 25, sp: 72 }], courses: [84, 167] });
  }
}
function ruinDetail(site) {
  const { width: w, depth: d, height: h, arch: a, archHeight: ah } = site;
  const th = 14;
  ruinPortalWall(w, -d / 2 + th / 2, th, h * .7, a, ah);
  ruinPortalWall(w,  d / 2 - th / 2, th, h * .54, a, ah);
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
    const mesh = solids.splice(before); // do NOT mutate its cast bins or height surface
    mesh.forEach((so, i) => { so.id = 2000 + i; });
    const cx = cathedral.ox + site.x * WS;
    const cy = cathedral.oy - site.z * SINP * WS;
    const maxH = site.height * 1.02, halfD = site.depth / 2 + 12;
    const x0 = Math.max(0, Math.floor((cx - (site.width / 2 + 35) * WS) / CW));
    const x1 = Math.min(COLS - 1, Math.ceil((cx + (site.width / 2 + 35) * WS) / CW));
    const y0 = Math.max(0, Math.floor((cy - (halfD * SINP + maxH * COSP) * WS - 16) / CH));
    const y1 = Math.min(ROWS - 1, Math.ceil((cy + halfD * SINP * WS + 16) / CH));
    const width = x1 - x0 + 1, height = y1 - y0 + 1;
    const lum = new Float32Array(width * height).fill(-1);
    const dep = new Float32Array(width * height);
    const glyph = new Int16Array(width * height).fill(-1);
    const lev = new Uint8Array(width * height);
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
      let shade = ornament(hx, hy, hz, n, hit.so,
        (hit.kind === 'spire' ? .69 : .76) * (.24 + .96 * diff));
      shade *= .88 + .19 * vnoise(hx * .031 + hz * .021, hy * .035);
      const k = (y - y0) * width + x;
      lum[k] = Math.max(.02, Math.min(.999, shade));
      dep[k] = cy - hz * SINP * WS;
      const set = FACESETS[shade < .1 ? 4 : hit.kind === 'spire' ? 3 : n[2] < -.65 ? 0 : 1];
      if (set.length) {
        glyph[k] = CI[set[(hash(x * 11 + 7, y * 13 + 3) * set.length) | 0]];
        lev[k] = BL0 + Math.min(BLN - 1,
          (Math.pow(Math.min(1, shade * 1.15), .72) * BLN) | 0);
      }
    }
    ruins.push({ ...site, cx, cy, x0, x1, y0, y1, width, height,
      lum, dep, glyph, lev, walls: ruinWallRectangles(site) });
  }
}
function drawRuins() {
  const up = Math.round(flash * 3);
  for (const r of ruins) {
    const xa = Math.max(r.x0, VX0), xb = Math.min(r.x1, VX1);
    const ya = Math.max(r.y0, VY0), yb = Math.min(r.y1, VY1);
    if (xa > xb || ya > yb) continue;
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      const k = (y - r.y0) * r.width + x;
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
    const k = (y - r.y0) * r.width + x;
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
      const k = (y - r.y0) * r.width + x;
      if (r.lum[k] < 0 || r.dep[k] <= feet + 1.5) continue;
      gput(SOLID_CELL, x * CW, y * CH, 1);
      if (r.glyph[k] >= 0) blit(r.glyph[k], r.lev[k], x * CW, y * CH);
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
    if (Math.max(Math.abs(mx - r.x), Math.abs(mz - r.z),
      Math.abs(ex - r.x), Math.abs(ez - r.z)) > border * 5) continue;
    for (const w of r.walls)
      if (ruinSegmentRect(ex - r.x, ez - r.z, mx - r.x, mz - r.z, w, radius)) return true;
  }
  return false;
}
