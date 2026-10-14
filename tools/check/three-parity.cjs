// Render exactly the same frozen, authored ASCII world in both backends.
// Five real map locations, desktop + phone, and a real UI-toggle smoke test.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const shots=path.join(process.cwd(),'shots','three-parity');
fs.mkdirSync(shots,{recursive:true});
const file=(mobile,name,mode)=>path.join(shots,(mobile?'phone':'desktop')+'-'+name+'-'+mode+'.png');
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
    '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
  for(const mobile of [false,true]){
   const context=await browser.newContext({
     viewport:mobile?{width:390,height:844}:{width:1280,height:800},
     deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile
   });
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.stack||e.message));
   page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
   const res=await page.goto(base.replace(/\/$/,'')+
     '/experiments/three/parity.html?edit=0&parityTest=1',{waitUntil:'domcontentloaded'});
   if(!res?.ok())throw Error('parity page failed to load');
   await page.waitForFunction(()=>window.__ASCII_PARITY__?.ready,{timeout:90000});
   const sourceMap=await page.evaluate(()=>JSON.stringify(window.__ASCII_PARITY__.map));
   // Click as a player first: the controls must stay interactive.
   await page.locator('#parity-three').click();
   await page.waitForFunction(()=>window.__ASCII_PARITY__?.mode==='three'&&
      window.__ASCII_PARITY__.stats?.glyphs>1000,{timeout:60000});
   await page.locator('#parity-legacy').click();
   await page.waitForFunction(()=>window.__ASCII_PARITY__?.mode==='legacy',{timeout:30000});
   if(!await page.evaluate(()=>window.__ASCII_PARITY__.freezeForTest()))
     throw Error('Cannot freeze game world and source render');
   // Hide UI only in test screenshots, not in the actual playable preview.
   await page.addStyleTag({content:'.hud,.stats,#parity-toolbar,.ed,.ed-open{visibility:hidden!important}'});
   const sites=mobile?['camp','broken-gate','castle']:
      ['camp','broken-gate','abbey-front','cloister-walk','castle'];
   for(const site of sites){
     const loc=await page.evaluate(name=>window.__ASCII_PARITY__.visitForTest(name),site);
     if(!loc)throw Error('Authored map location not found: '+site);
     const originalBatch=await page.evaluate(()=>window.__ASCII_PARITY__.captureReferenceForTest());
     if(!originalBatch||originalBatch.glyphs<1000)
       throw Error('Original glyph source missing at '+site);
     await page.screenshot({path:file(mobile,site,'original'),timeout:60000,animations:'disabled'});
     const threeBatch=await page.evaluate(()=>window.__ASCII_PARITY__.captureThreeForTest());
     if(!threeBatch||threeBatch.glyphs!==originalBatch.glyphs)
       throw Error('Not rendering the SAME original glyphs in Three.js at '+site);
     await page.screenshot({path:file(mobile,site,'three'),timeout:60000,animations:'disabled'});
     const verify=await page.evaluate(()=>({
       map:JSON.stringify(window.__ASCII_PARITY__.map),
       stats:window.__ASCII_PARITY__.stats,
       gpuCanvasSize:document.getElementById('three-parity-canvas')?.width
     }));
     if(verify.map!==sourceMap||!verify.gpuCanvasSize||verify.stats.glyphs<1000)
       throw Error('Rendering/map failure: '+site+' '+JSON.stringify(verify.stats));
     await page.evaluate(()=>window.__ASCII_PARITY__.select('legacy'));
     console.log('CAPTURE '+(mobile?'PHONE':'DESKTOP')+' '+site,
       JSON.stringify({glyphs:verify.stats.glyphs,drawCalls:verify.stats.drawCalls,mapUnchanged:true}));
   }
   // Bright lightning uses two original castle quads with DIFFERENT blend
   // modes. A faithful Three port must match the source at every pixel.
   const flashSetup=await page.evaluate(()=>{
     const p=window.__ASCII_PARITY__;
     p.visitForTest('castle');
     if(!p.setSourceFlashForTest(.65))return null;
     return p.captureReferenceForTest();
   });
   if(!flashSetup||flashSetup.glyphs<1000)
     throw Error('Source castle lightning frame absent');
   await page.screenshot({path:file(mobile,'castle-flash','original'),timeout:60000,animations:'disabled'});
   const flashThree=await page.evaluate(()=>window.__ASCII_PARITY__.captureThreeForTest());
   if(!flashThree||flashThree.glyphs!==flashSetup.glyphs||flashThree.drawCalls<3)
     throw Error('Three renderer lost additive source castle flash '+JSON.stringify(flashThree));
   await page.screenshot({path:file(mobile,'castle-flash','three'),timeout:60000,animations:'disabled'});
   await page.evaluate(()=>{
     window.__ASCII_PARITY__.select('legacy');
     window.__ASCII_PARITY__.setSourceFlashForTest(0);
   });
   const restored=await page.evaluate(()=>({
     mode:window.__ASCII_PARITY__.mode,
     visible:getComputedStyle(document.getElementById('g')).visibility,
     map:JSON.stringify(window.__ASCII_PARITY__.map)
   }));
   if(restored.mode!=='legacy'||restored.visible!=='visible'||restored.map!==sourceMap)
      throw Error('Original game not restored on mode switch');
   if(errors.length)throw Error('Browser exceptions: '+errors.join('\n'));
   console.log(mobile?'PARITY PHONE PASS':'PARITY DESKTOP PASS',sites.join(','));
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
