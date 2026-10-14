// Test the optional *source-backed* native Gothic geometry viewer.
// Must not mutate original authored map or leave an extra GPU context behind.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const dir=path.join(process.cwd(),'shots','three-parity');
fs.mkdirSync(dir,{recursive:true});
const base=process.argv[2]||'http://127.0.0.1:8181';
(async()=>{
  const browser=await chromium.launch({headless:true,args:[
    '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'
  ]});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:800}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base.replace(/\/$/,'')+'/experiments/three/?geometry=1',
      {waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__ASCII_SOURCE_3D__?.stats?.triangles>100,
      undefined,{timeout:90000});
    const before=await page.evaluate(()=>({
      map:JSON.stringify(window.__ASCII_PARITY__.map),
      castle:{...window.__ASCII_SOURCE_3D__.stats}
    }));
    if(before.castle.sourceSolids<10||before.castle.drawCalls>8||
       before.castle.skipped>Math.ceil(before.castle.sourceSolids*.08))throw Error('Castle source geometry invalid: '+JSON.stringify(before.castle));
    await page.screenshot({path:path.join(dir,'native-source-castle.png'),timeout:60000});
    await page.locator('#source-arch-site').selectOption('broken-gate');
    await page.waitForFunction(()=>window.__ASCII_SOURCE_3D__?.stats?.id==='broken-gate');
    const gate=await page.evaluate(()=>({...window.__ASCII_SOURCE_3D__.stats}));
    if(gate.sourceSolids<10||gate.triangles<50||gate.skipped>Math.ceil(gate.sourceSolids*.08))
       throw Error('Native ruined gateway must be real 3D halfspaces: '+JSON.stringify(gate));
    await page.screenshot({path:path.join(dir,'native-source-gate.png'),timeout:60000});
    // Assemble castle AND every authored Gothic ruin in a single native 3D
    // world, then align its orthographic camera with the original camera.
    await page.locator('#source-arch-site').selectOption('world');
    await page.waitForFunction(()=>window.__ASCII_SOURCE_3D__?.stats?.id==='world');
    const world=await page.evaluate(()=>({
      ...window.__ASCII_SOURCE_3D__.stats,
      siteIds:window.__ASCII_SOURCE_3D__.sourceSites
    }));
    if(world.authoredSites!==4||world.siteIds.length!==4||
       world.triangles<=before.castle.triangles+gate.triangles||
       world.drawCalls>30)
      throw Error('Unified authored 3D world is incomplete: '+JSON.stringify(world));
    await page.screenshot({path:path.join(dir,'native-source-full-world.png'),timeout:60000});
    await page.locator('#source-arch-focus').selectOption('broken-gate');
    await page.waitForFunction(()=>document.getElementById('source-arch-focus')?.value==='broken-gate');
    await page.screenshot({path:path.join(dir,'native-source-world-gate-focused.png'),timeout:60000});
    const refocused=await page.evaluate(()=>window.__ASCII_SOURCE_3D__.focus('castle'));
    if(!refocused)throw Error('Could not frame actual main castle in native world');
    await page.screenshot({path:path.join(dir,'native-source-world-castle-focused.png'),timeout:60000});
    await page.locator('#source-arch-sync').click();
    if(await page.locator('#source-arch-sync').textContent()!=='Камера игры: вкл.')
      throw Error('Game-camera alignment toggle failed');
    await page.screenshot({path:path.join(dir,'native-source-game-camera.png'),timeout:60000});
    await page.locator('#source-arch-sync').click();

    await page.locator('#source-arch-close').click();
    const restored=await page.evaluate(()=>({
      overlay:!!window.__ASCII_SOURCE_3D__,
      map:JSON.stringify(window.__ASCII_PARITY__.map),
      originalMode:window.__ASCII_PARITY__.mode
    }));
    if(restored.overlay||restored.map!==before.map||restored.originalMode!=='legacy')
      throw Error('Architecture viewer failed to restore authored scene');
    if(errors.length)throw Error('Architecture viewer exceptions: '+errors.join('; '));
    console.log('NATIVE GOTHIC SOURCE PASS '+JSON.stringify({castle:before.castle,gate,world,mapUnchanged:true,restored:true}));
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
