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
     window.__ASCII_NATIVE__.frameCount>3,undefined,{timeout:120000});
   const stats=await page.evaluate(()=>{
     const game=window.__ASCII_NATIVE__,gothic=window.__ASCII_NATIVE_COMPLETE_ARCH__;
     const source=JSON.stringify(MEADOW_MAP);
     if(game.mode!=='three')throw Error('Three native not running');
     if(!gothic.westPortalReliefClear)
       throw Error('New Gothic solids cross protected central facade |x|<300');
     if(!gothic.westCurtainProjects)
       throw Error('Gothic canopies hidden behind source gatehouse rather than projecting ahead of curtain');
     const c=gothic.features.castle;
     if(c.portalSideTracery<52||!c.rose||!c.portal||!c.buttresses)
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
   await page.screenshot({path:path.join(dir,mode+'-castle-tracery.png'),
     timeout:60000});
   const comparison=await page.evaluate(()=>{
     const gothic=window.__ASCII_NATIVE_COMPLETE_ARCH__;
     const native=window.__ASCII_NATIVE__;
     const mapOriginal=JSON.stringify(MEADOW_MAP);
     const gl=native.renderer.getContext(),canvas=native.renderer.domElement;
     const oldRandom=Math.random;
     function snapshot(enabled){
       if(!gothic.setFacadeEnabledForTest(enabled))
         throw Error('Test-only castle geometry toggle is inaccessible');
       // Rebuild the actual authored raycast solids and source flora for
       // EACH state; a static rectangle or fake UV overlay cannot pass.
       buildWorld();
       placeFlora();
       updateCamera(0,true);
       render();
       const out=new Uint8Array(canvas.width*canvas.height*4);
       gl.readPixels(0,0,canvas.width,canvas.height,
         gl.RGBA,gl.UNSIGNED_BYTE,out);
       return out;
     }
     try{
       // Fog banks otherwise have new random seeds on each rebuild.
       // Freeze this source of timing noise, not the user's world map.
       Math.random=()=>.513;
       const on=snapshot(true);
       const off=snapshot(false);
       const restored=snapshot(true);
       let changed=0,restoreErrors=0;
       for(let i=0;i<on.length;i+=4){
         if(Math.max(Math.abs(on[i]-off[i]),
           Math.abs(on[i+1]-off[i+1]),
           Math.abs(on[i+2]-off[i+2]))>8)changed++;
         if(Math.max(Math.abs(on[i]-restored[i]),
           Math.abs(on[i+1]-restored[i+1]),
           Math.abs(on[i+2]-restored[i+2]))>8)restoreErrors++;
       }
       if(!gothic.westCurtainProjects||!gothic.westPortalReliefClear||
          !gothic.facadeEnabled)
         throw Error('Castle features not physically restored');
       if(JSON.stringify(MEADOW_MAP)!==mapOriginal)
         throw Error('QA-only castle rebuild touched authored map');
       return {changedPixels:changed,restoreErrors,
         canvas:[canvas.width,canvas.height],
         portalClear:gothic.westPortalReliefClear,
         projects:gothic.westCurtainProjects,
         mapUnchanged:true};
     }finally{
       Math.random=oldRandom;
       if(!gothic.facadeEnabled){
         gothic.setFacadeEnabledForTest(true);
         buildWorld();placeFlora();
       }
     }
   });
   if(comparison.changedPixels<(mobile?30:100)||
      comparison.restoreErrors>120)
     throw Error(mode+' castle geometry does not make stable visible GPU pixels '+JSON.stringify(comparison));
   console.log('NATIVE CASTLE TRACERY VISIBLE '+mode+' '+JSON.stringify(comparison));
   if(errors.length)throw Error(mode+' browser errors '+errors.join(' | '));
   console.log('NATIVE CASTLE TRACERY PASS '+mode+' '+JSON.stringify(stats));
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
