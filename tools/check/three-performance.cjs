// Per-frame CPU metrics only: SwiftShader is not a real iPhone/iPad GPU.
// Culling must not change ONE screenshot pixel of the frozen authored world.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const dir=path.join(process.cwd(),'shots','three-performance');
fs.mkdirSync(dir,{recursive:true});
const percentile=(list,q)=>{
 const a=[...list].sort((x,y)=>x-y);
 return a[Math.min(a.length-1,Math.ceil(a.length*q)-1)];
};
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
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base.replace(/\/$/,'')+'/experiments/three/?parityTest=1',
    {waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__ASCII_PARITY__?.ready,undefined,{timeout:90000});
   const source=await page.evaluate(()=>{
    const p=window.__ASCII_PARITY__;
    p.freezeForTest();
    return p.captureReferenceForTest();
   });
   await page.addStyleTag({content:'.hud,.stats,#parity-toolbar,.ed,.ed-open{visibility:hidden!important}'});
   const results={},screens={};
   for(const enabled of [false,true]){
    const mode=enabled?'clipped':'unclipped',records=[];
    const ok=await page.evaluate(flag=>{
      const p=window.__ASCII_PARITY__;
      if(p.mode!=='three')p.select('three');
      return p.setGlyphCullingForTest(flag);
    },enabled);
    if(!ok)throw Error('Cannot change QA glyph culling flag');
    for(let i=0;i<9;i++){
      const stats=await page.evaluate(()=>window.__ASCII_PARITY__.captureThreeForTest());
      if(!stats||stats.glyphs!==source.glyphs||stats.visibleGlyphs>stats.glyphs)
        throw Error('Incorrect source glyph accounting');
      if(!Number.isFinite(stats.uploadCpuMs)||!Number.isFinite(stats.renderCpuMs))
        throw Error('Missing upload/render CPU measurements');
      if(i>1)records.push(stats);
    }
    screens[mode]=await page.screenshot({
      path:path.join(dir,name+'-'+mode+'.png'),timeout:60000,animations:'disabled'
    });
    results[mode]={
      glyphs:records[0].glyphs,visible:records[0].visibleGlyphs,
      culled:records[0].culledGlyphs,
      uploadMedianMs:percentile(records.map(r=>r.uploadCpuMs),.5),
      uploadP95Ms:percentile(records.map(r=>r.uploadCpuMs),.95),
      renderMedianMs:percentile(records.map(r=>r.renderCpuMs),.5)
    };
   }
   if(!screens.unclipped.equals(screens.clipped))
    throw Error('Glyph culling changed the original source scene pixels');
   if(results.unclipped.culled!==0||results.clipped.visible>source.glyphs)
    throw Error('Wrong invisible-sprite count');
   if(errors.length)throw Error('GPU benchmark browser exceptions: '+errors.join('; '));
   const report={
     source:'Chromium SwiftShader software WebGL2, not physical GPU FPS',
     exactPixels:true,withoutCulling:results.unclipped,withCulling:results.clipped
   };
   fs.writeFileSync(path.join(dir,name+'-metrics.json'),JSON.stringify(report,null,2));
   console.log(name.toUpperCase()+' GLYPH CULL BENCH PASS '+JSON.stringify(report));
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
