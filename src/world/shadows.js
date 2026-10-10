// Shadows of the knight and the cows on the grass, written into `shadow`: the share of light a cell loses
// (grass multiplies its light by 1 − shadow, the fog grain over it dims too). The night has no moon:
//  - a dense contact patch under the body (along it for a cow), shrinking and paling in a jump;
//  - near a fire, a long shadow thrown straight away from the flame, as strong as its light there;
//  - a lightning flash throws a hard shadow away from the strike for as long as the flash lasts.
// A body in the air casts from where it hangs, so its shadow parts from the feet.

const CONTACT_S = 0.95, FIRE_S = 0.85, BOLT_S = 0.9;

// A tapered capsule A→B in screen px, radius r0 at A and r1 at B, fading by `fade` towards B; ky stretches
// vertical distances (a patch on the ground is flatter than it is wide). Solid core, soft rim, max-blended.
function shadeCapsule(ax, ay, bx, by, r0, r1, s, fade, ky) {
  const r = Math.max(r0, r1);
  const x0 = Math.max(SBX0, Math.floor((Math.min(ax, bx) - r) / CW)), x1 = Math.min(SBX1 - 1, Math.ceil((Math.max(ax, bx) + r) / CW));
  const y0 = Math.max(SBY0, Math.floor((Math.min(ay, by) - r / ky) / CH)), y1 = Math.min(SBY1 - 1, Math.ceil((Math.max(ay, by) + r / ky) / CH));
  const ux = bx - ax, uy = by - ay, uu = ux * ux + uy * uy;
  for (let y = y0; y <= y1; y++) {
    const py = (y + 0.5) * CH, o = y * COLS;
    for (let x = x0; x <= x1; x++) {
      const px = (x + 0.5) * CW;
      let u = uu > 0 ? ((px - ax) * ux + (py - ay) * uy) / uu : 0;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const dx = px - ax - ux * u, dy = (py - ay - uy * u) * ky, rr = r0 + (r1 - r0) * u;
      const q = (dx * dx + dy * dy) / (rr * rr);
      if (q >= 1) continue;
      const e = (1 - q) * 2.5, v = s * (e < 1 ? e : 1) * (1 - fade * u), i = o + x;
      if (v > shadow[i]) shadow[i] = v;
    }
  }
}

// One cast shadow along screen direction (gx, gy) per px of height: a strip for the knight, three for a cow.
function castAlong(fx, fy, tx, ty, gx, gy, air, h, w, s, fade, cow) {
  if (cow) for (const j of [-1, 0, 1]) shadeCapsule(fx + j * tx + gx * air, fy + j * ty + gy * air, fx + j * tx + gx * (air + h), fy + j * ty + gy * (air + h), w, w * 0.8, s, fade, 1.3);
  else shadeCapsule(fx + gx * air, fy + gy * air, fx + gx * (air + h), fy + gy * (air + h), w, w * 0.55, s, fade, 1.3);
}

function castShadow(e) {
  const cow = e.cls === 'cow', kp = knightPx();
  const fx = e.x * CW, fy = (e.y + 0.3) * CH;   // the feet
  if (fx < (SBX0 - 30) * CW || fx > (SBX1 + 30) * CW || fy < (SBY0 - 12) * CH || fy > (SBY1 + 16) * CH) return;
  const air = cow ? hopPx(e) : jumpPx(e), k = Math.min(1, air / (cow ? charDims(e).fch * 9 : kp * 0.45));
  const h = cow ? kp * 0.6 : kp, w = cow ? 2.8 * CW : 0.19 * h;
  // a cow's body lies along its heading, half a cow each way
  const half = cow ? cowHalf() * CW * 0.8 : 0, tx = cow ? KTX[e.d8 | 0] * half : 0, ty = cow ? KTY[e.d8 | 0] * half * 0.5 * CH / CW : 0;
  // contact: dense and flat under the whole body; in the air it shrinks and pales
  const cr = (cow ? 2.6 : 6) * CW * (1 - 0.45 * k);
  shadeCapsule(fx - tx, fy - ty, fx + tx, fy + ty, cr, cr, CONTACT_S * (1 - 0.65 * k), 0, cr / ((cow ? 1.6 : 2) * CH * (1 - 0.45 * k)));
  // the fire nearest in light, as fireLightAt sees it: a low flame throws a long, deep shadow that only
  // gives out near the edge of its light
  let fI = 0, gx = 0, gy = 0;
  for (const b of braziers) {
    const dx = fx - b.x * CW, dy = ((e.y + 0.7) * CH - ((b.y + 0.7) * CH - b.lift)) * 1.6, d = Math.hypot(dx, dy), r = 300 * Math.min(MS, 1.4);
    if (d < r && d > 1) { const v = (1 - d / r) ** 1.6 * (0.82 + 0.18 * flick(b.seed * 3, 5)); if (v > fI) { fI = v; gx = dx / d; gy = dy / d / 1.6; } }
  }
  if (fI > 0.03) castAlong(fx, fy, tx, ty, gx, gy, air * 1.1, h * 1.1, w, FIRE_S * Math.min(1, fI * 2.2) * (1 - 0.3 * k), 0.5, cow);
  // lightning: the bolt is far off and high, so its shadow is shorter and hard, gone with the flash
  if (flash > 0.05) castAlong(fx, fy, tx, ty, -Math.cos(flashAng) * 0.75, -Math.sin(flashAng) * 0.4, air * 0.75, h * 0.75, w, BOLT_S * Math.min(1, flash * 1.4) * (1 - 0.3 * k), 0.35, cow);
}
