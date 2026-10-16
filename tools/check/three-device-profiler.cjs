// Real Safari/iPad/desktop profiling UI smoke (Chromium test driver here).
// CI data is SwiftShader and must NEVER be presented as hardware FPS.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const dest=path.join(process.cwd(),'shots','three-device-profiler');
fs.mkdirSync(dest,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
  const page=await browser.newPage({viewport:{width:1080,height:720}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const res=await page.goto(base.replace(/\/$/,'')+
   '/experiments/three/?profile=1&profileTest=1',{waitUntil:'domcontentloaded'});
  if(!res?.ok())throw Error('Profiler page failed');
  await page.waitForFunction(()=>window.__ASCII_DEVICE_PROFILER__?.report,
   undefined,{timeout:90000});
  const outcome=await page.evaluate(()=>({
   report:window.__ASCII_DEVICE_PROFILER__.report,
   mode:window.__ASCII_PARITY__.mode,
   sourceReady:window.__ASCII_PARITY__.ready
  }));
  const q=outcome.report;
  if(outcome.mode!=='three'||!outcome.sourceReady||!q||
     q.frameCount<1||!(q.frameMsP95>0)||
     !(q.visibleGlyphMedian>1000)||!(q.originalGlyphMedian>1000))
    throw Error('Missing actual display frame/Three glyph metrics '+JSON.stringify(outcome));
  await page.screenshot({path:path.join(dest,'profile-overlay.png'),timeout:60000});
  fs.writeFileSync(path.join(dest,'software-run.json'),JSON.stringify(q,null,2));
  const closed=await page.evaluate(()=>{
   window.__ASCII_DEVICE_PROFILER__.dispose();
   return !document.querySelector('#ascii-device-profiler');
  });
  if(!closed)throw Error('Profiling UI did not release its own RAF/DOM resources');
  if(errors.length)throw Error('Profiler exceptions: '+errors.join('; '));
  console.log('DEVICE PROFILER UI PASS '+JSON.stringify({
   frameCount:q.frameCount,frameMsP95:q.frameMsP95,
   recordedCpuSubmit:true,cleansUp:true,
   driver:'Chromium SwiftShader, not physical GPU FPS'
  }));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
