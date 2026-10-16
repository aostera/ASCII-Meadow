// T08: reproducible CPU-submission/GPU-scene budget audit for the actual
// native ASCII game. Runs authored map and renderer, not a synthetic scene.
// Chromium SwiftShader ≠ physical phone/GPU FPS, and renderer CPU calls ≠ GPU time.
const {chromium}=require('playwright');
const path=require('node:path'),fs=require('node:fs');
const base=process.argv[2]||'http://127.0.0.1:8181';
const root=path.join(process.cwd(),'shots','three-native-t08-profile');
fs.mkdirSync(root,{recursive:true});
const percentile=(v,p)=>{
 const a=v.filter(x=>Number.isFinite(x)&&x>=0).sort((a,b)=>a-b);
 return a.length?a[Math.min(a.length-1,Math.max(0,Math.ceil(a.length*p)-1))]:null;
};
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
   '--enable-webgl','--use-angle=swiftshader',
   '--enable-unsafe-swiftshader'
 ]});
 try{
  for(const mobile of [false,true]){
   const viewport=mobile?{width:390,height:844}:{width:1100,height:740};
   const label=mobile?'phone-emulated':'desktop-swiftshader';
   const context=await browser.newContext({
     viewport,deviceScaleFactor:mobile?2:1,
     isMobile:mobile,hasTouch:mobile
   });
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.stack||e.message));
   const res=await page.goto(base.replace(/\/$/,'')+
      '/experiments/three/native.html?edit=0',
      {waitUntil:'domcontentloaded'});
   if(!res?.ok())throw Error('Native page HTTP status '+res?.status());
   await page.waitForFunction(()=>window.__ASCII_NATIVE__?.ready&&
     window.__ASCII_NATIVE__.mode==='three'&&
     window.__ASCII_NATIVE__.stats?.glyphs>1000&&
     window.__ASCII_NATIVE__.frameCount>=3&&
     ruins?.length===3,undefined,{timeout:120000});
   const initial=await page.evaluate(()=>({
     original:JSON.stringify(MEADOW_MAP),
     sourcePositions:ruins.map(r=>({
       id:r.id,x:r.x,z:r.z,yaw:r.yaw,
       width:r.width,height:r.height
     })),
     gpu:window.__ASCII_NATIVE__.renderer?.getContext()?.getParameter(
       window.__ASCII_NATIVE__.renderer.getContext().MAX_TEXTURE_SIZE),
     browser:navigator.userAgent
   }));
   const locations=[{id:'castle',type:'castle'},
     ...initial.sourcePositions.map(r=>({id:r.id,type:'ruin'}))];
   const scenes=[];
   for(const location of locations){
     const raw=await page.evaluate(({location,source})=>{
       const n=window.__ASCII_NATIVE__,renderer=n.renderer;
       if(!renderer||n.mode!=='three'||ruins.length!==3)
         throw Error('Native WebGL2 scene/ruins unavailable');
       const r=ruins.find(z=>z.id===location.id);
       if(location.type==='ruin'&&!r)
         throw Error('Authored ruin missing '+location.id);
       const world=location.type==='castle'?
         [cathedral.kx/CW,cathedral.ky/CH-18]:
         mapToCell(...ruinWorldXZ(r,0,-r.depth/2-60));
       player.x=player.tx=world[0];
       player.y=player.ty=world[1];
       player.h=player.hT=surfAt(player.x,player.y);
       VZ=1;updateCamera(0,true);
       const sourceBefore=JSON.stringify(MEADOW_MAP);
       const measures=[];
       let singleCanvas=true,mapOK=true,depthOK=true;
       const oldRandom=Math.random;
       try{
         Math.random=()=>.517;cloudTick=2;FG.tick=0;
         // Two shader/texture warmup frames excluded from measurements.
         for(let i=0;i<2;i++)render();
         for(let i=0;i<8;i++){
           const start=performance.now();
           render();
           const submitWallMs=performance.now()-start;
           const s={...n.stats},depth={...n.nativeDepth};
           const mem={...renderer.info.memory};
           measures.push({
             submitWallMs,uploadCpuMs:s.uploadCpuMs,
             renderCpuMs:s.renderCpuMs,
             glyphs:s.glyphs,visible:s.visibleGlyphs,culled:s.culledGlyphs,
             glyphDrawCalls:s.drawCalls,glyphTriangles:s.triangles,
             depthDrawCalls:depth.drawCalls??0,
             depthTriangles:depth.propTriangles??0,
             depthActorRanges:s.depthActorRanges??0,
             glTextures:mem.textures??null,
             glGeometries:mem.geometries??null,
             glyphCapacity:s.glyphCapacity,
             glyphInstanceAttributeBytes:s.glyphInstanceAttributeBytes
           });
           singleCanvas&&=document.querySelectorAll(
             '#three-parity-canvas').length===1;
           mapOK&&=source===JSON.stringify(MEADOW_MAP);
           depthOK&&=s.visibleGlyphs<=s.glyphs&&
             s.culledGlyphs===s.glyphs-s.visibleGlyphs&&
             s.drawCalls>=1&&s.visibleGlyphs>100;
         }
       }finally{Math.random=oldRandom}
       if(!singleCanvas||!mapOK||!depthOK||
         JSON.stringify(MEADOW_MAP)!==sourceBefore)
         throw Error('Native frame counters or source map regressed '+
           JSON.stringify({singleCanvas,mapOK,depthOK}));
       return {id:location.id,
         camera:[camX,camY,VZ],
         canvas:[renderer.domElement.width,renderer.domElement.height],
         singleCanvas,mapOK,depthOK,
         data:measures,
         sourceCellCount:GB.n,worldCoords:world,
         activeEntities:npcs.length+1,
         depth:n.nativeDepth};
     },{location,source:initial.original});
     const grouped=raw.data;
     const p=(key,quantile)=>percentile(grouped.map(m=>m[key]),quantile);
     const mid=grouped[3];
     const record={
       id:raw.id,camera:raw.camera,viewport:raw.canvas,
       originalGlyphMedian:p('glyphs',.5),
       visibleGlyphMedian:p('visible',.5),
       culledGlyphMedian:p('culled',.5),
       cullingPct:p('glyphs',.5)>0?
         +(100*p('culled',.5)/p('glyphs',.5)).toFixed(1):0,
       submitCpuP50Ms:p('submitWallMs',.5),
       submitCpuP95Ms:p('submitWallMs',.95),
       glyphUploadCpuP95Ms:p('uploadCpuMs',.95),
       glyphRenderSubmitCpuP95Ms:p('renderCpuMs',.95),
       drawCalls:mid.glyphDrawCalls,
       depthDrawCalls:mid.depthDrawCalls,
       glyphTriangles:mid.glyphTriangles,
       depthProxyTriangles:mid.depthTriangles,
       nativeActors:mid.depthActorRanges,
       glTrackedTextures:mid.glTextures,
       glTrackedGeometries:mid.glGeometries,
       glyphCapacity:mid.glyphCapacity,
       glyphInstanceAttributeBytes:mid.glyphInstanceAttributeBytes,
       // Dynamic glyph uploads are 6 vec4+vec2 floats for normal scene
       // and a further vec2 when the architecture actor-Z mask is active.
       // This is a CPU-written buffer estimate, not actual GPU VRAM.
       estimatedInstanceStreamBytes:mid.visible*(
         4*4+2*4+(mid.nativeActors?2*4:0)),
       sampleCount:grouped.length
     };
     // On desktop the actual Gothic abbey creates >65,536 original glyphs,
     // yet its viewport crop fits inside 65,536 slots. The old source-count
     // grow() silently doubled all three typed attribute arrays to 131,072.
     // Verify the real native renderer no longer reallocates for invisible
     // glyphs. This is a capacity regression, not an FPS claim.
     if(!mobile&&raw.id==='abbey-front'){
       if(!(record.originalGlyphMedian>65536&&
          record.visibleGlyphMedian<=65536))
         throw Error('T08 abbey failed to exercise >65536 source case '+
           JSON.stringify(record));
       if(record.glyphCapacity!==65536||
          record.glyphInstanceAttributeBytes!==65536*32)
         throw Error('T08 offscreen source glyphs still double buffers '+
           JSON.stringify(record));
     }
     if(record.glyphCapacity<record.visibleGlyphMedian||
       record.glyphInstanceAttributeBytes!==record.glyphCapacity*32)
       throw Error('T08 invalid glyph buffer accounting '+
         JSON.stringify(record));
     scenes.push(record);
     await page.screenshot({path:path.join(root,
       label+'-'+raw.id+'.png'),timeout:60000});
     console.log('T08 PROFILE SCENE '+label+' '+JSON.stringify(record));
   }
   if(errors.length)throw Error('Native benchmark JS exceptions '+
     errors.slice(0,5).join(';'));
   const report={
     label,mode:'native Three.js authored-world SwiftShader',
     viewport,deviceScaleFactor:mobile?2:1,
     sourceMapUnchanged:true,oneRenderer:true,
     maxTextureSize:initial.gpu,
     sampleMethod:'8 synchronous gameplay render() calls per unchanged pose; excludes two warmups',
     caveat:'CPU submission timings only. Not hardware GPU time, VRAM, uncapped FPS or real-phone FPS. Performance timing variability on SwiftShader is high.',
     scenes
   };
   fs.writeFileSync(path.join(root,label+'.json'),
     JSON.stringify(report,null,2)+'\n');
   console.log('T08 PROFILE SUMMARY '+JSON.stringify(report));
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
