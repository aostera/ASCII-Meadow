// One frame: castle, windows, then rows from back to front with flora, fires and people sorted in, grass
// with occlusion, dew, butterflies, gusts, fog, lights, ash, vignette, the prompt; then the batch flush.

// ---------- render ----------
// Static masonry uses a per-cell world-depth buffer. Sprites are sorted by
// their grounded feet, but the cathedral/ruins are baked before the sprite
// batch, so stone that is IN FRONT must be restored over a background tree,
// tent or fence. Testing against the object's foot (not its tall crown) keeps
// foreground foliage correctly in front of background buildings.
function coverFloraWithArchitecture(f) {
  const v = f.v, sp = GB.spr[v.whole], C = cathedral;
  if (!sp) return;
  const bx = Math.round(f.x) * CW, by = f.br * CH;
  const x0 = Math.max(VX0, Math.floor((bx + sp[6] - 1) / CW));
  const x1 = Math.min(VX1, Math.ceil((bx + sp[6] + sp[4] + 1) / CW));
  const y0 = Math.max(VY0, Math.floor((by + sp[7] - 1) / CH));
  const y1 = Math.min(VY1, Math.ceil((by + sp[7] + sp[5] + 1) / CH));
  if (x1 < x0 || y1 < y0) return;
  const castleNear = C.cv && x1 >= C.cx0 && x0 < C.cx0 + C.BW &&
    y1 >= C.cy0 && y0 < C.cy0 + C.BH;
  const nearRuins = ruins.filter(r => x1 >= r.x0 && x0 <= r.x1 &&
    y1 >= r.y0 && y0 <= r.y1);
  if (!castleNear && !nearRuins.length) return;
  const feet = by + 1.5;
  const up = Math.round(flash * 3);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let best = feet, gl = -1, lv = 0;
    if (castleNear && x >= C.cx0 && x < C.cx0 + C.BW &&
      y >= C.cy0 && y < C.cy0 + C.BH) {
      const i = (y - C.cy0) * C.BW + x - C.cx0;
      if (C.lum[i] >= 0 && C.dep[i] > best) {
        best = C.dep[i]; gl = C.glyph[i]; lv = Math.min(BL0 + BLN - 1, C.lev[i] + up);
      }
    }
    for (const r of nearRuins) {
      if (x < r.x0 || x > r.x1 || y < r.y0 || y > r.y1) continue;
      const i = (y - r.y0) * r.gridW + x - r.x0;
      if (r.lum[i] >= 0 && r.dep[i] > best) {
        best = r.dep[i]; gl = r.glyph[i]; lv = Math.min(BL0 + BLN - 1, r.lev[i] + up);
      }
    }
    if (best <= feet) continue;
    gput(SOLID_CELL, x * CW, y * CH, 1);
    if (gl >= 0) blit(gl, lv, x * CW, y * CH);
  }
}

let cloudBuf, cloudTick = 0;

function render() {
  // Diagnostic sections are measured only by the explicit perf benchmark;
  // no clocks are read and no data is collected during normal gameplay.
  const diag = window.__profileRender;
  let mark = diag ? window.__realNow() : 0;
  ctx.clearRect(0, 0, W, H);
  GB.n = 0; castleDraw = null;
  ctx.save();
  if (VZ !== 1) ctx.scale(VZ, VZ);   // the editor's zoom
  ctx.translate(-camX * CW, -camY * CH);
  if (!cloudBuf || cloudBuf.length !== N) { cloudBuf = new Float32Array(N); cloudTick = 0; }
  else cloudTick = (cloudTick + 1) % 3;

  drawCathedral();
  drawRuins();
  const C = cathedral;
  drawWindows();
  if (diag) { diag.setup += window.__realNow() - mark; mark = window.__realNow(); }
  const order = visibleToads(visibleFlora([...ents, ...braziers])).sort((a, b) => a.y - b.y);
  let oi = 0;
  let cloudRow = 0;
  const boxes = [];  // people already drawn: grass in front of them gets a dark backing so it hides their legs
  const cX0 = C.cv ? C.cx0 : 1e9, cY0 = C.cv ? C.cy0 : 1e9, cX1 = C.cv ? C.cx0 + C.BW : -1, cY1 = C.cv ? C.cy0 + C.BH : -1;
  const covered = (cx, cy, baseY) => {
    if (ruinCellCovered(cx, cy, baseY)) return true;
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
  // the per-cell arrays as locals: a script-level binding costs a context load and a hole check on every read
  const KD = kind, SD = seed, HT = height, FL = flat, AN = ang, SG = segs, SHD = shadow, BS = bshade, FRT = FR, CB = cloudBuf, CG = campGround;
  for (let y = VY0; y <= VY1 + 4 && y < ROWS; y++) {
    while (oi < order.length && (order[oi].y + 0.7) * CH < (y + 1) * CH) {
      const e = order[oi++];
      if (e.isFlora) { drawFlora(e); coverFloraWithArchitecture(e); continue; }
      if (e.isToad) { drawToad(e); continue; }
      if (e.isFire) { drawBrazier(e); continue; }
      drawEntity(e); occlude(e); occludeRuins(e);
      const G = geomOf(e); boxes.push([G.left + G.w * 0.18, G.top + G.h * 0.05, G.left + G.w * 0.82, G.gy + 2]);
    }
    const py = y * CH, baseY = py + CH;
    // most rows touch neither the castle nor a person: those skip every occlusion test
    let slowRow = y + 1 >= cY0 && y - 5 < cY1 || ruinRowNearby(y);
    for (const bb of boxes) if (py + CH > bb[1] && py - CH * 4 < bb[3]) { slowRow = true; break; }
    const P = slowRow ? put : fastPut, PF2 = slowRow ? putFlat : fastPut;
    for (let x = VX0; x <= VX1; x++) {
      const i = y * COLS + x, kd = KD[i], s = SD[i], sx = x - terrainSeedOffset;
      if (!kd) continue;
      if (cloudTick === 0) { // cloud shadow is soft: sample it every fourth column and share it
        if ((sx & 3) === 0 || x === VX0) { const cn = vnoise(sx * 0.018 - t * 0.06, y * 0.03 + t * 0.015); cloudRow = cn > 0.54 ? (cn - 0.54) * 1.4 : 0; }
        CB[i] = cloudRow;
      }
      const cloud = CB[i], px = x * CW;
      if (kd === 7) { // the trail: pale grit and pebbles, dimmed by shade and cloud
        const v = (HT[i] - cloud * 0.5 - BS[i]) * (1 - SHD[i]);
        if (v < 0.12) continue;
        const ci = s > 0.94 ? CI['o'] : s > 0.85 ? CI[':'] : s > 0.6 ? CI['.'] : s > 0.4 ? CI[','] : s > 0.2 ? CI['_'] : CI["'"];
        PF2(ci, PT0 + Math.min(PTN - 1, (v * PTN) | 0), px, py, x, y, baseY);
        continue;
      }
      if (kd === 8) {   // water: dark and still; ripples drift across it and catch what light there is
        const w = Math.sin(sx * 0.55 + y * 0.9 - t * 1.3 + s * 6) + Math.sin(sx * 0.21 - y * 0.37 + t * 0.8) * 0.6;
        const lit = (1 - SHD[i]) * (1 - cloud * 0.6) * (1 - BS[i]);
        if (SG[i]) {   // a lily pad lying on the water, lifted a little as each ripple passes under it, drifting on its stem
          const lift = w > 0.4 ? (w - 0.4) * 0.9 : 0, sway = Math.sin(t * 0.7 + s * 9) * 0.6;
          const lp = LILIES[SG[i] === 3 ? 3 + ((s * 97) | 0) % 2 : ((s * 89) | 0) % 3];
          if (!(slowRow && covered(x, y, baseY))) gput(lp.whole, px + CW * 0.5 + sway, py + CH * 0.6 - lift, lit < 0.35 ? 0.35 : lit * 0.85);
          continue;
        }
        // the surface: faint level strokes everywhere, so water reads as a sheet; brighter crests ride over them;
        // a lightning flash shows on the whole sheet at once
        const gl = lit * (1 + flash * 0.8), dx = px + Math.sin(t * 0.9 + y) * 1.5;
        if (w > 0.4) PF2(w > 1.05 ? CI['~'] : CI['-'], Math.max(6, Math.min(SH - 1, ((11 + (w - 0.4) * 5) * gl) | 0)), dx, py, x, y, baseY);
        else if (s > 0.45) PF2(s > 0.8 ? CI['~'] : CI['-'], Math.max(6, Math.min(SH - 1, ((8.5 + w) * gl) | 0)), dx, py, x, y, baseY);
        else if (s > 0.3) PF2(CI['.'], Math.max(6, (8 * gl) | 0), px, py, x, y, baseY);
        continue;
      }
      if (kd === 2) { if (s > 0.55) PF2(s > 0.8 ? CI[','] : CI['.'], s > 0.75 ? C_DIRT : C_DIRT2, px, py, x, y, baseY); continue; }
      if (kd === 5) {   // stony ground: one stone to a 4×3 block of cells, set at random in it, grit between
        const bx = sx >> 2, by = (y / 3) | 0, h = hash(bx, by * 7 + 1);
        if (h > 0.12 && sx === bx * 4 + ((h * 4) | 0) && y === by * 3 + ((hash(bx * 3 + 5, by) * 3) | 0)) {
          if (slowRow && covered(x, y, baseY)) continue;
          const z = hash(by * 5 + 3, bx), st = STONES[(h * 97 | 0) % 3 * 3 + (z < 0.4 ? 0 : z < 0.8 ? 1 : 2)];
          const lit = (1 - SHD[i]) * (1 - cloud * 0.55) * (1 - BS[i] * 0.8);
          gput(st.whole, px + CW * (0.2 + s * 0.6), py + CH * 0.85, lit < 0.3 ? 0.3 : lit);
        } else if (s > 0.62) PF2(s > 0.9 ? CI['o'] : s > 0.78 ? CI[','] : CI['.'], s > 0.95 ? C_STONE2 : s > 0.85 ? C_STONE : C_DIRT, px, py, x, y, baseY);
        continue;
      }
      if (kd >= 3) {
        // The physical tent body occludes roots below its opaque canvas,
        // while grass along the near edge and beside the guy ropes survives.
        // tmask is a real footprint, not a broad rectangular sprite bbox.
        if (tmask[i] && CG && CG[i] > .74) continue;
        // Flowers share the tents' and fences' physical ground contact;
        // none should float out through an opaque canvas or stone footing.
        const contact = CG ? CG[i] : 0;
        if (contact > .82 || (contact > .38 && s < contact * .65)) continue;
        P(FL[i] > 0.5 ? CI['.'] : (kd === 3 ? CI['*'] : kd === 4 ? CI['o'] : CI['"']),
          kd === 3 ? C_WHITE : kd === 4 ? C_YEL : C_LAV, px + AN[i] * 1.5, py, x, y, baseY);
        continue;
      }
      // a blade: stem at its cell, then up to three more glyphs climbing and bending further with the wind
      // The grass by a fence is shortened, not erased into a sterile strip.
      // Its posts conceal only their own cells; blades remain at the outer edge.
      const grounding = CG ? CG[i] : 0;
      // Never show grass coming through the centre of a solid tent. The
      // footprint has physical collision but does NOT clear the saved terrain:
      // a tent moved in the editor restores the meadow exactly.
      if (tmask[i] && grounding > .74) continue;
      // The previous .78 flatten and .82 segment loss erased the foreground
      // entirely. Rooted grass stays visible at the front hem and fence base.
      const h = HT[i] * (1 - grounding * .2),
        f = Math.max(FL[i], grounding * .22), a = AN[i], front = FRT[i];
      // its light: height, lean, a passing wind front; flattening, cloud and shade take from it, and a body's
      // shadow takes a share, so it shows even on grass lit to the full. Shades below 4 vanish into the ground
      let l = 0.24 + h * 0.52 + Math.max(0, a) * 0.16 +
        (front > 0.55 ? (front - 0.55) * 0.55 : 0) - f * 0.38 -
        cloud * 0.75 - BS[i] * (1 - grounding * .32) + (s - 0.5) * 0.16;
      // Static 3D cast shadow should darken the blades, not delete all their
      // glyphs. Reserve a dim charcoal silhouette at a genuine contact rim.
      if (grounding > .12) l = Math.max(l, .35 + grounding * .09);
      l = (l > .999 ? .999 : l) * (1 - SHD[i]);
      const lt = l < 0 ? 0 : (l * SH) | 0;
      if (lt > 6) P(stemGlyph(a * 0.65, s, h, f), lt - 3, px + a * 0.8, py, x, y, baseY);
      if (f > 0.4 || h < 0.3) continue;
      const n = grounding > .28 ? Math.max(1, Math.round(SG[i] * (1 - grounding * .23))) : SG[i];
      for (let k = 1; k <= n && y - k >= 0; k++) {
        const bend = a * (0.6 + k * 0.45);
        const r = (s * 7.31 + k * 0.618) % 1;
        const ci = k === n ? tipGlyph(bend * 1.3, r) : stemGlyph(bend * 0.8, r, 1, 0);
        const lv = Math.min(SH - 1, lt - 3 + k);
        if (lv >= 4) P(ci, lv, px + a * CW * 0.45 * k, py - CH * 0.82 * k, x, y - k, baseY);
      }
    }
  }
  while (oi < order.length) { const e = order[oi++]; if (e.isFlora) { drawFlora(e); coverFloraWithArchitecture(e); } else if (e.isToad) drawToad(e); else if (e.isFire) drawBrazier(e); else { drawEntity(e); occlude(e); occludeRuins(e); } }

  if (diag) { diag.terrain += window.__realNow() - mark; mark = window.__realNow(); }
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

  drawBirds();         // world/birds.js
  drawToadRipples();   // world/toads.js: rings where a toad went in or came out

  // gust ring
  for (const g of rings) {
    ctx.strokeStyle = `rgba(250,250,250,${0.07 * g.life})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(g.x * CW, g.y * CH, Math.max(0.1, g.r * CW), Math.max(0.1, g.r * CW), 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (diag) { diag.sprites += window.__realNow() - mark; mark = window.__realNow(); }
  updateFog();
  castleFogGlyphs();
  drawFog();
  ctx.restore();
  drawFogField();
  drawLights();
  if (diag) { diag.fog += window.__realNow() - mark; mark = window.__realNow(); }

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
  if (editing) drawEditor();   // editor/editor.js: brush, markers, selection, over the fog and vignette
  if (diag) { diag.overlay += window.__realNow() - mark; mark = window.__realNow(); }
  if (GL.ok) GL.flush(camX * CW, camY * CH, castleDraw); else flush2D(camX * CW, camY * CH, castleDraw);
  if (diag) diag.flush += window.__realNow() - mark;
}
