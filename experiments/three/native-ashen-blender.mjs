// The Ashen Vow knight repaired in Blender (blender/ashen/), printed as the game's own glyphs.
// The skinned GLB plays its own baked clips (Idle / Walk / Run / Jump, 60 fps, in place); every
// frame it is rendered into a small offscreen target laid over the source knight's 104 x 54 cell
// grid, read back and converted cell by cell with the SAME recipe that made the original knight
// frames (tools/to_ascii.py). The cells go through the source painter (grect/gput, the knight's
// atlas blocks and firelight), so the 3D knight is layered, lit and occluded like the ASCII one.
import * as THREE from 'three';
import {createClipKnight} from './gltf-clip-knight.mjs';
import {headingForSourceD8} from './source-motion.mjs';
import {chooseNativeRasterHz} from './ashen-glyph-emitter.mjs';

const COLS = 104, ROWS = 54, FX = 52, FY = 51.6, ART = 44.4;   // the source knight grid (KG)
const SPRITE_ELEV = .35;
export const ASHEN_BLENDER_GLB = new URL('./assets/ashen-vow/ashen_tripo_blender_repaired_v01.glb', import.meta.url).href;
// 30k-triangle variant for touch devices (same 40 joints, clips and sword); ?ashenLod=full|mobile
export const ASHEN_BLENDER_GLB_MOBILE = new URL('./assets/ashen-vow/ashen_tripo_blender_repaired_v01_mobile.glb', import.meta.url).href;
const CLIP_SPEED = {Walk: .529, Run: 1.571};
const NO_ASYNC = new URLSearchParams(globalThis.location?.search || '').get('ashenAsync') === '0';   // A/B switch
// Share of cells per ramp level (0 = dark plate, 1..9 = ". : - = + * # % @") in the original baked
// knight frames, measured in the game over idle, walk and run (2026-10-17); cumulative.
const LEVEL_SHARE = [.004, 0, .019, .046, .111, .179, .259, .198, .107, .077];
const LEVEL_CDF = LEVEL_SHARE.reduce((acc, v, i) => (acc.push((acc[i - 1] || 0) + v), acc), [])
  .map((v, i, a) => v / a[a.length - 1]);      // model heights per second the baked clips cover
const JUMP_FRAMES = {takeoff: 22, land: 48, end: 72, fps: 60};   // anim_ashen.py JUMP                            // camera elevation of the sprite view, rad
const MODEL_TOP = 1.0;                              // top of the hood (the GLB is height-normalised)
const SS = 4;                                       // render pixels per cell side
const PW = COLS * SS, PH = ROWS * SS;               // offscreen target
const GW = COLS * 2, GH = ROWS * 2;                 // to_ascii works on 2 x 2 samples per cell
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => v / 16 - .5);
const h32 = (x, y) => {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
const GRAIN = new Float32Array(COLS * ROWS);
for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++)
  GRAIN[cy * COLS + cx] = (h32(cx * 7 + 186, cy * 13) - .5) * .05;
// Gaussian, sigma 2.5 samples (PIL GaussianBlur(2.5) in to_ascii.py)
const KER = (() => {
  const k = []; let s = 0;
  for (let i = -7; i <= 7; i++) { const v = Math.exp(-i * i / (2 * 2.5 * 2.5)); k.push(v); s += v; }
  return Float32Array.from(k, v => v / s);
})();
function blur(src, tmp, out) {
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    let s = 0;
    for (let i = -7; i <= 7; i++) s += src[y * GW + Math.min(GW - 1, Math.max(0, x + i))] * KER[i + 7];
    tmp[y * GW + x] = s;
  }
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    let s = 0;
    for (let i = -7; i <= 7; i++) s += tmp[Math.min(GH - 1, Math.max(0, y + i)) * GW + x] * KER[i + 7];
    out[y * GW + x] = s;
  }
}

// Luminance in R, cloth in G, coverage in A. Cloth is where the Blender vertex colours are the
// burgundy of the cape, hood, scarf and mantle (red clearly above green), so the source painter
// gives those cells the cloak's firelight block.
function cloakAttribute(mesh) {
  const g = mesh.geometry, n = g.attributes.position.count, w = new Float32Array(n);
  const col = g.attributes.color;
  if (col) for (let v = 0; v < n; v++) w[v] = col.getX(v) - col.getY(v) > .12 ? 1 : 0;
  g.setAttribute('cloak', new THREE.BufferAttribute(w, 1));
}
function glyphMaterial(material) {
  const m = material.clone();
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'attribute float cloak;\nvarying float vCloak;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCloak = cloak;');
    sh.fragmentShader = 'varying float vCloak;\n' + sh.fragmentShader.replace('#include <dithering_fragment>',
      '#include <dithering_fragment>\ngl_FragColor = vec4(dot(gl_FragColor.rgb, vec3(.299, .587, .114)), vCloak, 0., 1.);');
  };
  m.customProgramCacheKey = () => 'knight-glyph-pass';
  return m;
}

// ?ashenPerf=1: a small live readout for checking the knight on a real phone or tablet.
function perfOverlay() {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:50;padding:6px 8px;background:rgba(0,0,0,.72);' +
    'color:#d8d2c8;font:11px/1.35 ui-monospace,monospace;white-space:pre;pointer-events:none;border-radius:4px';
  document.body.appendChild(el);
  let last = performance.now(), frames = 0, rasters = 0, prevRasters = 0;
  return {
    el,
    tick(st) {
      frames++;
      const now = performance.now();
      if (now - last < 500) return;
      rasters = st.rasterFrames - prevRasters;
      prevRasters = st.rasterFrames;
      const sec = (now - last) / 1000;
      el.textContent = `knight ${st.model}
` +
        `game fps     ${(frames / sec).toFixed(1)}
` +
        `3D raster/s  ${(rasters / sec).toFixed(1)} (target ${st.rasterHz})
` +
        `read ${st.asyncRead ? 'async' : 'sync '}   ${((st.asyncRead ? st.readLatencyMs : st.readMs) ?? 0).toFixed(1)} ms
` +
        `issue        ${(st.readMs ?? 0).toFixed(1)} ms   glyphs ${(st.convertMs ?? 0).toFixed(1)} ms
` +
        `clip ${st.clip}   cells ${st.cells}`;
      frames = 0; last = now;
    },
    dispose() { el.remove(); },
  };
}

export class NativeKnightGlyphs {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 40000);
    // a key from the upper left, like the turntable the original frames were rendered from
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    this.scene.add(key, key.target);
    this.key = key;
    this.target = new THREE.WebGLRenderTarget(PW, PH, {depthBuffer: true});
    this.pixels = new Uint8Array(PW * PH * 4);
    this.lum = new Float32Array(GW * GH); this.al = new Float32Array(GW * GH);
    this.cl = new Float32Array(GW * GH);
    this.pm = new Float32Array(GW * GH); this.tmp = new Float32Array(GW * GH);
    this.bl = new Float32Array(GW * GH); this.bc = new Float32Array(GW * GH);
    this.S = new Float32Array(COLS * ROWS); this.A = new Float32Array(COLS * ROWS);
    this.cloakFrac = new Float32Array(COLS * ROWS);
    // one frame of cells, shaped like a source frame so knightFireBlock() reads it as is
    this.K = {n: 0, code: new Int16Array(COLS * ROWS), cx: new Int16Array(COLS * ROWS),
      cy: new Int16Array(COLS * ROWS), cl: new Uint8Array(COLS * ROWS)};
    this.tone = null;
    const touch = Boolean(globalThis.matchMedia?.('(pointer:coarse)')?.matches);
    const lodParam = new URLSearchParams(globalThis.location?.search || '').get('ashenLod');
    const lod = lodParam === 'full' || lodParam === 'mobile' ? lodParam : touch ? 'mobile' : 'full';
    this.stats = {model: 'ashen-blender-v01', lod, frames: 0, loaded: false, error: null, clip: null,
      motion: 'idle', cells: 0, glyphs: 0, cloakCells: 0, readMs: 0, convertMs: 0,
      animationSource: 'baked glTF clips (Blender)'};
    this.knight = createClipKnight(THREE, {
      url: lod === 'mobile' ? ASHEN_BLENDER_GLB_MOBILE : ASHEN_BLENDER_GLB, modelHeight: MODEL_TOP, forward: '+X', clipSpeed: CLIP_SPEED,
      onLoad: rig => {
        this.stats.loaded = true;
        this.stats.clips = Object.keys(rig.userData.gltf.actions);
      },
      onError: err => { this.stats.error = String(err?.message || err); }
    });
    this.knight.userData.prepareModel = model => model.traverse(o => {
      if (!o.isMesh) return;
      cloakAttribute(o);
      o.material = Array.isArray(o.material) ? o.material.map(glyphMaterial) : glyphMaterial(o.material);
    });
    this.scene.add(this.knight);
    this.clock = null; this.prev = null; this.disposed = false;
    // The pose is evaluated every frame; the GPU raster + read-back + glyph build runs at an
    // adaptive rate (as the V2 adapter does), the cached glyphs are re-emitted in between with
    // live firelight and occlusion.
    this.touchDevice = Boolean(globalThis.matchMedia?.('(pointer:coarse)')?.matches);
    this.asyncRead = false; this.readPending = false; this.freshPixels = false;
    if (new URLSearchParams(globalThis.location?.search || '').get('ashenPerf') === '1') this.perf = perfOverlay();
    this.rasterClock = null;
    this.rasterInterval = 1 / (this.touchDevice ? 12 : 20);
    this.rasterCostAvg = null;
    this.glyphDirty = true;
    Object.assign(this.stats, {rasterHz: 1 / this.rasterInterval, rasterFrames: 0, glyphBuilds: 0});
  }
  get ready() { return !this.disposed && this.stats.loaded; }

  // Source jump phase (knight.js JUMP_T/AIR0/AIR1) -> Jump clip time (60 fps clip):
  // load and take-off 0..22, flight 22..48, landing and recovery 48..72.
  static jumpClipTime(e, JUMP_T, AIR0, AIR1) {
    if (!(e.jump > 0)) return undefined;
    const {takeoff, land, end, fps} = JUMP_FRAMES;
    const tt = (1 - e.jump) * JUMP_T;
    if (tt < AIR0) return tt / AIR0 * takeoff / fps;
    if (tt < AIR1) return (takeoff + (tt - AIR0) / (AIR1 - AIR0) * (land - takeoff)) / fps;
    return (land + Math.min(1, (tt - AIR1) / Math.max(1e-3, JUMP_T - AIR1)) * (end - 1 - land)) / fps;
  }

  // Pose the knight from the source player and print him into the glyph batch.
  draw(e, G, fcw, fch, src) {
    const now = Number(src.t) || 0;
    const dt = this.clock === null ? 1 / 60 : Math.max(1 / 240, Math.min(.05, now - this.clock));
    this.clock = now;
    // ground speed in source pixels per second, for the clip cadence
    const fx = e.x * src.CW, fy = (e.y + .7) * src.CH;
    let speed = 0;
    if (this.prev && dt > 0) speed = Math.hypot(fx - this.prev[0], fy - this.prev[1]) / dt / 10;
    this.prev = [fx, fy];
    const walking = !(e.jump > 0) && (e.walk || 0) > .5;
    if (walking) speed = Math.max(speed, (e.run || 0) > .5 ? 15 : 8); else speed = 0;
    this.knight.userData.pxPerUnit = src.KG.art * fch / MODEL_TOP;
    this.stats.motion = this.knight.userData.animate(dt, {
      speed, run: (e.run || 0) > .5, heading: headingForSourceD8(e.d8 || 0),
      jumpClipTime: NativeKnightGlyphs.jumpClipTime(e, src.JUMP_T, src.AIR0, src.AIR1)
    }, now);
    this.stats.clip = this.knight.userData.gltf.clip;
    if (this.freshPixels) {                 // an asynchronous read-back has landed
      this.freshPixels = false;
      this.convert();
      this.glyphDirty = true;
    }
    const due = this.rasterClock === null || now - this.rasterClock >= this.rasterInterval || now < this.rasterClock;
    if (due && !this.readPending) {
      const pending = this.render(G, fcw, fch);
      if (pending) {
        this.readPending = true;
        const issued = performance.now();
        pending.then(() => {
          this.readPending = false;
          this.freshPixels = true;
          const latency = this.stats.readLatencyMs = performance.now() - issued;
          // A fence that keeps landing late means a frozen pose: a short stall is better.
          this.slowReads = latency > 250 ? (this.slowReads || 0) + 1 : 0;
          if (this.slowReads >= 3 || latency > 1000) { this.asyncRead = false; this.stats.asyncError = `slow fence (${Math.round(latency)} ms)`; }
        }, err => {
          this.readPending = false;
          this.asyncRead = false;               // fall back to synchronous reads
          this.stats.asyncError = String(err?.message || err);
        });
      } else {
        this.convert();
        this.glyphDirty = true;
        this.asyncRead = !this.stats.asyncError && !NO_ASYNC;   // async from the second raster on
      }
      this.stats.asyncRead = Boolean(pending);
      const cost = this.stats.readMs + this.stats.convertMs;
      if (Number.isFinite(cost) && cost >= 0)
        this.rasterCostAvg = this.rasterCostAvg === null ? cost : this.rasterCostAvg * .85 + cost * .15;
      const hz = chooseNativeRasterHz({gpuReadMs: this.rasterCostAvg ?? 25, glyphConvertMs: 0, touch: this.touchDevice});
      this.rasterInterval = 1 / hz;
      this.stats.rasterHz = hz;
      this.rasterClock = now;
      this.stats.rasterFrames++;
    }
    this.perf?.tick(this.stats);
    this.emit(e, G, fcw, fch, src);
    this.stats.frames++;
  }

  render(G, fcw, fch) {
    // A sprite camera, like the turntable the original frames were rendered from: low
    // elevation, the model standing at the origin, its soles on the grid's foot point and its
    // height (helmet to soles) the source knight's art height. The map's steep PITCH is for the
    // ground; the figure seen from it is foreshortened into a squat, cloak-wide blot.
    const c = Math.cos(SPRITE_ELEV), s = Math.sin(SPRITE_ELEV);
    const pxPerM = ART * fch / (MODEL_TOP * c);
    this.knight.position.set(0, 0, 0);
    this.knight.scale.setScalar(pxPerM * MODEL_TOP / 8.9);   // the clip knight is 8.9 units tall
    const dy = (FY - ROWS / 2) * fch, dx = (FX - COLS / 2) * fcw;   // foot point below/right of centre
    const cam = this.camera;
    cam.left = -COLS * fcw / 2; cam.right = COLS * fcw / 2;
    cam.top = ROWS * fch / 2; cam.bottom = -ROWS * fch / 2;
    const target = new THREE.Vector3(dx, c * dy, s * dy);   // screen right is world -x
    cam.up.set(0, c, s);
    cam.position.set(target.x, target.y + s * 1000, target.z - c * 1000);
    cam.lookAt(target);
    cam.near = 1; cam.far = 4000;
    cam.updateProjectionMatrix();
    // key light from the camera's upper left, a little in front
    const h = ART * fch;
    this.key.position.set(h * 2, h * 3, -h * 2.5);
    this.key.target.position.set(0, h * .5, 0);
    const r = this.renderer;
    const prevTarget = r.getRenderTarget(), auto = r.autoClear;
    const color = r.getClearColor(new THREE.Color()).clone(), alpha = r.getClearAlpha();
    const t0 = performance.now();
    let pending = null;
    try {
      r.setRenderTarget(this.target);
      r.setClearColor(0x000000, 0);
      r.autoClear = true;
      r.render(this.scene, cam);
      // Asynchronous read-back (WebGL2 PBO + fence) once the first raster exists: the frame does
      // not wait for the GPU; the glyphs follow one or two frames later.
      if (this.asyncRead && r.readRenderTargetPixelsAsync)
        pending = r.readRenderTargetPixelsAsync(this.target, 0, 0, PW, PH, this.pixels);
      else r.readRenderTargetPixels(this.target, 0, 0, PW, PH, this.pixels);
    } finally {
      r.setRenderTarget(prevTarget);
      r.setClearColor(color, alpha);
      r.autoClear = auto;
    }
    this.stats.readMs = performance.now() - t0;
    return pending;
  }

  // tools/to_ascii.py frame_to_ascii(), on the live render
  convert() {
    const t0 = performance.now();
    const {pixels: P, lum, al, cl, pm, tmp, bl, bc, S, A} = this;
    const k = SS / 2, kk = k * k;
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      let L = 0, a = 0, cc = 0;
      for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
        // read-back rows run bottom-up
        const o = ((PH - 1 - (y * k + j)) * PW + x * k + i) * 4, av = P[o + 3] / 255;
        L += P[o] / 255 * av; cc += P[o + 1] / 255 * av; a += av;
      }
      const q = y * GW + x;
      al[q] = a / kk; lum[q] = a > 0 ? L / a : 0; cl[q] = a > 0 ? cc / a : 0;
      pm[q] = lum[q] * al[q];
    }
    blur(pm, tmp, bl); blur(al, tmp, bc);
    for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) {
      let sa = 0, ss = 0, scl = 0;
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        const q = (cy * 2 + j) * GW + cx * 2 + i, a = al[q];
        const base = bc[q] > 8 / 255 ? bl[q] / Math.max(bc[q], 1 / 255) : lum[q];
        const sharp = lum[q] + 1.15 * (lum[q] - base);
        sa += a; ss += sharp * a; scl += cl[q] * a;
      }
      const c = cy * COLS + cx;
      A[c] = sa / 4; S[c] = sa > 0 ? ss / sa : 0; this.cloakFrac[c] = sa > 0 ? scl / sa : 0;
    }
    this.stats.convertMs = performance.now() - t0;
  }

  emit(e, G, fcw, fch, src) {
    const {K} = this;
    if (this.glyphDirty) { this.buildGlyphs(src); this.glyphDirty = false; this.stats.glyphBuilds++; }
    this.paint(e, G, fcw, fch, src);
  }

  // tone -> ramp levels for the latest raster (only when a new one exists)
  buildGlyphs(src) {
    const {S, A, K} = this;
    const vals = [];
    for (let c = 0; c < COLS * ROWS; c++) if (A[c] >= .3) vals.push(S[c]);
    K.n = 0;
    this.stats.cells = vals.length;
    if (vals.length < 10) { this.stats.glyphs = 0; return; }
    vals.sort((a, b) => a - b);
    const pct = q => vals[Math.min(vals.length - 1, Math.max(0, Math.round(q / 100 * (vals.length - 1))))];
    let lo = pct(3), hi = pct(98);
    // the tone stretch follows the pose, but not frame by frame (no flicker)
    if (this.tone) { lo = this.tone[0] + (lo - this.tone[0]) * .25; hi = this.tone[1] + (hi - this.tone[1]) * .25; }
    this.tone = [lo, hi];
    const span = Math.max(1e-3, hi - lo);
    let glyphs = 0, cloak = 0;
    // to_ascii's tone per cell, then matched to the ORIGINAL knight's glyph statistics: cells are
    // ranked by tone and given ramp levels in the same proportions as the baked ASCII frames
    // (LEVEL_CDF), so steel, legs and blade sit on the original's levels instead of a brighter
    // spread. Bayer dither and the fixed grain still break up the bands.
    const order = this.order || (this.order = new Int32Array(COLS * ROWS));
    const tone = this.toneV || (this.toneV = new Float32Array(COLS * ROWS));
    let m = 0;
    for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) {
      const c = cy * COLS + cx;
      if (A[c] < .3) continue;
      const V = Math.pow(Math.min(1, Math.max(0, (S[c] - lo) / span)), .9);
      tone[c] = (.37 + .63 * V) * Math.min(1, A[c] * 1.25);
      order[m++] = c;
    }
    const sorted = Array.from(order.subarray(0, m)).sort((a, b) => tone[a] - tone[b]);
    const rank = this.rank || (this.rank = new Float32Array(COLS * ROWS));
    sorted.forEach((c, i) => { rank[c] = (i + .5) / m; });
    for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) {
      const c = cy * COLS + cx;
      if (A[c] < .3) continue;
      const q = Math.min(.9999, Math.max(0, rank[c] + BAYER[(cy & 3) * 4 + (cx & 3)] * .07 + GRAIN[c] * .8));
      let level = 0;
      while (level < 9 && q >= LEVEL_CDF[level]) level++;
      const j = K.n++;
      K.cx[j] = cx; K.cy[j] = cy;
      K.cl[j] = this.cloakFrac[c] > .5 ? 1 : 0;
      cloak += K.cl[j];
      if (level === 0) { K.code[j] = -1; continue; }
      K.code[j] = src.rampCode(level);
      glyphs++;
    }
    this.stats.glyphs = glyphs; this.stats.cloakCells = cloak;
    // how many cells sit on each ramp level (0 = dark plate only, 1..9 = " .:-=+*#%@" minus space)
    const levels = new Array(10).fill(0);
    for (let j = 0; j < K.n; j++) levels[K.code[j] < 0 ? 0 : K.code[j] >> 3]++;
    this.stats.levels = levels;
    let y0 = ROWS, y1 = 0, x0 = COLS, x1 = 0;
    for (let j = 0; j < K.n; j++) { y0 = Math.min(y0, K.cy[j]); y1 = Math.max(y1, K.cy[j]); x0 = Math.min(x0, K.cx[j]); x1 = Math.max(x1, K.cx[j]); }
    this.stats.bounds = [x0, y0, x1, y1];
  }

  // dark plates and glyphs into the source batch, every frame (firelight is live)
  paint(e, G, fcw, fch, src) {
    const {K} = this;
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

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.perf?.dispose();
    this.scene.remove(this.knight);
    this.knight.userData.dispose?.();
    this.target.dispose();
    this.scene.clear();
  }
}
