// Original-source-driven animated Three knight is an opt-in, same-GPU inset.
// Check desktop/phone, direction, walking, jumping, source map and disposal.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const shots=path.join(process.cwd(),'shots','three-knight');
fs.mkdirSync(shots,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
  for(const mobile of [false,true]){
   const name=mobile?'phone':'desktop';
   const context=await browser.newContext({
    viewport:mobile?{width:390,height:844}:{width:1100,height:740},
    deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile
   });
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.stack||e.message));
   const res=await page.goto(base.replace(/\/$/,'')+
    '/experiments/three/?parityTest=1',{waitUntil:'domcontentloaded'});
   if(!res?.ok())throw Error('Author 3D rig preview failed to load');
   await page.waitForFunction(()=>window.__ASCII_PARITY__?.ready,undefined,{timeout:90000});
   const before=await page.evaluate(()=>({
     map:JSON.stringify(window.__ASCII_PARITY__.map),
     canvases:document.querySelectorAll('canvas').length
   }));
   await page.evaluate(()=>{
     const p=window.__ASCII_PARITY__;
     p.freezeForTest();
     p.captureReferenceForTest();
     p.captureThreeForTest();
   });
   await page.addStyleTag({content:'.hud,.stats,#parity-toolbar,.ed,.ed-open{visibility:hidden!important}'});
   await page.screenshot({path:path.join(shots,name+'-base.png'),animations:'disabled'});
   if(!await page.evaluate(()=>window.__ASCII_PARITY__.setKnightMode(true)))
     throw Error('Source-driven native knight rig mode refused');
   await page.evaluate(()=>window.__ASCII_PARITY__.captureThreeForTest());
   const active=await page.evaluate(()=>({
     ...window.__ASCII_PARITY__.liveArchitecture,
     map:JSON.stringify(window.__ASCII_PARITY__.map),
     canvases:document.querySelectorAll('canvas').length,
     player:window.__ASCII_PARITY__.playerLocation
   }));
   if(!active.active||!active.knightRig||active.knightMeshes<25||
      !active.knightActorFoot||!active.knightNativePosition||
      active.map!==before.map||active.canvases!==before.canvases)
     throw Error('Real source-controlled rig is not in shared WebGL render '+JSON.stringify(active));
   await page.screenshot({path:path.join(shots,name+'-rig.png'),animations:'disabled'});
   // Physically drive the source movement/rig with original input.
   await page.keyboard.down('w');
   const motions=[];
   for(let i=0;i<4;i++){
     const frame=await page.evaluate(()=>window.__ASCII_PARITY__.advanceThreeForTest(.05));
     if(!frame||!frame.feet)throw Error('Live source 3D tracking stopped');
     motions.push(frame);
   }
   await page.keyboard.up('w');
   const jumped=await page.evaluate(()=>window.__ASCII_PARITY__.advanceThreeForTest(.05,'jump'));
   if(!(jumped.jump>0)||!['jump','walk','run'].includes(jumped.motion))
      throw Error('Knight did not receive original jump state '+JSON.stringify(jumped));
   if(motions.every(s=>s.player[1]===motions[0].player[1]))
      throw Error('Test movement had no effect on original real player');
   await page.screenshot({path:path.join(shots,name+'-rig-jump.png'),animations:'disabled'});
   if(!await page.evaluate(()=>window.__ASCII_PARITY__.setKnightMode(false)))
     throw Error('Could not disable source-driven knight');
   const restored=await page.evaluate(()=>({
     rig:window.__ASCII_PARITY__.liveArchitecture?.knightRig||false,
     map:JSON.stringify(window.__ASCII_PARITY__.map),
     canvases:document.querySelectorAll('canvas').length,
     mode:window.__ASCII_PARITY__.mode
   }));
   if(restored.rig||restored.map!==before.map||
      restored.canvases!==before.canvases||restored.mode!=='three')
     throw Error('Native rig GPU resources not detached '+JSON.stringify(restored));
   if(errors.length)throw Error('Three source rig browser exceptions '+errors.join('\n'));
   console.log(name.toUpperCase()+' SOURCE KNIGHT 3D PASS '+JSON.stringify({
     bodyMeshes:active.knightMeshes,sourceMapUnchanged:true,
     sourceFoot:active.knightActorFoot,walkUpdated:true,jumpReceived:true,
     extraCanvasContexts:0,disposed:true
   }));
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
