// Drawing entities: the knight from his baked frames (cloak spring, legs, breath, firelight) and rigged
// figures; cows are drawn by entities/cow.js.

function drawEntity(e) {
  if (e.cls === 'cow') { drawCow(e); return; }
  const { ffs, fcw, fch, u } = charDims(e);
  const G = geomOf(e), { gx, gy, top } = G;
  const kn = e.cls === 'knight';
  if (kn && !KS.ok) return;
  const BH = boxH(e);
  const cols = kn ? Math.round(G.w / fcw) : Math.round(BOX_W * u / fcw), rows = kn ? Math.round(G.h / fch) : Math.round(BH * u / fch);
  const SS = 2;
  if (rig.width !== cols * SS || rig.height !== rows * SS) { rig.width = cols * SS; rig.height = rows * SS; }
  rg.setTransform(1, 0, 0, 1, 0, 0);
  rg.clearRect(0, 0, rig.width, rig.height);
  if (kn) {
    // The frame's glyphs are baked; animation only moves them, never re-dithers, so motion is continuous.
    const fi = knightFrame(e), K = KFR[fi], left = G.left, n = K.n, runF = fi >= 88 && fi < 152;
    const ft = Math.min(0.05, Math.max(0, t - (e.lt ?? t))); e.lt = t;   // time-based, so speed doesn't follow the frame rate
    const jumping = e.jump > 0, walking = !jumping && e.walk > 0.5;
    const k = e.idleK = Math.min(1, Math.max(0, (e.idleK || 0) + (!jumping && !walking ? ft * 1.8 : -ft * 5)));
    const br = (0.5 - 0.5 * Math.cos(t * 2.1)) * fch * 0.25 * k;   // breath
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
    // Dark plate first, in runs of neighbouring cells that move together. The far leg goes down before
    // the near one's plate, so where the legs cross the near leg hides it instead of tangling with it.
    const near = sgL > 0 ? 1 : 2, far = 3 - near;
    const plate = (pick) => {
      let ry = -1, rs = 0, re = 0, rdx = 0, rdy = 0;
      for (let j = 0; j <= n; j++) {
        if (j < n) {
          if (!pick(j)) continue;
          const cx = K.cx[j], cy = K.cy[j], dx = KDX[j], dy = KDY[j];
          if (cy === ry && cx === re && Math.abs(dx - rdx) < 0.35 && Math.abs(dy - rdy) < 0.35) { re = cx + 1; continue; }
          if (ry >= 0) grect(left + rs * fcw + rdx - 0.4, top + ry * fch + rdy - 0.4, (re - rs) * fcw + 0.8, fch + 0.8, 0.94);
          ry = cy; rs = cx; re = cx + 1; rdx = dx; rdy = dy;
        } else if (ry >= 0) grect(left + rs * fcw + rdx - 0.4, top + ry * fch + rdy - 0.4, (re - rs) * fcw + 0.8, fch + 0.8, 0.94);
      }
    };
    // Firelight: near a brazier the side facing it and the lower body catch the light, as in a painting lit
    // by embers: the cloak turns red, the armour dark metal with warm edges. Steps are dithered per glyph.
    let fI = 0, fdx = 0;
    for (const b of braziers) {
      const ddx = b.x * CW - e.x * CW, ddy = (((b.y + 0.7) * CH - b.lift) - ((e.y + 0.7) * CH - liftPx(e))) * 1.6, d = Math.hypot(ddx, ddy), r = 300 * Math.min(MS, 1.4);
      if (d < r) { const v = (1 - d / r) ** 1.6 * (0.82 + 0.18 * flick(b.seed * 3, 5)); if (v > fI) { fI = v; fdx = ddx / (d + 1); } }
    }
    const warm = j => {
      if (fI < 0.01) return 0;
      const cx = K.cx[j], cy = K.cy[j], face = Math.min(1.1, Math.max(0.15, 0.55 + 0.6 * fdx * (cx - KFX) / 16)), L = fI * face * (0.45 + 0.55 * cy / 54) * 1.7;
      return Math.max(0, Math.min(KWH - 1, Math.floor(L * (KWH - 1) + 0.5 + BAYER[(cy & 3) * 4 + (cx & 3)] * 0.9)));
    };
    // the cloak goes red as a whole once the light is real (only its shade varies), the armour metallic
    const fireBlock = j => { let h = warm(j); if (K.cl[j]) { if (fI > 0.12) h = Math.max(1, h); return h ? KWH - 1 + h : 0; } return h; };
    const glyphs = (pick) => { for (let j = 0; j < n; j++) { const c = K.code[j]; if (c >= 0 && pick(j)) gput(KN0 + fireBlock(j) * KNS + c, left + K.cx[j] * fcw + KDX[j], top + K.cy[j] * fch + KDY[j], 1); } };
    // The cloak is its own layer: behind the body, or over it when he is seen from behind.
    const cloak = j => K.cm[j] === 1, over = K.d >= 3 && K.d <= 5;
    if (!over) { plate(cloak); glyphs(cloak); }
    plate(j => !cloak(j) && K.seg[j] !== near); glyphs(j => !cloak(j) && K.seg[j] === far);
    plate(j => K.seg[j] === near); glyphs(j => !cloak(j) && K.seg[j] !== far);
    if (over) { plate(cloak); glyphs(cloak); }
    drawTag(e, gx, gy);
    return;
  }
  {
  const sx = cols * SS / BOX_W, sy = rows * SS / BH;
  rg.setTransform(sx * e.face, 0, 0, sy, (e.face > 0 ? -BOX_X0 : BOX_W + BOX_X0) * sx, 0);
  if (e.cls === 'dwarf') { rg.translate(0, 100); rg.scale(1.12, 0.8); rg.translate(0, -100); }
  drawRig(e, pose(e));
  if (e.cls === 'dwarf' && e.glowM) e.glowM = [e.glowM[0] * 1.12, 100 - (100 - e.glowM[1]) * 0.8];
  }

  const img = rg.getImageData(0, 0, rig.width, rig.height).data;
  const left = kn ? G.left : gx + BOX_X0 * u, W2 = rig.width;
  const [tr, tg, tb] = e.tint;
  const LV = 8;
  const lv = [];
  for (let k = 0; k < LV; k++) lv.push([]);
  const emit = [];
  // backing silhouette so the figure occludes the grass behind it
  if (!kn) { ctx.fillStyle = 'rgba(12,12,12,.94)'; ctx.beginPath(); }
  let runY = -1, runS = 0, runE = 0;
  const kg = [];  // knight glyphs wait until every backing block is down
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    let r = 0, g = 0, a = 0;
    for (let oy = 0; oy < SS; oy++) for (let ox = 0; ox < SS; ox++) {
      const o = ((cy * SS + oy) * W2 + cx * SS + ox) * 4;
      r += img[o]; g += img[o + 1]; a += img[o + 3];
    }
    const n = SS * SS; a /= n * 255;
    if (a < 0.3) continue;
    r /= n * 255 * a; g /= n * 255 * a;
    if (kn) { r = 0.16 + 0.84 * Math.pow(Math.min(1, r / 0.5), 0.75); g = r; } // dark plate keeps a sparse grain, highlights go dense
    const px = left + cx * fcw, py = top + cy * fch;
    if (kn) { if (runY === cy && runE === cx) runE = cx + 1; else { if (runY >= 0) grect(left + runS * fcw - 0.4, top + runY * fch - 0.4, (runE - runS) * fcw + 0.8, fch + 0.8, 0.94); runY = cy; runS = cx; runE = cx + 1; } }
    else ctx.rect(px - 0.4, py - 0.4, fcw + 0.8, fch + 0.8);
    if (r > 0.75 && g < 0.35) { emit.push(px, py); continue; }
    const grain = (hash(cx * 7 + (e.cls.length * 31), cy * 13) - 0.5) * 0.16;
    const lit = Math.pow(Math.max(0, r * 1.3 - 0.06), 0.8);
    let v = lit * Math.min(1, a * 1.2) + BAYER[(cy & 3) * 4 + (cx & 3)] * (e.cls === 'knight' ? 0.24 : 0.38) + grain;
    if (v < 0.16) continue;
    v = Math.min(0.999, v);
    const ci = 1 + ((v * (RAMP.length - 1)) | 0);
    if (kn) { kg.push(KN0 + Math.min(RAMP.length - 1, ci) * KLV + ((v * KLV) | 0), px, py); continue; }
    lv[(v * LV) | 0].push(px, py, ci);
  }
  if (kn) {
    if (runY >= 0) grect(left + runS * fcw - 0.4, top + runY * fch - 0.4, (runE - runS) * fcw + 0.8, fch + 0.8, 0.94);
    for (let j = 0; j < kg.length; j += 3) gput(kg[j], kg[j + 1], kg[j + 2], 1);
  } else ctx.fill();
  ctx.font = `600 ${ffs}px ${FONT}`;
  ctx.textBaseline = 'top';
  for (let k = 0; k < LV; k++) {
    const arr = lv[k]; if (!arr.length) continue;
    const f = 0.3 + 0.85 * (k / (LV - 1));
    ctx.fillStyle = `rgb(${Math.min(255, tr * f) | 0},${Math.min(255, tg * f) | 0},${Math.min(255, tb * f) | 0})`;
    for (let j = 0; j < arr.length; j += 3) ctx.fillText(RAMP[Math.min(RAMP.length - 1, arr[j + 2])], arr[j], arr[j + 1]);
  }
  if (emit.length) {
    ctx.fillStyle = e.glowCol || '#fff';
    ctx.shadowColor = e.glowCol || '#fff'; ctx.shadowBlur = 8 + Math.sin(t * 9) * 3;
    for (let j = 0; j < emit.length; j += 2) ctx.fillText('@', emit[j], emit[j + 1]);
    ctx.shadowBlur = 0;
  }

  drawTag(e, gx, gy);
}
