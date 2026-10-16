// Isolated Ashen Vow showroom smoke: live browser, desktop + touch viewport.
// This page is NEVER wired to original gameplay or production.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const host=process.argv[2]||'http://127.0.0.1:8181';
const out=path.resolve('shots/three-ashen-vow');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  for(const mobile of [false,true]){
   const context=await browser.newContext({
    viewport:mobile?{width:390,height:844}:{width:1280,height:800},
    deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile
   });
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   const response=await page.goto(host.replace(/\/$/,'')+'/experiments/three/ashen-vow.html',{waitUntil:'domcontentloaded'});
   assert(response?.ok(),'Showroom HTTP failed');
   try{
    await page.waitForFunction(()=>window.__ASHEN_VOW__?.ready,{timeout:30000});
   }catch(e){
    await page.screenshot({path:path.join(out,mobile?'failed-phone.png':'failed-desktop.png')});
    throw new Error('Showroom failed: '+errors.join(' | ')+'; '+e.message);
   }
   const meshes=await page.evaluate(()=>window.__ASHEN_VOW__.meshes);
   assert(meshes>=90,'Too few actual 3D parts: '+meshes);
   for(const clip of ['idle','walk','run','jump','attack','crouch','salute','turn']){
    await page.locator('[data-clip="'+clip+'"]').click();
    const value=await page.evaluate(()=>window.__ASHEN_VOW__.current);
    assert.equal(value,clip,'Clip switch failed');
   }
   await page.locator('[data-clip="walk"]').click();
   // SwiftShader on a simulated phone can spend >500 ms drawing a single
   // detailed character frame. Check actual progress instead of imposing
   // a wall-clock delay that incorrectly fails healthy animation.
   await page.waitForFunction(()=>{
     const progress=Number(document.querySelector('#scrub')?.value);
     return window.__ASHEN_VOW__?.playing&&progress>0;
   },undefined,{timeout:60000,polling:100});
   const animatedProgress=Number(await page.locator('#scrub').inputValue());
   assert(animatedProgress>0,'Animation timeline did not run');
   await page.locator('#pause').click();
   assert.equal(await page.evaluate(()=>window.__ASHEN_VOW__.playing),false);
   await page.locator('#scrub').evaluate(el=>{el.value='750';el.dispatchEvent(new Event('input',{bubbles:true}));});
   assert.equal((await page.locator('#scrub-value').innerText()),'75%');
   await page.locator('#viewBack').click();
   const z=await page.evaluate(()=>window.__ASHEN_VOW__.model.parent===null?null:1);
   assert.equal(z,1,'Scene should stay attached after camera move');
   await page.locator('#auto').click();
   assert((await page.locator('#auto').getAttribute('class')||'').includes('active'),'Auto rotate inactive');
   await page.locator('#wire').click();
   await page.locator('#wire').click();
   await page.locator('[data-clip="idle"]').click();
   await page.screenshot({path:path.join(out,mobile?'phone.png':'desktop.png'),fullPage:true});
   if(errors.length)throw new Error('Console errors: '+errors.join(' | '));
   console.log((mobile?'Phone':'Desktop')+': OK, '+meshes+' meshes, 8 clips, orbit controls, scrub and pause.');
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
