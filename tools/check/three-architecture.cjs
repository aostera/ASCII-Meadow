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
    await page.locator('#source-arch-close').click();
    const restored=await page.evaluate(()=>({
      overlay:!!window.__ASCII_SOURCE_3D__,
      map:JSON.stringify(window.__ASCII_PARITY__.map),
      originalMode:window.__ASCII_PARITY__.mode
    }));
    if(restored.overlay||restored.map!==before.map||restored.originalMode!=='legacy')
      throw Error('Architecture viewer failed to restore authored scene');
    if(errors.length)throw Error('Architecture viewer exceptions: '+errors.join('; '));
    console.log('NATIVE GOTHIC SOURCE PASS '+JSON.stringify({castle:before.castle,gate,mapUnchanged:true,restored:true}));
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
