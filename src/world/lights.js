// Lights in the dark: lit castle windows, the campfire and the braziers, and their glow on the overlay.

// ---------- light in the dark: a few lit windows and two small fires at the gate ----------
// The windows give a pale, almost colourless light; the two fires burn warm and colour whoever comes close.
const braziers = [];
const LIGHTCH = ['#', '=', ':', '+', '%'].map(c => CI[c]);
const FLAMECH = ['^', '*', "'", '"', ',', '.'].map(c => CI[c]);
const flick = (k, sp) => 0.62 + 0.22 * Math.sin(t * sp + k * 1.7) + 0.16 * Math.sin(t * sp * 2.7 + k * 4.1);
function drawWindows() {
  const L = cathedral.lit; if (!L) return;
  for (let j = 0; j < L.length; j += 3) {
    const id = L[j + 2], f = id < 0 ? 0.55 : flick(id, 2.2), cx = L[j], cy = L[j + 1];
    const lv = BL0 + Math.min(BLN - 1, Math.round((0.7 + 0.3 * f) * (BLN - 1)));
    blit(LIGHTCH[(hash(cx, cy) * LIGHTCH.length) | 0], lv, cx * CW, cy * CH, 0.75 + 0.25 * f);
  }
}
function updateFire(b, dt) {
  if (b.ground) for (let y = Math.floor(b.y - 1); y <= Math.ceil(b.y + 2.5); y++) for (let x = Math.floor(b.x - 6); x <= Math.ceil(b.x + 6); x++) {
    const i = y * COLS + x, dx = (x + 0.5 - b.x) / 6, dy = (y + 0.5 - b.y - 0.7) / 1.8;
    if (i >= 0 && i < N && dx * dx + dy * dy < 1) flat[i] = Math.max(flat[i], 0.85);
  }
  const F = Math.min(MS, 1.4); for (let k = 0; k < 6; k++) if (b.parts.length < 110 && Math.random() < dt * 60) { const sp = Math.random() - 0.5; b.parts.push({ x: sp * 26 * F, y: 0, vy: -(30 + Math.random() * 46) * F * (1 - Math.abs(sp)), vx: -sp * 14 * F, life: 1, k: Math.random() }); }
  for (let i = b.parts.length - 1; i >= 0; i--) {
    const q = b.parts[i];
    q.life -= dt * (0.9 + q.k * 0.8); q.y += q.vy * dt; q.x += (q.vx + Math.sin(t * 9 + q.k * 20) * 6 * Math.min(MS, 1.4)) * dt;
    if (q.life <= 0) b.parts.splice(i, 1);
  }
  if (b.cook) {   // steam off the pot: slow, swelling, leaning with the wind, gone in a few seconds
    const S = b.steam;
    if (S.length < 26 && Math.random() < dt * 7) S.push({ x: (Math.random() - 0.5) * 6, y: 0, life: 1, k: Math.random() });
    for (let i = S.length - 1; i >= 0; i--) { const q = S[i]; q.life -= dt * 0.38; q.y -= (10 + q.k * 6) * dt * MS; q.x += (9 + Math.sin(t * 1.3 + q.k * 9) * 5) * dt * MS; if (q.life <= 0) S.splice(i, 1); }
  }
}
function drawBrazier(b) {
  const bx = b.x * CW, by = (b.y + 0.7) * CH - b.lift;
  // the iron bowl: two rows of dark glyphs
  // an iron bowl on a short stand
  if (b.ground) {   // a campfire: crossed logs and a ring of stones in the grass
    const logs = ['o', '\\', '=', '#', '=', '/', 'o'];
    for (let k = 0; k < logs.length; k++) blit(CI[logs[k]], BL0 + 3 + (k === 3 ? 2 : 1), bx + (k - 3.5) * CW, by - CH * 1.1);
    blit(CI['o'], BL0 + 2, bx - CW * 4.4, by - CH * 0.4); blit(CI['o'], BL0 + 2, bx + CW * 3.4, by - CH * 0.4);
  } else {
    const bowl = ['\\', '=', '#', '=', '#', '=', '/'];
    for (let k = 0; k < bowl.length; k++) blit(CI[bowl[k]], BL0 + 4 + (k === 2 || k === 4 ? 1 : 0), bx + (k - 3.5) * CW, by - CH * 1.6);
    blit(CI['|'], BL0 + 3, bx - CW * 0.5, by - CH * 0.7); blit(CI['/'], BL0 + 3, bx - CW * 1.6, by - CH * 0.1); blit(CI['\\'], BL0 + 3, bx + CW * 0.6, by - CH * 0.1);
  }
  const ey = b.ground ? -CH * 1.8 : -CH * 2.3, fy = b.ground ? -CH * 2.2 : -CH * 2.8;
  // embers in the bowl
  for (let k = -2; k <= 2; k++) blit(CI[hash(k + 9, (t * 8) | 0) > 0.5 ? '*' : 'o'], BL0 + 9 + ((hash(k, (t * 6) | 0) * 4) | 0), bx + (k - 0.5) * CW, by + ey);
  for (const q of b.parts) {
    const ci = FLAMECH[Math.min(FLAMECH.length - 1, ((1 - q.life) * FLAMECH.length) | 0)];
    blit(ci, BL0 + Math.min(BLN - 1, Math.round(6 + q.life * 8)), bx + q.x - CW * 0.5, by + fy + q.y, Math.min(1, q.life * 1.6));
  }
  if (b.cook && COOKV) gput(COOKV.whole, bx, by - CH * 0.4, 1);   // world/camp.js: the tripod and the pot over the flames, its dark belly in front of them
  if (b.cook) { const top = by - CH * 0.4 - knightPx() * 0.5; for (const q of b.steam) blit(CI[q.life > 0.6 ? '~' : q.k > 0.5 ? '°' : '.'], C_WHITE, bx + q.x - CW * 0.5, top + q.y, Math.min(0.7, q.life) * (1 - Math.max(0, q.life - 0.9) * 8)); }
}
let glowCv = null;
function glowSprite() {
  if (glowCv) return glowCv;
  glowCv = document.createElement('canvas'); glowCv.width = glowCv.height = 128;
  const g = glowCv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(236,232,222,1)'); gr.addColorStop(0.25, 'rgba(236,232,222,.45)'); gr.addColorStop(1, 'rgba(236,232,222,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return glowCv;
}
let fireCv = null;
function fireSprite() {   // the fires burn warm: ember red at the rim, orange at the heart
  if (fireCv) return fireCv;
  fireCv = document.createElement('canvas'); fireCv.width = fireCv.height = 128;
  const g = fireCv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,150,80,1)'); gr.addColorStop(0.3, 'rgba(205,48,28,.5)'); gr.addColorStop(1, 'rgba(120,18,12,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return fireCv;
}
function drawLights() {  // on the overlay, above the fog, so the light pushes through it
  const G = glowSprite(), FG = fireSprite(), ox = camX * CW, oy = camY * CH;
  const spot = (x, y, r, a, S = G) => { x = (x - ox) * VZ; y = (y - oy) * VZ; r *= VZ; if (x + r < 0 || y + r < 0 || x - r > W || y - r > H) return; ctx.globalAlpha = Math.max(0, Math.min(1, a)); ctx.drawImage(S, x - r, y - r, r * 2, r * 2); };
  for (const w of cathedral.glows || []) spot(w.x, w.y, w.r * 1.5, (w.id < 0 ? 0.2 : 0.42) * (w.id < 0 ? 1 : flick(w.id, 2.2)));
  for (const b of braziers) {
    const bx = b.x * CW, by = (b.y + 0.7) * CH - b.lift - CH * 3.5, f = flick(b.seed * 3, 11);
    spot(bx, by + CH, 280 * Math.min(MS, 1.4) * (0.9 + 0.1 * f), 0.22 * f, FG);   // a pool on the stone and in the fog
    spot(bx, by, 60 * Math.min(MS, 1.4), 0.5 * f, FG);                          // the heart of the flame
  }
  ctx.globalAlpha = 1;
}
