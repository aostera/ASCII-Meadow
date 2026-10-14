// Full authored-world compatibility smoke for the new Three.js glyph backend.
// Renders exactly the existing game (with no fake primitive map) and tests that
// swapping only the backend preserves source map and original game simulation.
// Run with repo-root HTTP server, Playwright Chromium + software WebGL2.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const shots=path.join(process.cwd(),'shots','three-parity');
fs.mkdirSync(shots,{recursive:true});
(async()=>{
 const browser=await chromium.launch({
   headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']
 });
 try{
  for(const mobile of [false,true]){
   const context=await browser.newContext({
     viewport:mobile?{width:390,height:844}:{width:1280,height:800},
     deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile
   });
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.stack||e.message));
   page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   const res=await page.goto(base.replace(/\/$/,'')+'/experiments/three/parity.html?edit=0',
     {waitUntil:'domcontentloaded'});
   if(!res||!res.ok())throw Error('parity HTML failed');
   await page.waitForFunction(()=>window.__ASCII_PARITY__?.ready,{timeout:90000});
   const before=await page.evaluate(()=>({
     mode:window.__ASCII_PARITY__.mode,
     map:JSON.stringify(window.__ASCII_PARITY__.map),
     world:window.__ASCII_PARITY__.playerLocation,
     frames:window.__ASCII_PARITY__.baselineGlyphs
   }));
   if(before.mode!=='legacy'||before.frames<1000)throw Error('legacy baseline missing: '+JSON.stringify({mode:before.mode,frames:before.frames}));
   await page.screenshot({path:path.join(shots,mobile?'phone-original.png':'desktop-original.png')});
   await page.locator('#parity-three').click();
   await page.waitForFunction(()=>{
     const p=window.__ASCII_PARITY__;
     return p?.mode==='three'&&p.stats?.frame>2&&p.stats.glyphs>1000&&p.stats.drawCalls>0;
   },{timeout:50000});
   const after=await page.evaluate(()=>({
     mode:window.__ASCII_PARITY__.mode,
     stats:window.__ASCII_PARITY__.stats,
     map:JSON.stringify(window.__ASCII_PARITY__.map)
   }));
   if(after.map!==before.map)throw Error('Three.js mutated the real authored map!');
   await page.screenshot({path:path.join(shots,mobile?'phone-three.png':'desktop-three.png')});
   await page.locator('#parity-legacy').click();
   await page.waitForFunction(()=>window.__ASCII_PARITY__.mode==='legacy');
   const restored=await page.evaluate(()=>({
     map:JSON.stringify(window.__ASCII_PARITY__.map),
     canvasVisible:getComputedStyle(document.getElementById('g')).visibility
   }));
   if(restored.map!==before.map||restored.canvasVisible!=='visible')throw Error('original renderer not restored');
   if(errors.length)throw Error('parity browser errors: '+errors.join('\n'));
   console.log(mobile?'PARITY PHONE PASS':'PARITY DESKTOP PASS',
     JSON.stringify({glyphs:after.stats.glyphs,draws:after.stats.drawCalls,originalRestored:true,mapUnchanged:true}));
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
