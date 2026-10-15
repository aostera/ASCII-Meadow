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
     // The legacy map's v1 format omits "actors"; undo correctly normalizes
     // that missing key to null in memory. The user-facing map export must
     // remain byte-for-byte identical across undo, not the internal object.
     const exported=mapFileText(),snapshot=JSON.stringify(mapSnapshot());
     openEditor();
     ED.tool='select';ED.sel={kind:'ruins',mi:1};edSyncUI();
     // Source map remains unchanged until user actually rotates.
     return {source,exported,snapshot,editing,sites:ruinSites().map(r=>r.id),
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
   await slider.evaluate(el=>{
     el.value='75';
     el.dispatchEvent(new Event('input',{bubbles:true}));
   });
   // Dragging must rotate real THREE geometry without immediately rebaking
   // source masonry or changing the exported map. Mirrored X means the
   // Three-space Y rotation is the negative source yaw delta.
   await page.waitForFunction(original=>
     Math.abs(window.__ASCII_NATIVE__.greyEditor.previewRotationY-
       (original-75*Math.PI/180))<.002,
     before.yaw,{timeout:90000});
   const during=await page.evaluate(()=>({
     map:JSON.stringify(MEADOW_MAP),
     preview:window.__ASCII_NATIVE__.greyEditor.yawPreview
   }));
   if(during.map!==scene.source||
      Math.abs(during.preview-75*Math.PI/180)>.001)
     throw Error(label+' grey preview wrote to authored map too soon');
   await slider.evaluate(el=>
     el.dispatchEvent(new Event('change',{bubbles:true})));
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
   await page.waitForFunction(initialYaw=>MEADOW_MAP.ruins===null||
     Math.abs(ruinSites()[1].yaw-initialYaw)<.001,
     before.yaw,{timeout:90000});
   // Direct rotation by touching the actual grey ruin IN THE MAP.
   // Keep this distinct from the slider: Alt-drag must generate a single
   // normal source editor undo entry, and never drag the ruin's world position.
   const point=await page.evaluate(()=>{
     const r=ruins[1];
     const [x,y]=mapToCell(r.x,r.z);
     camX=x-W/(CW*VZ)*.5;camY=y-H/(CH*VZ)*.5;
     const o=edObjects().find(o=>o.kind==='ruins'&&o.mi===1);
     if(!o)throw Error('Selected abbey not present in editor');
     return {x:o.sx,y:o.sy-Math.min(22,o.top*.25)};
   });
   await page.keyboard.down('Alt');
   await page.mouse.move(point.x,point.y);
   await page.mouse.down();
   await page.mouse.move(point.x+74,point.y,{steps:6});
   await page.mouse.up();
   await page.keyboard.up('Alt');
   await page.waitForFunction(initialYaw=>
     Math.abs(ruinSites()[1].yaw-initialYaw)>.08,
     before.yaw,{timeout:90000});
   await page.evaluate(()=>edUndo());
   await page.waitForFunction(initialYaw=>MEADOW_MAP.ruins===null||
     Math.abs(ruinSites()[1].yaw-initialYaw)<.001,
     before.yaw,{timeout:90000});
   if(mobile){
     // Undo may clear the editor's selection; select the intended ruin
     // explicitly before entering the guarded touch-rotation mode.
     await page.evaluate(()=>{
       ED.tool='select';ED.sel={kind:'ruins',mi:1};edSyncUI();
     });
     await page.waitForFunction(()=>
       window.__ASCII_NATIVE__.greyEditor.selected==='abbey-front'&&
       document.querySelector('.native-grey-map-drag')?.offsetWidth>0);
     // Verify the browser's native touch pointer handler without keyboard.
     // The first tap must select a ruin; gestures are explicitly opt-in.
     const touchButton=page.locator('.native-grey-map-drag');
     await touchButton.click();
     if(await touchButton.getAttribute('aria-pressed')!=='true')
       throw Error('Touch rotation mode was not enabled');
     await page.evaluate(({x,y})=>{
       const cv=document.querySelector('#c');
       const opts={bubbles:true,cancelable:true,button:0,
         pointerType:'touch',pointerId:91,clientX:x,clientY:y};
       cv.dispatchEvent(new PointerEvent('pointerdown',opts));
       window.dispatchEvent(new PointerEvent('pointermove',{
         ...opts,clientX:x+90}));
       window.dispatchEvent(new PointerEvent('pointerup',{
         ...opts,clientX:x+90}));
     },point);
     await page.waitForFunction(initialYaw=>
       Math.abs(ruinSites()[1].yaw-initialYaw)>.08,
       before.yaw,{timeout:90000});
     await page.evaluate(()=>edUndo());
     await page.waitForFunction(initialYaw=>MEADOW_MAP.ruins===null||
       Math.abs(ruinSites()[1].yaw-initialYaw)<.001,
       before.yaw,{timeout:90000});
     await touchButton.click();
     if(await touchButton.getAttribute('aria-pressed')!=='false')
       throw Error('Touch rotation mode did not disable');
   }
   const restored=await page.evaluate(()=>({
     map:JSON.stringify(MEADOW_MAP),
     snapshot:JSON.stringify(mapSnapshot()),
     exported:mapFileText(),
     editor:window.__ASCII_NATIVE__.greyEditor,
     native:window.__ASCII_NATIVE__.mode
   }));
   if(restored.snapshot!==scene.snapshot||restored.exported!==scene.exported)
     throw Error(label+' rotating grey model broke editor undo source map export');
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
     directAltDragOnMap:true,
     touchDragOnSelectedRuin:mobile,
     singleThreeContext:true,
     inMap:true,
     sourceGameIntact:true
   }));
   await context.close();
  }
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
