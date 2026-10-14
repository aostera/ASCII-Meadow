// Actual native Three.js ASCII Meadow runtime, not the side-by-side lab.
// This page loads ALL original simulation and source map modules unmodified,
// but never initialises the old WebGL shader. One Three WebGL2 context handles
// the complete authored glyph framebuffer; #g is a Canvas2D-only fallback.
import {ThreeGlyphBackend} from './three-glyphs.js';
import {NativeArchitectureDepth} from './native-architecture-depth.mjs';
import {NativeGreyMapEditor} from './native-editor-models.mjs';

const fallbackCanvas=document.getElementById('g');
let backend=null,depthPass=null,editorModels=null,disposed=false,fallbackReason=null,frames=0;
let testDepthDisabled=false;
// The player is the skinned 3D knight printed as the game's own glyphs (see
// native-knight3d.mjs). ?knight3d=0 keeps the original baked ASCII knight; so does
// any failure, and the time until the GLB has loaded.
const knight3dOn=new URLSearchParams(location.search).get('knight3d')!=='0';
let knight3d=null,knight3dError=null;
if(knight3dOn){
  const originalDrawKnight=drawKnight;
  drawKnight=function(e,G,fcw,fch){
    if(e===player&&knight3d?.ready){
      try{
        knight3d.draw(e,G,fcw,fch,{t,CW,CH,PITCH,KG,JUMP_T,AIR0,AIR1,
          rampCode,grect,gput,KN0,KNS,fireLightAt,knightFireBlock});
        drawTag(e,G.gx,G.gy);
        return;
      }catch(error){
        // A broken 3D knight hands the player back to the original ASCII art.
        knight3dError=String(error?.message||error);
        console.error('3D knight disabled:',error);
        knight3d.dispose();knight3d=null;
      }
    }
    return originalDrawKnight(e,G,fcw,fch);
  };
}
let contextLostCount=0,contextRestoredCount=0,nativeFallbackFrames=0;
// The source game remains the authoritative painter: collect only NPC spans.
const originalNativeRender=render;
render=function(){
  GB.nativeActorRanges=[];
  const result=originalNativeRender();
  if(!GL.ok&&!GL.lost&&GL.ctx2)nativeFallbackFrames++;
  return result;
};
const nativeBridge=GL;
const resizeFallback=GL.resize.bind(GL);

function enableFallback(error){
  fallbackReason=String(error?.message||error||'WebGL2 unavailable');
  console.error('Native Three runtime fell back to Canvas2D:',error);
  GL.ok=false;GL.lost=false;GL.gl=null;
  depthPass?.dispose();depthPass=null;
  editorModels?.dispose();editorModels=null;
  GL.flush=()=>{};
  try{backend?.show(false)}catch(_){}
  fallbackCanvas.style.visibility='visible';
  // Surface already has a 2D context, so a failed WebGL allocation never
  // leaves the player on an empty/lost WebGL canvas.
  resizeFallback();
}

function flushNative(camx,camy,castle){
  if(!backend||backend.lost)return;
  try{
    const source={solids,ruinSites,ruinDetail,ruinRotateMesh,
      cathedral,ruins,WS,MS,pitch:PITCH,worldGen,
      flora,VARS,t3Tree,campTent,campFence,campTurn};
    const ranges=GB.nativeActorRanges||[];
    if(ranges.length){
      for(const a of ranges){
        const world=toModelXZ(a.source.x,a.source.y);
        // Source camera is 12,000 model pixels above the projected target.
        // Farther north in the game map means farther from the camera.
        const z=12000+world[1]*WS*Math.cos(PITCH);
        a.depth=Math.max(0,Math.min(1,(z-.01)/39999.99));
        if(new URLSearchParams(location.search).has('nativeDepthTest')&&
           a.source._nativeForceFar)a.depth=.95;
        a.footY=(a.source.y+.7)*CH;
      }
    }
    // Cache native geometry, and perform Z prepass only near real masonry.
    // The source glyph pixels and 2D overlay remain completely unchanged.
    if(ranges.length&&!depthPass)
      depthPass=new NativeArchitectureDepth(backend.renderer);
    if(depthPass){
      try{
        backend.actorDepthTexture=depthPass.prepare({
          source,W,H,VZ,CW,CH,camX,camY,actorRanges:ranges
        });
      }catch(depthError){
        console.warn('Native depth disabled; original painter retained:',depthError);
        depthPass.dispose();depthPass=null;
        backend.actorDepthTexture=null;
      }
    }else backend.actorDepthTexture=null;
    if(testDepthDisabled)backend.actorDepthTexture=null;
    backend.actorDepthPitch=PITCH;
    backend.flush(GB,SPF,gput,CAST,camx,camy,castle,W,H,DPR,VZ,cathedral.cv);
    // Re-enable the author's favourite grey 3D building models INSIDE the
    // map editor, not on the production/game screen. They use the SAME
    // Three renderer/context/camera, and ruin yaw is saved in MEADOW_MAP.
    if(EDIT&&editing&&editorModels)
      editorModels.render({W,H,DPR,VZ,CW,CH,camX:camx,camY:camy,pitch:PITCH});
    else editorModels?.refreshUi();
    frames++;
  }catch(error){
    enableFallback(error);
    if(GL.ctx2)flush2D(camx,camy,castle);
  }
}

try{
  backend=new ThreeGlyphBackend(fallbackCanvas);
  const gl=backend.renderer.getContext();
  if(typeof WebGL2RenderingContext==='undefined'||
     !(gl instanceof WebGL2RenderingContext))
    throw Error('Native renderer needs WebGL2');
  backend.show(true);
  fallbackCanvas.style.visibility='hidden';
  GL.gl=backend.renderer.getContext();
  GL.ctx2=GL.ctx2||fallbackCanvas.getContext('2d');
  GL.resize=()=>{
    resizeFallback();
    if(backend&&W>0&&H>0&&DPR>0)backend.resize(W,H,DPR);
  };
  GL.upload=()=>{}; // Three imports source atlas lazily on first GPU frame.
  GL.uploadCastle=()=>{};
  GL.refresh=()=>{
    if(backend.lost)return false;
    // Safari can evict GPU textures independently of CPU-authored atlases.
    backend.sv=-1;
    for(const tex of [backend.atlas,backend.castleTexture,backend.uvTexture])
      if(tex)tex.needsUpdate=true;
    if(W>0&&H>0&&DPR>0)backend.resize(W,H,DPR);
    return true;
  };
  GL.flush=flushNative;
  GL.ok=true;
  if(EDIT)editorModels=new NativeGreyMapEditor(
    backend.renderer,
    ()=>({solids,ruinSites,ruinDetail,ruinRotateMesh,cathedral,
      WS,MS,pitch:PITCH,worldGen}),
    {
      isEditing:()=>editing,
      selectedRuin:()=>{
        if(!editing||ED.sel?.kind!=='ruins')return null;
        const i=ED.sel.mi,r=MEADOW_MAP.ruins?.[i]||ruins[i];
        if(!r)return null;
        return {index:i,id:Array.isArray(r)?r[0]:r.id,
          yaw:Array.isArray(r)?r[4]:r.yaw};
      },
      commit:(i,angle)=>{
        if(!editing||ED.sel?.kind!=='ruins'||ED.sel.mi!==i)return;
        const previous=MEADOW_MAP.ruins?.[i]?.[4]??ruins[i]?.yaw??0;
        if(Math.abs(angle-previous)<.0001)return;
        edBeginObjectEdit();edBakeRuins();
        MEADOW_MAP.ruins[i][4]=Math.round(angle*10000)/10000;
        applyObjects({ruins:1});edSyncUI();
      }
    }
  );
  backend.renderer.domElement.addEventListener('webglcontextlost',e=>{
    e.preventDefault();
    contextLostCount++;
    // Source main.js intentionally stops animation while GL.lost is true
    // because its original #g framebuffer *is* the lost WebGL canvas.
    // Unlike production, native.html has an INDEPENDENT 2D #g backing;
    // permit its normal simulation/flush2D to continue during GPU loss.
    GL.ok=false;GL.lost=false;
    backend.actorDepthTexture=null;
    editorModels?.refreshUi();
    backend.show(false);
    fallbackCanvas.style.visibility='visible';
    // Do not dispose GPU resources during context loss: stale render targets
    // will be freed and reconstructed only AFTER Three's restore event.
  });
  backend.renderer.domElement.addEventListener('webglcontextrestored',()=>{
    if(disposed)return;
    contextRestoredCount++;
    // The original CPU world atlas, source geometry and authored map remain
    // intact. The GPU target and mesh resources are recreated lazily.
    depthPass?.dispose();depthPass=null;
    backend.actorDepthTexture=null;
    backend.sv=-1;backend.width=0;backend.height=0;
    for(const tex of [backend.atlas,backend.castleTexture,backend.uvTexture])
      if(tex)tex.needsUpdate=true;
    backend.show(true);
    fallbackCanvas.style.visibility='hidden';
    GL.ok=true;GL.lost=false;
  });
  // WebKit may restore automatically after a background tab resumes.
  // When supported, explicitly request restoration; if unsupported, the
  // Canvas2D game continues to run rather than leaving a black screen.
  const requestRestore=()=>{
    if(disposed||!backend?.lost||document.hidden)return;
    try{
      const gl=backend.renderer.getContext();
      if(gl?.isContextLost())
        gl.getExtension('WEBGL_lose_context')?.restoreContext();
    }catch(error){console.warn('Native WebGL restore deferred:',error)}
  };
  window.addEventListener('pageshow',requestRestore);
  window.addEventListener('focus',requestRestore);
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden)requestRestore();
  });
}catch(err){enableFallback(err)}

if(knight3dOn&&backend){
  import('./native-knight3d.mjs').then(({NativeKnightGlyphs})=>{
    if(!disposed&&backend)knight3d=new NativeKnightGlyphs(backend.renderer);
  }).catch(error=>{
    knight3dError=String(error?.message||error);
    console.error('Native 3D knight unavailable:',error);
  });
}

window.__ASCII_NATIVE__={
  get ready(){return Boolean(GB.atlasCv&&W&&H&&GB.n>1000)},
  get mode(){return GL.ok&&!GL.lost?'three':'canvas2d'},
  get stats(){return backend?.stats||null},
  get renderer(){return backend?.renderer||null},
  get originalMap(){return MEADOW_MAP},
  get frameCount(){return frames},
  get recovery(){return {
    contextLostCount,contextRestoredCount,
    fallbackFrames:nativeFallbackFrames,
    runningOnFallback:!GL.ok&&!GL.lost&&!!GL.ctx2,
    hasGpu:!!backend&&!backend.lost&&GL.ok
  }},
  get nativeDepth(){return depthPass?.stats||{frames:0,builds:0,visible:false,activeActors:0}},
  get greyEditor(){return editorModels?.stats||{enabled:false,frames:0,sites:[]}},
  // Strictly test-scoped: prove an actual GPU occlusion difference without
  // needing any user-facing renderer toggle or laboratory overlay.
  setDepthMaskForTest(disabled){
    if(!new URLSearchParams(location.search).has('nativeDepthTest'))return false;
    testDepthDisabled=Boolean(disabled);
    return true;
  },
  get error(){return fallbackReason},
  get knight3d(){return knight3dOn?{active:!!knight3d,ready:!!knight3d?.ready,
    error:knight3dError||knight3d?.stats.error||null,...(knight3d?.stats||{})}:null},
  // Explicitly off the production route; visual art review comes at the end.
  dispose(){
    if(disposed)return;
    disposed=true;
    knight3d?.dispose();knight3d=null;
    enableFallback('Native GPU bridge disposed');
    backend?.dispose();backend=null;
  }
};
