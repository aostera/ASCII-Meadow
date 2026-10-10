// Knight animation on top of the baked frames: the cloak's hem as a damped spring, and per-cell offsets
// (legs, breath, the runner's lean, cloth bending and fluttering). Glyphs only move; they are never
// re-dithered, so motion stays continuous.

function stepCloak(e, ft) {
  // The cloak's hem is a damped spring with inertia: it trails the way he came, swings on when he stops,
  // sags on the way up a jump and floats on the way down; the wind leans it and sets it fluttering.
  const w0 = windAt(e.x, e.y), cs = e.cloth || (e.cloth = { x: 0, y: 0, vx: 0, vy: 0, ph: 0, fa: 0, px: e.x, py: e.y, jp: 0, mvx: 0, mvy: 0 });
  if (ft > 0) {
    const jp = jumpPx(e), vx = (e.x - cs.px) * CW / ft, vy = ((e.y - cs.py) * CH - (jp - cs.jp)) / ft;   // screen px/s; rising is negative
    cs.px = e.x; cs.py = e.y; cs.jp = jp;
    cs.mvx += (vx - cs.mvx) * Math.min(1, ft * 10); cs.mvy += (vy - cs.mvy) * Math.min(1, ft * 10);
    const hx = Math.max(-5, Math.min(5, -cs.mvx * 0.022 + (w0.lean - 0.1) * 1.4 + w0.gust * 1.2)), hy = Math.max(-3, Math.min(3, -cs.mvy * 0.006));
    cs.vx += (28 * (hx - cs.x) - 5.5 * cs.vx) * ft; cs.vy += (28 * (hy - cs.y) - 5.5 * cs.vy) * ft;   // under-damped: a little swing past the rest
    cs.x += cs.vx * ft; cs.y += cs.vy * ft;
    const spd = Math.min(1, Math.hypot(cs.mvx, cs.mvy) / 90);
    cs.fa = 0.25 + 0.35 * spd + 0.35 * (e.run || 0) + 0.6 * w0.gust;                   // flutter, in cells at the hem
    cs.ph += ft * (4 + 4 * spd + 3 * (e.run || 0) + 3 * w0.gust);
  }
  return cs;
}

// Fills KDX/KDY for every cell of frame K; returns which leg is ahead (the sign the drawing order needs).
function knightCellOffsets(e, K, fcw, fch, walking, runF, br, cs) {
  const n = K.n;
  // Walk: the phase follows the ground covered, so a planted foot keeps still while the body passes it.
  const m = 0, mb = walking && runF ? Math.min(1, (e.walk - 0.5) / 0.35) : 0, rn = walking ? e.run || 0 : 0, R = KR[K.d] * (1 + 0.3 * rn);   // the coded step only runs: walk frames step by themselves
  if (!walking) e.wph = 0;
  else e.wph = (e.wph || 0) + Math.max(0, (e.wd || 0) - (e.wd0 ?? e.wd ?? 0)) * Math.PI / ((rn > 0.5 ? 13 : 22) * fcw);   // a step of the drawn stride, so the feet don't slide; the same cadence for every heading   // one cadence for every heading, or one way reads as running and another as creeping
  e.wd0 = e.wd || 0;
  const tx = KTX[K.d], ty = KTY[K.d], side = Math.abs(tx), psi = (e.wph || 0) + K.beta, cb = Math.cos(K.beta), cp = Math.cos(psi), sp = Math.sin(psi);
  const bob = -mb * 1.2 * fch * sp * sp, sway = 0;   // the drawn frames walk by themselves; a runner still bounces
  const lean = mb * rn * 1.1 * fcw;   // a runner leans into the run: the top of the figure goes ahead, the feet stay
  // the leg ahead in the pose: with a sideways heading it is the one on the heading's side
  const sgL = side > 0.3 ? -Math.sign(tx) : -1, lift = 1.5 * (1 + 0.9 * rn) * fch;
  for (let j = 0; j < n; j++) {
    const cx = K.cx[j], cy = K.cy[j], sg = K.seg[j];
    let dx = 0, dy = 0;
    if (sg === 1 || sg === 2) {
      // a leg swings from the hip along the heading; the one travelling forward lifts its foot
      const dep = K.dep[j], sgn = sg === 1 ? sgL : -sgL, ds = sgn * R * (0.5 + 0.12 * rn) * (cp - cb) * fcw * dep * m;   // half a swap: the legs meet under the body and part again, never bending out of the drawn shape
      dx = ds * tx + sway * (1 - dep);
      dy = ds * ty * 0.5 + bob * (1 - dep) - m * lift * Math.max(0, -sgn * sp) * dep ** 1.4;
    } else {
      dx = sway + lean * tx * Math.max(0, (KHIP - cy) / KHIP); dy = bob;
      if (cy < 36) dy -= br * Math.min(1, (36 - cy) / 6);   // breath: head and chest rise as one piece, fading out over the waist
      const w = K.w[j];
      if (w > 0) {
        // cloth: fixed at the shoulders, freest at the hem; it bends as one sheet, and the flutter runs
        // down it as a slow wave so neighbouring rows stay together
        const tt = K.t[j], bend = w * tt ** 0.3, f = cs.fa * w * Math.sin(cs.ph - tt * 2.6 - cx * 0.05);
        dx += bend * cs.x * fcw + (side > 0.5 ? 0.35 : 1) * f * fcw;
        dy += bend * cs.y * fch + (side > 0.5 ? 0.7 : 0.25) * f * fch;
      }
    }
    KDX[j] = dx; KDY[j] = dy;
  }
  return sgL;
}
