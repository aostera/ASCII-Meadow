// Leafy trees, bushes and stones as solid things, seen and lit the castle's way.
// A tree is a 3D skeleton of crooked limbs and a crown of a few hundred leaf clumps hung round their
// ends. Everything is a sphere (a limb is a string of them), drawn into a depth buffer in the castle's
// view (PITCH); a shadow map along the castle's light (LGT) lets the crown shade itself, so it is dark
// deep inside and only the outer clumps facing the light catch it. Leaves are each fine glyph turned its
// own way: the crown shimmers with texture, its edge is ragged and lets the dark through. Stones are
// rough lumps (a noise-bent dome, faceted, cracked, half sunk) ray-marched the same way. The tone follows
// the castle's curve; the glyphs are the knight's fine ones. Baked once per window size.

const T3_DV = [0, -SINP, COSP], T3_EY = [0, -COSP, -SINP];   // view direction; screen down
// light-space axes, for the shadow map
const T3_LU = (() => { const u = [LGT[1], -LGT[0], 0], m = Math.hypot(u[0], u[1]); return [u[0] / m, u[1] / m, 0]; })();
const T3_LV = [LGT[1] * T3_LU[2] - LGT[2] * T3_LU[1], LGT[2] * T3_LU[0] - LGT[0] * T3_LU[2], LGT[0] * T3_LU[1] - LGT[1] * T3_LU[0]];
const t3dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// ---------- the models: spheres [x, y, z, r, material] (0 leaf, 1 wood) ----------
function t3Tree(type, sd) {
  const rnd = k => hash(sd * 53 + k, 1777), K = knightPx(), S = [], bush = type === 'bush';
  const R = bush ? K * (0.3 + rnd(1) * 0.12) : K * (0.5 + rnd(1) * 0.2);              // crown radius, across
  const Hc = bush ? R * 0.62 : K * (0.95 + rnd(2) * 0.35) + R * 0.55;                  // crown centre height
  const lean = (rnd(3) - 0.5) * R * 0.35, ry = bush ? R * 0.68 : R * (0.78 + rnd(4) * 0.15);
  const C = [lean, Hc, 0];
  // limbs: from the foot, forking upwards and outwards in 3D, thinning; their ends hold the clumps
  const tips = [];
  const limb = (p, d, len, w, depth, k0) => {
    const n = Math.max(2, Math.ceil(len / (w * 0.7 + 1)));
    let q = p.slice(), dir = d.slice();
    for (let i = 0; i < n; i++) {
      dir = [dir[0] + (rnd(k0 + i * 3) - 0.5) * 0.25, dir[1] + (rnd(k0 + i * 3 + 1) - 0.5) * 0.12, dir[2] + (rnd(k0 + i * 3 + 2) - 0.5) * 0.25];
      const m = Math.hypot(...dir); dir = dir.map(c => c / m);
      q = [q[0] + dir[0] * len / n, q[1] + dir[1] * len / n, q[2] + dir[2] * len / n];
      S.push([q[0], q[1], q[2], Math.max(0.9, w * (1 - i / n * 0.3) / 2), 1]);
    }
    if (depth <= 0) { tips.push(q); return; }
    const nb = 2 + (rnd(k0 + 77) > 0.5 ? 1 : 0);
    for (let b = 0; b < nb; b++) {
      const az = rnd(k0 + 90 + b) * 6.2832, out = 0.55 + rnd(k0 + 95 + b) * 0.45;
      const nd = [dir[0] * 0.55 + Math.cos(az) * out, dir[1] * 0.55 + 0.35, dir[2] * 0.55 + Math.sin(az) * out];
      limb(q, nd, len * (0.62 + rnd(k0 + 99 + b) * 0.2), w * 0.62, depth - 1, k0 * 3 + b * 131 + 7);
    }
  };
  // a trunk up into the crown, then main limbs spreading inside it; ends that would poke out are pulled in
  const top = [lean * 0.7, Hc - ry * 0.25, 0];
  if (bush) for (let b = 0; b < 5; b++) limb([0, 0, 0], [Math.cos(b * 1.3), 1.4, Math.sin(b * 1.3)], R * 0.45, K * 0.028, 1, 500 + b * 61);
  else {
    const n = Math.ceil(top[1] / (R * 0.06));
    for (let i = 1; i <= n; i++) { const f = i / n; S.push([top[0] * f * f, top[1] * f, 0, Math.max(1, R * (0.13 - f * 0.04)), 1]); }
    for (let b = 0; b < 4; b++) { const az = b * 1.57 + rnd(40 + b); limb(top, [Math.cos(az), 0.75 + rnd(50 + b) * 0.5, Math.sin(az)], R * 0.42, R * 0.1, 2, 700 + b * 97); }
  }
  for (const tp of tips) {
    const e = Math.hypot((tp[0] - C[0]) / R, (tp[1] - C[1]) / ry, tp[2] / R);
    if (e > 0.85) { const f = 0.85 / e; tp[0] = C[0] + (tp[0] - C[0]) * f; tp[1] = C[1] + (tp[1] - C[1]) * f; tp[2] *= f; }
  }
  // the crown: many small clumps, thick round the limb ends and over the envelope where the leaf noise is
  // high, so it is one lumpy mass of leaves with a few deep gaps, not a heap of balls
  const clump = (x, y, z, r) => S.push([x, y, z, r, 0]);
  for (const tp of tips) for (let k = 0; k < 7; k++) {
    const a = rnd(tp[0] * 7 + k) * 6.2832, b = rnd(tp[2] * 5 + k + 3) * 3.1416, d = R * 0.16 * rnd(tp[1] + k * 5);
    clump(tp[0] + Math.cos(a) * Math.sin(b) * d, tp[1] + Math.cos(b) * d * 0.8, tp[2] + Math.sin(a) * Math.sin(b) * d, R * (0.06 + rnd(tp[1] + k) * 0.06));
  }
  const M = bush ? 170 : 460;
  for (let k = 0, tries = 0; k < M && tries < M * 6; tries++) {
    const a = rnd(1000 + tries) * 6.2832, c = rnd(2000 + tries) * 2 - 1, s = Math.sqrt(1 - c * c), rr = 0.55 + Math.pow(rnd(3000 + tries), 0.6) * 0.45;
    const x = C[0] + Math.cos(a) * s * R * rr, y = C[1] + c * ry * rr, z = Math.sin(a) * s * R * rr;
    if (bush && y < R * 0.06) continue;
    if (fbm3(x * 2.6 / R + sd, (y + z * 0.7) * 2.6 / R) < 0.36) continue;   // a few deep gaps between the masses
    clump(x, y, z, R * (bush ? 0.08 + rnd(4000 + tries) * 0.07 : 0.05 + rnd(4000 + tries) * 0.05)); k++;
  }
  return { S, R, H: Hc + ry, C, ry, bush };
}

// ---------- rasterising: depth buffer in the view, shadow map along the light ----------
function t3Bake(type, model, sd) {
  const fd = charDims(player), fw = fd.fcw, fh = fd.fch, { S, R, C, ry } = model;
  const proj = s => [s[0], -(s[1] * COSP + s[2] * SINP)];
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const s of S) { const [px, py] = proj(s); x0 = Math.min(x0, px - s[3]); x1 = Math.max(x1, px + s[3]); y0 = Math.min(y0, py - s[3]); y1 = Math.max(y1, py + s[3]); }
  const cx0 = Math.floor(x0 / fw) - 1, cy0 = Math.floor(y0 / fh) - 1, GW = Math.ceil(x1 / fw) + 2 - cx0, GH = Math.ceil(y1 / fh) + 2 - cy0;
  const depth = new Float32Array(GW * GH).fill(1e9), who = new Int32Array(GW * GH).fill(-1);
  S.forEach((s, k) => {   // nearest sphere surface per fine cell
    const [px, py] = proj(s), dc = t3dot(s, T3_DV), r = s[3];
    for (let cy = Math.floor((py - r) / fh); cy <= Math.ceil((py + r) / fh); cy++) for (let cx = Math.floor((px - r) / fw); cx <= Math.ceil((px + r) / fw); cx++) {
      const dx = cx * fw - px, dy = cy * fh - py, d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      const z = dc - Math.sqrt(r * r - d2), i = (cy - cy0) * GW + (cx - cx0);
      if (i >= 0 && i < depth.length && z < depth[i]) { depth[i] = z; who[i] = k; }
    }
  });
  // shadow map: the surface nearest the light, over a grid in the light's plane
  const SR = 1.5, lp = S.map(s => [t3dot(s, T3_LU), t3dot(s, T3_LV), t3dot(s, LGT)]);
  let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
  lp.forEach((l, k) => { const r = S[k][3]; u0 = Math.min(u0, l[0] - r); u1 = Math.max(u1, l[0] + r); v0 = Math.min(v0, l[1] - r); v1 = Math.max(v1, l[1] + r); });
  const SW = Math.ceil((u1 - u0) / SR) + 2, SH2 = Math.ceil((v1 - v0) / SR) + 2, smap = new Float32Array(SW * SH2).fill(-1e9);
  lp.forEach((l, k) => {
    const r = S[k][3];
    for (let j = Math.floor((l[1] - r - v0) / SR); j <= Math.ceil((l[1] + r - v0) / SR); j++) for (let i = Math.floor((l[0] - r - u0) / SR); i <= Math.ceil((l[0] + r - u0) / SR); i++) {
      const du = u0 + i * SR - l[0], dv = v0 + j * SR - l[1], d2 = du * du + dv * dv;
      if (d2 >= r * r || i < 0 || j < 0 || i >= SW || j >= SH2) continue;
      const top = l[2] + Math.sqrt(r * r - d2);
      if (top > smap[j * SW + i]) smap[j * SW + i] = top;
    }
  });
  const shadowAt = p => { const i = Math.round((t3dot(p, T3_LU) - u0) / SR), j = Math.round((t3dot(p, T3_LV) - v0) / SR); return i < 0 || j < 0 || i >= SW || j >= SH2 ? 0 : Math.max(0, Math.min(1, (smap[j * SW + i] - t3dot(p, LGT) - 2) / (R * 0.12))); };
  const list = [], runs = [];
  for (let cy = 0; cy < GH; cy++) {
    let r0 = -1;
    for (let cx = 0; cx <= GW; cx++) {
      const i = cy * GW + cx, k = cx < GW ? who[i] : -1;
      let on = false;
      if (k >= 0) {
        const s = S[k], X = (cx + cx0) * fw, Y = (cy + cy0) * fh, [px, py] = proj(s), dx = X - px, dy = Y - py, r = s[3];
        const e2 = (dx * dx + dy * dy) / (r * r);
        const leaf = s[4] === 0;
        // a ragged leafy rim: the clump's edge is broken into single leaves and holes
        if (!(leaf && e2 > 0.6 && hash(cx + cx0 * 3 + sd, cy * 7 + cy0) < (e2 - 0.6) * 1.6)) {
          on = true;
          const back = Math.sqrt(Math.max(0, 1 - e2));
          let n = [dx / r, dy / r * T3_EY[1] - back * T3_DV[1], dy / r * T3_EY[2] - back * T3_DV[2]];   // (P - centre) / r
          if (leaf) { const j = 0.55; n = [n[0] + (hash(cx * 13 + 5, cy * 3 + sd) - 0.5) * j, n[1] + (hash(cx * 7, cy * 11 + 2) - 0.5) * j, n[2] + (hash(cx * 3 + 1, cy * 5 + 9) - 0.5) * j]; }
          let m = Math.hypot(...n); n = n.map(c => c / m);
          const P = [s[0] + n[0] * r, s[1] + n[1] * r, s[2] + n[2] * r];
          if (leaf) {   // a leaf faces partly its clump, partly out of the whole crown: the crown has a lit side and a dark one
            const g = [(P[0] - C[0]) / R, (P[1] - C[1]) / ry, P[2] / R], gm = Math.hypot(...g) || 1;
            n = [n[0] * 0.45 + g[0] / gm * 0.55, n[1] * 0.45 + g[1] / gm * 0.55, n[2] * 0.45 + g[2] / gm * 0.55]; m = Math.hypot(...n); n = n.map(c => c / m);
          }
          const diff = Math.max(0, t3dot(n, LGT)), sh = shadowAt(P);
          // ambient: less deep inside the crown and low under it
          const inner = Math.hypot((P[0] - C[0]) / R, (P[1] - C[1]) / ry, P[2] / R), ao = Math.max(0.25, Math.min(1, inner * 1.1)) * (leaf ? 1 : 0.8);
          let alb = leaf ? 0.62 * (0.7 + 0.6 * hash(cx * 5 + 3, cy * 9 + k)) : 0.34 * (0.75 + 0.45 * vnoise(P[0] * 0.5, P[1] * 0.08));
          if (!leaf && Math.abs(n[0]) > 0.7 && n[0] < 0) alb *= 1.3;          // bark lit along the trunk's light side
          let v = alb * (0.24 * ao + 1.0 * diff * (1 - sh * 0.85));
          v = Math.pow(Math.min(1, v * 1.15), 0.7) * (leaf ? 0.62 : 0.8);    // the castle's tone curve, sunk into the night
          v = Math.max(0, Math.min(0.95, v + BAYER[(cy & 3) * 4 + (cx & 3)] * 0.12));
          const ci = Math.min(RAMP.length - 1, Math.floor(v * 9));
          const c = !leaf && v > 0.18 && hash(cx, cy * 3) < 0.5 ? (Math.abs(dx / r) < 0.5 ? '|' : dx < 0 ? '|' : ':') : ci > 0 ? RAMP[ci] : null;
          if (c) list.push(cx + cx0, cy + cy0, fid(c, Math.floor(v * 8)), Math.round(Math.min(1, 0.5 + v * 0.7) * 100));
        }
      }
      if (on && r0 < 0) r0 = cx;
      else if (!on && r0 >= 0) { runs.push(cy + cy0, r0 + cx0, cx + cx0); r0 = -1; }
    }
  }
  // coarse grass cells wholly under the crown (and not at its feet): not drawn
  const hide = [], solid = (x, y) => { const i = (y - cy0) * GW + (x - cx0); return x >= cx0 && y >= cy0 && x < cx0 + GW && y < cy0 + GH && who[i] >= 0; };
  for (let gy = Math.floor(y0 / CH); gy < -1; gy++) for (let gx = Math.floor(x0 / CW); gx <= Math.ceil(x1 / CW); gx++) {
    let all = true;
    for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (!solid(Math.round((gx + ox) * CW / fw), Math.round((gy + oy) * CH / fh))) { all = false; break; }
    if (all) hide.push(gx, gy);
  }
  // its shadow on the ground: every clump and limb cast along the light, leaves letting some light through,
  // so the shade has the crown's shape, its gaps, and falls the way the castle's does
  const shm = new Map();
  for (const s of S) {
    const t = s[1] / LGT[1], gx = s[0] - LGT[0] * t, gz = s[2] - LGT[2] * t, r = s[3] * 1.15, a = s[4] === 0 ? 0.22 : 0.5;
    const cx0s = Math.floor((gx - r) / CW), cx1s = Math.ceil((gx + r) / CW), cy0s = Math.floor(-(gz + r) * SINP / CH), cy1s = Math.ceil(-(gz - r) * SINP / CH);
    for (let cy = cy0s; cy <= cy1s; cy++) for (let cx = cx0s; cx <= cx1s; cx++) {
      const dx = (cx + 0.5) * CW - gx, dz = -(cy + 0.5) * CH / SINP - gz, q = (dx * dx + dz * dz) / (r * r);
      if (q >= 1) continue;
      const k = cy * 4096 + cx, o = shm.get(k) || 0; shm.set(k, 1 - (1 - o) * (1 - a * (1 - q * 0.6)));
    }
  }
  const gshadow = [];
  for (const [k, a] of shm) { const cy = Math.round(k / 4096), cx = k - cy * 4096; gshadow.push(cx, cy, Math.round(Math.min(0.62, a * 0.75) * 100)); }
  let minY = 0; for (let k = 1; k < list.length; k += 4) minY = Math.min(minY, list[k]);
  return { type, list: Int32Array.from(list), runs: Int16Array.from(runs), hide: Int16Array.from(hide), gshadow: Int16Array.from(gshadow), fw, fh, minY, R, Hc: C[1], crownH: -minY * fh };
}
const bakeTree3D = (type, sd) => t3Bake(type, t3Tree(type, sd), sd);

// ---------- stones: a rough lump, ray-marched ----------
const STONES = [];   // pebble, stone, boulder, three of each; drawn by render() on stony ground
// size 0 a pebble, 1 a stone, 2 a boulder (knee-high). A dome bent by noise into planes and ridges,
// cracked, its foot sunk into the ground; lit by LGT with soft self-shadow; a shadow baked on the ground.
function bakeStone3D(size, sd) {
  const rnd = k => hash(sd * 31 + k, 977), K = knightPx(), fd = charDims(player), fw = fd.fcw, fh = fd.fch;
  const rx = K * [0.09, 0.15, 0.25][size] * (0.85 + rnd(1) * 0.3), ryy = rx * (0.55 + rnd(2) * 0.25), rz = rx * (0.75 + rnd(3) * 0.3), sink = ryy * 0.3;
  const ox = rnd(4) * 50, oz = rnd(5) * 50;
  const sdf = (x, y, z) => {
    const q = Math.hypot(x / rx, (y + sink) / ryy, z / rz) - 1;
    const f = fbm3(x / rx * 1.6 + ox, (y * 0.8 + z) / rx * 1.6 + oz), ridge = Math.abs(vnoise(x / rx * 2.3 + oz, z / rz * 2.3 + y / ryy + ox) - 0.5);
    return (q + (f - 0.5) * 0.45 + ridge * 0.25) * Math.min(rx, ryy) * 0.8;
  };
  const nrm = (x, y, z) => { const e = 0.6, a = sdf(x + e, y, z) - sdf(x - e, y, z), b = sdf(x, y + e, z) - sdf(x, y - e, z), c = sdf(x, y, z + e) - sdf(x, y, z - e), m = Math.hypot(a, b, c) || 1; return [a / m, b / m, c / m]; };
  const list = [], runs = [], shade = [];
  const Ymax = (ryy * 1.3) * COSP + rz * 1.3 * SINP, cyA = Math.floor(-Ymax / fh) - 1, cyB = Math.ceil(rz * 1.4 * SINP / fh) + 1;
  for (let cy = cyA; cy <= cyB; cy++) {
    let r0 = 1e9, r1 = -1e9, s0 = 1e9, s1 = -1e9;
    for (let cx = Math.floor(-rx * 1.4 / fw); cx <= Math.ceil(rx * 1.5 / fw); cx++) {
      const X = cx * fw, Y = cy * fh, O = [X, -Y * COSP - T3_DV[1] * 400, -Y * SINP - T3_DV[2] * 400];
      let t = 0, hit = false, P = null;
      for (let k = 0; k < 64; k++) {
        P = [O[0] + T3_DV[0] * t, O[1] + T3_DV[1] * t, O[2] + T3_DV[2] * t];
        if (P[1] < -0.01) break;                                                         // under the ground: missed
        const d = sdf(P[0], P[1], P[2]);
        if (d < 0.25) { hit = true; break; }
        t += Math.max(0.4, d * 0.9); if (t > 900) break;
      }
      if (!hit) {   // the ground: in the stone's shadow?
        const tg = -O[1] / T3_DV[1], G = [O[0], 0.3, O[2] + T3_DV[2] * tg];
        let s = 0; for (let k = 1; k < 24; k++) { const q = k * rx * 0.08; if (sdf(G[0] + LGT[0] * q, G[1] + LGT[1] * q, G[2] + LGT[2] * q) < 0.2) { s = 1; break; } }
        if (s) { s0 = Math.min(s0, cx); s1 = Math.max(s1, cx); }
        continue;
      }
      r0 = Math.min(r0, cx); r1 = Math.max(r1, cx);
      const n = nrm(P[0], P[1], P[2]), diff = Math.max(0, t3dot(n, LGT));
      let sh = 0; for (let k = 1; k < 14 && diff > 0; k++) { const q = 1.2 + k * rx * 0.07; if (sdf(P[0] + LGT[0] * q, P[1] + LGT[1] * q, P[2] + LGT[2] * q) < 0.1) { sh = 1; break; } }
      let alb = 0.42 * (0.78 + 0.4 * vnoise(P[0] * 0.35 + ox, P[1] * 0.35 + P[2] * 0.2));       // grain and lichen
      if (Math.abs(vnoise(P[0] * 0.12 + oz, P[2] * 0.12 + P[1] * 0.1) - 0.5) < 0.03) alb *= 0.35;   // cracks
      if (P[1] < ryy * 0.12) alb *= 0.6;                                                    // damp and dirt at the foot
      const lam = diff * (1 - sh * 0.75), step = Math.floor(lam * 4) / 4;          // light in steps: flat faces meeting at edges
      let v = alb * (0.16 + 0.95 * (step * 0.65 + lam * 0.35));
      if (n[1] > 0.55 && diff > 0.45 && hash(cx * 3 + 7, cy) > 0.35) v += 0.06;        // a worn, paler top
      v = Math.pow(Math.min(1, v * 1.15), 0.7) * 0.95;
      v = Math.max(0, Math.min(0.92, v + BAYER[(cy & 3) * 4 + (cx & 3)] * 0.05));
      const ci = Math.min(RAMP.length - 1, Math.floor(v * 9));
      if (ci > 0) list.push(cx, cy, fid(RAMP[ci], Math.floor(v * 8)), Math.round(Math.min(1, 0.5 + v * 0.7) * 100));
    }
    if (r1 >= r0) runs.push(cy, r0, r1 + 1);
    if (s1 >= s0) shade.push(cy, s0, s1 + 1);
  }
  let minY = 0; for (let k = 1; k < list.length; k += 4) minY = Math.min(minY, list[k]);
  const block = [];   // a stone or a boulder stands in the way; a pebble does not
  if (size > 0) for (let dy = -Math.ceil(rz * SINP / CH); dy <= 1; dy++) for (let dx = -Math.ceil(rx / CW); dx <= Math.ceil(rx / CW); dx++) if (((dx * CW) / rx) ** 2 + ((dy * CH / SINP) / rz) ** 2 < 0.8) block.push(dx, dy);
  return { type: 'stone', list: Int32Array.from(list), runs: Int16Array.from(runs), shade: Int16Array.from(shade), hide: new Int16Array(0), block: block.length ? Int16Array.from(block) : null, solid: true, fw, fh, minY, R: rx, Hc: ryy, crownH: Math.max(1, -minY * fh) };
}
