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
     '/experiments/three/native.html?edit=0',
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
   if(errors.length)throw Error(mode+' browser errors '+errors.join(' | '));
   console.log('NATIVE CASTLE TRACERY PASS '+mode+' '+JSON.stringify(stats));
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
