// Regression: on touch, the map editor pans with two fingers and zooms with a
// pinch about the fingers, without painting or placing anything, while a
// single finger still paints exactly as before. Real CDP touch input.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const out=path.join(process.cwd(),'shots','three-native-editor-touch');
fs.mkdirSync(out,{recursive:true});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
  for(const [label,viewport] of [['phone',{width:390,height:844}],['tablet',{width:820,height:1180}]]){
   const ctx=await browser.newContext({viewport,deviceScaleFactor:2,isMobile:true,hasTouch:true});
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   const response=await page.goto(base.replace(/\/$/,'')+
    '/experiments/three/native.html?edit=1',{waitUntil:'domcontentloaded'});
   if(!response?.ok())throw Error('Native editor-touch HTTP failed');
   await page.waitForFunction(()=>window.__ASCII_NATIVE__?.ready&&
    window.__ASCII_NATIVE_EDITOR_TOUCH__&&typeof openEditor==='function',
    undefined,{timeout:180000});
   const cdp=await ctx.newCDPSession(page);
   const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,
    touchPoints:points.map(([id,x,y])=>({id,x,y,radiusX:4,radiusY:4,force:1}))});
   const state=()=>page.evaluate(()=>({VZ,camX,camY,map:mapFileText(),
    undo:ED.undo.length,stroke:!!ED.stroke,editing,
    stats:window.__ASCII_NATIVE_EDITOR_TOUCH__.stats}));
   await page.evaluate(()=>{openEditor();ED.tool='g';ED.size=4;edZoomTo(1);edSyncUI()});
   // Upper part of the screen: on a phone the editor panel covers the bottom half.
   const cx=viewport.width/2,cy=viewport.height*.26;
   const s0=await state();
   if(!s0.editing)throw Error(label+' editor did not open');

   // 1. Pinch out + pan with the grass brush armed: both fingers together.
   await touch('touchStart',[[1,cx-40,cy],[2,cx+40,cy]]);
   for(let k=1;k<=8;k++){
    const d=40+k*10,dx=k*6,dy=k*4;
    await touch('touchMove',[[1,cx-d+dx,cy+dy],[2,cx+d+dx,cy+dy]]);
    await wait(16);
   }
   await touch('touchEnd',[]);
   await wait(50);
   const s1=await state();
   if(!(s1.VZ>s0.VZ*1.5))throw Error(label+' pinch did not zoom in '+JSON.stringify({a:s0.VZ,b:s1.VZ}));
   if(s1.map!==s0.map||s1.undo!==s0.undo)throw Error(label+' pinch painted the map');

   // 2. Two-finger pan, second finger 40 ms after the first (real hands):
   // still no paint, camera moves by the finger travel, zoom unchanged.
   await touch('touchStart',[[3,cx-50,cy]]);
   await wait(40);
   await touch('touchStart',[[3,cx-50,cy],[4,cx+50,cy]]);
   for(let k=1;k<=8;k++){
    await touch('touchMove',[[3,cx-50-k*12,cy-k*8],[4,cx+50-k*12,cy-k*8]]);
    await wait(16);
   }
   await touch('touchEnd',[]);
   await wait(50);
   const s2=await state();
   if(Math.abs(s2.VZ-s1.VZ)>1e-6)throw Error(label+' parallel pan changed zoom');
   if(!(s2.camX>s1.camX&&s2.camY>s1.camY))
    throw Error(label+' two-finger pan did not move the camera '+JSON.stringify({s1,s2}));
   if(s2.map!==s0.map||s2.undo!==s0.undo)throw Error(label+' two-finger pan painted the map');

   // 3. Pinch in back down: zoom never leaves the editor's range.
   await touch('touchStart',[[5,cx-100,cy],[6,cx+100,cy]]);
   for(let k=1;k<=10;k++){
    await touch('touchMove',[[5,cx-100+k*9,cy],[6,cx+100-k*9,cy]]);
    await wait(16);
   }
   await touch('touchEnd',[]);
   await wait(50);
   const s3=await state();
   const range=await page.evaluate(()=>[ED_ZOOMS[0],ED_ZOOMS[ED_ZOOMS.length-1]]);
   if(!(s3.VZ<s2.VZ)||s3.VZ<range[0]-1e-6||s3.VZ>range[1]+1e-6)
    throw Error(label+' pinch-in out of range '+s3.VZ);

   // 4. One finger still paints: a drag records exactly one undo entry.
   // Water, so every stamp lands on cells that are not water yet.
   await page.evaluate(()=>{ED.tool='w';edSyncUI()});
   await touch('touchStart',[[7,cx,cy]]);
   for(let k=1;k<=6;k++){await touch('touchMove',[[7,cx+k*8,cy+k*3]]);await wait(16)}
   await touch('touchEnd',[]);
   await wait(80);
   const s4=await state();
   if(s4.undo!==s3.undo+1||s4.map===s3.map)
    throw Error(label+' single-finger paint broken '+JSON.stringify({undo:[s3.undo,s4.undo]}));
   // 5. A quick tap (shorter than the hold distance) still paints.
   await touch('touchStart',[[8,cx-60,cy+60]]);
   await touch('touchEnd',[]);
   await wait(80);
   const s5=await state();
   if(s5.undo!==s4.undo+1)throw Error(label+' quick tap did not paint '+JSON.stringify({s4:{...s4,map:0},s5:{...s5,map:0},same:s4.map===s5.map}));
   // 6. A second finger landing mid-stroke ends that stroke as one entry
   // and the rest of the gesture paints nothing. The end goes through the
   // ACTIVE handler (the grey-ruin rotation delegate in native.html), so a
   // rotation in progress is cancelled the same way.
   await page.evaluate(()=>{
     const real=window.__ASCII_NATIVE_EDITOR_POINTER__;
     window.__touchDelivered=[];
     window.__touchRealDelegate=real;
     window.__ASCII_NATIVE_EDITOR_POINTER__=e=>{window.__touchDelivered.push(e.type);(real||edPointer)(e)};
   });
   await touch('touchStart',[[9,cx-60,cy+100]]);
   for(let k=1;k<=4;k++){await touch('touchMove',[[9,cx-60+k*10,cy+100]]);await wait(16)}
   await touch('touchStart',[[9,cx-20,cy+100],[10,cx+60,cy+100]]);
   for(let k=1;k<=5;k++){
    await touch('touchMove',[[9,cx-20-k*8,cy+100],[10,cx+60+k*8,cy+100]]);
    await wait(16);
   }
   await touch('touchEnd',[]);
   await wait(80);
   const s6=await state();
   if(s6.undo!==s5.undo+1||s6.stroke)throw Error(label+' late second finger did not end the stroke cleanly');
   const delivered=await page.evaluate(()=>{
     window.__ASCII_NATIVE_EDITOR_POINTER__=window.__touchRealDelegate;
     return window.__touchDelivered;
   });
   if(delivered.join()!=='pointerdown,pointermove,pointercancel')
     throw Error(label+' stroke was not ended through the active handler '+delivered.join());
   // 7. Closing the editor under a finger leaves no stale touch behind.
   await touch('touchStart',[[11,cx,cy]]);
   await page.evaluate(()=>closeEditor());
   await touch('touchEnd',[]);
   await page.evaluate(()=>{openEditor();ED.tool='w';edSyncUI()});
   const stale=await page.evaluate(()=>window.__ASCII_NATIVE_EDITOR_TOUCH__.tracked);
   if(stale)throw Error(label+' stale touches after closing the editor: '+stale);
   const mapAfterGesture=s6.map;
   // Screenshot at 100%: at 0.35 a tablet frame is too slow for software GL.
   await page.evaluate(()=>edZoomTo(1));
   await page.waitForTimeout(300);
   await page.screenshot({path:path.join(out,label+'.png'),timeout:120000});
   // Undo every touch paint: the authored map is restored byte for byte.
   const restored=await page.evaluate(n=>{for(let i=0;i<n;i++)edUndo();return mapFileText()},s6.undo-s0.undo);
   if(restored!==s0.map)throw Error(label+' undo did not restore the authored map');
   if(mapAfterGesture===s0.map)throw Error(label+' paints never reached the map');
   if(errors.length)throw Error(label+' browser exceptions: '+errors.join(' | '));
   console.log('NATIVE EDITOR TOUCH PASS '+label+' '+JSON.stringify({
    zoom:[s0.VZ,s1.VZ,s3.VZ],cam:[s1.camX,s2.camX],undoEntries:s6.undo-s0.undo,stats:s6.stats}));
   await ctx.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
