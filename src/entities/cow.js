// Cows: frame index per animation and direction, grazing, hopping, the herd's behaviour, and drawing
// (frames swap by dissolving). Frames: data/cow-frames.js.

// ---------- cows: the dark-fantasy cow atlases (assets/cow/), printed as glyphs like the knight ----------
// Eight directions (d8: S, SW, W, NW, N, NE, E, SE) for idle, walk, run and grazing, and a hop where the jump
// sheet has a clean drawing (W, SW, N and their mirrors E, SE). Grazing: eatdown lowers the head from the
// standing drawing to the drawn grazing pose (played backwards it rises), eat is the grazing loop. Every frame was looked at and the faults worked
// around in tools/cow/build_cow_frames.py (turning rows, tails that snap, a jump sheet that turns mid-air).
const CG = { cols: 144, rows: 54, fx: 72, fy: 51.6 };
const CFR = COW_ART.map(src => {   // glyph codes and dark backing runs, as [code, cx, cy...] and [cy, s0, s1...]
  const lines = src.split('\n'), top = +lines[0], list = [], runs = [];
  for (let k = 1; k < lines.length; k++) {
    const raw = lines[k], cy = top + k - 1;
    let row = ' '.repeat(raw.length ? raw.charCodeAt(0) - 0xC0 : 0);
    for (let i = 1; i < raw.length; i++) row += raw[i] === '~' ? "'".repeat(raw.charCodeAt(++i) - 0xC0) : raw[i];
    let s0 = -1;
    for (let cx = 0; cx <= row.length; cx++) {
      const ch = cx < row.length ? row[cx] : ' ';
      if (ch !== ' ' && s0 < 0) s0 = cx;
      if (ch === ' ' && s0 >= 0) { runs.push(cy, s0, cx); s0 = -1; }
      if (ch === ' ' || ch === "'") continue;
      list.push(rampCode(RAMP.indexOf(ch)), cx, cy);
    }
  }
  return { list: Int16Array.from(list), runs: Int16Array.from(runs) };
});
COW_ART.length = 0;
const CIX = {idle: [[0, 9], [9, 11], [20, 11], [31, 11], [42, 11], [53, 11], [64, 11], [75, 11]], walk: [[86, 42], [128, 21], [149, 21], [170, 21], [191, 21], [212, 21], [233, 21], [254, 21]], run: [[275, 28], [303, 14], [317, 14], [331, 14], [345, 14], [359, 14], [373, 14], [387, 14]], jump: [[-1, 0], [401, 15], [416, 15], [-1, 0], [431, 15], [-1, 0], [446, 15], [461, 15]], eatdown: [[476, 10], [495, 10], [516, 10], [537, 10], [558, 10], [579, 10], [600, 10], [621, 10]], eat: [[486, 9], [505, 11], [526, 11], [547, 11], [568, 11], [589, 11], [610, 11], [631, 11]]};   // anim: per direction [first frame, count] (jump: -1 where that way has no hop)
const COW_HOP = [0.08, 0.1, 0.1, 0.12, 0.14, 0.12, 0.1, 0.12];   // the hop's 8 drawn phases, seconds; air from phase 2 to 5
const HOP_T = COW_HOP.reduce((a, b) => a + b, 0), HOP0 = 0.18, HOP1 = 0.18 + 0.1 + 0.12 + 0.14 + 0.12;
const GRAZE_DOWN = 0.9, GRAZE_UP = 0.75;   // seconds to lower and to raise the head
const COW_STRIDE = 30;   // fine cells of ground per walk cycle (about half a cow's length: hooves don't slide)
const cows = [];
const smooth = u => sm(Math.min(1, Math.max(0, u)));
const cowFrame = c => {
  const d = c.d8 | 0, f = (r, k) => r[0] + (((k % r[1]) + r[1]) % r[1]), fcw = charDims(c).fcw;
  switch (c.state) {
    case 'walk': return f(CIX.walk[d], Math.floor((c.wd || 0) / (COW_STRIDE * fcw) * CIX.walk[d][1]));
    case 'run': return f(CIX.run[d], Math.floor((c.wd || 0) / (COW_STRIDE * 1.7 * fcw) * CIX.run[d][1]));
    case 'hop': {
      const J = CIX.jump[d]; if (J[0] < 0) return f(CIX.run[d], 0);
      let tt = c.at, k = 0;
      while (k < 7 && tt >= COW_HOP[k]) tt -= COW_HOP[k++];
      return J[0] + Math.min(J[1] - 1, Math.round((k + tt / COW_HOP[k]) / 7 * (J[1] - 1)));
    }
    case 'graze': {
      const D = CIX.eatdown[d], n = D[1];
      if (c.gp === 'down') return D[0] + Math.min(n - 1, Math.floor(c.at / GRAZE_DOWN * n));
      if (c.gp === 'up') return D[0] + Math.max(0, n - 1 - Math.floor(c.at / GRAZE_UP * n));
      const G = CIX.eat[d], m = G[1], k = Math.floor(c.at * 5) % (2 * m - 2);   // crops the grass, tail swishing
      return G[0] + (k < m ? k : 2 * m - 2 - k);
    }
    default: {   // idle: the tail swishes back and forth
      const I = CIX.idle[d], n = I[1], k = Math.floor((c.at + (c.seed || 0)) * 6) % (2 * n - 2);
      return I[0] + (k < n ? k : 2 * n - 2 - k);
    }
  }
};
const hopPx = c => c.state === 'hop' && c.at > HOP0 && c.at < HOP1 ? Math.sin(Math.PI * (c.at - HOP0) / (HOP1 - HOP0)) * charDims(c).fch * 9 : 0;
function drawCowFrame(c, F, a) {
  const { fcw, fch } = charDims(c), gx = c.x * CW, gy = (c.y + 0.7) * CH - hopPx(c);
  const left = gx - CG.fx * fcw, top = gy - CG.fy * fch, R = F.runs, Lg = F.list;
  for (let j = 0; j < R.length; j += 3) grect(left + R[j + 1] * fcw - 0.4, top + R[j] * fch - 0.4, (R[j + 2] - R[j + 1]) * fcw + 0.8, fch + 0.8, 0.94 * a);
  const ga = a * 0.9;   // the tone is in the glyphs: a dark mass with moonlight on the back, like the trees
  for (let j = 0; j < Lg.length; j += 3) gput(KN0 + Lg[j], left + Lg[j + 1] * fcw, top + Lg[j + 2] * fch, ga);
}
// A turn or a change of gait dissolves over a moment instead of jumping between drawings.
function drawCow(c) {
  const ft = Math.min(0.05, Math.max(0, t - (c.lt ?? t))); c.lt = t;
  const fi = cowFrame(c), key = c.state + (c.d8 | 0);
  if (key !== c.key) { if (c.key !== undefined && c.shown !== undefined) { c.from = c.shown; c.xf = 0; } c.key = key; }
  if (c.xf !== undefined && c.xf < 1) {
    c.xf = Math.min(1, c.xf + ft / 0.22);
    const u = smooth(c.xf);
    drawCowFrame(c, CFR[c.from], 1 - u);
    drawCowFrame(c, CFR[fi], u);
  } else drawCowFrame(c, CFR[fi], 1);
  c.shown = fi;
}
const cowHalf = () => 34 * charDims(player).fcw / CW;   // half a cow's length, in field cells
// the cow's footprint lies along its heading: long one way, narrow the other
function inCow(c, x, y, grow) {
  const h = cowHalf() + grow, dx = x - c.x, dy = (y - c.y) * (CH / CW), tx = KTX[c.d8 | 0], ty = KTY[c.d8 | 0], l = Math.hypot(tx, ty * 1.4);
  const along = (dx * tx + dy * ty * 1.4) / l, across = (-dx * ty * 1.4 + dy * tx) / l;
  return (along / h) ** 2 + (across / (h * 0.42)) ** 2 < 1;
}
function placeCows() {
  for (let i = ents.length - 1; i >= 0; i--) if (ents[i].cls === 'cow') ents.splice(i, 1);
  cows.length = 0;
  // the map's herd, or a small one near the start
  const spots = MEADOW_MAP.cows ? MEADOW_MAP.cows.map(([gx, gz]) => mapToCell(gx, gz)) : [[34, -16], [-40, -30], [16, -54]].map(([ox, oy]) => [player.x + ox, player.y + oy]);
  spots.forEach(([x, y], mi) => {
    for (let k = 0; k < 20 && blocked(x, y, null); k++) { x += 3; y -= 1; }
    const c = mk('cow', 'cow', [236, 236, 236]);
    Object.assign(c, { seed: Math.random() * 6, x, y, home: [x, y], state: 'idle', at: 0, st: 1 + Math.random() * 3, d8: (Math.random() * 8) | 0, mi });
    cows.push(c); ents.push(c);
  });
}
function updateCows(dt) {
  for (const c of cows) {
    c.at += dt;
    const dx = c.x - player.x, dyc = c.y - player.y, dy = dyc * (CH / CW), d = Math.hypot(dx, dy);
    // a knight running close by spooks it: a startled hop where it has one, then it bolts
    if (c.state !== 'run' && c.state !== 'hop' && d < 18 && player.moving && (player.run || 0) > 0.5) {
      c.d8 = dirTo(dx, dy); c.at = 0; c.rt = 1.8 + Math.random();
      c.state = CIX.jump[c.d8][0] >= 0 && Math.random() < 0.6 ? 'hop' : 'run';
      if (c.state === 'hop') { const l = d || 1; c.hv = [dx / l, dy / l]; }
    }
    if (c.state === 'hop') {   // the leap keeps the heading it took off with
      const air = c.at > HOP0 && c.at < HOP1, hd = c.d8;
      move(c, air ? c.hv[0] : 0, air ? c.hv[1] : 0, dt, air ? 16 : 0);
      c.d8 = hd;
      if (c.at > HOP_T) { c.state = 'run'; c.at = 0; }
      continue;
    }
    if (c.state === 'run') {
      const l = d || 1;
      move(c, dx / l, dy / l, dt, 19);
      if (c.at > c.rt) { c.state = 'idle'; c.at = 0; c.st = 2 + Math.random() * 3; c.home = [c.x, c.y]; }
      continue;
    }
    if (c.state === 'walk') {
      const ex = c.tx - c.x, ey = (c.ty - c.y) * (CH / CW);
      if (Math.hypot(ex, ey) < 1.2 || c.at > 14) { c.state = 'idle'; c.at = 0; c.st = 2 + Math.random() * 3; move(c, 0, 0, dt, 0); }
      else { const x0 = c.x, y0 = c.y; move(c, ex, ey, dt, 6); if (Math.abs(c.x - x0) + Math.abs(c.y - y0) < 1e-4 && c.at > 1) { c.state = 'idle'; c.at = 0; c.st = 1; } }
      continue;
    }
    if (c.state === 'graze') {   // head down, grazing for a while, head back up
      move(c, 0, 0, dt, 0);
      if (c.gp === 'down' && c.at > GRAZE_DOWN) { c.gp = 'loop'; c.at = 0; }
      else if (c.gp === 'loop' && c.at > c.gl) { c.gp = 'up'; c.at = 0; }
      else if (c.gp === 'up' && c.at > GRAZE_UP) { c.state = 'idle'; c.at = 0; c.st = 1.5 + Math.random() * 2; }
      continue;
    }
    move(c, 0, 0, dt, 0);
    if (d < 22 && c.at > 0.6) { const w = dirTo(-dx, -dy); if (w !== c.d8) { c.d8 = w; c.at = 0; } }   // turns to watch the knight
    if (c.at > c.st) {   // stands, tail swishing, with a stroll now and then
      c.at = 0;
      const r = Math.random();
      if (r < 0.4) { c.state = 'graze'; c.gp = 'down'; c.gl = 4 + Math.random() * 5; }
      else if (r < 0.75) { const a = Math.random() * Math.PI * 2, rr = 6 + Math.random() * 22; c.state = 'walk'; c.tx = c.home[0] + Math.cos(a) * rr; c.ty = c.home[1] + Math.sin(a) * rr * 0.5; }
      else c.st = 3 + Math.random() * 4;
    }
  }
}
