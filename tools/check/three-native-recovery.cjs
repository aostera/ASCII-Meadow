// Native renderer survival: lose WebGL2 while the game runs, retain gameplay
// on the separate source Canvas2D surface, restore Three and the source atlas.
// Desktop and simulated iPhone run Chromium SwiftShader. Physical Safari
// remains a separate acceptance step.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const shots=path.join(process.cwd(),'shots','three-native-recovery');
fs.mkdirSync(shots,{recursive:true});
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
   const page=await context.newPage();
   const errors=[];
   page.on('pageerror',e=>errors.push(e.stack||e.message));
   const res=await page.goto(
     (base.endsWith('/')?base.slice(0,-1):base)+
     '/experiments/three/native.html?edit=0',
     {waitUntil:'domcontentloaded'});
   if(!res?.ok())throw Error(label+': no native game HTTP response');
   await page.waitForFunction(()=>window.__ASCII_NATIVE__?.ready&&
     window.__ASCII_NATIVE__.mode==='three'&&
     window.__ASCII_NATIVE__.frameCount>5,
     undefined,{timeout:120000});
   const before=await page.evaluate(()=>{
     const n=window.__ASCII_NATIVE__,gl=n.renderer.getContext();
     const ext=gl.getExtension('WEBGL_lose_context');
     if(!ext)throw Error('WEBGL_lose_context unavailable');
     window.__nativeTestExtension=ext;
     return {map:JSON.stringify(MEADOW_MAP),
       player:[player.x,player.y],size:[W,H],
       backendCanvas:n.renderer.domElement,
       atlasSize:[GB.atlasCv.width,GB.atlasCv.height],
       frames:n.frameCount,contexts:
         [...document.querySelectorAll('canvas')].filter(c=>c===n.renderer.domElement).length};
   });
   if(before.contexts!==1)throw Error(label+': native GPU surface absent');
   await page.evaluate(()=>window.__nativeTestExtension.loseContext());
   await page.waitForFunction(()=>{
     const n=window.__ASCII_NATIVE__;
     return n?.recovery.contextLostCount===1 &&
       n.mode==='canvas2d' && n.recovery.runningOnFallback &&
       getComputedStyle(document.getElementById('g')).visibility==='visible' &&
       getComputedStyle(n.renderer.domElement).display==='none';
   },undefined,{timeout:45000});
   const first=await page.evaluate(()=>window.__ASCII_NATIVE__.recovery.fallbackFrames);
   await page.waitForFunction(count=>
     window.__ASCII_NATIVE__?.recovery.fallbackFrames>count+2,
     first,{timeout:90000});
   const middle=await page.evaluate(()=>{
     const g=GL.ctx2;
     const d=g.getImageData(0,0,Math.min(40,g.canvas.width),
       Math.min(40,g.canvas.height)).data;
     let max=0;
     for(let i=0;i<d.length;i+=4)max=Math.max(max,d[i]);
     return {mode:window.__ASCII_NATIVE__.mode,
       gpuLost:window.__ASCII_NATIVE__.renderer.getContext().isContextLost(),
       frames:window.__ASCII_NATIVE__.recovery.fallbackFrames,
       originalMap:JSON.stringify(MEADOW_MAP),
       canvasVisible:getComputedStyle(document.getElementById('g')).visibility,
       fallbackPixelMax:max};
   });
   if(!middle.gpuLost||middle.fallbackPixelMax<10||
      middle.originalMap!==before.map||middle.mode!=='canvas2d')
     throw Error(label+': fallback lost world '+JSON.stringify(middle));
   await page.screenshot({
     path:path.join(shots,label+'-during-gpu-loss.png'),timeout:60000
   });
   await page.evaluate(()=>window.__nativeTestExtension.restoreContext());
   await page.waitForFunction(()=>{
     const n=window.__ASCII_NATIVE__;
     return n?.recovery.contextRestoredCount===1 &&
       n.mode==='three' && n.recovery.hasGpu &&
       getComputedStyle(document.getElementById('g')).visibility==='hidden' &&
       getComputedStyle(n.renderer.domElement).display==='block' &&
       n.stats?.glyphs>1000&&n.frameCount>8;
   },undefined,{timeout:90000});
   // The Safari resume listeners must not rebuild world coordinates or atlas.
   await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
   await page.waitForFunction(()=>window.__ASCII_NATIVE__.stats?.drawCalls>0,
     undefined,{timeout:90000});
   const after=await page.evaluate(()=>{
     const n=window.__ASCII_NATIVE__;
     return {mode:n.mode,recovery:n.recovery,frames:n.frameCount,
       atlasSize:[GB.atlasCv.width,GB.atlasCv.height],
       map:JSON.stringify(MEADOW_MAP),
       contexts:[...document.querySelectorAll('canvas')].filter(c=>
         c===n.renderer.domElement).length,
       glyphs:n.stats.glyphs,drawCalls:n.stats.drawCalls,
       sourceOverlay:document.getElementById('c').width>0};
   });
   if(after.mode!=='three'||after.map!==before.map||
      JSON.stringify(after.atlasSize)!==JSON.stringify(before.atlasSize)||
      after.contexts!==1||after.drawCalls<1||!after.sourceOverlay||
      after.recovery.fallbackFrames<3)
     throw Error(label+': WebGL context did not fully recover '+JSON.stringify(after));
   await page.screenshot({
     path:path.join(shots,label+'-after-gpu-restoration.png'),timeout:60000
   });
   if(errors.length)throw Error(label+' script errors: '+errors.join('; '));
   console.log('NATIVE WEBGL SUSPEND/RESUME PASS '+label+
     ' '+JSON.stringify({
       lost:after.recovery.contextLostCount,
       restored:after.recovery.contextRestoredCount,
       fallbackFrames:after.recovery.fallbackFrames,
       nativeFrames:after.frames,glyphs:after.glyphs,
       atlasUnchanged:true,mapUnchanged:true,
       singleGpuContext:true
     }));
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
