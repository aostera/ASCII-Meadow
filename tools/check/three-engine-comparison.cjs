// Browser smoke: a software-rendered test, not a physical device FPS claim.
// Confirm renderer transitions and source map remain intact on desktop/phone.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const dir=path.join(process.cwd(),'shots','three-engine-comparison');
fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
  for(const mobile of [false,true]){
   const kind=mobile?'phone':'desktop';
   const context=await browser.newContext({
    viewport:mobile?{width:390,height:844}:{width:1100,height:740},
    deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile
   });
   const page=await context.newPage(),errors=[];
   page.on('pageerror',err=>errors.push(err.message));
   const res=await page.goto(base.replace(/\\/$/,'')+
    '/experiments/three/?profile=compare&profileTest=1',
    {waitUntil:'domcontentloaded'});
   if(!res?.ok())throw Error('A/B page not served '+kind);
   await page.waitForFunction(()=>window.__ASCII_ENGINE_COMPARE__?.report,
     undefined,{timeout:120000});
   const proof=await page.evaluate(()=>{
     const compare=window.__ASCII_ENGINE_COMPARE__;
     return {
      report:compare.report,
      mode:window.__ASCII_PARITY__.mode,
      ready:window.__ASCII_PARITY__.ready,
      sourceMapUnchanged:compare.report?.mapUnchanged,
      canvasCount:document.querySelectorAll('canvas').length
     };
   });
   if(!proof.ready||proof.mode!=='legacy'||proof.sourceMapUnchanged!==true)
     throw Error(kind+' failed to return to unchanged original '+JSON.stringify(proof));
   const r=proof.report;
   if(r.sequence.join('/')!=='legacy/three/three/legacy'||
      !(r.original.frameCount>0)||!(r.nativeThree.frameCount>0)||
      !(r.original.frameMsP95>0)||!(r.nativeThree.frameMsP95>0)||
      !(r.nativeThree.visibleGlyphMedian>1000))
     throw Error(kind+' missing real RAF/source glyph samples '+JSON.stringify(r));
   await page.screenshot({path:path.join(dir,kind+'-summary.png')});
   fs.writeFileSync(path.join(dir,kind+'-software-report.json'),JSON.stringify(r,null,2));
   const closed=await page.evaluate(()=>{
     window.__ASCII_ENGINE_COMPARE__.dispose();
     return !document.getElementById('ascii-engine-comparison')&&
       !window.__ASCII_ENGINE_COMPARE__&&window.__ASCII_PARITY__.mode==='legacy';
   });
   if(!closed||errors.length)throw Error(kind+' cleanup/browser errors: '+errors.join('; '));
   console.log('A/B SOURCE/THREE PASS '+kind+' original p95 '+r.original.frameMsP95+
     'ms, native p95 '+r.nativeThree.frameMsP95+
     'ms (SwiftShader only; NOT hardware GPU)');
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
