// Visual and interaction QA for real reference-derived GLB, NOT original game integration.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=(process.argv[2]||'http://127.0.0.1:8181').replace(/\/$/,'');
const out=path.resolve('shots/ashen-vow-v12');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
 try{
 for(const phone of [false,true]){
   const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1220,height:850},
     isMobile:phone,hasTouch:phone,deviceScaleFactor:phone?2:1});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   const res=await page.goto(base+'/experiments/three/ashen-sculpt-v12.html',{waitUntil:'domcontentloaded',timeout:45000});
   assert(res?.ok(),'Preview not served');
   try{await page.waitForFunction(()=>window.__ASHEN_REFERENCE__?.ready,{timeout:60000});}
   catch(e){
    await page.screenshot({path:path.join(out,phone?'phone-failed.png':'desktop-failed.png'),fullPage:true});
    throw new Error('GLB failed to load: '+errors.join(' | ')+' / '+e.message);
   }
   const data=await page.evaluate(()=>({meshCount:__ASHEN_REFERENCE__.meshCount,
       triangles:__ASHEN_REFERENCE__.triangles,gameIntegrated:__ASHEN_REFERENCE__.gameIntegrated,
       hasRig:__ASHEN_REFERENCE__.hasRig}));
   assert(data.meshCount>=10);
   assert(data.triangles>=50000);
   assert.equal(data.gameIntegrated,false);
   assert.equal(data.hasRig,false);
   const imgPrefix=phone?'phone':'desktop';
   for(const view of ['front','side','back']){
    await page.locator('#'+view).click();await page.waitForTimeout(300);
    await page.screenshot({path:path.join(out,imgPrefix+'-'+view+'.png'),fullPage:true});
   }
   await page.locator('#texture').click();
   assert((await page.locator('#texture').innerText()).includes('Текстуры'),'Texture switch failed');
   await page.locator('#texture').click();
   await page.locator('#wire').click();await page.locator('#wire').click();
   await page.locator('#orbit').click();
   assert((await page.locator('#orbit').getAttribute('class')||'').includes('active'));
   await page.locator('#reset').click();
   if(errors.length)throw Error('Browser error: '+errors.join(' | '));
   console.log((phone?'PHONE':'DESKTOP')+' GLB OK '+JSON.stringify(data));
   await context.close();
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
