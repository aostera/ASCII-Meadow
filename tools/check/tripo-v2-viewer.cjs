const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=(process.argv[2]||'http://127.0.0.1:8181').replace(/\/$/,'');
const out='shots/tripo-v2-viewer';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
 for(const m of [false,true]){
  const ctx=await browser.newContext({viewport:m?{width:390,height:844}:{width:1100,height:780},
   deviceScaleFactor:m?2:1,isMobile:m,hasTouch:m});
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const res=await page.goto(base+'/experiments/three/ashen-tripo-v2-viewer.html',{
   waitUntil:'domcontentloaded',timeout:60000});
  if(res.status()!==200)throw Error('Viewer HTML HTTP '+res.status());
  await page.waitForFunction(()=>window.__TRIPO_V2_VIEW__?.ready||
    window.__TRIPO_V2_VIEW__?.error,undefined,{timeout:120000});
  const model=await page.evaluate(()=>window.__TRIPO_V2_VIEW__);
  if(!model.ready||model.error)throw Error('GLB not loaded: '+JSON.stringify(model));
  if(model.bones!==40||model.skinnedMeshes<1||model.clips!==0)
    throw Error('Incorrect genuine rig state '+JSON.stringify(model));
  const scripts=await page.evaluate(()=>Array.from(document.querySelectorAll('canvas')).length);
  if(scripts!==1)throw Error('Expected exactly one model GPU canvas, saw '+scripts);
  await page.screenshot({path:path.join(out,(m?'phone':'desktop')+'-full.png')});
  await page.locator('#bones').click();
  const active=await page.locator('#bones').evaluate(el=>el.classList.contains('active'));
  if(!active)throw Error('Show skeleton action did not activate');
  await page.screenshot({path:path.join(out,(m?'phone':'desktop')+'-bones.png')});
  await page.locator('#side').click();
  await page.screenshot({path:path.join(out,(m?'phone':'desktop')+'-side.png')});
  await page.locator('#bones').click();
  if(errors.length)throw Error('Page JavaScript errors '+errors.join(' | '));
  console.log((m?'PHONE':'DESKTOP')+' TRIPO V2 MODEL VIEWER PASS '+JSON.stringify(model));
  await ctx.close();
 }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
