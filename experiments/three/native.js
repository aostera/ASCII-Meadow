// Actual native Three.js ASCII Meadow runtime, not the side-by-side lab.
// This page loads ALL original simulation and source map modules unmodified,
// but never initialises the old WebGL shader. One Three WebGL2 context handles
// the complete authored glyph framebuffer; #g is a Canvas2D-only fallback.
import {ThreeGlyphBackend} from './three-glyphs.js';
import {NativeArchitectureDepth} from './native-architecture-depth.mjs';

const fallbackCanvas=document.getElementById('g');
let backend=null,depthPass=null,disposed=false,fallbackReason=null,frames=0;
let testDepthDisabled=false;
// Opt-in 3D player knight in the main picture: ?knight3d replaces the ASCII
// knight, ?knight3d=both draws both. Without the flag nothing below runs.
const knight3dParam=new URLSearchParams(location.search).get('knight3d');
const knight3dMode=knight3dParam===null?null:(knight3dParam==='both'?'both':'replace');
let knight3d=null,knight3dError=null;
if(knight3dMode==='replace'){
  const originalDrawKnight=drawKnight;
  // Only the player's ASCII body is skipped; its name tag is still drawn.
  drawKnight=function(e,G,fcw,fch){
    if(e===player&&knight3d&&!knight3d.disposed){drawTag(e,G.gx,G.gy);return}
    return originalDrawKnight(e,G,fcw,fch);
  };
}
// The source game remains the authoritative painter: collect only NPC spans.
const originalNativeRender=render;
render=function(){GB.nativeActorRanges=[];return originalNativeRender()};
const nativeBridge=GL;
const resizeFallback=GL.resize.bind(GL);

function enableFallback(error){
  fallbackReason=String(error?.message||error||'WebGL2 unavailable');
  console.error('Native Three runtime fell back to Canvas2D:',error);
  GL.ok=false;GL.lost=false;GL.gl=null;
  depthPass?.dispose();depthPass=null;
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
      cathedral,ruins,WS,MS,pitch:PITCH,worldGen};
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
    if(knight3d)try{
      knight3d.render({player,gameTime:t,
        sourceHeight:KG.art*charDims(player).fch,
        W,H,VZ,CW,CH,camX,camY,pitch:PITCH});
    }catch(knightError){
      // A broken 3D knight never takes the glyph renderer down with it.
      knight3dError=String(knightError?.message||knightError);
      console.error('Native 3D knight disabled:',knightError);
      knight3d.dispose();knight3d=null;
    }
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
  backend.renderer.domElement.addEventListener('webglcontextlost',e=>{
    e.preventDefault();GL.lost=true;GL.ok=false;
    depthPass?.dispose();depthPass=null;
    backend.actorDepthTexture=null;
  });
  backend.renderer.domElement.addEventListener('webglcontextrestored',()=>{
    GL.lost=false;GL.ok=true;
    backend.sv=-1;backend.width=0;backend.height=0;
    backend.show(true);fallbackCanvas.style.visibility='hidden';
  });
}catch(err){enableFallback(err)}

if(knight3dMode&&backend){
  import('./native-knight3d.mjs').then(({NativeKnight3D})=>{
    if(!disposed&&backend)knight3d=new NativeKnight3D(backend.renderer);
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
  get nativeDepth(){return depthPass?.stats||{frames:0,builds:0,visible:false,activeActors:0}},
  // Strictly test-scoped: prove an actual GPU occlusion difference without
  // needing any user-facing renderer toggle or laboratory overlay.
  setDepthMaskForTest(disabled){
    if(!new URLSearchParams(location.search).has('nativeDepthTest'))return false;
    testDepthDisabled=Boolean(disabled);
    return true;
  },
  get error(){return fallbackReason},
  get knight3d(){return knight3dMode?{mode:knight3dMode,active:!!knight3d,
    error:knight3dError,...(knight3d?.stats||{})}:null},
  // Explicitly off the production route; visual art review comes at the end.
  dispose(){
    if(disposed)return;
    disposed=true;
    knight3d?.dispose();knight3d=null;
    enableFallback('Native GPU bridge disposed');
    backend?.dispose();backend=null;
  }
};
