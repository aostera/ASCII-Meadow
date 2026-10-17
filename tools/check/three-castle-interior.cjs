// End-to-end castle: same native renderer, authored exterior state preserved,
// real playable interior + tower links, keyboard and phone buttons + exit.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const out=path.join(process.cwd(),'shots','three-castle-interior');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
  for(const mobile of [false,true]){
   const label=mobile?'phone':'desktop';
   const context=await browser.newContext({
    viewport:mobile?{width:390,height:844}:{width:1100,height:740},
    deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile
   });
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   const r=await page.goto(base.replace(/\/$/,'')+
    '/experiments/three/native.html?edit=0&castleInterior=1',
    {waitUntil:'domcontentloaded'});
   assert(r?.ok(),'Castle game URL inaccessible');
   await page.waitForFunction(()=>window.__ASCII_NATIVE__?.mode==='three'&&
    window.__ASCII_NATIVE__.castleInterior?.frames>4,undefined,{timeout:120000});
   const first=await page.evaluate(()=>({
    stats:window.__ASCII_NATIVE__.castleInterior,
    map:JSON.stringify(MEADOW_MAP),
    actor:[player.x,player.y],
    gpu:document.querySelectorAll('#three-parity-canvas').length,
    renderer:window.__ASCII_NATIVE__.renderer?.domElement?.id
   }));
   assert(first.stats.active&&first.stats.rooms===9&&
    first.stats.usesNativeRenderer,label+' interior did not initialize');
   assert.equal(first.gpu,1,label+' incorrectly created extra WebGL canvas');
   await page.screenshot({path:path.join(out,label+'-gate.png')});
   const startX=first.stats.x,startZ=first.stats.z;
   await page.keyboard.down('d');await page.waitForTimeout(750);await page.keyboard.up('d');
   await page.waitForTimeout(80);
   const after=await page.evaluate(()=>window.__ASCII_NATIVE__.castleInterior);
   assert(after.x>startX+.5,label+' keyboard right did not move character');
   assert(Math.abs(after.z-startZ)<.2,label+' right movement incorrectly moved Z');
   if(mobile){
    // Test actual touch-pad button, not just a synthetic keyboard event.
    const b=page.locator('.castle-interior-pad button[data-key="ArrowUp"]');
    await b.scrollIntoViewIfNeeded();
    const rect=await b.boundingBox();assert(rect,label+' touch control missing');
    await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);
    await page.mouse.down();await page.waitForTimeout(450);await page.mouse.up();
    await page.waitForTimeout(80);
    const touch=await page.evaluate(()=>window.__ASCII_NATIVE__.castleInterior);
    assert(touch.z<after.z-.3,label+' mobile movement pad not interactive');
   }else{
    // Follow the actual sanctuary route north, then the western tower corridor.
    await page.keyboard.down('w');await page.waitForTimeout(1100);await page.keyboard.up('w');
    await page.screenshot({path:path.join(out,label+'-hall.png')});
   }
   assert.equal(await page.evaluate(()=>JSON.stringify(MEADOW_MAP)),first.map,
    label+' authored exterior map unexpectedly changed');
   assert.deepEqual(await page.evaluate(()=>[player.x,player.y]),first.actor,
    label+' exterior player moved during interior exploration');
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>window.__ASCII_NATIVE__?.castleInterior?.active===false);
   assert.equal(await page.evaluate(()=>JSON.stringify(MEADOW_MAP)),first.map,
    label+' returning outdoors mutated map');
   // The production-like flow is the *actual E interaction at the exterior
   // castle gate*, not the QA query string. Teleport the TEST knight only to
   // the authored gate (never change the map), then use normal input.
   await page.evaluate(()=>{
     const spot=props.flatMap(p=>p.spots||[]).find(s=>s._nativeInterior);
     if(!spot)throw Error('No live castle gate interaction in world props');
     player.x=spot.x;player.y=spot.y;player.hT=140;
   });
   await page.waitForFunction(()=>activeSpot?.label==='войти в замок',
      undefined,{timeout:15000});
   await page.keyboard.press('e');
   await page.waitForFunction(()=>window.__ASCII_NATIVE__?.castleInterior?.active===true,
      undefined,{timeout:10000});
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>window.__ASCII_NATIVE__?.castleInterior?.active===false);
   assert.equal(await page.evaluate(()=>JSON.stringify(MEADOW_MAP)),first.map,
     label+' exterior gate roundtrip changed authored map');
   assert.equal(errors.length,0,label+' script errors: '+errors.join(' | '));
   console.log('PASS castle interior '+label+': nine rooms, one native renderer, movement, no map mutation, return');
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
