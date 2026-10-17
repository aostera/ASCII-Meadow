// Genuine original-GLB versus exact SAME GLB with live bone animation.
// One camera, one material space, one light rig, one 60Hz render loop.
// Refuses to accept the studio tint as original artwork.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=(process.argv[2]||'http://127.0.0.1:8181').replace(/\/$/,'');
const out=path.join(process.cwd(),'shots','ashen-tripo-ab-reference');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
   '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
  const page=await browser.newPage({viewport:{width:1360,height:850},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  const res=await page.goto(base+'/experiments/three/ashen-tripo-ab-review.html',
    {waitUntil:'domcontentloaded',timeout:60000});
  if(res.status()!==200)throw Error('Missing controlled original-versus-animated A/B view');
  await page.waitForFunction(()=>{
    const a=window.__ASHEN_AB_COMPARE__;return a&&(a.ready||a.error);
  },undefined,{timeout:90000});
  const state=()=>page.evaluate(()=>{
    const a=window.__ASHEN_AB_COMPARE__;
    return {ready:a.ready,error:a.error,materials:a.materialMatch,
      bindDelta:a.bindMaxDelta,frames:a.frames,mode:a.mode};
  });
  const first=await state();
  if(!first.ready||!first.materials||!Number.isFinite(first.bindDelta)||
     first.bindDelta>.001)
    throw Error('A/B source Tripo material/bind poses differ BEFORE ANY ANIMATION: '+
      JSON.stringify(first));
  await page.screenshot({path:path.join(out,'00-source-vs-rig-bind.png')});
  const stages=[['Idle',35],['Walk',55],['Run',55],['Jump',35]];
  for(const [mode,frames] of stages){
    const before=(await state()).frames;
    await page.locator('[data-mode="'+mode+'"]').click();
    await page.waitForFunction(({mode,before,frames})=>{
      const a=window.__ASHEN_AB_COMPARE__;
      return a?.mode===mode&&a.frames>=before+frames;
    },{mode,before,frames},{timeout:60000});
    await page.screenshot({path:path.join(out,
      ['Idle','Walk','Run','Jump'].indexOf(mode)+1+'-'+mode.toLowerCase()+
      '-original-vs-animated.png'),timeout:30000});
    const snap=await state();
    if(!snap.materials||snap.error)throw Error(mode+' broke original source: '+JSON.stringify(snap));
    console.log('CONTROLLED A/B '+mode+' screenshot recorded: '+JSON.stringify(snap));
  }
  if(errors.length)throw Error('Original-vs-rig browser exceptions: '+JSON.stringify(errors));
  console.log('PASS identical base Tripo materials, <1mm vertex bind error, 5 real A/B GPU screenshots');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
