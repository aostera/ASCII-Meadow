// Four REAL browser captures from actual unchanged 10.7MB Tripo skin.
// No fake image generation, no changing the approved source GLB.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const base=(process.argv[2]||'http://127.0.0.1:8181').replace(/\/$/,'');
const out=path.join(process.cwd(),'shots','ashen-four-fixes');
fs.mkdirSync(out,{recursive:true});
const raf=page=>page.evaluate(()=>new Promise(resolve=>
 requestAnimationFrame(()=>requestAnimationFrame(resolve))));
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
  const page=await browser.newPage({viewport:{width:1360,height:850}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(base+'/experiments/three/ashen-tripo-ab-review.html',
    {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>{
    const a=window.__ASHEN_AB_COMPARE__;return a?.ready||a?.error;
  },undefined,{timeout:90000});
  const get=()=>page.evaluate(()=>{
    const a=window.__ASHEN_AB_COMPARE__;
    return {error:a.error,ready:a.ready,bindDelta:a.bindMaxDelta,
      materialMatch:a.materialMatch,mode:a.mode,frames:a.frames,
      style:a.styleEnabled,braces:a.swordBraces,pose:a.visualPose};
  });
  const baseline=await get();
  if(!baseline.ready||baseline.materialMatch!==true||
     baseline.bindDelta>.001||baseline.bindDelta<0)
   throw Error('Original Tripo base shape/material damaged: '+JSON.stringify(baseline));
  // 1. Material study is intentionally opt-in. Source is untouched on left.
  await page.evaluate(()=>window.__ASHEN_AB_COMPARE__.setStyle(true));
  await page.locator('[data-mode="Idle"]').click();
  await page.waitForFunction(()=>window.__ASHEN_AB_COMPARE__.frames>=40,
    undefined,{timeout:60000});
  await raf(page);
  await page.screenshot({path:path.join(out,'01-materials-original-vs-gothic-review.png')});
  const material=await get();
  if(!material.style||material.materialMatch!==true)
    throw Error('Source changed or V20 Gothic study not enabled');
  console.log('01 MATERIALS A/B SAVED: original untouched, restrained study opt-in');
  // 2. Magnify genuine wrist bone and the *separate* retention clasps.
  await page.evaluate(()=>window.__ASHEN_AB_COMPARE__.focus('grip'));
  await raf(page);
  await page.screenshot({path:path.join(out,'02-original-wrist-and-sword-grip.png')});
  if((await get()).braces!==6)throw Error('No newly authored sword-hand braces');
  console.log('02 SWORD WRIST DETAIL SAVED: retention clamps=6, fingers not rigged');
  // 3. Expose real knee/shoe swing vs unchanged original robe.
  await page.evaluate(()=>window.__ASHEN_AB_COMPARE__.focus('legs'));
  await page.locator('[data-mode="Run"]').click();
  await page.waitForFunction(()=>{
   const p=window.__ASHEN_AB_COMPARE__?.visualPose;
   return p?.animationVersion==='Tripo-IK-v20-art-review-gait' &&
     (p.leftFootLift>.074||p.rightFootLift>.074)&&
     p.footContact.includes(false);
  },undefined,{timeout:60000});
  await raf(page);
  await page.screenshot({path:path.join(out,'03-real-run-boot-swing-under-tabard.png')});
  const stride=await get();
  console.log('03 GAIT FOOT LIFT SAVED: '+JSON.stringify({
    left:stride.pose.leftFootLift,right:stride.pose.rightFootLift,
    contacts:stride.pose.footContact}));
  // Restore the unchanged source material before leaving this browser.
  await page.evaluate(()=>window.__ASHEN_AB_COMPARE__.setStyle(false));
  if((await get()).style!==false)throw Error('Temporary Gothic material not reversible');
  await page.close();

  // 4. Screenshot is from the ACTUAL original ASCII Meadow map render.
  const game=await browser.newPage({viewport:{width:1100,height:760}});
  game.on('pageerror',e=>errors.push('game: '+e));
  await game.goto(base+'/experiments/three/native.html?edit=0&ashenVow=1&tripoV2=1',
    {waitUntil:'domcontentloaded',timeout:60000});
  await game.waitForFunction(()=>{
    const s=window.__ASCII_NATIVE__;
    return s?.ready&&s?.ashenVow?.rasterFrames>=5&&s?.ashenVow?.glyphs>50;
  },undefined,{timeout:120000});
  const perf=await game.evaluate(()=>{
   const n=window.__ASCII_NATIVE__,s=n.ashenVow;
   const div=document.createElement('div');
   div.id='ashen-visible-real-glyph-metrics';
   Object.assign(div.style,{position:'fixed',bottom:'16px',left:'16px',
     zIndex:'100000',padding:'12px 15px',background:'#101014ef',
     color:'#f4e8e8',font:'14px/1.5 monospace',border:'1px solid #75646f',
     pointerEvents:'none',whiteSpace:'pre'});
   div.textContent='REAL ASCII MEADOW / Tripo V20\\n'+
    'Skinned model bones: '+s.bones+'\\n'+
    'Visible raster target: '+s.rasterTargetHz+' Hz (adaptive 20-30)\\n'+
    'Real raster frames: '+s.rasterFrames+'\\n'+
    'Cached glyph frames: '+s.glyphCacheHits+'\\n'+
    'Glyphs on map: '+s.glyphs;
   document.body.appendChild(div);
   return {bones:s.bones,targetHz:s.rasterTargetHz,
     raster:s.rasterFrames,hits:s.glyphCacheHits,glyphs:s.glyphs};
  });
  if(perf.bones!==40||perf.targetHz<20||perf.targetHz>30||
     perf.raster<5||perf.glyphs<50)
    throw Error('Native glyph performance diagnostics wrong: '+JSON.stringify(perf));
  await game.screenshot({path:path.join(out,'04-actual-game-adaptive-ascii-render.png'),
    timeout:30000});
  console.log('04 NATIVE ASCII REAL GAME SAVED: '+JSON.stringify(perf));
  if(errors.length)throw Error('Browser errors: '+JSON.stringify(errors));
  console.log('ALL FOUR REAL TRIPO FIX REVIEW SCREENSHOTS CAPTURED');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
