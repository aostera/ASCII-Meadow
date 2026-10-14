// Depth attachment regression: capture the SAME exact original authored
// castle frame, then enable source-masonry depth without re-rendering game
// simulation. One GPU context, no changed world/brightness/alpha outside inset.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const dir=path.join(process.cwd(),'shots','three-depth');
fs.mkdirSync(dir,{recursive:true});
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
   page.on('pageerror',err=>errors.push(err.message));
   const res=await page.goto(base.replace(/\/$/,'')+
     '/experiments/three/?parityTest=1',{waitUntil:'domcontentloaded'});
   if(!res?.ok())throw Error('Source-depth preview page unavailable');
   await page.waitForFunction(()=>window.__ASCII_PARITY__?.ready,undefined,{timeout:90000});
   await page.evaluate(()=>{
     const p=window.__ASCII_PARITY__;
     p.visitForTest('castle');
     p.freezeForTest();
     p.captureReferenceForTest();
     p.captureThreeForTest();
   });
   await page.addStyleTag({content:'.hud,.stats,#parity-toolbar,.ed,.ed-open{visibility:hidden!important}'});
   const src=await page.evaluate(()=>({
     map:JSON.stringify(window.__ASCII_PARITY__.map),
     canvases:document.querySelectorAll('canvas').length,
     glyphs:window.__ASCII_PARITY__.stats.glyphs
   }));
   if(src.glyphs<1000)throw Error('Original ASCII source buffer empty');
   await page.screenshot({path:path.join(dir,name+'-before.png'),animations:'disabled'});
   const activated=await page.evaluate(()=>window.__ASCII_PARITY__.setDepthMode(true));
   if(!activated)throw Error('Cannot enable original architecture GPU depth');
   await page.evaluate(()=>window.__ASCII_PARITY__.captureThreeForTest());
   const live=await page.evaluate(()=>({
     ...window.__ASCII_PARITY__.liveArchitecture,
     map:JSON.stringify(window.__ASCII_PARITY__.map),
     canvases:document.querySelectorAll('canvas').length,
     mode:window.__ASCII_PARITY__.mode
   }));
   if(!live.depth?.active||!live.depth?.hasDepthTexture||
      live.depth.drawCalls<1||live.depth.sites!==4||
      live.depth.width<150||live.depth.height<200||
      live.depth.frames<1||live.map!==src.map||
      live.canvases!==src.canvases||live.mode!=='three')
     throw Error('Three depth source mismatch: '+JSON.stringify(live));
   await page.screenshot({path:path.join(dir,name+'-depth.png'),animations:'disabled'});
   fs.writeFileSync(path.join(dir,name+'-rect.json'),JSON.stringify(live.depth.viewport));
   if(!await page.evaluate(()=>window.__ASCII_PARITY__.setDepthMode(false)))
      throw Error('Cannot disable depth prepass');
   await page.evaluate(()=>window.__ASCII_PARITY__.captureThreeForTest());
   await page.screenshot({path:path.join(dir,name+'-restored.png'),animations:'disabled'});
   const end=await page.evaluate(()=>({
     depth:window.__ASCII_PARITY__.liveArchitecture?.depth||null,
     map:JSON.stringify(window.__ASCII_PARITY__.map),
     canvases:document.querySelectorAll('canvas').length
   }));
   if(end.depth||end.map!==src.map||end.canvases!==src.canvases)
     throw Error('Native GPU depth attachment not freed safely');
   if(errors.length)throw Error('Browser errors: '+errors.join('\n'));
   console.log(name.toUpperCase()+' NATIVE DEPTH PASS '+
     JSON.stringify({resolution:[live.depth.width,live.depth.height],
       draws:live.depth.drawCalls,sites:live.depth.sites,
       rendererContextsAdded:0,sourceUnchanged:true,freed:true}));
   await context.close();
  }
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
