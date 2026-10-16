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
     window.__ASCII_NATIVE_COMPLETE_ARCH__?.features?.castle?.highFlyingArches>=20,
     undefined,{timeout:120000});
   // Freeze the test page after its current RAF; production camera is untouched.
   await page.evaluate(()=>{window.requestAnimationFrame=()=>0});
   await page.waitForTimeout(150);
   const data=await page.evaluate(()=>{
     const c=cathedral,native=window.__ASCII_NATIVE__;
     const mapOriginal=JSON.stringify(MEADOW_MAP);
     const outline=window.__ASCII_NATIVE_COMPLETE_ARCH__;
     if(!outline.highFlyingArchesClear)throw Error('Flying arches cross the protected inner portal/nave');
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
