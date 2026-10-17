// Pure user input (no teleport/private-object mutation): enter the castle,
// walk to west stair, climb up and down and return to the source world.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=(process.argv[2]||'http://127.0.0.1:8181').replace(/\/$/,'');
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
  const context=await browser.newContext({viewport:{width:1100,height:740}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto(base+'/experiments/three/native.html?edit=0&castleInterior=1',
    {waitUntil:'domcontentloaded'});
  assert(response?.ok(),'Castle entrance URL failed');
  const stats=()=>page.evaluate(()=>window.__ASCII_NATIVE__?.castleInterior);
  await page.waitForFunction(()=>window.__ASCII_NATIVE__?.castleInterior?.active&&
    window.__ASCII_NATIVE__.castleInterior.frames>3,undefined,{timeout:120000});
  const before=await page.evaluate(()=>JSON.stringify(MEADOW_MAP));
  const walk=async(key,predicate,label)=>{
   await page.keyboard.down('Shift');
   await page.keyboard.down(key);
   try{
    await page.waitForFunction(predicate,undefined,{timeout:25000});
   }catch(e){throw new Error(label+' inaccessible: '+JSON.stringify(await stats()))}
   finally{
    await page.keyboard.up(key);
    await page.keyboard.up('Shift');
   }
  };
  // Main nave central aisle -> skirt the physical benches at +2.1 z,
  // westward through two real pointed arches -> spiral stair.
  await walk('w',()=>window.__ASCII_NATIVE__?.castleInterior?.z<2.3,'central nave');
  await walk('a',()=>window.__ASCII_NATIVE__?.castleInterior?.x< -23.5,'west tower corridor');
  await walk('w',()=>window.__ASCII_NATIVE__?.castleInterior?.stairNearby==='west','west tower stair');
  const atStair=await stats();
  assert.equal(atStair.level,0);
  await page.keyboard.press('e');
  await page.waitForFunction(()=>window.__ASCII_NATIVE__?.castleInterior?.transitioning,
    undefined,{timeout:10000});
  await page.waitForFunction(()=>window.__ASCII_NATIVE__?.castleInterior?.level===1&&
    !window.__ASCII_NATIVE__.castleInterior.transitioning,
    undefined,{timeout:15000});
  const upper=await stats();
  assert.equal(upper.upperRooms,4);
  assert(Math.abs(upper.height-7.5)<.02,'Tower upper landing not on elevated floor');
  assert.equal(upper.stairNearby,'west');
  await walk('s',()=>window.__ASCII_NATIVE__?.castleInterior?.z>-.5,'upper landing space');
  // Return to the actual stair via normal movement, then descend.
  await walk('w',()=>window.__ASCII_NATIVE__?.castleInterior?.z<-.8,'upper west stair return');
  await page.keyboard.press('e');
  await page.waitForFunction(()=>window.__ASCII_NATIVE__?.castleInterior?.level===0&&
    !window.__ASCII_NATIVE__.castleInterior.transitioning,
    undefined,{timeout:15000});
  const lower=await stats();
  assert(Math.abs(lower.height)<.02,'Descending must land on original floor');
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>window.__ASCII_NATIVE__?.castleInterior?.active===false);
  assert.equal(await page.evaluate(()=>JSON.stringify(MEADOW_MAP)),before,'Authored map was modified');
  assert.equal(errors.length,0,'Browser script errors: '+errors.join(' | '));
  console.log('PASS castle actual input: nave -> west tower -> helix -> upper landing -> descent -> unchanged exterior');
  await context.close();
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
