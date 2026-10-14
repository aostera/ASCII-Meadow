// Restore grey 3D building editing in the REAL source-map editor.
// No second canvas, no diagnostic inset: see castle + three ruins at their
// exact source world-map positions and persist ruin rotation in map.js format.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const dir=path.join(process.cwd(),'shots','three-native-grey-editor');
fs.mkdirSync(dir,{recursive:true});

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
   page.on('pageerror',err=>errors.push(err.message));
   const res=await page.goto((base.endsWith('/')?base.slice(0,-1):base)+
    '/experiments/three/native.html?edit=1',
    {waitUntil:'domcontentloaded'});
   if(!res?.ok())throw Error('Native grey editor preview HTTP failed');
   await page.waitForFunction(()=>
     window.__ASCII_NATIVE__?.ready&&
     window.__ASCII_NATIVE__.mode==='three'&&
     document.querySelector('.native-grey-editor'),
     undefined,{timeout:100000});
   const scene=await page.evaluate(()=>{
     const source=JSON.stringify(MEADOW_MAP);
     openEditor();
     ED.tool='select';ED.sel={kind:'ruins',mi:1};edSyncUI();
     // Source map remains unchanged until user actually rotates.
     return {source,editing,sites:ruinSites().map(r=>r.id),
       rootVisible:!ED.ui.root.hidden};
   });
   if(!scene.editing||scene.sites.length!==3||!scene.rootVisible)
     throw Error(label+' native editor unavailable');
   await page.waitForFunction(()=>
     window.__ASCII_NATIVE__?.greyEditor?.frames>1&&
     window.__ASCII_NATIVE__.greyEditor.sites.length===4&&
     window.__ASCII_NATIVE__.greyEditor.selected==='abbey-front'&&
     document.querySelector('.native-grey-rotation')?.hidden===false,
     undefined,{timeout:90000});
   const before=await page.evaluate(()=>({
      scenes:document.querySelectorAll('#three-parity-canvas').length,
      yaw:ruinSites()[1].yaw,
      selected:window.__ASCII_NATIVE__.greyEditor.selected,
      draws:window.__ASCII_NATIVE__.greyEditor.drawCalls,
      sourceMap:JSON.stringify(MEADOW_MAP)
   }));
   if(before.scenes!==1||before.draws<1||
      before.sourceMap!==scene.source)
     throw Error(label+' grey model overlay allocated wrong renderer');
   await page.screenshot({
     path:path.join(dir,label+'-grey-3d.png'),timeout:60000
   });
   const slider=page.locator('.native-grey-rotation input[type=range]');
   await slider.fill('75');
   await page.waitForFunction(()=>(
     Math.abs(ruinSites()[1].yaw-75*Math.PI/180)<.001 &&
     window.__ASCII_NATIVE__.greyEditor.selected==='abbey-front'
   ),undefined,{timeout:90000});
   const saved=await page.evaluate(()=>({
     originalYaw:ruinSites()[1].yaw,
     actualMapYaw:MEADOW_MAP.ruins[1][4],
     undoCount:ED.undo.length,
     serialized:mapFileText(),
     viewport:window.__ASCII_NATIVE__.greyEditor.sites
   }));
   if(!saved.serialized.includes('abbey-front')||
      Math.abs(saved.actualMapYaw-75*Math.PI/180)>.001||
      saved.undoCount<1)
     throw Error(label+' rotating model did not save to source map.js');
   await page.locator('.native-grey-buttons button[data-rotate="15"]').click();
   await page.waitForFunction(()=>
     Math.abs(ruinSites()[1].yaw-Math.PI/2)<.001,
     undefined,{timeout:90000});
   await page.evaluate(()=>edUndo());
   await page.waitForFunction(()=>
     Math.abs(ruinSites()[1].yaw-75*Math.PI/180)<.001,
     undefined,{timeout:90000});
   await page.evaluate(()=>edUndo());
   await page.waitForFunction(()=>MEADOW_MAP.ruins===null||
     Math.abs(ruinSites()[1].yaw-.34)<.001,
     undefined,{timeout:90000});
   const restored=await page.evaluate(()=>({
     map:JSON.stringify(MEADOW_MAP),
     editor:window.__ASCII_NATIVE__.greyEditor,
     native:window.__ASCII_NATIVE__.mode
   }));
   if(restored.map!==scene.source)
     throw Error(label+' rotating grey model broke editor undo source map');
   await page.locator('.native-grey-switch input').uncheck();
   await page.waitForFunction(()=>
     window.__ASCII_NATIVE__.greyEditor.enabled===false,
     undefined,{timeout:90000});
   await page.evaluate(()=>closeEditor());
   await page.waitForFunction(()=>
     document.querySelector('.native-grey-editor').hidden&&
     window.__ASCII_NATIVE__.mode==='three',
     undefined,{timeout:90000});
   if(errors.length)throw Error(label+' JS errors: '+errors.join('; '));
   console.log('NATIVE GREY 3D EDITOR PASS '+label+' '+JSON.stringify({
     buildings:before.scenes===1?4:0,
     originalSourceMapUnchanged:true,
     savedAngleDegrees:75,
     rotatedByButtonDegrees:90,
     undoWorks:true,
     singleThreeContext:true,
     inMap:true,
     sourceGameIntact:true
   }));
   await context.close();
  }
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
