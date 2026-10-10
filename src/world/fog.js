// Fog: a low-resolution domain-warped field on the overlay, its grain of glyphs, and the castle banks.

// ---------- castle fog: soft banks on the overlay, with a grain of glyphs drifting through them ----------
const fogBanks = [];
const FOGCH = ['.', '-', '~', ':', "'", '-'].map(c => CI[c]);
// One low-resolution fog field for the whole screen, recomputed every other frame and stretched smooth.
// Domain-warped noise in world space, so the fog rolls and curls as it drifts; thickest round the castle,
// a lower, thinner sheet over the rest of the field.
const FG = { cv: document.createElement('canvas'), w: 0, h: 0, d: null, img: null, tick: 0 };
function fogDensity(x, y) {
  const C = cathedral;
  let m = 0;
  if (C.cv) { const dx = (x - C.ox) / (1500 * MS), dy = (y - (C.oy - 120 * MS)) / (900 * MS); m = Math.max(0, 1 - (dx * dx + dy * dy)); }
  const qx = vnoise(x * 0.0021 + t * 0.03, y * 0.004) * 2.2, qy = vnoise(x * 0.0021 + 5.2, y * 0.004 - t * 0.025) * 2.2;   // warp
  const u = x * 0.0032 + qx - t * 0.06, v = y * 0.0058 + qy + t * 0.012;
  const n = vnoise(u, v) * 0.6 + vnoise(u * 2.3 - t * 0.09, v * 2.3) * 0.28 + vnoise(u * 5.1, v * 5.1 + t * 0.05) * 0.12;
  const thick = 0.28 + 0.72 * Math.min(1, m * 1.5);
  return Math.max(0, Math.min(1, (n - 0.56 + thick * 0.42) * 2.4)) * thick;
}
function updateFog() {
  const fw = Math.max(32, Math.round(W / 12)), fh = Math.max(24, Math.round(H / 12));
  if (FG.w !== fw || FG.h !== fh) { FG.w = fw; FG.h = fh; FG.cv.width = fw; FG.cv.height = fh; FG.d = new Float32Array(fw * fh); FG.img = FG.cv.getContext('2d').createImageData(fw, fh); FG.tick = 0; }
  if ((FG.tick++ & 1) && FG.tick > 2) return;
  const x0 = camX * CW, y0 = camY * CH, sx = W / fw, sy = H / fh, px = FG.img.data;
  for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) {
    const wx = x0 + (i + 0.5) * sx, wy = y0 + (j + 0.5) * sy;
    let d = fogDensity(wx, wy);
    { const C2 = cathedral; if (C2.cv) { const dx = (wx - C2.ox) / (230 * MS), dy = (wy - (C2.oy - 20 * MS)) / (200 * MS); d *= 1 - 0.65 * Math.exp(-(dx * dx + dy * dy)); } }  // the stair stays readable
    for (const b of braziers) { const dx = wx - b.x * CW, dy = (wy - ((b.y + 0.7) * CH - b.lift)) * 1.6, r = 150 * Math.min(MS, 1.4); d *= 1 - 0.55 * Math.exp(-(dx * dx + dy * dy) / (r * r)); }  // the heat thins the fog
    const k = j * fw + i;
    FG.d[k] = d;
    const gc = Math.min(COLS - 1, Math.max(0, (wx / CW) | 0)) + Math.min(ROWS - 1, Math.max(0, (wy / CH) | 0)) * COLS;
    const c = (64 + d * 26) * (1 - 0.8 * shadow[gc]), o = k * 4;   // dark, wet grey: it smothers the light rather than glowing; in a body's shadow it is unlit
    px[o] = c; px[o + 1] = c; px[o + 2] = c; px[o + 3] = Math.min(150, d * 105 + d * d * 50);
  }
  FG.cv.getContext('2d').putImageData(FG.img, 0, 0);
}
const fogAt = (sx, sy) => { const i = Math.min(FG.w - 1, Math.max(0, (sx / W * FG.w) | 0)), j = Math.min(FG.h - 1, Math.max(0, (sy / H * FG.h) | 0)); return FG.d ? FG.d[j * FG.w + i] : 0; };
function castleFogGlyphs() {  // grain of the fog, in the glyph batch on top of stone, grass and the knight
  if (!FG.d) return;
  const ox = camX * CW, oy = camY * CH;
  for (let y = VY0; y <= VY1; y += 2) for (let x = VX0 + ((y >> 1) & 1); x <= VX1; x += 2) {
    const px = x * CW, py = y * CH, d = fogAt(px - ox, py - oy);
    if (d < 0.12) continue;
    const h = hash(x + ((t * 3) | 0), y);   // reshuffles a few times a second, so the grain seethes
    if (h > d * 1.3) continue;
    const sh = shadow[y * COLS + x];   // the ground fog lying in a body's shadow is unlit too
    blit(FOGCH[(h * 47 | 0) % FOGCH.length], C_WHITE, px + Math.sin(t * 0.7 + y * 0.3) * 3, py, Math.min(0.5, 0.08 + d * 0.4 + flash * 0.2) * (1 - 0.8 * sh));
  }
}
function drawFogField() {  // screen space, on the overlay
  if (!FG.d) return;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.globalAlpha = Math.min(1, 0.85 + flash * 0.3);
  ctx.drawImage(FG.cv, 0, 0, W, H);
  ctx.globalAlpha = 1;
}
function castleFogBanks(dt) {  // on the overlay, in world space
  const C = cathedral;
  if (!C.cv) return;
  const vx0 = camX * CW, vy0 = camY * CH;
  for (const b of fogBanks) {
    b.x += b.sp * dt;
    if (b.x - b.rx > C.ox + 1200 * MS) b.x = C.ox - 1200 * MS - b.rx;
    if (b.x + b.rx < vx0 || b.x - b.rx > vx0 + W || b.y + b.ry < vy0 || b.y - b.ry > vy0 + H) continue;
    const a = b.a * (0.8 + 0.2 * Math.sin(t * 0.4 + b.ph)) + flash * 0.05;
    ctx.save(); ctx.translate(b.x, b.y); ctx.scale(1, b.ry / b.rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, b.rx);
    g.addColorStop(0, `rgba(205,205,205,${a})`); g.addColorStop(0.55, `rgba(205,205,205,${a * 0.5})`); g.addColorStop(1, 'rgba(205,205,205,0)');
    ctx.fillStyle = g; ctx.fillRect(-b.rx, -b.rx, b.rx * 2, b.rx * 2);
    ctx.restore();
  }
}
function drawFog() {
  for (const f of fogs) {
    const x = f.x * CW, y = f.y * CH, r = f.r * CW;
    if (x + r < camX * CW || x - r > camX * CW + W || y + r < camY * CH || y - r > camY * CH + H) continue;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(190,190,190,${0.06 * f.a})`); gr.addColorStop(1, 'rgba(190,190,190,0)');
    ctx.fillStyle = gr; ctx.fillRect(x - r, y - r * 0.6, r * 2, r * 1.2);
  }
}
