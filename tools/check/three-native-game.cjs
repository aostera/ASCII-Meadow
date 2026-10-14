// Full-world native Three runtime QA. No old GPU: original game simulation,
// artist map and editor, one Three WebGL2 canvas, independent 2D fallback.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const output=path.join(process.cwd(),'shots','three-native-game');
fs.mkdirSync(output,{recursive:true});
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
     '/experiments/three/native.html?edit=0',
     {waitUntil:'domcontentloaded'});
   if(!res?.ok())throw Error('Native game HTTP failed');
   await page.waitForFunction(()=>window.__ASCII_NATIVE__?.ready &&
     window.__ASCII_NATIVE__.mode==='three' &&
     window.__ASCII_NATIVE__.stats?.glyphs>1000 &&
     window.__ASCII_NATIVE__.frameCount>4,undefined,{timeout:120000});
   const start=await page.evaluate(()=>({
     map:JSON.stringify(MEADOW_MAP),player:[player.x,player.y],
     canvas:document.querySelectorAll('canvas').length,
     gpuCanvases:[...document.querySelectorAll('canvas')].filter(c=>
       c===window.__ASCII_NATIVE__.renderer?.domElement).length,
     oldCanvas2D:document.getElementById('g').getContext('2d')===GL.ctx2,
     oldWebglContext:document.getElementById('g').getContext('webgl2'),
     activeCanvasVisible:getComputedStyle(
       window.__ASCII_NATIVE__.renderer.domElement).display!=='none',
     originalCanvasHidden:getComputedStyle(document.getElementById('g')).visibility==='hidden',
     calls:window.__ASCII_NATIVE__.stats.drawCalls
   }));
   if(start.canvas!==3||start.gpuCanvases!==1||
      !start.oldCanvas2D||start.oldWebglContext!==null||
      !start.activeCanvasVisible||!start.originalCanvasHidden||start.calls<1)
     throw Error(label+' allocated duplicate GPU / lost real native draw '+JSON.stringify(start));
   // Same user-facing full world, original controls, physics and map coordinates.
   if(!mobile){
     await page.keyboard.down('KeyW');
     await page.waitForTimeout(200);
     await page.keyboard.up('KeyW');
   }else{
     await page.waitForTimeout(250);
   }
   const game=await page.evaluate(()=>({
     map:JSON.stringify(MEADOW_MAP),player:[player.x,player.y],
     glyphs:window.__ASCII_NATIVE__.stats.glyphs,
     visible:window.__ASCII_NATIVE__.stats.visibleGlyphs,
     frames:window.__ASCII_NATIVE__.frameCount
   }));
   if(game.map!==start.map||!(game.glyphs>1000)||
      game.visible>game.glyphs||game.frames<=4)
     throw Error(label+' original source or Three glyph draw changed '+JSON.stringify(game));
   await page.screenshot({path:path.join(output,label+'-native.png'),timeout:60000});
   // In fallback the same authored game must remain playable; no lost WebGL
   // canvas and no renderer toolbar / diagnostic 3D inset are retained.
   const fallback=await page.evaluate(()=>{
     window.__ASCII_NATIVE__.dispose();
     return {mode:window.__ASCII_NATIVE__.mode,
       oldVisible:getComputedStyle(document.getElementById('g')).visibility,
       three:document.getElementById('three-parity-canvas'),
       map:JSON.stringify(MEADOW_MAP)};
   });
   if(fallback.mode!=='canvas2d'||fallback.oldVisible!=='visible'||
      fallback.three!==null||fallback.map!==start.map)
     throw Error(label+' Canvas2D fallback failed '+JSON.stringify(fallback));
   await page.waitForTimeout(150);
   const drawn=await page.evaluate(()=>{
     const g=GL.ctx2;
     const data=g.getImageData(0,0,Math.min(40,g.canvas.width),
       Math.min(40,g.canvas.height)).data;
     let min=255,max=0;
     for(let i=0;i<data.length;i+=4){min=Math.min(min,data[i]);max=Math.max(max,data[i])}
     return {min,max,size:[g.canvas.width,g.canvas.height]};
   });
   if(drawn.max<10||drawn.size[0]<300)throw Error(label+' Canvas2D fallback blank '+JSON.stringify(drawn));
   if(errors.length)throw Error(label+' browser exceptions '+errors.join('; '));
   console.log('NATIVE SINGLE-WEBGL WHOLE GAME PASS '+label+
     ' glyphs='+game.glyphs+' visible='+game.visible+' frames='+game.frames);
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
