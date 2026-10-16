// Exact original native 3D-to-ASCII glyph emitter, isolated from Three.js.
// The actual game imports this function; Node CI tests this SAME function.
// Rendering coordinates, source firelight and tone stretch stay unchanged.
export function emitCachedTripoGlyphs(e, G, fcw, fch, src, {COLS, ROWS, BAYER, GRAIN}) {
    const {S, A, K} = this;
    if(this.glyphDirty!==false){
    const vals = [];
    for (let c = 0; c < COLS * ROWS; c++) if (A[c] >= .3) vals.push(S[c]);
    K.n = 0;
    this.stats.cells = vals.length;
    if (vals.length < 10) {
      this.stats.glyphs = 0;
      this.glyphDirty=false;
      this.stats.glyphBuilds=(this.stats.glyphBuilds||0)+1;
      return;
    }
    vals.sort((a, b) => a - b);
    const pct = q => vals[Math.min(vals.length - 1, Math.max(0, Math.round(q / 100 * (vals.length - 1))))];
    let lo = pct(3), hi = pct(98);
    // the tone stretch follows the pose, but not frame by frame (no flicker)
    if (this.tone) { lo = this.tone[0] + (lo - this.tone[0]) * .25; hi = this.tone[1] + (hi - this.tone[1]) * .25; }
    this.tone = [lo, hi];
    const span = Math.max(1e-3, hi - lo);
    let glyphs = 0, cloak = 0;
    for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) {
      const c = cy * COLS + cx;
      if (A[c] < .3) continue;
      const V = Math.pow(Math.min(1, Math.max(0, (S[c] - lo) / span)), .9);
      let v = (.37 + .63 * V) * Math.min(1, A[c] * 1.25) + BAYER[(cy & 3) * 4 + (cx & 3)] * .14 + GRAIN[c];
      const j = K.n++;
      K.cx[j] = cx; K.cy[j] = cy;
      K.cl[j] = this.cloakFrac[c] > .5 ? 1 : 0;
      cloak += K.cl[j];
      if (v < .14) { K.code[j] = -1; continue; }
      v = Math.min(.999, v);
      K.code[j] = src.rampCode(Math.min(9, 1 + Math.floor(v * 9)));
      glyphs++;
    }
    this.stats.glyphs = glyphs; this.stats.cloakCells = cloak;
    let y0 = ROWS, y1 = 0, x0 = COLS, x1 = 0;
    for (let j = 0; j < K.n; j++) { y0 = Math.min(y0, K.cy[j]); y1 = Math.max(y1, K.cy[j]); x0 = Math.min(x0, K.cx[j]); x1 = Math.max(x1, K.cx[j]); }
    this.stats.bounds = [x0, y0, x1, y1];
    this.glyphDirty=false;
    this.stats.glyphBuilds=(this.stats.glyphBuilds||0)+1;
    }else{
      // Reuse the last real 3D->ASCII raster; no repeated sort, tone
      // stretch or shader glyph reconstruction on unchanged imagery.
      this.stats.glyphCacheHits=(this.stats.glyphCacheHits||0)+1;
    }
    const left = G.left, top = G.top;
    // dark plate first, in runs along each row (as drawKnight does), then the glyphs
    let ry = -1, rs = 0, re = 0;
    const flushRun = () => { if (ry >= 0) src.grect(left + rs * fcw - .4, top + ry * fch - .4, (re - rs) * fcw + .8, fch + .8, .94); };
    for (let j = 0; j < K.n; j++) {
      const cx = K.cx[j], cy = K.cy[j];
      if (cy === ry && cx === re) { re = cx + 1; continue; }
      flushRun(); ry = cy; rs = cx; re = cx + 1;
    }
    flushRun();
    const [fI, fdx] = src.fireLightAt(e);
    for (let j = 0; j < K.n; j++) {
      const code = K.code[j];
      if (code < 0) continue;
      src.gput(src.KN0 + src.knightFireBlock(K, j, fI, fdx) * src.KNS + code,
        left + K.cx[j] * fcw, top + K.cy[j] * fch, 1);
    }
}

// Adaptive GPU raster budget for the native game. Visual sampling is not
// the same as 60Hz skeleton pose evaluation and must stay bounded on phones.
export function chooseNativeRasterHz({gpuReadMs=20,glyphConvertMs=4,touch=false}={}){
 const total=gpuReadMs+glyphConvertMs;
 if(!Number.isFinite(total)||total<0)return touch?12:20;
 if(touch)return total<10?20:total<18?16:12;
 return total<10?30:total<19?24:20;
}
