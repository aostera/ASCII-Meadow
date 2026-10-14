// Original ASCII Meadow gameplay + switchable Three.js rasterizer.
// This page is the migration baseline: all gameplay and authored-world scripts
// are loaded directly from ../../src/*. This bridge only swaps final GL.flush.
// The separate primitive-model experiment remains app.js on index.html.
import { ThreeGlyphBackend } from './three-glyphs.js';

const originalCanvas=document.getElementById('g');
const modeOriginal=document.getElementById('parity-legacy');
const modeThree=document.getElementById('parity-three');
const architectureButton=document.getElementById('parity-architecture');
const depthButton=document.getElementById('parity-depth');
let depthStartedArchitecture=false;
let liveArchitecture=null,architectureLoading=null,architectureWanted=false;
const status=document.getElementById('parity-status');
let legacyFlush=GL.flush;
let backend=null,mode='legacy',lastError=null;
let lastStats=0;
const referenceRender=render; // original complete draw of the exact source glyph batch
let referenceBatch=null;
const safeStatus=text=>{status.textContent=text;};

function renderThree(camx,camy,castle){
  try {
    backend.flush(GB,SPF,gput,CAST,camx,camy,castle,W,H,DPR,VZ,cathedral.cv);
    // Native Gothic source meshes share this very same GPU context. The
    // full-screen original ASCII image is committed first; optional geometry
    // is restricted to a small diagnostic viewport, never replacing art.
    if(liveArchitecture?.active){
      liveArchitecture.render({W,H,VZ,CW,CH,camX:camx/CW,camY:camy/CH,DPR});
    }
    const now=performance.now();
    if(now-lastStats>1100){
      const s=backend.stats;
      safeStatus(s.glyphs.toLocaleString()+' исходных символов · '+s.drawCalls+
        ' вызовов Three.js · все игровые системы оригинальные');
      lastStats=now;
    }
  } catch(error) {
    lastError=error.message||String(error);
    console.error('Experimental Three.js backend failed, switching to original:',error);
    selectMode('legacy');
    legacyFlush(camx,camy,castle);
    safeStatus('Three.js ошибка, восстановлен оригинал: '+lastError);
  }
}

function selectMode(next){
  if(next==='three'){
    if(!GL.ok||GL.lost){
      safeStatus('На этом устройстве WebGL2 недоступен. Оставлен оригинал.');
      return false;
    }
    try{
      if(!backend)backend=new ThreeGlyphBackend(originalCanvas);
      // Only rendering backend changes. Original simulation, renderer/render.js,
      // world, paint, grass, cow/knight frames and map editor remain operational.
      GL.flush=renderThree;
      originalCanvas.style.visibility='hidden';
      backend.show(true);
      mode='three';lastStats=0;
      safeStatus('Исходный мир → Three.js glyph renderer. Графика ещё проходит проверку 1:1.');
    }catch(error){
      lastError=String(error);
      console.error('Unable to initialize Three.js rasterizer',error);
      mode='legacy';GL.flush=legacyFlush;
      originalCanvas.style.visibility='visible';
      backend?.show(false);
      safeStatus('Three.js инициализация не удалась: '+lastError);
      return false;
    }
  }else{
    GL.flush=legacyFlush;
    originalCanvas.style.visibility='visible';
    backend?.show(false);
    // Free experimental 3D GPU resources on returning to original mode.
    if(liveArchitecture){liveArchitecture.dispose();liveArchitecture=null}
    architectureWanted=false;
    depthStartedArchitecture=false;
    architectureButton.setAttribute('aria-pressed','false');
    architectureButton.textContent='3D архитектура: выкл.';
    depthButton.setAttribute('aria-pressed','false');
    depthButton.textContent='Глубина 3D: выкл.';
    mode='legacy';
    safeStatus('Оригинальный движок: эталон 1:1 без каких-либо визуальных замен');
  }
  modeOriginal.setAttribute('aria-pressed',String(mode==='legacy'));
  modeThree.setAttribute('aria-pressed',String(mode==='three'));
  return true;
}
async function setLiveArchitecture(enabled){
  architectureWanted=Boolean(enabled);
  if(!architectureWanted){
    if(liveArchitecture){liveArchitecture.dispose();liveArchitecture=null}
    depthStartedArchitecture=false;
    depthButton.setAttribute('aria-pressed','false');
    depthButton.textContent='Глубина 3D: выкл.';
    architectureButton.setAttribute('aria-pressed','false');
    architectureButton.textContent='3D архитектура: выкл.';
    return true;
  }
  if(!selectMode('three')){
    architectureWanted=false;return false;
  }
  architectureButton.disabled=true;
  try{
    // Lazy dependency: main game and old WebGL never spend CPU/GPU resources
    // generating native meshes unless the player explicitly chooses 3D QA.
    const {LiveSourceArchitecture}=await import('./live-architecture.js');
    if(!architectureWanted)return false;
    liveArchitecture=new LiveSourceArchitecture(backend.renderer,()=>({
      solids,ruinSites,ruinDetail,ruinRotateMesh,cathedral,
      WS,MS,pitch:PITCH,worldGen
    }));
    architectureButton.setAttribute('aria-pressed','true');
    architectureButton.textContent='3D архитектура: вкл.';
    return true;
  }catch(error){
    console.error('Native 3D architecture integration failed',error);
    architectureWanted=false;
    architectureButton.setAttribute('aria-pressed','false');
    architectureButton.textContent='3D архитектура: ошибка';
    return false;
  }finally{architectureButton.disabled=false}
}
async function setDepthMode(enabled){
  depthButton.disabled=true;
  try{
    if(!enabled){
      if(liveArchitecture)await liveArchitecture.setDepthPreview(false);
      // If depth created the source layer on its own, disabling depth must
      // also remove that layer. Do not leave a distracting gray inset behind.
      if(depthStartedArchitecture)await setLiveArchitecture(false);
      depthStartedArchitecture=false;
      depthButton.setAttribute('aria-pressed','false');
      depthButton.textContent='Глубина 3D: выкл.';
      return true;
    }
    if(!liveArchitecture){
      if(!(await setLiveArchitecture(true)))return false;
      depthStartedArchitecture=true;
    }else depthStartedArchitecture=false;
    if(!liveArchitecture||!(await liveArchitecture.setDepthPreview(true)))return false;
    depthButton.setAttribute('aria-pressed','true');
    depthButton.textContent='Глубина 3D: вкл.';
    return true;
  }catch(error){
    console.error('Native Gothic depth prepass failed',error);
    depthButton.setAttribute('aria-pressed','false');
    depthButton.textContent='Глубина 3D: ошибка';
    return false;
  }finally{depthButton.disabled=false}
}
architectureButton.addEventListener('click',()=>setLiveArchitecture(!architectureWanted));
depthButton.addEventListener('click',()=>setDepthMode(depthButton.getAttribute('aria-pressed')!=='true'));
modeOriginal.addEventListener('click',()=>selectMode('legacy'));
modeThree.addEventListener('click',()=>selectMode('three'));

// Restored WebGL2 contexts reset GL.flush. Reinstall experimental backend
// only after the old renderer's handler finished restoring its resources.
originalCanvas.addEventListener('webglcontextrestored',()=>{
  // src/renderer/webgl.js rebuilds its WebGL2 program and replaces GL.flush.
  // The old function closes over deleted GPU handles, so NEVER restore it
  // after tab suspension (especially on Safari/iPadOS).
  queueMicrotask(()=>{
    if(!GL.ok)return;
    if(GL.flush!==renderThree)legacyFlush=GL.flush;
    if(mode==='three')GL.flush=renderThree;
  });
});
window.addEventListener('pagehide',()=>{});
window.__ASCII_PARITY__={
  select:selectMode,
  get mode(){return mode;},
  get stats(){return backend?.stats||null;},
  get liveArchitecture(){return liveArchitecture?{
    active:liveArchitecture.active,
    ...liveArchitecture.stats,
    camera:liveArchitecture.lastCamera,
    depth:liveArchitecture.depthInfo
  }:null;},
  setDepthMode,
  setLiveArchitecture,
  get error(){return lastError;},
  get canvas(){return backend?.renderer.domElement||null;},
  get ready(){return Boolean(GB.atlasCv&&GB.spr.length&&W&&H&&GB.n>1000);},
  get baselineGlyphs(){return GB.n;},
  // Produce ONE exact glyph buffer from the original scene, then render that
  // identical buffer in the independent Three.js backend. No second foliage
  // draw, no extra smoothing ticks, no perceptual brightness manipulation.
  captureReferenceForTest(){
    if(!new URLSearchParams(location.search).has('parityTest'))return null;
    if(mode!=='legacy')selectMode('legacy');
    referenceRender();
    const castle=castleDraw;
    const count=GB.n-(castle?(castle.flash>0.02?2:1):0);
    referenceBatch={count,camX:camX*CW,camY:camY*CH,castle};
    return {glyphs:count,camera:[referenceBatch.camX,referenceBatch.camY]};
  },
  captureThreeForTest(){
    if(!new URLSearchParams(location.search).has('parityTest')||!referenceBatch)return null;
    if(!selectMode('three'))return null;
    GB.n=referenceBatch.count;
    renderThree(referenceBatch.camX,referenceBatch.camY,referenceBatch.castle);
    return backend?.stats||null;
  },

  // Only used in automated screenshot QA. Camera and player positions are
  // temporary; the authored MEADOW_MAP and editor state are not mutated.
  visitForTest(name) {
    if(!new URLSearchParams(location.search).has('parityTest'))return null;
    let coords=null;
    if(name==='castle')coords=[0,-115];
    else if(name!=='camp') {
      const site=(MEADOW_MAP.ruins||[]).find(r=>r[0]===name);
      if(!site)return null;
      coords=[site[2],site[3]];
    }
    if(coords) {
      [player.x,player.y]=mapToCell(coords[0],coords[1]);
      player.tx=player.x;player.ty=player.y;player.moving=false;
      updateCamera(0,true);
    }
    return {name,player:[player.x,player.y],camera:[camX,camY]};
  },
  get positionDiagnostics(){
    if(!backend)return null;
    const layer=backend.glyphs,n=layer.geo.instanceCount;
    const rect=layer.rect,cam=layer.uniforms.uCam.value,view=layer.uniforms.uView.value;
    let visible=0,minX=Infinity,maxX=-Infinity;
    for(let i=0;i<n;i+=Math.max(1,Math.floor(n/2048))){
      const j=i*4,x=(rect[j]-cam.x)/view.x*2-1,xx=(rect[j+2]-cam.x)/view.x*2-1;
      if(x<1&&xx>-1)visible++;
      minX=Math.min(minX,x);maxX=Math.max(maxX,xx);
    }
    return {sampledVisibleX:visible,clipXRange:[minX,maxX],
      first:rect.slice(0,16).join(','),cam:[cam.x,cam.y],view:[view.x,view.y],
      positions:layer.geo.instanceCount,draws:backend.stats.drawCalls,
      triangles:backend.stats.triangles};
  },
  // Debug shader modes are available ONLY in ?parityTest=1, never to players.
  debugForTest(mode){
    if(!new URLSearchParams(location.search).has('parityTest')||!backend)return false;
    backend.debug(mode);return true;
  },
  // Test-only deterministic frame comparison. Never available during normal play.
  freezeForTest(){
    if(!new URLSearchParams(location.search).has('parityTest'))return false;
    window.simulate=()=>{};
    window.render=()=>{}; // freeze canvas-producing render(), not just simulate()
    return true;
  },
  get map(){return MEADOW_MAP;},
  get originalWebGL(){return Boolean(GL.ok);},
  get playerLocation(){return [player?.x||0,player?.y||0];}
};
selectMode('legacy');

// Dedicated opt-in geometry inspection mode. Never enters the pixel-perfect
// original / Three glyph comparison unless explicitly requested in the URL.
// It builds meshes from the REAL raycast source and is not the game's renderer.
if(['1','world'].includes(new URLSearchParams(location.search).get('geometry'))){
  const readyForSourceModel=()=>{
    if(!GB.atlasCv||!solids.length){
      requestAnimationFrame(readyForSourceModel);return;
    }
    import('./architecture-viewer.mjs')
      .then(m=>m.openSourceArchitecture({
        solids,ruinSites,ruinDetail,ruinRotateMesh,cathedral,
        WS,MS,PITCH,
        getCamera:()=>({W,H,VZ,CW,CH,camX,camY}),
        initialWorld:new URLSearchParams(location.search).get('geometry')==='world'
      }))
      .catch(err=>{
        console.error('Original-masonry Three.js view failed:',err);
        safeStatus('Ошибка загрузки исходной 3D-геометрии: '+err.message);
      });
  };
  requestAnimationFrame(readyForSourceModel);
}

