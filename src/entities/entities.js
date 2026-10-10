// Entities: the factory, the player and the entity list, their on-screen size and footprint, name tags.

// ---------- entities ----------
// Characters are 2D rigs: shaded shapes drawn to an offscreen buffer, then dithered into tiny glyphs.
const mk = (name, cls, tint, opts = {}) => ({
  x: 0, y: 0, tx: 0, ty: 0, name, cls, tint, dir: 'down', step: 0, walk: 0, swing: 0, wait: 0, moving: false, face: 1,
  say: '', sayT: 0, sayCd: 0, label: '#cfdccf', ...opts,
});
const player = mk('you', 'knight', [236, 236, 236], { me: true, label: '#9a9a9a' });
const npcs = []; // the knight walks the meadow alone
const ents = [player, ...npcs];
function placeEntities() {
  player.y = ROWS - VR * 0.3; player.x = pathX(player.y) - 3;
  player.dir = 'up'; player.d8 = 4;
  placeCows();
  updateCamera(0, true);
}
function charDims(e) {
  if (e && (e.cls === 'knight' || e.cls === 'cow')) { // ~16% of the screen tall, in fine grain
    const ffs = Math.max(3.2, Math.min(4.2, FS * 0.38));
    return { ffs, fcw: ffs * 0.6, fch: ffs * 0.9, u: Math.max(1, Math.min(2, H * 0.16 / 92)) };
  }
  const ffs = Math.max(3.8, FS * 0.42);
  const u = Math.max(1.25, Math.min(2.3, H / 400)); // px per model unit
  return { ffs, fcw: ffs * 0.6, fch: ffs * 0.9, u };
}
const boxH = e => BOX_H;
function geomOf(e) {
  const { u } = charDims(e);
  if (e.cls === 'knight') {
    const { fcw, fch } = charDims(e), gx = e.x * CW, gy = (e.y + 0.7) * CH - liftPx(e) - jumpPx(e);
    return { u, gx, gy, top: gy - KG.fy * fch, left: gx - KG.fx * fcw, w: KG.cols * fcw, h: KG.rows * fch };
  }
  if (e.cls === 'cow') {
    const { fcw, fch } = charDims(e), gx = e.x * CW, gy = (e.y + 0.7) * CH;
    return { u, gx, gy, top: gy - CG.fy * fch * 0.75, left: gx - CG.fx * fcw * 0.6, w: CG.cols * fcw * 0.6, h: CG.rows * fch * 0.75 };
  }
  const gx = e.x * CW, gy = (e.y + 0.7) * CH;
  return { u, gx, gy, top: gy - (boxH(e) - 6) * u };
}
function glowPos(e) {
  if (!e.glowM) return [-999, -999];
  const { u, gx, gy } = geomOf(e);
  return [gx + e.glowM[0] * u * e.face, gy - (100 - e.glowM[1]) * u];
}
function drawTag(e, gx, gy) {
  const kn = e.cls === 'knight', u = charDims(e).u;
  // name tag
  const headTop = kn ? gy - knightPx() * 0.98 : gy - 96 * u * (e.cls === 'dwarf' ? 0.8 : 1);
  ctx.font = `${Math.max(9, FS)}px ${FONT}`;
  const lw = ctx.measureText(e.name).width;
  ctx.fillStyle = e.label;
  ctx.fillText(e.name, gx - lw / 2, headTop - FS * 1.6);
  if (e.say && e.sayT > 0) {
    const a = Math.min(1, e.sayT * 2, (3 - e.sayT) * 4);
    ctx.globalAlpha = Math.max(0, a);
    const fs = Math.max(10, FS + 1);
    ctx.font = `${fs}px ${FONT}`;
    const tw = ctx.measureText(e.say).width, pad = 6;
    const bx = Math.max(camX * CW + 8, Math.min(camX * CW + W - tw - pad * 2 - 8, gx - tw / 2 - pad));
    const by = headTop - FS * 1.6 - fs - pad * 2 - 6;
    ctx.fillStyle = 'rgba(12,12,12,.92)'; ctx.strokeStyle = 'rgba(250,250,250,.22)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.rect(bx, by, tw + pad * 2, fs + pad * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#eaeaea'; ctx.fillText(e.say, bx + pad, by + pad);
    ctx.globalAlpha = 1;
  }
}
