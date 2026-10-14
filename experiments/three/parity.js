// Original ASCII Meadow gameplay + switchable Three.js rasterizer.
// This page is the migration baseline: all gameplay and authored-world scripts
// are loaded directly from ../../src/*. This bridge only swaps final GL.flush.
// The separate primitive-model experiment remains app.js on index.html.
import { ThreeGlyphBackend } from './three-glyphs.js';

const originalCanvas=document.getElementById('g');
const modeOriginal=document.getElementById('parity-legacy');
const modeThree=document.getElementById('parity-three');
const status=document.getElementById('parity-status');
const legacyFlush=GL.flush;
let backend=null,mode='legacy',lastError=null;
let lastStats=0;
const safeStatus=text=>{status.textContent=text;};

function renderThree(camx,camy,castle){
  try {
    backend.flush(GB,SPF,gput,CAST,camx,camy,castle,W,H,DPR,VZ,cathedral.cv);
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
    mode='legacy';
    safeStatus('Оригинальный движок: эталон 1:1 без каких-либо визуальных замен');
  }
  modeOriginal.setAttribute('aria-pressed',String(mode==='legacy'));
  modeThree.setAttribute('aria-pressed',String(mode==='three'));
  return true;
}
modeOriginal.addEventListener('click',()=>selectMode('legacy'));
modeThree.addEventListener('click',()=>selectMode('three'));

// Restored WebGL2 contexts reset GL.flush. Reinstall experimental backend
// only after the old renderer's handler finished restoring its resources.
originalCanvas.addEventListener('webglcontextrestored',()=>{
  queueMicrotask(()=>{
    if(mode==='three'&&GL.ok)GL.flush=renderThree;
  });
});
window.addEventListener('pagehide',()=>{});
window.__ASCII_PARITY__={
  select:selectMode,
  get mode(){return mode;},
  get stats(){return backend?.stats||null;},
  get error(){return lastError;},
  get canvas(){return backend?.renderer.domElement||null;},
  get ready(){return Boolean(GB.atlasCv&&GB.spr.length&&W&&H&&GB.n>1000);},
  get baselineGlyphs(){return GB.n;},
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
    return true;
  },
  get map(){return MEADOW_MAP;},
  get originalWebGL(){return Boolean(GL.ok);},
  get playerLocation(){return [player?.x||0,player?.y||0];}
};
selectMode('legacy');
