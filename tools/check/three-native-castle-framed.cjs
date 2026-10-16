// T02 source-aware full-silhouette art QA from the actual native game.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const root=(process.argv[2]||'http://127.0.0.1:8181').replace(/\/$/,'');
const dir=path.join(process.cwd(),'shots','three-native-castle-framed');
fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
  for(const mobile of [false,true]){
   const label=mobile?'phone':'desktop';
   const ctx=await browser.newContext({
     viewport:mobile?{width:390,height:844}:{width:1100,height:740},
     deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile
   });
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.stack||e.message));
   const reply=await page.goto(root+
     '/experiments/three/native.html?edit=0&nativeCastleFramedTest=1',
     {waitUntil:'domcontentloaded'});
   if(!reply?.ok())throw Error('Native game not available');
   await page.waitForFunction(()=>window.__ASCII_NATIVE__?.ready&&
     window.__ASCII_NATIVE__.frameCount>4&&
     window.__ASCII_NATIVE_COMPLETE_ARCH__?.features?.castle?.centralBrokenGables>=30&&
     window.__ASCII_NATIVE_COMPLETE_ARCH__?.features?.castle?.highFlyingArches>=20&&
     window.__ASCII_NATIVE_COMPLETE_ARCH__?.features?.castle?.recessedMainPortal>=10,
     undefined,{timeout:120000});
   // Freeze the test page after its current RAF; production camera is untouched.
   await page.evaluate(()=>{window.requestAnimationFrame=()=>0});
   await page.waitForTimeout(150);
   const data=await page.evaluate(()=>{
     const c=cathedral,native=window.__ASCII_NATIVE__;
     const mapOriginal=JSON.stringify(MEADOW_MAP);
     const outline=window.__ASCII_NATIVE_COMPLETE_ARCH__;
     if(!outline.highFlyingArchesClear)throw Error('Flying arches cross the protected inner portal/nave');
     if(!outline.mainPortalRecessClear)throw Error('Gate recess is physically blocked or lost original door');
     if(native.mode!=='three'||editing||!c.cv)
       throw Error('Not in original playable Three mode');
     let n=0,x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
     // The source raycast raster includes all castle stones and spires.
     for(let y=0;y<c.BH;y++)for(let x=0;x<c.BW;x++){
       if(c.lum[y*c.BW+x]<0)continue;
       n++;
       x0=Math.min(x0,c.cx0+x);x1=Math.max(x1,c.cx0+x);
       y0=Math.min(y0,c.cy0+y);y1=Math.max(y1,c.cy0+y);
     }
     if(n<500)throw Error('Missing authored castle raster');
     const z=Math.min(.7,W*.84/((x1-x0+1)*CW),
       H*.84/((y1-y0+1)*CH));
     if(!(z>=.08&&z<=.7))throw Error('Cannot frame '+z);
     // Same source VZ and camera cropping used by the map editor;
     // this changes no production camera, object or render pipeline.
     VZ=z;
     camX=Math.max(0,Math.min(Math.max(0,COLS-VC/VZ),
       (x0+x1+1)/2-VC/(2*VZ)));
     camY=Math.max(0,Math.min(Math.max(0,ROWS-VR/VZ),
       (y0+y1+1)/2-VR/(2*VZ)));
     setView();cloudTick=2;render();
     const rect=[(x0-camX)*CW*VZ,(y0-camY)*CH*VZ,
       (x1+1-camX)*CW*VZ,(y1+1-camY)*CH*VZ];
     const margins=[rect[0],rect[1],W-rect[2],H-rect[3]];
     let visible=0;
     for(let y=0;y<c.BH;y++)for(let x=0;x<c.BW;x++){
       if(c.lum[y*c.BW+x]<0)continue;
       const cx=c.cx0+x,cy=c.cy0+y;
       if(cx>=VX0&&cx<=VX1&&cy>=VY0&&cy<=VY1)visible++;
     }
     const canvas=native.renderer.domElement;
     const result={
       viewport:[W,H],canvas:[canvas.width,canvas.height],
       sourceCells:n,visibleCells:visible,coverage:visible/n,
       largeFlyingSolids:outline.features.castle.highFlyingArches,
       zoom:VZ,withinEditorZoomRange:VZ>=.35,
       sourceBounds:[x0,y0,x1,y1],rect,margins,
       mode:native.mode,mapPreserved:mapOriginal===JSON.stringify(MEADOW_MAP),
       gameplayNotEditing:!editing,solids:solids.length,
       oneWebGLCanvas:document.querySelectorAll('#three-parity-canvas').length===1
     };
     if(result.coverage<.995||Math.min(...margins)<-1||
        !result.mapPreserved||!result.gameplayNotEditing||
        !result.oneWebGLCanvas)
       throw Error('Full castle still clipped / altered '+JSON.stringify(result));
     return result;
   });
   await page.screenshot({path:path.join(dir,label+'-full-hud.png'),timeout:60000});
   // Only in the second screenshot hide the actual DOM HUD, not the stones.
   await page.addStyleTag({content:'.hud,.stats{visibility:hidden!important}'});
   await page.evaluate(()=>{cloudTick=2;setView();render()});
   await page.screenshot({path:path.join(dir,label+'-full-clean.png'),timeout:60000});
   // Full-frame comparison is a REAL GPU on/off/on of ONLY the new
   // upper buttress wings. Earlier tracery, central gable and tower relief
   // stay enabled, so the difference isolates large-architecture legibility.
   const wingTest=await page.evaluate(()=>{
     const native=window.__ASCII_NATIVE__,arch=window.__ASCII_NATIVE_COMPLETE_ARCH__;
     const gl=native.renderer.getContext(),canvas=native.renderer.domElement;
     const original=JSON.stringify(MEADOW_MAP),oldRandom=Math.random;
     function snap(on){
       if(!arch.setHighFlyingArchesEnabledForTest(on))
         throw Error('Framed QA-only wing switch unavailable');
       build();setView();cloudTick=2;render();
       const p=new Uint8Array(canvas.width*canvas.height*4);
       gl.readPixels(0,0,canvas.width,canvas.height,
         gl.RGBA,gl.UNSIGNED_BYTE,p);
       return {p,n:arch.features.castle.highFlyingArches,
         lum:new Float32Array(cathedral.lum),
         dep:new Float32Array(cathedral.dep),
         glyph:new Int16Array(cathedral.glyph)};
     }
     try{
       Math.random=()=>.513;
       snap(true); // GPU/source warmup and cloud-phase synchronization
       const on=snap(true),off=snap(false),restored=snap(true);
       let pixels=0,restoreErrors=0,sourceCells=0,sourceRestoreErrors=0;
       for(let k=0;k<on.p.length;k+=4){
         const delta=(a,b)=>Math.max(Math.abs(a[k]-b[k]),
           Math.abs(a[k+1]-b[k+1]),Math.abs(a[k+2]-b[k+2]))>8;
         if(delta(on.p,off.p))pixels++;
         if(delta(on.p,restored.p))restoreErrors++;
       }
       if(on.lum.length!==off.lum.length||
          on.lum.length!==restored.lum.length)
         throw Error('Castle source array resized from ornament stage');
       for(let k=0;k<on.lum.length;k++){
         if(Math.abs(on.lum[k]-off.lum[k])>.01||
            on.glyph[k]!==off.glyph[k]||
            Math.abs(on.dep[k]-off.dep[k])>1)sourceCells++;
         if(Math.abs(on.lum[k]-restored.lum[k])>.01||
            on.glyph[k]!==restored.glyph[k]||
            Math.abs(on.dep[k]-restored.dep[k])>1)sourceRestoreErrors++;
       }
       const result={
         onSolids:on.n,offSolids:off.n,restoredSolids:restored.n,
         changedSourceCells:sourceCells,changedGPU: pixels,
         gpuRestoreErrors:restoreErrors,sourceRestoreErrors,
         sceneMapUnchanged:original===JSON.stringify(MEADOW_MAP),
         nativeMode:native.mode
       };
       if(on.n<20||off.n!==0||restored.n!==on.n||
          sourceCells<60||pixels<40||restoreErrors>120||
          sourceRestoreErrors!==0||!result.sceneMapUnchanged||
          result.nativeMode!=='three')
         throw Error('Physical large architecture not stable or not visible '+
           JSON.stringify(result));
       return result;
     }finally{
       Math.random=oldRandom;
       if(!arch.highFlyingArchesEnabled){
         arch.setHighFlyingArchesEnabledForTest(true);
         build();setView();cloudTick=2;render();
       }
     }
   });
   console.log('NATIVE CASTLE WINGS FULLFRAME '+label+' '+
     JSON.stringify(wingTest));
   // Compare at IDENTICAL native view with two actual PLAYER distances.
   // drawCathedral() deliberately fades distant masonry according to
   // player.y, independently from the viewport. Previous wide captures
   // kept the knight at world spawn, exaggerating the dark silhouette.
   // Do not change game fade formula/lighting globally: move only the
   // temporary test actor, then capture with original renderer.
   const near=await page.evaluate(()=>{
     const c=cathedral,beforePlayer={x:player.x,y:player.y},
       source=JSON.stringify(MEADOW_MAP);
     const fade=()=>{
       const far=Math.max(0,Math.min(1,
         ((player.y+.7)*CH-c.ky)/(H*2.4)));
       return {far,originalCastleAlpha:1-far*.55};
     };
     const distant=fade();
     const fixedCamera={x:camX,y:camY,z:VZ};
     player.x=c.kx/CW;player.y=c.ky/CH-16;
     player.tx=player.x;player.ty=player.y;
     const close=fade();
     // Camera is still the full-framed inspection view: no updateCamera()
     // call after player movement, since gameplay-follow movement would
     // defeat before/after art comparison.
     cloudTick=2;setView();render();
     const unchanged=JSON.stringify(MEADOW_MAP)===source&&
       camX===fixedCamera.x&&camY===fixedCamera.y&&VZ===fixedCamera.z;
     if(!unchanged||close.originalCastleAlpha<distant.originalCastleAlpha)
       throw Error('Distance-controlled screenshot changed map/camera or fade');
     return {distant,close,beforePlayer,
       nearPlayer:{x:player.x,y:player.y},
       mapAndCameraUnchanged:unchanged};
   });
   await page.screenshot({path:path.join(dir,label+'-full-near-clean.png'),
     timeout:60000});
   console.log('NATIVE CASTLE DISTANCE COMPARISON '+label+' '+
     JSON.stringify(near));
   // A full 13-14% silhouette shot is useful for coverage but too small
   // for reading masonry, while the authored editor already has 35% zoom.
   // Inspect the upper central towers, flank wings and great gate at the
   // EXISTING editor stop (0.35), again using the native source renderer.
   const mediumViews=[
     {id:'upper-center',fx:.5,fy:.22},
     {id:'upper-left',fx:.29,fy:.30},
     {id:'upper-right',fx:.71,fy:.30},
     {id:'gate-and-rose',fx:.5,fy:.76}
   ];
   const mediumMetrics=[];
   for(const view of mediumViews){
     const metrics=await page.evaluate(({fx,fy,id})=>{
       const b=cathedral,z=.35;
       const source=JSON.stringify(MEADOW_MAP);
       const full=[b.cx0,b.cy0,b.cx0+b.BW-1,b.cy0+b.BH-1];
       const cx=full[0]+(full[2]-full[0])*fx;
       const cy=full[1]+(full[3]-full[1])*fy;
       VZ=z;camX=Math.max(0,Math.min(Math.max(0,COLS-VC/VZ),
         cx-VC/(2*VZ)));
       camY=Math.max(0,Math.min(Math.max(0,ROWS-VR/VZ),
         cy-VR/(2*VZ)));
       setView();cloudTick=2;render();
       let occupied=0;
       for(let k=0;k<b.lum.length;k++){
         if(b.lum[k]<0)continue;
         const x=b.cx0+(k%b.BW),y=b.cy0+Math.floor(k/b.BW);
         if(x>=VX0&&x<=VX1&&y>=VY0&&y<=VY1)occupied++;
       }
       const data={id,zoom:VZ,camera:[camX,camY],
         view:[VX0,VY0,VX1,VY1],sourceOccupiedInView:occupied,
         mapUnchanged:source===JSON.stringify(MEADOW_MAP),
         threeMode:window.__ASCII_NATIVE__.mode};
       if(data.zoom!==.35||occupied<500||!data.mapUnchanged||
          data.threeMode!=='three')
         throw Error('Medium castle art viewport invalid '+JSON.stringify(data));
       return data;
     },view);
     await page.screenshot({
       path:path.join(dir,label+'-medium-'+view.id+'.png'),timeout:60000
     });
     mediumMetrics.push(metrics);
   }
   // T02 acceptance must also include what the PLAYER ACTUALLY SEES at
   // game zoom 1.0 and the original follow camera, not only inspector
   // panoramas (0.13) / editor zoom (0.35). All three shots use actual
   // traversable map coordinates, normal camera and the native renderer.
   await page.addStyleTag({
     content:'.hud,.stats{visibility:visible!important}'
   });
   const gameplayViews=[
     {id:'road-approach',distanceFactor:.85,sideFactor:0},
     {id:'gate-threshold',distanceFactor:.30,sideFactor:0},
     {id:'outer-arch-angle',distanceFactor:.52,sideFactor:.22}
   ];
   const gameplayMetrics=[];
   for(const target of gameplayViews){
     const metrics=await page.evaluate(({id,distanceFactor,sideFactor})=>{
       const c=cathedral,oldMap=JSON.stringify(MEADOW_MAP);
       const expectedSource=cathedral.lum.length;
       const originalData={
         cameraZoom:VZ,playerX:player.x,playerY:player.y,
         userEditing:editing
       };
       // Search for an ACTUAL walkable point near the gate route. The
       // knight is never staged inside a solid facade just for a nice shot.
       const desiredY=c.gateRow+Math.max(6,VR*distanceFactor);
       const desiredX=c.kx/CW+VC*sideFactor;
       let placed=null;
       for(let oy=0;oy<=65&&!placed;oy++){
         for(const dy of (oy===0?[0]:[oy,-oy])){
           const y=desiredY+dy;
           for(const ox of [0,-3,3,-7,7,-13,13,-20,20]){
             const x=desiredX+ox,h=surfAt(x,y);
             if(!Number.isFinite(h))continue;
             const oldHT=player.hT;player.hT=h;
             const ok=!blocked(x,y,player);
             player.hT=oldHT;
             if(ok){placed={x,y,h};break}
           }
           if(placed)break;
         }
       }
       if(!placed)throw Error('No traversable gameplay player spot '+id);
       player.x=placed.x;player.y=placed.y;
       player.tx=placed.x;player.ty=placed.y;
       player.h=placed.h;player.hT=placed.h;
       VZ=1;
       updateCamera(0,true); // exact original follow-camera, no QA pan
       cloudTick=2;render();
       let sourceVisible=0,sourceTotal=0;
       for(let k=0;k<c.lum.length;k++){
         if(c.lum[k]<0)continue;
         sourceTotal++;
         const x=c.cx0+k%c.BW,y=c.cy0+Math.floor(k/c.BW);
         if(x>=VX0&&x<=VX1&&y>=VY0&&y<=VY1)
           sourceVisible++;
       }
       const far=Math.max(0,Math.min(1,
         ((player.y+.7)*CH-c.ky)/(H*2.4)));
       const result={
         id,viewport:[W,H],originalPlayer:originalData,
         knight:[placed.x,placed.y],walkable:!blocked(player.x,player.y,player),
         originalCastleAlpha:1-far*.55,originalFarFactor:far,
         zoom:VZ,followCamera:[camX,camY],
         visibleWindow:[VX0,VY0,VX1,VY1],
         sourceStoneCellsVisible:sourceVisible,
         sourceStoneCellsTotal:sourceTotal,
         glyphCount:GB.n,
         sourceGridLengthUnchanged:cathedral.lum.length===expectedSource,
         mapUnchanged:JSON.stringify(MEADOW_MAP)===oldMap,
         oneWebGLCanvas:document.querySelectorAll('#three-parity-canvas').length===1,
         nativeThree:window.__ASCII_NATIVE__.mode==='three'
       };
       if(!result.walkable||VZ!==1||sourceVisible<100||
         !result.sourceGridLengthUnchanged||!result.mapUnchanged||
         !result.oneWebGLCanvas||!result.nativeThree||result.glyphCount<500)
         throw Error('Actual playable Gothic art view invalid '+
           JSON.stringify(result));
       return result;
     },target);
     await page.screenshot({
       path:path.join(dir,label+'-gameplay-'+target.id+'-hud.png'),
       timeout:60000
     });
     await page.addStyleTag({
       content:'.hud,.stats{visibility:hidden!important}'
     });
     await page.evaluate(()=>{cloudTick=2;render()});
     await page.screenshot({
       path:path.join(dir,label+'-gameplay-'+target.id+'-clean.png'),
       timeout:60000
     });
     await page.addStyleTag({
       content:'.hud,.stats{visibility:visible!important}'
     });
     gameplayMetrics.push(metrics);
   }
   // Audit REAL convex source raycast at the carved great-portal.
   // The map's gatehouse uses meta.door on a full 320-wide masonry box;
   // a dark carved doorway does NOT by itself remove its physics or depth.
   // Cast along EXACT original baked cathedral camera rays (same PITCH)
   // and record which real stone is in FRONT of the projected entrance.
   const portalAudit=await page.evaluate(()=>{
     const c=cathedral,saved=JSON.stringify(MEADOW_MAP);
     const frontFace=c.kx,gateFrontZ=100,Y=120;
     const rows=[45,95,155,215,285,335];
     const positions=[-90,-55,-20,0,20,55,90];
     const samples=[];
     for(const h of rows)for(const x of positions){
       const y=Y+h;
       const sx=c.kx+x*MS,sy=c.ky-(y*COSP+gateFrontZ*SINP)*MS;
       const px=(sx-c.kx)/MS,py=-(sy-c.ky)/MS*COSP,
         pz=-(sy-c.ky)/MS*SINP;
       const ox=px,oy=py+6000*SINP,oz=pz-6000*COSP;
       const ray=cast(ox,oy,oz,0,-SINP,COSP,0,
         BINS.view(px,py,pz));
       const so=ray?.so;
       const actual=ray?[
         ox,oy-ray.t*SINP,oz+ray.t*COSP
       ]:null;
       const portalTexture=pointedArch(x,y,0,150,Y,290);
       samples.push({x,height:h,screenCell:[
           Math.round(sx/CW),Math.round(sy/CH)
         ],intendedDoor:portalTexture,
         hit:so?{id:so.id,kind:so.kind,
           bb:so.bb.map(v=>Math.round(v*100)/100),
           isDoorTextured:Boolean(so.meta?.door),
           physicalPosition:actual?.map(v=>Math.round(v*10)/10)}:null});
     }
     const intended=samples.filter(s=>s.intendedDoor);
     const obstructed=intended.filter(s=>s.hit);
     const nearGate=intended.filter(s=>s.hit?.isDoorTextured);
     const curtain=intended.filter(s=>s.hit?.bb?.[4]>=135&&
       s.hit?.bb?.[5]<=210);
     const result={
       sampleCount:samples.length,intendedDoorSamples:intended.length,
       solidFrontHits:obstructed.length,texturedSolidHits:nearGate.length,
       innerCurtainHits:curtain.length,samples,
       mapUnchanged:saved===JSON.stringify(MEADOW_MAP),
       oneContext:document.querySelectorAll('#three-parity-canvas').length===1,
       nativeMode:window.__ASCII_NATIVE__.mode
     };
     if(intended.length<8||!result.mapUnchanged||!result.oneContext||
        result.nativeMode!=='three')
       throw Error('Invalid physical portal ray audit '+JSON.stringify(result));
     return result;
   });
   // The difference must be made by a real physical carve, not a
   // screen-space dark decal or an always-hidden solid. Compare the same
   // 100% playable gate-follow-camera before/after in one native WebGL2
   // context; replay source on/off/on and demand bitwise restoration.
   const gatePoint=gameplayMetrics.find(x=>x.id==='gate-threshold').knight;
   const portalRun=await page.evaluate(point=>{
     const arch=window.__ASCII_NATIVE_COMPLETE_ARCH__,
       native=window.__ASCII_NATIVE__,oldRandom=Math.random;
     const gl=native.renderer.getContext(),canvas=native.renderer.domElement;
     const originalMap=JSON.stringify(MEADOW_MAP);
     player.x=point[0];player.y=point[1];
     player.tx=point[0];player.ty=point[1];
     player.hT=player.h=surfAt(point[0],point[1]);
     Math.random=()=>.513;
     window.__ASCII_PORTAL_GATE_SHOTS__={};
     window.__ASCII_PORTAL_QA_MAP__=originalMap;
     function snapshot(enabled){
       if(!arch.setMainPortalRecessEnabledForTest(enabled))
         throw Error('Scoped carved-portal switch unavailable');
       build();VZ=1;updateCamera(0,true);cloudTick=2;render();
       const pix=new Uint8Array(canvas.width*canvas.height*4);
       gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,
         gl.UNSIGNED_BYTE,pix);
       return {pixels:pix,source:{
         lum:new Float32Array(cathedral.lum),
         glyph:new Int16Array(cathedral.glyph),
         dep:new Float32Array(cathedral.dep)},
         pieces:arch.features.castle.recessedMainPortal,
         clear:arch.mainPortalRecessClear,
         walkable:!blocked(player.x,player.y,player),
         single:document.querySelectorAll('#three-parity-canvas').length===1,
         three:native.mode==='three'};
     }
     try{
       const on=snapshot(true);
       // Native page screenshot is taken from Playwright after this
       // evaluation; maintain same frozen gameplay viewport and player.
       window.__ASCII_PORTAL_GATE_SHOTS__.on=on;
       return {enabled:on.pieces,clear:on.clear,walkable:on.walkable,
         nativeThree:on.three,oneCanvas:on.single,
         pixels:on.pixels.length,
         mapUnchanged:originalMap===JSON.stringify(MEADOW_MAP)};
     }finally{Math.random=oldRandom}
   },gatePoint);
   if(portalRun.enabled<10||!portalRun.clear||
     !portalRun.walkable||!portalRun.nativeThree||
     !portalRun.oneCanvas||!portalRun.mapUnchanged)
     throw Error('Recessed portal first gameplay state invalid '+
       JSON.stringify(portalRun));
   await page.screenshot({
     path:path.join(dir,label+'-portal-recess-on-gameplay.png'),
     timeout:60000});
   await page.evaluate(()=>{
     const arch=window.__ASCII_NATIVE_COMPLETE_ARCH__;
     arch.setMainPortalRecessEnabledForTest(false);
     const randomWas=Math.random;Math.random=()=>.513;
     try{build();VZ=1;updateCamera(0,true);cloudTick=2;render()}
     finally{Math.random=randomWas}
     const native=window.__ASCII_NATIVE__,gl=native.renderer.getContext(),
       canvas=native.renderer.domElement;
     const pixels=new Uint8Array(canvas.width*canvas.height*4);
     gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,
       gl.UNSIGNED_BYTE,pixels);
     window.__ASCII_PORTAL_GATE_SHOTS__.off={
       pixels,source:{lum:new Float32Array(cathedral.lum),
       glyph:new Int16Array(cathedral.glyph),
       dep:new Float32Array(cathedral.dep)},
       pieces:arch.features.castle.recessedMainPortal,
       walkable:!blocked(player.x,player.y,player)};
   });
   await page.screenshot({
     path:path.join(dir,label+'-portal-recess-off-gameplay.png'),
     timeout:60000});
   const portalDelta=await page.evaluate(()=>{
     const arch=window.__ASCII_NATIVE_COMPLETE_ARCH__;
     arch.setMainPortalRecessEnabledForTest(true);
     const randomWas=Math.random;Math.random=()=>.513;
     try{build();VZ=1;updateCamera(0,true);cloudTick=2;render()}
     finally{Math.random=randomWas}
     const native=window.__ASCII_NATIVE__,gl=native.renderer.getContext(),
       canvas=native.renderer.domElement;
     const pixels=new Uint8Array(canvas.width*canvas.height*4);
     gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,
       gl.UNSIGNED_BYTE,pixels);
     const A=window.__ASCII_PORTAL_GATE_SHOTS__.on,
       B=window.__ASCII_PORTAL_GATE_SHOTS__.off;
     let changedGPU=0,gpuRestoreErrors=0,sourceChanged=0,sourceRestoredErrors=0;
     for(let k=0;k<pixels.length;k+=4){
       const different=(a,b)=>
         Math.max(Math.abs(a[k]-b[k]),Math.abs(a[k+1]-b[k+1]),
           Math.abs(a[k+2]-b[k+2]))>8;
       if(different(A.pixels,B.pixels))changedGPU++;
       if(different(A.pixels,pixels))gpuRestoreErrors++;
     }
     const now={lum:new Float32Array(cathedral.lum),
       glyph:new Int16Array(cathedral.glyph),
       dep:new Float32Array(cathedral.dep)};
     for(let i=0;i<now.lum.length;i++){
       const different=(x,y)=>Math.abs(x.lum[i]-y.lum[i])>.01||
         x.glyph[i]!==y.glyph[i]||Math.abs(x.dep[i]-y.dep[i])>1;
       if(different(A.source,B.source))sourceChanged++;
       if(different(A.source,now))sourceRestoredErrors++;
     }
     const result={
       sourceChanged,gpuChanged:changedGPU,gpuRestoreErrors,
       sourceRestoredErrors,viewWindow:[VX0,VY0,VX1,VY1],
       onSolids:A.pieces,offSolids:B.pieces,
       restoredSolids:arch.features.castle.recessedMainPortal,
       roomAheadOfDoor:arch.mainPortalRecessClear,
       gateCollisionUnchanged:A.walkable===B.walkable,
       threeNative:native.mode==='three',
       originalMapUnchanged:JSON.stringify(MEADOW_MAP)===
         window.__ASCII_PORTAL_QA_MAP__
     };
     delete window.__ASCII_PORTAL_GATE_SHOTS__;
     delete window.__ASCII_PORTAL_QA_MAP__;
     if(!result.roomAheadOfDoor||result.onSolids<10||
        result.offSolids!==0||result.restoredSolids!==result.onSolids||
        !result.gateCollisionUnchanged||sourceChanged<100||
        gpuRestoreErrors>150||
        sourceRestoredErrors>0||!result.threeNative||
        !result.originalMapUnchanged)
       throw Error('Recessed portal not reproducible in genuine gameplay '+
         JSON.stringify(result));
     return result;
   });
   await page.screenshot({
     path:path.join(dir,label+'-portal-recess-restored-gameplay.png'),
     timeout:60000});
   // The TRUE follow camera crops off the physical doorway: on desktop
   // original doorway source cells are at rows 561..608, whereas the
   // legitimate gate player sees rows 630..737. Zero gameplay changed
   // pixels is therefore a VALID finding, not a passing art criterion.
   // Calculate the intersection from exact source-ray audit coordinates
   // instead of accidentally accepting a decorative object off-screen.
   const physicalDoorSamples=portalAudit.samples.filter(s=>s.intendedDoor);
   const v=portalDelta.viewWindow;
   portalDelta.doorRaySamplesInGameView=physicalDoorSamples.filter(s=>
     s.screenCell[0]>=v[0]&&s.screenCell[0]<=v[2]&&
     s.screenCell[1]>=v[1]&&s.screenCell[1]<=v[3]).length;
   portalDelta.doorRaySamplesTotal=physicalDoorSamples.length;
   portalDelta.gameCameraShowsPortal=
     portalDelta.doorRaySamplesInGameView>0;
   if(portalDelta.gpuChanged===0&&portalDelta.gameCameraShowsPortal)
     console.warn('Native gate visible samples lack GPU change: '+
       JSON.stringify(portalDelta));
   // Unlike gameplay VZ=1.0, the EXISTING map editor's 0.35 stop can
   // genuinely see the carved doorway. Match its exact logged camera
   // and take unmodified GPU frames before/after. These art inspection
   // screenshots must NEVER be labeled as normal follow-camera gameplay.
   const gateMedium=mediumMetrics.find(x=>x.id==='gate-and-rose');
   await page.evaluate(()=>{window.__ASCII_PORTAL_MEDIUM__={}});
   async function mediumShot(enabled,tag){
     const stats=await page.evaluate(({enabled,cam,tag})=>{
       const arch=window.__ASCII_NATIVE_COMPLETE_ARCH__;
       if(!arch.setMainPortalRecessEnabledForTest(enabled))
         throw Error('Medium QA-only recess switch missing');
       const originalRandom=Math.random;Math.random=()=>.513;
       try{
         build();VZ=.35;camX=cam[0];camY=cam[1];
         // The real fog field memoizes every second frame and would
         // otherwise reuse the PREVIOUS gameplay camera's fog texture
         // for the first medium snapshot. Refresh the original fog from
         // the exact same inspection camera on each QA pass only.
         setView();cloudTick=2;FG.tick=0;render();
       }finally{Math.random=originalRandom}
       const nat=window.__ASCII_NATIVE__,gl=nat.renderer.getContext(),
         can=nat.renderer.domElement,p=new Uint8Array(can.width*can.height*4);
       gl.readPixels(0,0,can.width,can.height,gl.RGBA,
         gl.UNSIGNED_BYTE,p);
       const result={pixels:p,parts:arch.features.castle.recessedMainPortal,
         camera:[camX,camY],zoom:VZ,view:[VX0,VY0,VX1,VY1],
         map:JSON.stringify(MEADOW_MAP)};
       window.__ASCII_PORTAL_MEDIUM__[tag]=result;
       return {parts:result.parts,zoom:result.zoom,view:result.view,
         single:document.querySelectorAll('#three-parity-canvas').length===1,
         three:nat.mode==='three'};
     },{enabled,cam:gateMedium.camera,tag});
     await page.screenshot({
       path:path.join(dir,label+'-portal-recess-'+tag+'-medium.png'),
       timeout:60000});
     return stats;
   }
   const mediumOn=await mediumShot(true,'on');
   const mediumOff=await mediumShot(false,'off');
   const mediumRestored=await mediumShot(true,'restored');
   const mediumDelta=await page.evaluate(()=>{
     const S=window.__ASCII_PORTAL_MEDIUM__,
       a=S.on.pixels,b=S.off.pixels,c=S.restored.pixels;
     let gpuChanged=0,gpuRestoreErrors=0;
     for(let k=0;k<a.length;k+=4){
       const delta=(x,y)=>Math.max(Math.abs(x[k]-y[k]),
         Math.abs(x[k+1]-y[k+1]),Math.abs(x[k+2]-y[k+2]))>8;
       if(delta(a,b))gpuChanged++;
       if(delta(a,c))gpuRestoreErrors++;
     }
     const result={gpuChanged,gpuRestoreErrors,
       sourceMapUnchanged:S.on.map===S.off.map&&S.on.map===S.restored.map,
       consistentCamera:JSON.stringify(S.on.camera)===JSON.stringify(S.off.camera)&&
         JSON.stringify(S.on.camera)===JSON.stringify(S.restored.camera),
       onCount:S.on.parts,offCount:S.off.parts,
       restoredCount:S.restored.parts};
     delete window.__ASCII_PORTAL_MEDIUM__;
     return result;
   });
   if(!mediumOn.three||!mediumOff.three||!mediumRestored.three||
     !mediumOn.single||!mediumOff.single||!mediumRestored.single||
     mediumOn.zoom!==.35||mediumDelta.gpuChanged<35||
     mediumDelta.gpuRestoreErrors>150||!mediumDelta.consistentCamera||
     !mediumDelta.sourceMapUnchanged||mediumDelta.onCount<10||
     mediumDelta.offCount!==0||mediumDelta.onCount!==mediumDelta.restoredCount)
     throw Error('Carved main gate not visible in REAL native 35% view '+
       JSON.stringify(mediumDelta));
   console.log('NATIVE CASTLE PORTAL MEDIUM ACTUAL GPU '+label+' '+
     JSON.stringify(mediumDelta));
   fs.writeFileSync(path.join(dir,label+'-portal-medium-delta.json'),
     JSON.stringify({gameplay:portalDelta,inspection:mediumDelta,
       note:'0.35 is source renderer editor/inspection zoom, NOT gameplay camera'},null,2)+'\n');
   fs.writeFileSync(path.join(dir,label+'-portal-recess-delta.json'),
     JSON.stringify(portalDelta,null,2)+'\n');
   console.log('NATIVE CASTLE PHYSICAL PORTAL RECESS '+label+' '+
     JSON.stringify(portalDelta));
   fs.writeFileSync(path.join(dir,label+'-portal-ray-audit.json'),
     JSON.stringify(portalAudit,null,2)+'\n');
   console.log('NATIVE CASTLE PORTAL RAY AUDIT '+label+' '+
     JSON.stringify({sampleCount:portalAudit.sampleCount,
       intendedDoorSamples:portalAudit.intendedDoorSamples,
       solidFrontHits:portalAudit.solidFrontHits,
       texturedSolidHits:portalAudit.texturedSolidHits,
       innerCurtainHits:portalAudit.innerCurtainHits,
       intended:portalAudit.samples.filter(p=>p.intendedDoor)
         .map(p=>({x:p.x,height:p.height,
           firstHit:p.hit?.id,box:p.hit?.bb}))}));
   fs.writeFileSync(path.join(dir,label+'-gameplay.json'),
     JSON.stringify(gameplayMetrics,null,2)+'\n');
   console.log('NATIVE CASTLE REAL GAMEPLAY ART '+label+' '+
     JSON.stringify(gameplayMetrics));
   fs.writeFileSync(path.join(dir,label+'-medium.json'),
     JSON.stringify({near,mediumMetrics},null,2)+'\n');
   console.log('NATIVE CASTLE MEDIUM INSPECTION '+label+' '+
     JSON.stringify(mediumMetrics));
   fs.writeFileSync(path.join(dir,label+'-framing.json'),
     JSON.stringify(data,null,2)+'\n');
   if(errors.length)throw Error(label+' browser exception '+errors.join(' | '));
   console.log('NATIVE FULL CASTLE FRAME '+label+' '+JSON.stringify(data));
   await ctx.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
