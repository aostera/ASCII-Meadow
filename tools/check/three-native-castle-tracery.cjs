// T02: castle west-front 3D tracery regression in the ACTUAL native game.
// Keep open physical portal and source map; do not accept a 2D facade decal.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const dir=path.join(process.cwd(),'shots','three-native-castle-tracery');
fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
  for(const mobile of [false,true]){
   const mode=mobile?'phone':'desktop';
   const context=await browser.newContext({
    viewport:mobile?{width:390,height:844}:{width:1100,height:740},
    deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile
   });
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   const reply=await page.goto(base.replace(/\/$/,'')+
     '/experiments/three/native.html?edit=0&nativeCastleFacadeTest=1',
     {waitUntil:'domcontentloaded'});
   if(!reply?.ok())throw Error('Native castle route failed');
   await page.waitForFunction(()=>window.__ASCII_NATIVE__?.ready&&
     window.__ASCII_NATIVE_COMPLETE_ARCH__?.features?.castle?.portalSideTracery>40&&
     window.__ASCII_NATIVE_COMPLETE_ARCH__?.features?.castle?.outerTowerRelief>65&&
     window.__ASCII_NATIVE_COMPLETE_ARCH__?.features?.castle?.centralBrokenGables>25&&
     window.__ASCII_NATIVE__.frameCount>3,undefined,{timeout:120000});
   const stats=await page.evaluate(()=>{
     const game=window.__ASCII_NATIVE__,gothic=window.__ASCII_NATIVE_COMPLETE_ARCH__;
     const source=JSON.stringify(MEADOW_MAP);
     if(game.mode!=='three')throw Error('Three native not running');
     if(!gothic.centralGablePortalClear||!gothic.centralGableProjects)
       throw Error('New central Gothic gable fills the portal or fails to project');
     if(!gothic.outerTowerReliefClear)
       throw Error('Outer tower relief reaches protected gate: '+
         JSON.stringify(gothic.outerTowerIntrusions));
     if(!gothic.westPortalReliefClear)
       throw Error('New Gothic solids cross protected central facade |x|<300');
     if(!gothic.westCurtainProjects)
       throw Error('Gothic canopies hidden behind source gatehouse rather than projecting ahead of curtain');
     const c=gothic.features.castle;
     if(c.portalSideTracery<52||c.outerTowerRelief<65||
        c.centralBrokenGables<25||
        !c.rose||!c.portal||!c.buttresses)
       throw Error('Gothic relief missing real stone solids '+JSON.stringify(c));
     // Move only the temporary player for the screenshot. Author map, ruins
     // and native camera / renderer remain real and otherwise unchanged.
     player.x=cathedral.kx/CW;
     player.y=cathedral.ky/CH-16;
     player.tx=player.x;player.ty=player.y;
     updateCamera(0,true);
     render();
     const geomCount=solids.length;
     const mapAfter=JSON.stringify(MEADOW_MAP);
     const actors=ents.length;
     return {mode:game.mode,site:'castle',features:c,
       portalClear:gothic.westPortalReliefClear,
       projectingCurtain:gothic.westCurtainProjects,sourceSolids:geomCount,
       mapUnchanged:source===mapAfter,actors,
       ruinSites:ruins.map(r=>r.id),glyphs:GB.n,
       gpuCanvases:document.querySelectorAll('#three-parity-canvas').length};
   });
   if(stats.glyphs<500||stats.gpuCanvases!==1||
      !stats.mapUnchanged||stats.ruinSites.length!==3)
     throw Error(mode+' castle art regression '+JSON.stringify(stats));
   // The initial gate-area camera deliberately does NOT show the west
   // facade on many aspect ratios. Reframe after measuring the true source
   // raster footprint rather than accepting an off-screen pixel test.
   const comparison=await page.evaluate(()=>{
     const gothic=window.__ASCII_NATIVE_COMPLETE_ARCH__;
     const native=window.__ASCII_NATIVE__;
     const mapOriginal=JSON.stringify(MEADOW_MAP);
     const gl=native.renderer.getContext(),canvas=native.renderer.domElement;
     const oldRandom=Math.random;
     function snapshot(enabled,towerEnabled=enabled,centralEnabled=enabled){
       if(!gothic.setFacadeEnabledForTest(enabled)||
          !gothic.setOuterTowerReliefEnabledForTest(towerEnabled)||
          !gothic.setCentralGableEnabledForTest(centralEnabled))
         throw Error('Test-only castle geometry toggles are inaccessible');
       // Rebuild the complete original renderer world, including source
       // sprites, all architecture rays, shadow, flora and depth worldGen.
       // Partial buildWorld()/placeFlora() leaks old GPU cache state and
       // can make the third pass spuriously differ from the first.
       build();
       updateCamera(0,true);
       // The source render amortizes cloud-shadow recomputation over 3
       // frames via cloudTick. A forced full-world on/off/on QA cycle has
       // no simulation time advance, yet otherwise reuses different cloud
       // cache phases depending on preceding screenshot/RAF timing.
       // Match the same freshly sampled cloud field in EACH test frame;
       // never change the actual source runtime or game animation cadence.
       cloudTick=2; // render() increments to 0, recomputing cloudBuf.
       render();
       const out=new Uint8Array(canvas.width*canvas.height*4);
       gl.readPixels(0,0,canvas.width,canvas.height,
         gl.RGBA,gl.UNSIGNED_BYTE,out);
       // Keep a source-space sample too: a solid can exist in the 3D
       // registry yet remain hidden by the original masonry rasterizer.
       const c=cathedral;
       return {pixels:out,source:{
         lum:new Float32Array(c.lum),glyph:new Int16Array(c.glyph),
         dep:new Float32Array(c.dep),left:c.cx0,top:c.cy0,
         width:c.BW,height:c.BH,
         viewport:[VX0,VX1,VY0,VY1]
       }};
     }
     try{
       // Fog banks otherwise have new random seeds on each rebuild.
       // Freeze this source of timing noise, not the user's world map.
       Math.random=()=>.513;
       // Discard one complete initial world rebuild: the first renderer
       // frame can also upload new textures / warm native WebGL resources.
       const warmup=snapshot(true);
       let on=snapshot(true);
       const onFeatures=gothic.features.castle.portalSideTracery;
       const onTowers=gothic.features.castle.outerTowerRelief;
       const onCentral=gothic.features.castle.centralBrokenGables;
       let off=snapshot(false);
       const offFeatures=gothic.features.castle.portalSideTracery;
       const offTowers=gothic.features.castle.outerTowerRelief;
       const offCentral=gothic.features.castle.centralBrokenGables;
       let restored=snapshot(true);
       const restoredFeatures=gothic.features.castle.portalSideTracery;
       const restoredTowers=gothic.features.castle.outerTowerRelief;
       const restoredCentral=gothic.features.castle.centralBrokenGables;
       let changed=0,restoreErrors=0,offToRestored=0,warmupToOn=0;
       let sourceChanged=0,sourceVisibleChanged=0,sourceChangedBounds=null;
       let towerChanged=0,towerFocus=null;
       const ac=on.source,bc=off.source;
       const changedCols=new Uint32Array(ac.width);
       if(ac.width!==bc.width||ac.height!==bc.height||
          ac.left!==bc.left||ac.top!==bc.top)
         throw Error('Castle source-grid moved during reversible QA');
       for(let k=0;k<ac.lum.length;k++){
         if(Math.abs(ac.lum[k]-bc.lum[k])<.01&&
            ac.glyph[k]===bc.glyph[k]&&
            Math.abs(ac.dep[k]-bc.dep[k])<1)continue;
         sourceChanged++;
         changedCols[k%ac.width]++;
         const cx=ac.left+k%ac.width,cy=ac.top+Math.floor(k/ac.width);
         // Real authored model coordinates, not a guessed screen rectangle.
         const localX=((cx+.5)*CW-cathedral.kx)/MS;
         if(Math.abs(localX)>475&&Math.abs(localX)<725){
           towerChanged++;
           if(!towerFocus || cy<towerFocus.row)
             towerFocus={col:cx,row:cy};
         }
         if(cx>=ac.viewport[0]&&cx<=ac.viewport[1]&&
            cy>=ac.viewport[2]&&cy<=ac.viewport[3])sourceVisibleChanged++;
         if(!sourceChangedBounds)sourceChangedBounds=[cx,cy,cx,cy];
         else{
           sourceChangedBounds[0]=Math.min(cx,sourceChangedBounds[0]);
           sourceChangedBounds[1]=Math.min(cy,sourceChangedBounds[1]);
           sourceChangedBounds[2]=Math.max(cx,sourceChangedBounds[2]);
           sourceChangedBounds[3]=Math.max(cy,sourceChangedBounds[3]);
         }
       }
       // Keep test viewport in the real game's follow-camera. Aim the
       // temporary player at the detected stone-glyph rows; never alter the
       // authored map, production camera formula or test screenshot with
       // separate standalone 3D rendering.
       let sourceVisibleAfterFocus=sourceVisibleChanged;
       let sourceFocusCol=null;
       if(sourceChangedBounds){
         // A symmetric castle has separated left/right clusters. Their
         // bounding-box midpoint is the EMPTY gateway, so centering there
         // can still keep every changed bay outside a narrow viewport.
         let best=0,bestCol=0;
         for(let i=0;i<changedCols.length;i++)
           if(changedCols[i]>best){best=changedCols[i];bestCol=i;}
         const focusRow=(sourceChangedBounds[1]+sourceChangedBounds[3])*.5;
         const focusCol=ac.left+bestCol;
         sourceFocusCol=focusCol;
         player.y=focusRow+VR*.4;player.ty=player.y;
         player.x=focusCol;player.tx=player.x;
         updateCamera(0,true);
         snapshot(true); // warm native GPU caches on the focused view
         on=snapshot(true);
         off=snapshot(false);
         restored=snapshot(true);
         const vis=on.source.viewport;
         for(let k=0;k<on.source.lum.length;k++){
           const a=on.source,b=off.source;
           if(Math.abs(a.lum[k]-b.lum[k])<.01&&a.glyph[k]===b.glyph[k]&&
              Math.abs(a.dep[k]-b.dep[k])<1)continue;
           const cx=a.left+k%a.width,cy=a.top+Math.floor(k/a.width);
           if(cx>=vis[0]&&cx<=vis[1]&&cy>=vis[2]&&cy<=vis[3])
             sourceVisibleAfterFocus++;
         }
       }
       for(let i=0;i<on.pixels.length;i+=4){
         function different(a,b){
           return Math.max(Math.abs(a[i]-b[i]),
             Math.abs(a[i+1]-b[i+1]),
             Math.abs(a[i+2]-b[i+2]))>8;
         }
         if(different(on.pixels,off.pixels))changed++;
         if(different(on.pixels,restored.pixels))restoreErrors++;
         if(different(off.pixels,restored.pixels))offToRestored++;
         if(different(warmup.pixels,on.pixels))warmupToOn++;
       }
       if(!(onFeatures>=52&&offFeatures===0&&restoredFeatures>=52&&
          onTowers>=65&&offTowers===0&&restoredTowers>=65&&
          onCentral>=25&&offCentral===0&&restoredCentral>=25))
         throw Error('QA toggle did not actually rebuild source solids '+JSON.stringify({
           onFeatures,offFeatures,restoredFeatures,
           onTowers,offTowers,restoredTowers,
           onCentral,offCentral,restoredCentral
         }));
       if(!gothic.westCurtainProjects||!gothic.westPortalReliefClear||
          !gothic.outerTowerReliefClear||!gothic.outerTowerReliefEnabled||
          !gothic.centralGablePortalClear||!gothic.centralGableProjects||
          !gothic.centralGableEnabled||!gothic.facadeEnabled)
         throw Error('Castle features not physically restored');
       if(JSON.stringify(MEADOW_MAP)!==mapOriginal)
         throw Error('QA-only castle rebuild touched authored map');
       // Independently prove ONLY tower geometry changes the actual
       // GPU frame: keep earlier west-front tracery enabled in BOTH
       // comparison frames, so pixel delta cannot come from those bays.
       // The tower screenshot follows exactly this final focused view.
       let towerGpuChanged=0,towerRestoreErrors=0,towerVisibleCells=0;
       let towerSourceRestoreErrors=0,towerSecondRenderErrors=0;
       let towerRestoreBounds=null;
       if(towerFocus){
         player.x=towerFocus.col;player.tx=player.x;
         player.y=towerFocus.row+VR*.4;player.ty=player.y;
         updateCamera(0,true);
         snapshot(true); // force native WebGL upload on new camera
         const towerOn=snapshot(true),towerOff=snapshot(true,false);
         const towerOffFeatures=gothic.features.castle.outerTowerRelief;
         const towerRestored=snapshot(true);
         if(towerOffFeatures!==0||
            gothic.features.castle.outerTowerRelief!==onTowers)
           throw Error('Tower-only switch did not leave facade intact');
         for(let k=0;k<towerOn.source.lum.length;k++){
           const a=towerOn.source,b=towerOff.source;
           if(Math.abs(a.lum[k]-b.lum[k])<.01&&a.glyph[k]===b.glyph[k]&&
              Math.abs(a.dep[k]-b.dep[k])<1)continue;
           const cx=a.left+k%a.width,cy=a.top+Math.floor(k/a.width),
             localX=((cx+.5)*CW-cathedral.kx)/MS;
           if(Math.abs(localX)<=475||Math.abs(localX)>=725)continue;
           if(cx>=a.viewport[0]&&cx<=a.viewport[1]&&
              cy>=a.viewport[2]&&cy<=a.viewport[3])
             towerVisibleCells++;
         }
         // Compare ORIGINAL source geometry raster as well as rendered
         // pixels: on/off/on GPU inconsistencies must not be dismissed as
         // animation noise without proving the CPU solids were restored.
         for(let k=0;k<towerOn.source.lum.length;k++){
           const a=towerOn.source,b=towerRestored.source;
           if(Math.abs(a.lum[k]-b.lum[k])>.01||
              a.glyph[k]!==b.glyph[k]||
              Math.abs(a.dep[k]-b.dep[k])>1)
             towerSourceRestoreErrors++;
         }
         // Repaint the already-built scene once WITHOUT rebuilding. If
         // native texture uploads are a single-frame lag, this isolates it
         // from true geometric nondeterminism.
         render();
         const settledPixels=new Uint8Array(canvas.width*canvas.height*4);
         gl.readPixels(0,0,canvas.width,canvas.height,
           gl.RGBA,gl.UNSIGNED_BYTE,settledPixels);
         for(let i=0;i<towerOn.pixels.length;i+=4){
           const diff=(a,b)=>Math.max(Math.abs(a[i]-b[i]),
             Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]))>8;
           if(diff(towerOn.pixels,towerOff.pixels))towerGpuChanged++;
           if(diff(towerOn.pixels,towerRestored.pixels)){
             towerRestoreErrors++;
             const k=i/4,cx=k%canvas.width,cy=Math.floor(k/canvas.width);
             if(!towerRestoreBounds)towerRestoreBounds=[cx,cy,cx,cy];
             else{
               towerRestoreBounds[0]=Math.min(towerRestoreBounds[0],cx);
               towerRestoreBounds[1]=Math.min(towerRestoreBounds[1],cy);
               towerRestoreBounds[2]=Math.max(towerRestoreBounds[2],cx);
               towerRestoreBounds[3]=Math.max(towerRestoreBounds[3],cy);
             }
           }
           if(diff(towerOn.pixels,settledPixels))
             towerSecondRenderErrors++;
         }
       }
       // Isolate the NEW two-depth central ogival gables. The first
       // curtain and both tower stages remain enabled during every
       // frame of this independent source/GPU comparison.
       let centralSourceChanged=0,centralVisibleCells=0,
         centralGpuChanged=0,centralRestoreErrors=0,
         centralSourceRestoreErrors=0,centralFocus=null;
       {
         const cOn=snapshot(true,true,true);
         const cOff=snapshot(true,true,false);
         const cRest=snapshot(true,true,true);
         if(gothic.features.castle.centralBrokenGables!==onCentral)
           throw Error('Central Gothic rebuild failed');
         const a=cOn.source,b=cOff.source;
         const columns=new Uint32Array(a.width);
         const changedRows=[];
         for(let k=0;k<a.lum.length;k++){
           if(Math.abs(a.lum[k]-b.lum[k])<.01&&
              a.glyph[k]===b.glyph[k]&&
              Math.abs(a.dep[k]-b.dep[k])<1)continue;
           const cx=a.left+k%a.width,cy=a.top+Math.floor(k/a.width);
           const localX=((cx+.5)*CW-cathedral.kx)/MS;
           if(Math.abs(localX)>220)continue;
           centralSourceChanged++;
           columns[k%a.width]++;
           changedRows.push(cy);
         }
         let best=0,colIndex=0;
         for(let k=0;k<columns.length;k++)
           if(columns[k]>best){best=columns[k];colIndex=k;}
         if(changedRows.length){
           changedRows.sort((a,b)=>a-b);
           // Center on middle altered row, not an unrelated lower ground
           // shadow or a roof tip outside the true mobile viewport.
           centralFocus={col:a.left+colIndex,
             row:changedRows[Math.floor(changedRows.length*.5)]};
           player.x=centralFocus.col;player.tx=player.x;
           player.y=centralFocus.row+VR*.4;player.ty=player.y;
           updateCamera(0,true);
           snapshot(true,true,true); // viewport warmup
           const focusedOn=snapshot(true,true,true);
           const focusedOff=snapshot(true,true,false);
           const focusedRest=snapshot(true,true,true);
           const visible=focusedOn.source.viewport;
           for(let k=0;k<focusedOn.source.lum.length;k++){
             const aa=focusedOn.source,bb=focusedOff.source;
             if(Math.abs(aa.lum[k]-bb.lum[k])<.01&&
                aa.glyph[k]===bb.glyph[k]&&
                Math.abs(aa.dep[k]-bb.dep[k])<1)continue;
             const cx=aa.left+k%aa.width,cy=aa.top+Math.floor(k/aa.width),
               localX=((cx+.5)*CW-cathedral.kx)/MS;
             if(Math.abs(localX)<=220&&cx>=visible[0]&&
                cx<=visible[1]&&cy>=visible[2]&&cy<=visible[3])
               centralVisibleCells++;
             if(Math.abs(aa.lum[k]-focusedRest.source.lum[k])>.01||
                aa.glyph[k]!==focusedRest.source.glyph[k]||
                Math.abs(aa.dep[k]-focusedRest.source.dep[k])>1)
               centralSourceRestoreErrors++;
           }
           for(let k=0;k<focusedOn.pixels.length;k+=4){
             const delta=(l,r)=>Math.max(
               Math.abs(l[k]-r[k]),Math.abs(l[k+1]-r[k+1]),
               Math.abs(l[k+2]-r[k+2]))>8;
             if(delta(focusedOn.pixels,focusedOff.pixels))
               centralGpuChanged++;
             if(delta(focusedOn.pixels,focusedRest.pixels))
               centralRestoreErrors++;
           }
         }
       }
       if(!gothic.centralGableEnabled||
          !gothic.centralGablePortalClear||!gothic.centralGableProjects)
         throw Error('Central relief not restored or portal not clear');
       return {changedPixels:changed,restoreErrors,
         centralSourceChanged,centralVisibleCells,
         centralGpuChanged,centralRestoreErrors,
         centralSourceRestoreErrors,centralFocus,
         onCentral,offCentral,restoredCentral,
         towerChanged,towerFocus,towerVisibleCells,
         towerGpuChanged,towerRestoreErrors,towerSourceRestoreErrors,
         towerSecondRenderErrors,towerRestoreBounds,
         onTowers,offTowers,restoredTowers,
         sourceChanged,sourceVisibleChanged,sourceVisibleAfterFocus,
         sourceChangedBounds,sourceFocusCol,
         warmupToOn,offToRestored,
         onFeatures,offFeatures,restoredFeatures,
         canvas:[canvas.width,canvas.height],
         portalClear:gothic.westPortalReliefClear,
         projects:gothic.westCurtainProjects,
         mapUnchanged:true};
     }finally{
       Math.random=oldRandom;
       if(!gothic.facadeEnabled||!gothic.outerTowerReliefEnabled||
          !gothic.centralGableEnabled){
         gothic.setFacadeEnabledForTest(true);
         gothic.setOuterTowerReliefEnabledForTest(true);
         gothic.setCentralGableEnabledForTest(true);
         build();
       }
     }
   });
   await page.screenshot({path:path.join(dir,mode+'-castle-tracery.png'),
     timeout:60000});
   if(comparison.centralSourceChanged<70||
      comparison.centralVisibleCells<30||
      comparison.centralGpuChanged<(mobile?30:100)||
      comparison.centralRestoreErrors>120||
      comparison.centralSourceRestoreErrors!==0||
      comparison.towerChanged<100||comparison.towerVisibleCells<40||
      comparison.towerGpuChanged<(mobile?30:100)||
      comparison.towerRestoreErrors>120||
      comparison.sourceChanged<100||comparison.sourceVisibleAfterFocus<100||
      comparison.changedPixels<(mobile?30:100)||
      comparison.restoreErrors>120)
     throw Error(mode+' castle geometry does not make stable visible GPU pixels '+JSON.stringify(comparison));
   console.log('NATIVE CASTLE CENTRAL GABLES VISIBLE '+mode+' '+JSON.stringify({
     centralSourceChanged:comparison.centralSourceChanged,
     centralVisibleCells:comparison.centralVisibleCells,
     centralGpuChanged:comparison.centralGpuChanged,
     centralRestoreErrors:comparison.centralRestoreErrors,
     centralSourceRestoreErrors:comparison.centralSourceRestoreErrors,
     centralFocus:comparison.centralFocus,
     onCentral:comparison.onCentral,offCentral:comparison.offCentral,
     restoredCentral:comparison.restoredCentral
   }));
   console.log('NATIVE CASTLE TOWERS VISIBLE '+mode+' '+JSON.stringify({
     towerChanged:comparison.towerChanged,
     towerVisibleCells:comparison.towerVisibleCells,
     towerGpuChanged:comparison.towerGpuChanged,
     towerRestoreErrors:comparison.towerRestoreErrors,
     towerSourceRestoreErrors:comparison.towerSourceRestoreErrors,
     towerSecondRenderErrors:comparison.towerSecondRenderErrors,
     towerRestoreBounds:comparison.towerRestoreBounds,
     onTowers:comparison.onTowers,
     offTowers:comparison.offTowers,
     focus:comparison.towerFocus
   }));
   console.log('NATIVE CASTLE TRACERY VISIBLE '+mode+' '+JSON.stringify(comparison));
   if(errors.length)throw Error(mode+' browser errors '+errors.join(' | '));
   console.log('NATIVE CASTLE TRACERY PASS '+mode+' '+JSON.stringify(stats));
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
