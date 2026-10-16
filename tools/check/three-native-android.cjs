// Android Chromium device emulation, not a claim about physical hardware.
// Verify orientation, touch-cancel, source map/actor persistence and DPR-only
// changes in the same real Three world. Also verify a WebView without WebGL2
// remains playable on its separate Canvas2D backend.
const {chromium,devices}=require('playwright');
const path=require('node:path'),fs=require('node:fs');
const base=process.argv[2]||'http://127.0.0.1:8181';
const url=(base.endsWith('/')?base.slice(0,-1):base)+
 '/experiments/three/native.html?edit=0';
const shotDir=path.join(process.cwd(),'shots','three-native-android');
fs.mkdirSync(shotDir,{recursive:true});
const device=devices['Pixel 7']||devices['Pixel 5'];
if(!device)throw Error('Playwright Android Pixel device missing');
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
  const ctx=await browser.newContext({...device});
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  const res=await page.goto(url,{waitUntil:'domcontentloaded'});
  if(!res?.ok())throw Error('Android Three page returned HTTP failure');
  await page.waitForFunction(()=>window.__ASCII_NATIVE__?.ready&&
    window.__ASCII_NATIVE__.mode==='three'&&
    window.__ASCII_MOBILE__?.enabled&&
    window.__ASCII_MOBILE__.android&&
    window.__ASCII_NATIVE__.frameCount>4,
    undefined,{timeout:120000});
  const initial=await page.evaluate(()=>({
    map:JSON.stringify(MEADOW_MAP),
    atlas:[GB.atlasCv.width,GB.atlasCv.height],
    x:player.x,y:player.y,world:worldGen,
    dpr:DPR,w:W,h:H
  }));
  // Android notification shade or OS back-gesture cancels a held touch.
  const input=await page.evaluate(()=>{
    keys.add('w');
    ptr={x:400,y:300,sx:350,sy:300,held:true,t:performance.now()};
    document.getElementById('c').dispatchEvent(new PointerEvent('pointercancel',{
      bubbles:true,cancelable:true,pointerType:'touch',pointerId:5}));
    const cancelled=ptr===null&&!keys.size;
    keys.add('a');
    ptr={x:200,y:300,sx:180,sy:300,held:true,t:performance.now()};
    window.dispatchEvent(new Event('pagehide'));
    const paused=ptr===null&&!keys.size;
    window.dispatchEvent(new Event('pageshow'));
    return {cancelled,paused,stats:window.__ASCII_MOBILE__.stats};
  });
  if(!input.cancelled||!input.paused)
    throw Error('Android navigation gesture stuck in running mode');
  // Phone -> landscape while actively rendering the full source game.
  await page.setViewportSize({width:844,height:390});
  await page.waitForFunction(()=>W===innerWidth&&H===innerHeight&&
    window.__ASCII_NATIVE__.stats?.glyphs>1000&&
    window.__ASCII_NATIVE__.frameCount>8,
    undefined,{timeout:100000});
  const landscape=await page.evaluate(()=>({
    map:JSON.stringify(MEADOW_MAP),world:worldGen,
    size:[W,H],canvas:[cv.width,cv.height],
    texture:[GB.atlasCv.width,GB.atlasCv.height],
    mode:window.__ASCII_NATIVE__.mode,actors:[player.x,player.y],
    contexts:document.querySelectorAll('#three-parity-canvas').length
  }));
  if(landscape.map!==initial.map||landscape.world<=initial.world||
     landscape.contexts!==1||landscape.mode!=='three')
    throw Error('Android orientation changed source game '+JSON.stringify({
     before:initial.world,after:landscape.world,
     contexts:landscape.contexts,mode:landscape.mode
    }));
  // WebView density can change with unchanged innerWidth/innerHeight.
  const newDpr=initial.dpr>1.6?1.25:1.75;
  const beforeDensity=landscape.world;
  await page.evaluate(ratio=>{
    Object.defineProperty(window,'devicePixelRatio',{
      configurable:true,get:()=>ratio
    });
    window.dispatchEvent(new Event('resize'));
  },newDpr);
  await page.waitForFunction(({ratio,world})=>
    Math.abs(DPR-ratio)<.001&&worldGen>world&&
    window.__ASCII_NATIVE__.stats?.glyphs>1000,
    {ratio:newDpr,world:beforeDensity},{timeout:120000});
  const scaled=await page.evaluate(()=>({
    world:worldGen,dpr:DPR,viewport:[W,H],
    map:JSON.stringify(MEADOW_MAP),mode:window.__ASCII_NATIVE__.mode,
    densityInvalidations:window.__ASCII_MOBILE__.stats.densityInvalidations,
    measuredDpr:window.__ASCII_MOBILE__.inspect().dpr,
    restoredUi:document.querySelector('.hud p')?.textContent,
    actors:[player.x,player.y]
  }));
  if(scaled.map!==initial.map||scaled.mode!=='three'||
     scaled.densityInvalidations<1||
     Math.abs(scaled.measuredDpr-newDpr)>.001)
    throw Error('Android density-only resize failed '+JSON.stringify(scaled));
  await page.screenshot({
    path:path.join(shotDir,'android-chrome-landscape.png'),timeout:60000
  });
  if(errors.length)throw Error('Android Chromium script errors '+errors.join('; '));
  console.log('ANDROID CHROME NATIVE LIFE PASS '+JSON.stringify({
    portrait:[initial.w,initial.h],landscape:landscape.size,
    densityFrom:initial.dpr,densityTo:scaled.dpr,
    worldRebuilt:true,sourceMapUnchanged:true,
    densityInvalidations:scaled.densityInvalidations,
    pointerCancelled:true
  }));
  await ctx.close();

  // An older Android WebView may not expose WebGL2. Game must not leave a
  // blank dark screen or allocate a second GPU context trying to recover it.
  const fallbackContext=await browser.newContext({...device});
  await fallbackContext.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(kind,...args){
      if(kind==='webgl2'||kind==='webgl')return null;
      return original.call(this,kind,...args);
    };
  });
  const fallbackPage=await fallbackContext.newPage(),fallbackErrors=[];
  fallbackPage.on('pageerror',e=>fallbackErrors.push(e.message));
  const fbRes=await fallbackPage.goto(url,{waitUntil:'domcontentloaded'});
  if(!fbRes?.ok())throw Error('WebView no-WebGL2 URL failed');
  await fallbackPage.waitForFunction(()=>
    window.__ASCII_NATIVE__?.ready&&
    window.__ASCII_NATIVE__.mode==='canvas2d'&&
    window.__ASCII_MOBILE__?.enabled,
    undefined,{timeout:120000});
  await fallbackPage.waitForFunction(()=>{
    const ctx2=GL.ctx2;
    if(!ctx2||ctx2.canvas.width===0)return false;
    const data=ctx2.getImageData(0,0,
      Math.min(40,ctx2.canvas.width),Math.min(40,ctx2.canvas.height)).data;
    return [...data].some((v,i)=>i%4===0&&v>=10);
  },undefined,{timeout:60000});
  const noWebgl=await fallbackPage.evaluate(()=>({
    mode:window.__ASCII_NATIVE__.mode,
    canvas2d:GL.ctx2!==null,hasGpuCanvas:!!document.querySelector('#three-parity-canvas'),
    map:JSON.stringify(MEADOW_MAP),
    hint:document.querySelector('.hud p')?.textContent
  }));
  if(noWebgl.mode!=='canvas2d'||!noWebgl.canvas2d||
    noWebgl.hasGpuCanvas||noWebgl.map!==initial.map)
    throw Error('Android WebView without WebGL2 failed '+JSON.stringify(noWebgl));
  await fallbackPage.screenshot({
    path:path.join(shotDir,'android-webview-canvas2d.png'),timeout:60000
  });
  if(fallbackErrors.length)
    throw Error('Android WebView scripts failed '+fallbackErrors.join('; '));
  console.log('ANDROID WEBVIEW NO-WEBGL2 PASS '+JSON.stringify({
    fallbackPlayable:true,sourceMapUnchanged:true,singleCanvas2D:true
  }));
  await fallbackContext.close();
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
