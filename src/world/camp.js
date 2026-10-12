// Camp: tents and fences, built the castle's way. Each is a few solid shapes (convex: tent bodies, poles,
// posts, rails, stakes) ray-cast in the castle's view and light (PITCH, LGT), then written in the knight's
// fine glyphs: tone from the light, strokes where a slope or a post runs, weathered by noise. Baked once
// per window size with the flora (bakeVariants), drawn as one quad each; they do not sway.

// ---------- solids ----------
// A convex solid is a list of planes [nx, ny, nz, d], inside where n·p <= d; mat names its material.
const campV = (x, y, z) => { const m = Math.hypot(x, y, z) || 1; return [x / m, y / m, z / m]; };
const campDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function campRot(v, ax, a) {   // v turned by a about the unit axis ax (Rodrigues)
  const c = Math.cos(a), s = Math.sin(a), d = campDot(v, ax) * (1 - c);
  return [v[0] * c + (ax[1] * v[2] - ax[2] * v[1]) * s + ax[0] * d, v[1] * c + (ax[2] * v[0] - ax[0] * v[2]) * s + ax[1] * d, v[2] * c + (ax[0] * v[1] - ax[1] * v[0]) * s + ax[2] * d];
}
// A box: centre c, half sizes h, axes ex, ey, ez (unit, square to each other).
function campBox(c, h, ex, ey, ez, mat, top) {
  const p = [];
  for (const [a, hh] of [[ex, h[0]], [ey, h[1]], [ez, h[2]]]) { if (!(top && a === ey)) p.push([a[0], a[1], a[2], campDot(a, c) + hh]); p.push([-a[0], -a[1], -a[2], -campDot(a, c) + hh]); }   // a pointed top replaces the flat one
  if (top) for (const s of [-1, 1]) for (const a of [ex, ez]) {   // a pointed top: four slopes meeting above the box
    const n = campV(a[0] * s + ey[0] * 0.55, a[1] * s + ey[1] * 0.55, a[2] * s + ey[2] * 0.55), tip = [c[0] + ey[0] * (h[1] + top), c[1] + ey[1] * (h[1] + top), c[2] + ey[2] * (h[1] + top)];
    p.push([n[0], n[1], n[2], campDot(n, tip)]);
  }
  return { p, mat, bs: [c[0], c[1], c[2], Math.hypot(h[0], h[1] + (top || 0), h[2])] };
}
// The first solid a ray O + tD meets: distance, the plane it entered by, and the solid.
function campHit(solids, O, D) {
  let best = null;
  for (const s of solids) {
    const b = s.bs, vx = b[0] - O[0], vy = b[1] - O[1], vz = b[2] - O[2], tc = vx * D[0] + vy * D[1] + vz * D[2];
    if (vx * vx + vy * vy + vz * vz - tc * tc > b[3] * b[3]) continue;   // the ray passes clear of its bounding sphere
    let tn = -1e9, tf = 1e9, hp = null;
    for (const p of s.p) {
      const den = p[0] * D[0] + p[1] * D[1] + p[2] * D[2], dist = p[3] - (p[0] * O[0] + p[1] * O[1] + p[2] * O[2]);
      if (Math.abs(den) < 1e-9) { if (dist < 0) { tn = 1e9; break; } continue; }
      const t = dist / den;
      if (den < 0) { if (t > tn) { tn = t; hp = p; } } else if (t < tf) tf = t;
    }
    if (hp && tn <= tf && tn > 0 && (!best || tn < best.t)) best = { t: tn, n: hp, s };
  }
  return best;
}

// ---------- the models (px, the knight's height K; x to the right, y up, z to the north) ----------
function campTent(kind, sd) {
  const rnd = k => hash(sd * 37 + k, 613), K = knightPx(), S = [], ropes = [];
  // A medieval wedge tent: two canvas slopes over a ridge running away from us, sewn in panels, a dark
  // band with a dagged edge along the ridge, the door in the end facing us with one flap tied back,
  // wooden poles at both ends, a pennant on the front one, guy ropes to pegs. Torn: lower, sagging,
  // holed, its pennant gone to a rag.
  const torn = kind === 'torn', big = rnd(9) > 0.5;
  const W = K * (torn ? 0.8 : big ? 1.05 : 0.92), L = K * (torn ? 0.95 + rnd(2) * 0.1 : big ? 1.3 : 1.12), Hh = K * (torn ? 0.6 + rnd(3) * 0.05 : big ? 0.8 : 0.72);
  const nl = campV(-Hh, W / 2, 0), nr = campV(Hh, W / 2, 0), seam = L / (big ? 6 : 5);
  S.push({ p: [[0, -1, 0, 0], nl.concat(nl[1] * Hh), nr.concat(nr[1] * Hh), [0, 0, 1, L / 2], [0, 0, -1, L / 2]], mat: 'cloth', torn, bs: [0, Hh / 2, 0, Math.hypot(W / 2, Hh / 2, L / 2) + 1],
    door: h => h[2] < -L / 2 + 0.5 && h[1] < Hh * 0.72 && Math.abs(h[0]) < (Hh * 0.72 - h[1]) / Hh * W * 0.36,
    flap: h => h[2] < -L / 2 + 0.5 && h[1] < Hh * 0.6 && h[0] > (Hh * 0.72 - h[1]) / Hh * W * 0.36 && h[0] < (Hh * 0.72 - h[1]) / Hh * W * 0.36 + K * 0.12,
    seam: h => Math.abs(((h[2] / seam) % 1 + 1) % 1 - 0.5) > 0.42,                                     // the panels' seams
    dag: h => h[1] < Hh * (0.13 + 0.07 * Math.abs(Math.sin(h[2] / L * Math.PI * (big ? 9 : 7)))) && h[1] > Hh * 0.04,   // a dagged valance along the eaves
    band: h => h[1] > Hh * (0.8 + 0.04 * Math.sin(h[2] / L * 6.2832 * (big ? 6 : 5) * 2)),           // the ridge band, dagged
    H: Hh });
  // Three-dimensional ridge binding and canvas edge battens catch the same
  // grazing light as the fabric. They are well ABOVE the collision footprint.
  S.push(campBox([0, Hh - K * .012, 0], [K * .014, K * .016, L * .48],
    [1, 0, 0], [0, 1, 0], [0, 0, 1], 'trim'));
  for (const side of [-1, 1]) for (const z of [-L * .38, 0, L * .38]) {
    S.push(campBox([side * W * .46, K * .055, z],
      [K * .035, K * .016, K * .022], [1, 0, 0], [0, 1, 0], [0, 0, 1], 'trim'));
  }
  const lean = torn ? (rnd(4) - 0.5) * 0.25 : 0;
  for (const z of [-L / 2 - K * 0.02, L / 2 + K * 0.02]) S.push(campBox([0, (Hh + (z < 0 ? K * 0.3 : K * 0.06)) / 2, z], [K * 0.02, (Hh + (z < 0 ? K * 0.3 : K * 0.06)) / 2, K * 0.02], [1, 0, 0], campRot([0, 1, 0], [0, 0, 1], z < 0 ? lean : 0), campRot([0, 0, 1], [0, 0, 1], 0), 'wood'));
  // the pennant: a thin cloth tongue off the front pole's top, streaming downwind; a rag on a torn tent
  { const top = Hh + K * 0.3, z = -L / 2 - K * 0.02, fl = K * (torn ? 0.12 : 0.3), fh = K * 0.1;
    const up = campV(0.55 * fh, fl, 0), dn = campV(0.45 * fh, -fl, 0);   // its upper and lower edges, out of the triangle
    S.push({ p: [[0, 0, 1, z + 0.6], [0, 0, -1, -z + 0.6], [-1, 0, 0, 0], up.concat(campDot(up, [0, top, 0])), dn.concat(campDot(dn, [0, top - fh, 0]))], mat: 'flag', bs: [fl / 2, top - fh / 2, z, Math.hypot(fl, fh) + 2] }); }
  for (const z of [-L / 2, L / 2]) { ropes.push([[0, Hh + K * 0.08, z], [0, 0, z + Math.sign(z) * K * 0.45]]); }
  for (const s of [-1, 1]) for (const z of [-L * 0.3, L * 0.3]) ropes.push([[s * W * 0.36, Hh * 0.28, z], [s * W * 0.8, 0, z]]);
  for (const r of ropes) { const [x, , z] = r[1]; S.push(campBox([x, K * 0.03, z], [K * 0.012, K * 0.03, K * 0.012], [1, 0, 0], [0, 1, 0], [0, 0, 1], 'wood')); }   // the pegs
  return { S, ropes, foot: (x, z) => Math.abs(x) < W / 2 && Math.abs(z) < L / 2,
    // The tent's footprint and guy ropes sit in grass, not on an opaque shadow decal.
    grass: (x, z) => {
      const edge = Math.max(Math.abs(x) - W * .49, Math.abs(z) - L * .49);
      return Math.max(0, Math.min(1, .62 - edge / (K * .17)));
    },
    R: W / 2, depth: L / 2 + K * .5, H: Hh + K * .3 };
}
// A stretch of fence turned by ang (radians, 0: running left to right): weathered posts and two rails,
// one sagging or gone; or a palisade of pointed stakes.
function campFence(ang, stakes, sd) {
  const rnd = k => hash(sd * 41 + k, 389), K = knightPx(), S = [], up = [0, 1, 0];
  const ex = [Math.cos(ang), 0, Math.sin(ang)], ez = [-Math.sin(ang), 0, Math.cos(ang)], len = K * 1.7, h = K * (stakes ? 0.7 : 0.6);
  const at = (u, y) => [ex[0] * u, y, ex[2] * u];
  const posts = [];
  if (stakes) {
    for (let u = -len / 2; u <= len / 2 + 1; u += K * 0.085) {
      const k = Math.round(u * 10), hh = h * (0.8 + rnd(k) * 0.3), tilt = (rnd(k + 5) - 0.5) * 0.12, ey = campRot(up, ex, tilt), exx = campRot(ex, ex, 0), ezz = campRot(ez, ex, tilt);
      posts.push(at(u, 0));
      S.push(campBox(at(u, hh / 2), [K * 0.03, hh / 2, K * 0.03], exx, ey, ezz, 'wood', K * 0.07));
    }
  } else {
    const n = 4, gap = len / (n - 1), broken = (rnd(1) * 3) | 0;
    for (let k = 0; k < n; k++) {
      const u = -len / 2 + k * gap, hh = h * (0.92 + rnd(k + 2) * 0.16), tilt = (rnd(k + 7) - 0.5) * 0.16;
      posts.push(at(u, 0));
      S.push(campBox(at(u, hh / 2), [K * 0.032, hh / 2, K * 0.032], ex, campRot(up, ex, tilt), campRot(ez, ex, tilt), 'wood'));
    }
    for (let k = 0; k < n - 1; k++) for (const [y, j] of [[h * 0.45, 0], [h * 0.8, 1]]) {
      if (k === broken && j === 1 && rnd(9) > 0.4) continue;                       // a rail gone
      const sag = k === broken && j === 0 ? 0.22 : 0, mid = -len / 2 + (k + 0.5) * gap;
      const rx = campRot(ex, ez, sag), c = at(mid, y - (sag ? h * 0.12 : 0));
      S.push(campBox(c, [gap / 2 + K * 0.03, K * 0.018, K * 0.018], rx, campRot(up, ez, sag), ez, 'wood'));
    }
  }
  const foot = (x, z) => Math.abs(x * ez[0] + z * ez[2]) < K * 0.07 && Math.abs(x * ex[0] + z * ex[2]) < len / 2 + K * 0.05;
  // Flatten close to the timber only; long grass survives beside and partly in
  // front of each rail. Posts alone pierce the ground, the rail stays above it.
  const grass = (x, z) => {
    const along = x * ex[0] + z * ex[2], across = x * ez[0] + z * ez[2];
    if (Math.abs(along) > len / 2 + K * .12) return 0;
    const rim = K * .17;
    return Math.max(0, (1 - Math.abs(across) / rim) * .82);
  };
  return { S, ropes: [], foot, posts, grass, R: len / 2,
    depth: len / 2, H: h + K * .07 };
}

// A cooking fire's gear: three poles leaning together over the flames, a chain from where they cross, and a
// sooty iron pot on it, dark stew inside. Stands over a campfire whose map entry says 'cook'.
function campCook() {
  const K = knightPx(), S = [], apex = [0, K * 0.82, 0], up = [0, 1, 0];
  for (let k = 0; k < 3; k++) {
    const a = k / 3 * 6.2832 + 0.5, foot = [Math.cos(a) * K * 0.3, 0, Math.sin(a) * K * 0.3 * 0.8];
    const d = campV(apex[0] - foot[0], apex[1] - foot[1], apex[2] - foot[2]), len = Math.hypot(apex[0] - foot[0], apex[1] - foot[1], apex[2] - foot[2]);
    let ex = campV(d[1] * 0 - d[2] * 1, d[2] * 0 - d[0] * 0, d[0] * 1 - d[1] * 0); if (!isFinite(ex[0]) || Math.hypot(...ex) < 0.5) ex = [1, 0, 0];
    const ez = [d[1] * ex[2] - d[2] * ex[1], d[2] * ex[0] - d[0] * ex[2], d[0] * ex[1] - d[1] * ex[0]];
    S.push(campBox([(apex[0] + foot[0]) / 2, (apex[1] + foot[1]) / 2 + K * 0.04, (apex[2] + foot[2]) / 2], [K * 0.016, len / 2 + K * 0.05, K * 0.016], ex, d, ez, 'wood'));
  }
  const py = K * 0.42, pr = K * 0.13, ph = K * 0.14, p = [[0, -1, 0, -(py - ph / 2)], [0, 1, 0, py + ph / 2]];
  for (let k = 0; k < 10; k++) {   // ten staves of iron, bellied: the lower half tucks in
    const a = (k + 0.5) / 10 * 6.2832, c = Math.cos(a), s = Math.sin(a);
    p.push([c, 0, s, pr]);
    const n = campV(c, -0.9, s); p.push([n[0], n[1], n[2], campDot(n, [c * pr, py - ph * 0.1, s * pr])]);
  }
  S.push({ p, mat: 'iron', bs: [0, py, 0, Math.hypot(pr, ph) + 1] });
  S.push(campBox([0, (py + ph / 2 + apex[1]) / 2, 0], [K * 0.006, (apex[1] - py - ph / 2) / 2, K * 0.006], [1, 0, 0], up, [0, 0, 1], 'iron'));   // the chain
  return { S, ropes: [], foot: () => false, R: K * 0.34, H: apex[1], glow: true };
}
let COOKV = null;   // its baked picture

// Ground shadows are sampled from the SAME convex 3D solids and LGT as the
// objects' lit faces. Once per variant/resize, not once per frame. These cells
// shade the terrain, including grass moving around a fence's actual posts.
// Coarse cell offsets use the same ground projection as bakeTree3D.gshadow.
function bakeCampGround(type, model) {
  const { S, R, H, depth = R, foot, posts = [], grass } = model;
  const ex = Math.ceil((R + H * Math.abs(LGT[0]) / LGT[1] + CW * 3) / CW);
  const ez = Math.ceil((depth + H * Math.abs(LGT[2]) / LGT[1] + CH * 3 / SINP) * SINP / CH);
  const gshadow = [], grounding = [], hide = [], postKeys = new Set();
  if (type === 'fence') for (const p of posts) {
    const dx = Math.round(p[0] / CW), dy = Math.round(-p[2] * SINP / CH);
    postKeys.add(dy * 8192 + dx);
  }
  for (let dy = -ez; dy <= ez; dy++) for (let dx = -ex; dx <= ex; dx++) {
    const x = dx * CW, z = -dy * CH / SINP;
    // Contact is nonzero only under the true model footprint, not a huge oval.
    const contact = foot(x, z) ? (type === 'fence' ? .31 : .28) : 0;
    const hit = campHit(S, [x, .35, z], LGT);
    const cast = hit ? (type === 'fence' ? .24 : .33) : 0;
    const strength = Math.max(contact, cast);
    if (strength > 0) gshadow.push(dx, dy, Math.round(strength * 100));
    if (grass) {
      const value = grass(x, z);
      if (value > .025) grounding.push(dx, dy, Math.round(value * 100));
    }
    if (type === 'fence' && postKeys.has(dy * 8192 + dx)) hide.push(dx, dy);
  }
  return { gshadow: Int16Array.from(gshadow), grounding: Int16Array.from(grounding), postHide: Int16Array.from(hide) };
}

// ---------- baking: the model into fine glyphs ----------
function bakeCamp(type, model, sd) {
  const fd = charDims(player), fw = fd.fcw, fh = fd.fch, D = [0, -SINP, COSP], { S, ropes, R, H } = model;
  const ground = type === 'tent' || type === 'fence' ? bakeCampGround(type, model) : null;
  const list = [], runs = [], shade = [], half = R * 1.75;
  const y0 = Math.floor(-(H + 0.1 * knightPx()) * COSP / fh - R * 1.2 * SINP / fh) - 2, y1 = Math.ceil(R * 1.2 * SINP / fh) + 2;
  for (let cy = y0; cy <= y1; cy++) {
    let s0 = 1e9, s1 = -1e9, seg = 1e9, segEnd = -1e9;   // backing in runs of cells actually covered: gaps (between poles, holes) stay open
    for (let cx = Math.floor(-half / fw); cx <= Math.ceil(half / fw); cx++) {
      const sx = cx * fw, sy = cy * fh, P = [sx, -sy * COSP, -sy * SINP], O = [P[0], P[1] - D[1] * 1e4, P[2] - D[2] * 1e4];
      const hit = campHit(S, O, D);
      if (!hit) {   // the ground here: in the shadow of the model?
        const t = -O[1] / D[1], G = [O[0], 0, O[2] + D[2] * t];
        if (campHit(S, [G[0] + LGT[0] * 0.5, 0.5, G[2] + LGT[2] * 0.5], LGT)) { s0 = Math.min(s0, cx); s1 = Math.max(s1, cx); }
        continue;
      }
      const p = [O[0] + D[0] * hit.t, O[1] + D[1] * hit.t, O[2] + D[2] * hit.t], n = hit.n, s = hit.s;
      if (s.torn && vnoise(p[0] * 0.09 + sd, p[1] * 0.07 + p[2] * 0.05) > 0.74) continue;   // holes in the old cloth
      if (cx !== segEnd + 1) { if (segEnd >= seg) runs.push(cy, seg, segEnd + 1); seg = cx; }
      segEnd = cx;
      const diff = Math.max(0, campDot(n, LGT)), lit = diff > 0 && campHit(s.others || (s.others = S.filter(o => o !== s)), [p[0] + n[0] * 0.6, p[1] + n[1] * 0.6, p[2] + n[2] * 0.6], LGT) ? 0.45 : 1;
      let alb, c = null;
      if (s.mat === 'cloth') {
        alb = 0.52 * (0.78 + 0.34 * vnoise(p[0] * 0.07 + sd * 3, p[2] * 0.035 + p[1] * 0.02));
        // Long woven creases taper towards the eaves and break up smooth 3D
        // slopes. Fold troughs darken; ridges catch the same directional key.
        const fold = Math.sin(p[2] * .09 + p[0] * .045 + sd * .2) *
          Math.sin(Math.PI * Math.min(1, Math.max(0, p[1] / s.H)));
        alb *= .88 + .26 * Math.max(-1, Math.min(1, fold));
        if (vnoise(p[0] * 0.21 + 9, p[1] * 0.19 + p[2] * 0.11) > 0.7) alb *= 0.68;                // stains, patches
        if (p[1] < s.H * 0.14) alb *= 0.62;                                                        // mud along the hem
        if (s.seam && s.seam(p)) { alb *= .52; if (hash(cx + sd, cy) > .77) c = ':'; }
        if (s.dag && s.dag(p)) alb *= 1.35;
        if (s.band && s.band(p)) alb *= 0.6;
        if (s.door && s.door(p)) { alb = 0.04; c = ' '; }                                          // the dark inside
        else if (s.flap && s.flap(p)) alb *= 1.25;                                                 // the flap tied back
        else if (Math.abs(n[1]) < 0.95 && Math.abs(n[2]) < 0.5 && hash(cx * 3 + 1, cy * 5) < 0.45) c = n[0] < 0 ? '/' : '\\';   // slopes run in strokes
      } else if (s.mat === 'trim') {
        alb = n[1] > .45 ? .65 : .34; // raised canvas binding and reinforced eyelets
        if (hash(cx + sd, cy * 7) > .74) c = n[1] > .5 ? '=' : ':';
      } else if (s.mat === 'iron') {
        alb = n[1] > 0.9 ? 0.16 + (hash(cx, cy) > 0.8 ? 0.2 : 0) : 0.3 * (0.8 + 0.3 * vnoise(p[0] * 0.4, p[1] * 0.5));   // sooty iron; the stew a dark sheen on top
        if (n[1] <= 0.9) alb += 0.42 * Math.max(0, Math.min(1, (knightPx() * 0.52 - p[1]) / (knightPx() * 0.2)));   // its sides lit from below by the flames, brightest low down
      } else if (s.mat === 'flag') { alb = 0.62 * (0.8 + 0.3 * vnoise(p[0] * 0.2, p[1] * 0.3 + sd));   // a faded pennant, paler than the canvas
    } else {
        alb = 0.4 * (0.75 + 0.4 * vnoise(p[0] * 0.3 + p[2] * 0.3 + sd, p[1] * 0.06));            // grain
        if (Math.abs(n[1]) < 0.3 && hash(cx, cy * 7) < 0.5) c = Math.abs(n[0]) > Math.abs(n[2]) * 1.5 && Math.abs(D[2] * n[2]) < 0.5 ? '|' : null;
      }
      let v = Math.pow(Math.min(1, alb * (0.22 + 0.95 * diff * lit) * 1.15), 0.7);   // the castle's tone curve
      if (model.glow) v = Math.min(0.9, v * 1.35 + 0.1 * Math.max(0, -n[1]) + 0.06);   // lit from below by the fire
      v = Math.max(0, Math.min(0.95, v + BAYER[(cy & 3) * 4 + (cx & 3)] * 0.1));
      if (c === ' ') continue;
      const ci = Math.min(RAMP.length - 1, Math.floor(v * 9));
      if (!c) c = ci > 0 ? RAMP[ci] : null;
      if (c) list.push(cx, cy, fid(c, Math.floor(v * 8)), Math.round(Math.min(1, 0.45 + v * 0.8) * 100));
    }
    if (segEnd >= seg) runs.push(cy, seg, segEnd + 1);
    if (s1 >= s0) shade.push(cy, s0, s1 + 1);
  }
  for (const [a, b] of ropes) {   // guy ropes: thin dim strokes from the cloth to the pegs
    const pa = [a[0] / fw, -(a[1] * COSP + a[2] * SINP) / fh], pb = [b[0] / fw, -(b[1] * COSP + b[2] * SINP) / fh], n = Math.ceil(Math.hypot(pb[0] - pa[0], pb[1] - pa[1]));
    const dx = pb[0] - pa[0], dy = pb[1] - pa[1], c = Math.abs(dx) < Math.abs(dy) * 0.4 ? '|' : Math.abs(dy) < Math.abs(dx) * 0.4 ? '-' : (dx > 0) === (dy > 0) ? '\\' : '/';
    for (let k = 1; k <= n; k++) list.push(Math.round(pa[0] + dx * k / n), Math.round(pa[1] + dy * k / n), fid(k === n ? '.' : c, 1), 55);
  }
  // the coarse cells it stands on: they stop the knight, and their grass is not drawn
  const block = [];
  for (let dy = -Math.ceil(R * 1.1 * SINP / CH) - 1; dy <= Math.ceil(R * 1.1 * SINP / CH) + 1; dy++) for (let dx = -Math.ceil(R / CW) - 1; dx <= Math.ceil(R / CW) + 1; dx++)
    if (model.foot(dx * CW, -dy * CH / SINP)) block.push(dx, dy);
  let minY = 0; for (let k = 1; k < list.length; k += 4) minY = Math.min(minY, list[k]);
  // Geometry still blocks movement exactly as before. Only wood posts suppress
  // grass completely; the fence's rails allow shorter grass under them.
  const hide = type === 'fence' ? ground.postHide : Int16Array.from(block);
  return { type, list: Int32Array.from(list), runs: Int16Array.from(runs),
    shade: type === 'cook' ? Int16Array.from(shade) : new Int16Array(0),
    hide, block: Int16Array.from(block),
    gshadow: ground?.gshadow || null, grounding: ground?.grounding || null,
    fw, fh, minY, R, Hc: H, crownH: Math.max(1, -minY * fh), solid: true };
}
// The camp's variants: four tents (two whole, two torn), six stretches of fence (rails at four turns, stakes at two).
function bakeCampVariants(out) {
  [['ridge', 101], ['ridge', 104], ['torn', 103], ['torn', 107]].forEach(([k, sd]) => out.push(bakeCamp('tent', campTent(k, sd), sd)));   // whole and torn
  [[0, 0], [Math.PI / 2, 0], [Math.PI / 4, 0], [-Math.PI / 4, 0], [0, 1], [Math.PI / 2, 1]].forEach(([a, st], k) => out.push(bakeCamp('fence', campFence(a, st, 111 + k), 111 + k)));
  COOKV = bakeCamp('cook', campCook(), 131); out.push(COOKV);
}
