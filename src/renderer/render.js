// One frame: castle, windows, then rows from back to front with flora, fires and people sorted in, grass
// with occlusion, dew, butterflies, gusts, fog, lights, ash, vignette, the prompt; then the batch flush.

// ---------- render ----------
let cloudBuf, cloudTick = 0;

function render() {
  ctx.clearRect(0, 0, W, H);
  GB.n = 0; castleDraw = null;
  ctx.save();
  ctx.translate(-camX * CW, -camY * CH);
  if (!cloudBuf || cloudBuf.length !== N) { cloudBuf = new Float32Array(N); cloudTick = 0; }
  else cloudTick = (cloudTick + 1) % 3;

  drawCathedral();
  const C = cathedral;
  drawWindows();
  const order = visibleFlora([...ents, ...braziers]).sort((a, b) => a.y - b.y);
  let oi = 0;
  let cloudRow = 0;
  const boxes = [];  // people already drawn: grass in front of them gets a dark backing so it hides their legs
  const cX0 = C.cv ? C.cx0 : 1e9, cY0 = C.cv ? C.cy0 : 1e9, cX1 = C.cv ? C.cx0 + C.BW : -1, cY1 = C.cv ? C.cy0 + C.BH : -1;
  const covered = (cx, cy, baseY) => {
    if (cx < cX0 || cy < cY0 || cx >= cX1 || cy >= cY1) return false;
    const kx = cx - C.cx0, ky = cy - C.cy0;
    const k = ky * C.BW + kx; return C.lum[k] >= 0 && C.dep[k] > baseY;
  };
  const hidesPerson = (px, py) => { for (const b of boxes) if (px > b[0] && px < b[2] && py > b[1] && py < b[3]) return true; return false; };
  const putFlat = (ci, lv, px, py, cx, cy, baseY) => {   // ground lies under people, never over them
    if (covered(cx, cy, baseY) || (boxes.length && hidesPerson(px + CW * 0.5, py + CH * 0.5))) return;
    blit(ci, lv, px, py);
  };
  const fastPut = (ci, lv, px, py) => gput(ci * NB + lv, px, py, 1);
  const put = (ci, lv, px, py, cx, cy, baseY) => {
    if (covered(cx, cy, baseY)) return;
    if (boxes.length && hidesPerson(px + CW * 0.5, py + CH * 0.5)) gput(SOLID_FRONT, px, py, 0.62);
    blit(ci, lv, px, py);
  };
  for (let y = VY0; y <= VY1 + 4 && y < ROWS; y++) {
    while (oi < order.length && (order[oi].y + 0.7) * CH < (y + 1) * CH) {
      const e = order[oi++];
      if (e.isFlora) { drawFlora(e); continue; }
      if (e.isFire) { drawBrazier(e); continue; }
      drawEntity(e); occlude(e);
      const G = geomOf(e); boxes.push([G.left + G.w * 0.18, G.top + G.h * 0.05, G.left + G.w * 0.82, G.gy + 2]);
    }
    const py = y * CH, baseY = py + CH;
    // most rows touch neither the castle nor a person: those skip every occlusion test
    let slowRow = y + 1 >= cY0 && y - 5 < cY1;
    for (const bb of boxes) if (py + CH > bb[1] && py - CH * 4 < bb[3]) { slowRow = true; break; }
    const P = slowRow ? put : fastPut, PF2 = slowRow ? putFlat : fastPut;
    for (let x = VX0; x <= VX1; x++) {
      const i = y * COLS + x, kd = kind[i], s = seed[i];
      if (!kd) continue;
      if (cloudTick === 0) { // cloud shadow is soft: sample it every fourth column and share it
        if ((x & 3) === 0 || x === VX0) { const cn = vnoise(x * 0.018 - t * 0.06, y * 0.03 + t * 0.015); cloudRow = cn > 0.54 ? (cn - 0.54) * 1.4 : 0; }
        cloudBuf[i] = cloudRow;
      }
      const cloud = cloudBuf[i], px = x * CW;
      if (kd === 7) { // the trail: pale grit and pebbles, dimmed by shade and cloud
        const v = (height[i] - cloud * 0.5 - bshade[i]) * (1 - shadow[i]);
        if (v < 0.12) continue;
        const ci = s > 0.94 ? CI['o'] : s > 0.85 ? CI[':'] : s > 0.6 ? CI['.'] : s > 0.4 ? CI[','] : s > 0.2 ? CI['_'] : CI["'"];
        PF2(ci, PT0 + Math.min(PTN - 1, (v * PTN) | 0), px, py, x, y, baseY);
        continue;
      }
      if (kd === 2) { if (s > 0.55) PF2(s > 0.8 ? CI[','] : CI['.'], s > 0.75 ? C_DIRT : C_DIRT2, px, py, x, y, baseY); continue; }
      if (kd === 5) { PF2(s > 0.6 ? CI['@'] : s > 0.3 ? CI['o'] : CI['°'], s > 0.5 ? C_STONE : C_STONE2, px, py, x, y, baseY); continue; }
      if (kd >= 3) { P(flat[i] > 0.5 ? CI['.'] : (kd === 3 ? CI['*'] : kd === 4 ? CI['o'] : CI['"']), kd === 3 ? C_WHITE : kd === 4 ? C_YEL : C_LAV, px + ang[i] * 1.5, py, x, y, baseY); continue; }
      // a blade: stem at its cell, then up to three more glyphs climbing and bending further with the wind
      const h = height[i], f = flat[i], a = ang[i], lt = light(i, x, y, cloud);
      if (lt > 6) P(stemGlyph(a * 0.65, s, h, f), lt - 3, px + a * 0.8, py, x, y, baseY);  // shades below 4 vanish into the ground: skip them
      if (f > 0.4 || h < 0.3) continue;
      const n = segs[i];
      for (let k = 1; k <= n && y - k >= 0; k++) {
        const bend = a * (0.6 + k * 0.45);
        const r = (s * 7.31 + k * 0.618) % 1;
        const ci = k === n ? tipGlyph(bend * 1.3, r) : stemGlyph(bend * 0.8, r, 1, 0);
        const lv = Math.min(SH - 1, lt - 3 + k);
        if (lv >= 4) P(ci, lv, px + a * CW * 0.45 * k, py - CH * 0.82 * k, x, y - k, baseY);
      }
    }
  }
  while (oi < order.length) { const e = order[oi++]; if (e.isFlora) drawFlora(e); else if (e.isFire) drawBrazier(e); else { drawEntity(e); occlude(e); } }

  for (const d of dew) {
    const i = d.i, x = i % COLS, y = (i / COLS) | 0;
    if (kind[i] !== 1) continue;
    blit(CI['+'], C_DEW, x * CW + ang[i] * CW * 0.45 * segs[i], y * CH - CH * 0.82 * segs[i] - CH * 0.3, d.life);
  }

  // butterflies
  for (const f of flies) {
    const open = Math.sin(f.ph) > 0;
    blit(open ? CI['^'] : CI[';'], f.c, f.x * CW, f.y * CH);
  }

  // gust ring
  for (const g of rings) {
    ctx.strokeStyle = `rgba(250,250,250,${0.07 * g.life})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(g.x * CW, g.y * CH, Math.max(0.1, g.r * CW), Math.max(0.1, g.r * CW), 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  updateFog();
  castleFogGlyphs();
  drawFog();
  ctx.restore();
  drawFogField();
  drawLights();

  // ash
  for (const m of motes) {
    const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(m.ph * 3));
    ctx.fillStyle = `rgba(210,210,210,${a * m.z * 0.5})`;
    const s = 1 + m.z;
    ctx.fillRect(m.x, m.y, s, s);
  }

  // atmosphere: a heavy vignette and the odd lightning flash
  if (!render.vg || render.vgW !== W || render.vgH !== H) {
    render.vg = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.28, W / 2, H * 0.55, Math.max(W, H) * 0.78);
    render.vg.addColorStop(0, 'rgba(0,0,0,.12)'); render.vg.addColorStop(1, 'rgba(0,0,0,.85)'); render.vgW = W; render.vgH = H;
  }
  ctx.fillStyle = render.vg; ctx.fillRect(0, 0, W, H);
  if (flash > 0.02) { ctx.fillStyle = `rgba(250,250,250,${flash * 0.05})`; ctx.fillRect(0, 0, W, H); }
  drawPrompt();
  if (GL.ok) GL.flush(camX * CW, camY * CH, castleDraw); else flush2D(camX * CW, camY * CH, castleDraw);
}
