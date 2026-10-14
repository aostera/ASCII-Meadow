// Prove true castle/ruin 3D depth now masks NPC glyphs in the normal
// full-screen Three renderer, without an inset or duplicate GPU context.
// A fixture suppresses source CPU masonry redraw ONLY while it verifies the
// native GPU Z test is real; then restores the source untouched.
const {chromium}=require('playwright');
const path=require('node:path'),fs=require('node:fs');
const base=process.argv[2]||'http://127.0.0.1:8181';
const dir=path.join(process.cwd(),'shots','three-native-depth');
fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
   '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
  for(const mobile of [false,true]){
   const label=mobile?'phone':'desktop';
   const context=await browser.newContext({
    viewport:mobile?{width:390,height:844}:{width:1100,height:740},
    deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile
   });
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   const res=await page.goto((base.endsWith('/')?base.slice(0,-1):base)+
     '/experiments/three/native.html?edit=0&nativeDepthTest=1',
     {waitUntil:'domcontentloaded'});
   if(!res?.ok())throw Error('Native source depth game HTTP failed');
   await page.waitForFunction(()=>window.__ASCII_NATIVE__?.ready&&
     window.__ASCII_NATIVE_NPCS__?.paletteCount>0,
     undefined,{timeout:90000});
   const result=await page.evaluate(()=>{
     const native=window.__ASCII_NATIVE__;
     const sourceMap=JSON.stringify(MEADOW_MAP);
     const who=npcs.find(n=>n.actorType==='villager');
     if(!who||!ruins.length)throw Error('Source ruin/NPC missing');
     const previousActor={x:who.x,y:who.y,tx:who.tx,ty:who.ty,
       behavior:who.behavior,nativeForceFar:who._nativeForceFar};
     const previousPlayer={x:player.x,y:player.y,tx:player.tx,ty:player.ty};
     const oldOcclude=occlude,oldOccludeRuins=occludeRuins;
     const renderer=native.renderer,gl=renderer.getContext();
     const canvas=renderer.domElement;
     let best={pixelDelta:0,depthDrawCalls:0,depthFrames:0};
     function pixels(rect){
       const scale=VZ*DPR;
       const rx=Math.max(0,Math.floor((rect.left-camX*CW)*scale));
       const right=Math.min(canvas.width,Math.ceil((rect.left+rect.w-camX*CW)*scale));
       const bottom=Math.max(0,Math.floor(canvas.height-
         (rect.top+rect.h-camY*CH)*scale));
       const top=Math.min(canvas.height,Math.ceil(canvas.height-
         (rect.top-camY*CH)*scale));
       const w=right-rx,h=top-bottom;
       if(w<=0||h<=0)return new Uint8Array(0);
       const out=new Uint8Array(w*h*4);
       gl.readPixels(rx,bottom,w,h,gl.RGBA,gl.UNSIGNED_BYTE,out);
       return out;
     }
     try{
       // On test frames, source masonry stops doing an overlay redraw;
       // any hidden pixels are therefore proven to be the *GPU* Z test.
       occlude=()=>{};occludeRuins=()=>{};
       who.behavior='idle';
       who._nativeForceFar=true;
       for(const r of ruins){
         // Sample several parts of real opaque source masonry (not an
         // invented flat billboard; arches and holes remain transparent).
         for(const [u,v] of [[.2,.55],[.72,.6],[.35,.75],[.6,.35]]){
           const x=Math.round(r.x0+(r.x1-r.x0)*u);
           const y=Math.round(r.y0+(r.y1-r.y0)*v);
           who.x=x;who.y=y+4;
           player.x=x;player.y=y+4;
           player.tx=x;player.ty=player.y;
           updateCamera(0,true);
           const rect=geomOf(who);
           native.setDepthMaskForTest(true);
           render();
           const without=pixels(rect);
           native.setDepthMaskForTest(false);
           render();
           const withMask=pixels(rect);
           const stats=native.nativeDepth;
           if(!withMask.length||withMask.length!==without.length)continue;
           let diff=0;
           for(let j=0;j<withMask.length;j+=4){
             if(withMask[j]!==without[j]||
                withMask[j+1]!==without[j+1]||
                withMask[j+2]!==without[j+2])diff++;
           }
           if(diff>best.pixelDelta)best={
             pixelDelta:diff,depthDrawCalls:stats.drawCalls,
             depthFrames:stats.frames,sites:stats.sites,
             camera:{x:camX,y:camY},site:r.id,
             actorDepthRanges:native.stats.depthActorRanges,
             rendererContexts:[...document.querySelectorAll('canvas')].filter(
               c=>c===renderer.domElement).length
           };
           if(diff>12)break;
         }
         if(best.pixelDelta>12)break;
       }
       if(!(best.depthFrames>0&&best.depthDrawCalls>=3&&best.sites===4))
         throw Error('Source 3D geometry depth failed '+JSON.stringify(best));
       if(!(best.pixelDelta>12&&best.actorDepthRanges>0))
         throw Error('Actual GPU NPC occlusion not visible '+JSON.stringify(best));
       if(best.rendererContexts!==1)
         throw Error('Source 3D pass allocated additional canvas');
       if(JSON.stringify(MEADOW_MAP)!==sourceMap)
         throw Error('Native 3D depth changed authored map');
       return {...best,mapUnchanged:true};
     }finally{
       Object.assign(who,previousActor);
       Object.assign(player,previousPlayer);
       occlude=oldOcclude;occludeRuins=oldOccludeRuins;
       native.setDepthMaskForTest(false);
       updateCamera(0,true);
       render();
     }
   });
   await page.screenshot({path:path.join(dir,label+'.png'),timeout:60000});
   if(errors.length)throw Error(label+' browser errors '+errors.join('; '));
   console.log('NATIVE FULL-WORLD GOTHIC GPU DEPTH PASS '+label+' '+JSON.stringify(result));
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
