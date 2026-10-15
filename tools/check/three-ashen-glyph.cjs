// Independent browser acceptance gate for the original skeletal ASCII knight.
// Run with: node tools/check/three-ashen-glyph.cjs http://127.0.0.1:8181
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const host=(process.argv[2]||'http://127.0.0.1:8181').replace(/\/$/,'');
const out=path.resolve('shots/three-ashen-glyph');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  for(const phone of [false,true]){
   const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1280,height:800},
    deviceScaleFactor:phone?2:1,isMobile:phone,hasTouch:phone});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   const res=await page.goto(host+'/experiments/three/ashen-glyph-rig.html',{waitUntil:'domcontentloaded'});
   assert(res?.ok(),'Page must be served over HTTP');
   try{await page.waitForFunction(()=>window.__ASHEN_GLYPH_RIG__?.ready,{timeout:30000});}
   catch(e){
    await page.screenshot({path:path.join(out,phone?'phone-fail.png':'desktop-fail.png')});
    throw new Error('Skeleton/ASCII init failed: '+errors.join(' | ')+'; '+e.message);
   }
   const stats=await page.evaluate(()=>{
    const a=window.__ASHEN_GLYPH_RIG__;
    return {boneCount:a.boneCount,samples:a.samples,frames:a.framesPerClip,clips:a.clipNames,game:a.gameIntegrated,
      points:Array.from(a.samplesWorld).slice(0,8)};
   });
   assert(stats.boneCount>=28,'Expected articulated, independently transformed bones');
   assert(stats.samples>2300,'Expected dense 3D glyph volume');
   assert.equal(stats.frames,60);
   assert.equal(stats.game,false,'The experiment must NOT be wired to gameplay');
   assert.equal(stats.clips.length,8);
   for(const name of stats.clips){
    await page.locator('[data-clip="'+name+'"]').click();
    assert.equal(await page.evaluate(()=>window.__ASHEN_GLYPH_RIG__.clip),name);
   }
   await page.locator('[data-clip="walk"]').click();
   await page.waitForTimeout(250);
   const moved=await page.evaluate(()=>{
    const a=window.__ASHEN_GLYPH_RIG__;
    a.pose(0);const before=a.bones['thighL'].quaternion.toArray();
    a.pose(.25);const after=a.bones['thighL'].quaternion.toArray();
    a.pose(.5);const positions=Array.from(a.samplesWorld).slice(0,9);
    return {before,after,positions};
   });
   assert.notDeepEqual(moved.before,moved.after,'IK gait must move legs');
   assert(moved.positions.every(Number.isFinite),'Glyph coordinates must stay valid');
   await page.locator('#pause').click();
   await page.locator('#frame').evaluate(x=>{x.value='42';x.dispatchEvent(new Event('input',{bubbles:true}));});
   assert.equal(await page.locator('#frameOut').innerText(),'43 / 60');
   await page.locator('#skeleton').click();
   assert.equal(await page.evaluate(()=>window.__ASHEN_GLYPH_RIG__.debugVisible),true);
   await page.locator('#back').click();
   await page.locator('#skeleton').click();
   await page.locator('[data-clip="idle"]').click();
   await page.waitForTimeout(250);
   await page.screenshot({path:path.join(out,phone?'phone-back.png':'desktop-back.png'),fullPage:true});
   await page.locator('#front').click();
   await page.waitForTimeout(150);
   await page.screenshot({path:path.join(out,phone?'phone.png':'desktop.png'),fullPage:true});
   if(!phone){
     await page.locator('#side').click();
     await page.waitForTimeout(150);
     await page.screenshot({path:path.join(out,'desktop-side.png'),fullPage:true});
     await page.locator('#skeleton').click();
     await page.screenshot({path:path.join(out,'desktop-skeleton.png'),fullPage:true});
   }
   if(errors.length)throw Error('WebGL errors: '+errors.join(' | '));
   console.log((phone?'Phone':'Desktop')+' OK '+JSON.stringify(stats).slice(0,250));
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
