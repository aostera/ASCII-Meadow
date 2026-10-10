// World props and interaction: usable spots (E), speech, lightning, fog drift, the E prompt.

// ---------- world props: things that stand on the field, block the way, and can be used ----------
// A prop has a footprint in grid cells (x0..x1, y0..y1) and optional spots the knight can use.
const props = [];
let activeSpot = null;
let flash = 0, nextFlash = 6;
const fogs = [];

function buildWorld() {
  props.length = 0; cathedral.cv = null;
  buildCathedral();
  fogs.length = 0;
  // fog banks that lie round the castle mound and roll slowly east
  fogBanks.length = 0;
  const C = cathedral;
  if (C.cv) for (let k = 0; k < 16; k++) {
    const rx = (260 + Math.random() * 300) * MS;
    fogBanks.push({ x: C.ox + (Math.random() * 2 - 1) * 1100 * MS, y: C.oy - (Math.random() * 520 - 60) * MS, rx, ry: rx * (0.28 + Math.random() * 0.12), a: 0.14 + Math.random() * 0.1, sp: (6 + Math.random() * 14) * MS, ph: Math.random() * 6 });
  }
  for (let k = 0; k < 14; k++) fogs.push({ x: Math.random() * COLS, y: ROWS * 0.25 + Math.random() * ROWS * 0.6, r: 18 + Math.random() * 30, a: 0.5 + Math.random() * 0.5, sp: 0.6 + Math.random() * 1.2 });
}

function say(e, text) { e.say = text; e.sayT = 3; }

function updateWorld(dt) {
  flash *= Math.exp(-dt * 7);
  if ((nextFlash -= dt) <= 0) { flash = 1; nextFlash = 8 + Math.random() * 14; setTimeout(() => (flash = Math.max(flash, 0.7)), 140); }
  for (const f of fogs) { f.x += f.sp * dt; if (f.x - f.r > COLS) f.x = -f.r; }
  activeSpot = null; let best = 1e9;
  for (const p of props) for (const sp of p.spots || []) {
    const d = Math.hypot(sp.x - player.x, (sp.y - player.y) * CH / CW);
    if (d < sp.r && d < best && (!sp.need || sp.need())) { best = d; activeSpot = sp; }
  }
  player.sayT -= dt;
}

function drawPrompt() {
  if (!activeSpot) return;
  const sp = activeSpot, txt = `E  ${sp.label}`;
  const fs = Math.max(11, FS + 2);
  ctx.font = `500 ${fs}px "Rubik", system-ui, sans-serif`;
  const tw = ctx.measureText(txt).width, pad = 7;
  const x = Math.max(8, Math.min(W - tw - pad * 2 - 8, (player.x - camX) * CW - tw / 2 - pad));
  const y = Math.min(H - fs - pad * 2 - 8, (player.y + 0.7 - camY) * CH - liftPx(player) + 12);
  const pulse = 0.6 + 0.4 * Math.sin(t * 4);
  ctx.fillStyle = 'rgba(12,12,12,.9)'; ctx.strokeStyle = `rgba(250,250,250,${0.2 + 0.25 * pulse})`; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.rect(x, y, tw + pad * 2, fs + pad * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fafafa'; ctx.textBaseline = 'top'; ctx.fillText(txt, x + pad, y + pad);
  activeSpot.box = [x, y, tw + pad * 2, fs + pad * 2];
}
function useSpot() { if (activeSpot) activeSpot.use(); }
