// The New Tripo Ashen Vow V2 with genuine 40-bone skinned 3D mesh, printed as the game's own glyphs.
// Every frame the glTF knight is rendered (same Three.WebGLRenderer, the game's camera
// pitch) into a small offscreen target laid over the source knight's 104 x 54 cell grid,
// read back, and converted cell by cell with the SAME recipe that made the original
// knight frames (tools/to_ascii.py): local-contrast boost, per-frame tone stretch,
// " .:-=+*#%@" ramp, Bayer dither + fixed grain, dark plate under every cell. The cells
// then go through the source painter (grect/gput, the knight's atlas blocks and firelight),
// so the 3D knight is layered, lit and occluded exactly like the ASCII one.
import * as THREE from 'three';
import {createGltfKnight} from './ashen-tripo-native-rig.mjs';
import {headingForSourceD8} from './source-motion.mjs';
import {emitCachedTripoGlyphs,chooseNativeRasterHz} from './ashen-glyph-emitter.mjs';

const COLS = 104, ROWS = 54, FX = 52, FY = 51.6, ART = 44.4;   // the source knight grid (KG)
const SPRITE_ELEV = .35;                            // camera elevation of the sprite view, rad
const MODEL_TOP = 2.04; // normalized runtime character model height, metres
// Tripo V2 is an authentic skeletal GLB normalized to 2.04 metres by its own loader.
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

// Luminance in R, cloak in G (vertices driven by the Cloak_* bones), coverage in A.
function cloakAttribute(mesh) {
  const g=mesh.geometry,n=g.attributes.position.count;
  const cover=new Float32Array(n),accent=new Float32Array(n);
  const pos=g.attributes.position;
  const isSword=Boolean(mesh.name.match(/blade|edge|quillon|guard|pommel|grip|ferrule|fuller|sword|collar|spire/i));
  const si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
  const clothBones=mesh.isSkinnedMesh ?
    mesh.skeleton.bones.map((b,i)=>i>=36&&i<=39) : [];
  for(let v=0;v<n;v++){
    if(isSword){accent[v]=.24;cover[v]=0;continue;}
    // The Tripo mesh is longitudinal along +X, with the mask in the
    // face-facing +X half. Positions are in source 1-metre skin units.
    const x=pos.getX(v),y=pos.getY(v),z=pos.getZ(v),w=Math.abs(z);
    const face=y>.795&&y<.966&&x>.052&&w<.132;
    const eyes=face&&y>.857&&y<.902&&w>.033&&w<.090;
    const apron=y>.29&&y<.66&&x>.085&&w<.15;
    // Restrict red cloak to LOWER OUTER fabric: the old wide region made
    // a flat red rectangle covering the entire chest in native ASCII.
    const cape=(x<-.080&&y>.13&&y<.60&&w>.13&&w<.37);
    let weight=0;
    if(si&&sw){
      for(let k=0;k<4;k++)if(clothBones[si.getComponent(v,k)])
        weight+=sw.getComponent(v,k);
    }
    cover[v]=cape?Math.max(.69,weight):
      y<.48&&w>.11?weight*.77:weight*.11;
    // This material separation changes REAL rasterized 3D luminance,
    // not a pasted 2D sticker. Pale bone mask, dark eye slits, ashen
    // apron, black engraved armour and dark trailing cloth.
    accent[v]=eyes?-.40:face?.42:apron?.16:cape?-.17:
      y>.60&&y<.83?-.035:0;
  }
  g.setAttribute('cloak',new THREE.BufferAttribute(cover,1));
  g.setAttribute('ashenAccent',new THREE.BufferAttribute(accent,1));
}
function glyphMaterial(material) {
  const m=material.clone();
  m.onBeforeCompile=shader=>{
    shader.vertexShader=
      'attribute float cloak; attribute float ashenAccent;\n'+
      'varying float vCloak; varying float vAshenAccent;\n'+
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvCloak = cloak; vAshenAccent = ashenAccent;'
      );
    shader.fragmentShader=
      'varying float vCloak; varying float vAshenAccent;\n'+
      shader.fragmentShader.replace('#include <dithering_fragment>',
        '#include <dithering_fragment>\n' +
        'float ashenLuma=dot(gl_FragColor.rgb,vec3(.299,.587,.114));\n' +
        'gl_FragColor=vec4(clamp(ashenLuma+vAshenAccent*.42,0.,1.),vCloak,0.,1.);');
  };
  m.customProgramCacheKey=()=> 'ashen-v2-glyph-luma-mask-cloak-v2';
  return m;
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
    this.stats = {frames: 0, loaded: false, error: null, clip: null, motion: 'idle',
      cells: 0, glyphs: 0, cloakCells: 0, readMs: 0, convertMs: 0,
      glyphBuilds:0, glyphCacheHits:0};
    this.knight = createGltfKnight(THREE, {
      arc: false,
      onLoad: rig => {
        this.stats.loaded = true;
        this.stats.geometry='REAL Tripo H3.1 V2, 40 original skinned bones';
        this.stats.animationSource='Live Three.js bone poses (not GLB clips)';
        this.stats.bones=rig.userData.gltf.bones;
        this.stats.skinnedMeshes=rig.userData.gltf.skinnedMeshes;
        this.stats.proceduralStates = ['Idle','Walk','Run','Jump'];
        this.stats.weapon=rig.userData.gltf.weapon;
        this.stats.weaponSocketBone=rig.userData.gltf.weaponSocketBone;
        this.stats.clips = []; // no authored glTF clips; direct bone animation uses the real skin
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
    this.wasJumping = false;
    // Persistent travelled path length in the source GLB's bone units.
    // Independent from the knight's camera-centred ASCII sprite position.
    this.travelSource = 0;
    // Accumulated original-map X/Z travel in Tripo source-bone units.
    // This is not the stationary offscreen sprite root's position.
    this.groundX = 0; this.groundZ = 0;
    this.rasterClock = null;
    // Visible glyph geometry is stable until the next 3D raster sample.
    // Fire lighting and ground-map occlusion are STILL painted each tick.
    this.glyphDirty = true;
    // Mobile gets lower GPU readback frequency; 60+ distinct animation
    // poses are still evaluated from the simulation's live time.
    const slowDevice=window.matchMedia?.('(pointer:coarse)')?.matches;
    this.touchDevice=Boolean(slowDevice);
    this.rasterInterval=1/(slowDevice?12:20);
    this.stats.rasterHz=slowDevice?12:20;
    this.stats.rasterTargetHz=this.stats.rasterHz;
    this.rasterCostAvg=null;
    this.stats.rasterFrames=0;
  }
  get ready() { return !this.disposed && this.stats.loaded; }

  // Source jump phase (knight.js JUMP_T/AIR0/AIR1) -> Jump clip time: load, flight f9..f23, land.
  static jumpClipTime(e, JUMP_T, AIR0, AIR1) {
    if (!(e.jump > 0)) return undefined;
    const tt = (1 - e.jump) * JUMP_T;
    if (tt < AIR0) return tt / AIR0 * 9 / 24;
    if (tt < AIR1) return (9 + (tt - AIR0) / (AIR1 - AIR0) * 14) / 24;
    return (23 + Math.min(1, (tt - AIR1) / Math.max(1e-3, JUMP_T - AIR1)) * 12.9) / 24;
  }

  // Pose the knight from the source player and print him into the glyph batch.
  draw(e, G, fcw, fch, src) {
    const now = Number(src.t) || 0;
    const dt = this.clock === null ? 1 / 60 : Math.max(1 / 240, Math.min(.05, now - this.clock));
    this.clock = now;
    // ground speed in source pixels per second, for the clip cadence
    const fx = e.x * src.CW, fy = (e.y + .7) * src.CH;
    const dx=this.prev?fx-this.prev[0]:0;
    const dy=this.prev?fy-this.prev[1]:0;
    const travelPixels=Math.hypot(dx,dy);
    this.prev = [fx, fy];
    const jumping=(e.jump||0)>0;
    const firstLandingFrame=this.wasJumping&&!jumping;
    this.wasJumping=jumping;
    const walking = !jumping && (e.walk || 0) > .5;
    const pxPerMetre=src.KG.art*fch/1.9;
    this.knight.userData.pxPerMeter=pxPerMetre;
    // Source displacement drives BOTH animation speed and planted feet.
    // Ignore teleports, airborne movement and held input at a solid wall;
    // never feed a bogus sprint to the real skinned legs for those events.
    const sourceUnitsPerMetre=this.knight.userData.sourceUnitsPerMetre;
    const movedMetres=travelPixels/Math.max(1,pxPerMetre);
    const validStep=walking&&!firstLandingFrame&&
      Number.isFinite(sourceUnitsPerMetre)&&
      dt>0&&movedMetres/dt<12&&movedMetres<.20;
    const speed=validStep&&travelPixels>.001?
      Math.min(36,travelPixels/dt/10):0;
    if(validStep){
      const factor=sourceUnitsPerMetre/Math.max(1,pxPerMetre);
      this.travelSource+=movedMetres*sourceUnitsPerMetre;
      // In the original screen projection, right/down is negative world X/Z.
      // Integrate from actual actor coordinates, never camera pan or input intent.
      this.groundX-=dx*factor;
      this.groundZ-=dy*factor;
    }
    this.stats.sourceTravel=this.travelSource;
    this.stats.groundXZ=[this.groundX,this.groundZ];
    this.stats.motion = this.knight.userData.animate(dt, {
      speed, run: (e.run || 0) > .5, heading: headingForSourceD8(e.d8 || 0),
      travelSource:this.travelSource,
      groundX:this.groundX,groundZ:this.groundZ,
      // Gameplay keeps authentic sole-ground support but skips the SECOND
      // CPU-skinned mesh diagnostic scan; studio previews keep full QA.
      inspectSoles:false,
      jumpClipTime: NativeKnightGlyphs.jumpClipTime(e, src.JUMP_T, src.AIR0, src.AIR1)
    }, now);
    this.stats.clip = this.knight.userData.gltf.clip;
    this.stats.pose = this.knight.userData.pose?.()||null;
    // Do not force an expensive GPU->CPU readback every simulation step.
    // On intermediate frames the previous live 3D pose's glyphs remain
    // world-anchored and depth-sorted, while the rig continues animating.
    if(this.rasterClock===null||now-this.rasterClock>=this.rasterInterval){
      this.render(G, fcw, fch);
      this.convert();
      this.glyphDirty=true;
      // Let fast GPUs display up to 30 (desktop) / 20 (touch) DISTINCT
      // mesh-based glyph images; under load fall back to safe 20/12 Hz.
      // No assertion that a 399k-triangle model can visibly run 60fps.
      const cost=this.stats.readMs+this.stats.convertMs;
      if(Number.isFinite(cost)&&cost>=0)
        this.rasterCostAvg=this.rasterCostAvg===null?
          cost:this.rasterCostAvg*.85+cost*.15;
      const targetHz=chooseNativeRasterHz({
        gpuReadMs:this.rasterCostAvg??25,
        glyphConvertMs:0,touch:this.touchDevice
      });
      this.rasterInterval=1/targetHz;
      this.stats.rasterTargetHz=targetHz;
      this.rasterClock=now;
      this.stats.rasterFrames++;
    }
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
    this.knight.scale.setScalar(pxPerM); // V2 loader normalizes raw Tripo skin to 2.04 metres; keep full-body sprite height
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
    try {
      r.setRenderTarget(this.target);
      r.setClearColor(0x000000, 0);
      r.autoClear = true;
      r.render(this.scene, cam);
      r.readRenderTargetPixels(this.target, 0, 0, PW, PH, this.pixels);
    } finally {
      r.setRenderTarget(prevTarget);
      r.setClearColor(color, alpha);
      r.autoClear = auto;
    }
    this.stats.readMs = performance.now() - t0;
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
    return emitCachedTripoGlyphs.call(this,e,G,fcw,fch,src,
      {COLS,ROWS,BAYER,GRAIN});
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.knight);
    this.knight.userData.dispose?.();
    this.target.dispose();
    this.scene.clear();
  }
}
