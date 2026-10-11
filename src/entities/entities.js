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
  if (MEADOW_MAP.start) [player.x, player.y] = mapToCell(MEADOW_MAP.start[0], MEADOW_MAP.start[1]);
  else { player.y = ROWS - VR * 0.3; player.x = pathX(player.y) - 3; }
  [player.x, player.y] = dryNear(player.x, player.y);
  player.dir = 'up'; player.d8 = 4;
  placeCows();
  updateCamera(0, true);
}
// The nearest point out of water, marsh and the castle's walls: a stroke or the moved castle may cover the start.
function dryNear(x, y) {
  const dry = (px, py) => { const i = Math.round(py + 0.2) * COLS + Math.round(px); return px >= 1 && py >= 1 && px < COLS - 1 && py < ROWS - 1 && !wet[i] && !bmask[i]; };
  if (dry(x, y)) return [x, y];
  for (let r = 1; r < 120; r++) for (let k = 0, n = 8 * r; k < n; k++) {   // rings outwards, a cell row is ~2 columns tall
    const a = k / n * 6.2832, px = x + Math.cos(a) * r * 2, py = y + Math.sin(a) * r;
    if (dry(px, py)) return [px, py];
  }
  return [x, y];
}
function charDims(e) {
  if (e && (e.cls === 'knight' || e.cls === 'cow')) { // ~16% of the screen tall, in fine grain
    let ffs = Math.max(3.2, Math.min(4.2, FS * 0.38));
    // a phone: the knight a share of the screen's height, larger when it is held upright, smaller across
    if (W < 640 || H < 560) ffs = Math.max(2, Math.min(4.8, H * (W < H ? 0.175 : 0.16) / 40));
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

// Other walkers (none at the moment): wander, stop to talk when the knight comes close.
function updateNpcs(dt) {
  for (const n of npcs) {
    // Catalog actors use the extensible behavior contract. Legacy entities
    // retain exactly their old update path until explicitly migrated.
    if (n.actorType) { updateRegisteredNpc(n, dt); continue; }
    const px = player.x - n.x, py = (player.y - n.y) * (CH / CW), pd = Math.hypot(px, py);
    n.sayCd -= dt; n.sayT -= dt;
    if (pd < 14 && n.sayCd <= 0) { n.say = n.lines[(Math.random() * n.lines.length) | 0]; n.sayT = 3; n.sayCd = 10; n.tx = n.x; n.ty = n.y; n.wait = 3; }
    const dx = n.tx - n.x, dy = (n.ty - n.y) * (CH / CW);
    if (Math.hypot(dx, dy) < 1) {
      move(n, 0, 0, dt, 0);
      if (pd < 18) n.face = Math.sign(px) || n.face;
      if ((n.wait -= dt) <= 0) { n.tx = 6 + Math.random() * (COLS - 12); n.ty = 12 + Math.random() * (ROWS - 16); n.wait = 1.5 + Math.random() * 4; }
    } else move(n, dx, dy, dt, 8);
  }
}

// Per-entity easing: walk blend, swing, the jump clock and the gust of a landing.
function updateEntityTimers(dt) {
  for (const e of ents) { e.walk += ((e.moving ? 1 : 0) - e.walk) * Math.min(1, dt * 8); e.swing = Math.max(0, e.swing - dt * 2.6);
    if (e.jump > 0) { e.jump = Math.max(0, e.jump - dt / JUMP_T); if (!e.landed && (1 - e.jump) * JUMP_T >= AIR1) { e.landed = true; gust(e.x, e.y + 0.5); } }
  }
}
