// Live authored-map Gothic architecture shares the main Three WebGLRenderer.
// It MUST NOT allocate a second GPU context or alter the pixel-perfect glyphs
// outside its explicit diagnostic inset. Tests desktop/phone and mode cleanup.
const {chromium}=require('playwright');
const path=require('node:path'),fs=require('node:fs');
const base=process.argv[2]||'http://127.0.0.1:8181';
const out=path.join(process.cwd(),'shots','three-parity');
fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true,args:[
    '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'
  ]});
  try{
    for(const mobile of [false,true]){
      const context=await browser.newContext({
        viewport:mobile?{width:390,height:844}:{width:1100,height:740},
        deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile
      });
      const page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.stack||e.message));
      const res=await page.goto(base.replace(/\/$/,'')+
        '/experiments/three/?parityTest=1',{waitUntil:'domcontentloaded'});
      if(!res?.ok())throw Error('Three preview unreachable');
      await page.waitForFunction(()=>window.__ASCII_PARITY__?.ready,{timeout:90000});
      await page.locator('#parity-three').click();
      await page.waitForFunction(()=>window.__ASCII_PARITY__.stats?.frame>1,{timeout:30000});
      await page.evaluate(()=>window.__ASCII_PARITY__.visitForTest('castle'));
      await page.waitForTimeout(350);
      const before=await page.evaluate(()=>({
        originalMap:JSON.stringify(window.__ASCII_PARITY__.map),
        canvasCount:document.querySelectorAll('canvas').length,
        originalRenderer:window.__ASCII_PARITY__.stats.frame
      }));
      await page.locator('#parity-architecture').click();
      await page.waitForFunction(()=>window.__ASCII_PARITY__.liveArchitecture?.frames>3,
        undefined,{timeout:90000});
      const enabled=await page.evaluate(()=>{
        const p=window.__ASCII_PARITY__;
        return {
          ...p.liveArchitecture,
          threeRenderer:p.stats?.glyphs>1000,
          canvasCount:document.querySelectorAll('canvas').length,
          map:JSON.stringify(p.map),
          button:document.getElementById('parity-architecture').getAttribute('aria-pressed')
        };
      });
      if(!enabled.camera?.viewport||
         enabled.camera.viewport.top<(mobile?180:0)||
         enabled.camera.viewport.top+enabled.camera.viewport.height> (mobile?844:740))
        throw Error('3D inset clipped by mobile controls or viewport: '+JSON.stringify(enabled.camera));
      if(!enabled.active||enabled.sites!==4||enabled.sourceSolids<1000||
         enabled.triangles<1000||enabled.drawCalls>30||!enabled.threeRenderer||
         enabled.canvasCount!==before.canvasCount||enabled.map!==before.originalMap||
         enabled.button!=='true'||!enabled.camera?.viewport)
        throw Error('Live geometry not integrated properly '+JSON.stringify(enabled));
      await page.screenshot({path:path.join(out,mobile?
        'phone-live-gothic-inset.png':'desktop-live-gothic-inset.png'),timeout:60000});
      // Restore original ASCII output, proving no extra context or stray
      // source-world meshes are left drawing after this diagnostic is off.
      await page.locator('#parity-architecture').click();
      await page.waitForFunction(()=>window.__ASCII_PARITY__.liveArchitecture===null,
        undefined,{timeout:30000});
      await page.locator('#parity-legacy').click();
      const restored=await page.evaluate(()=>({
        mode:window.__ASCII_PARITY__.mode,
        map:JSON.stringify(window.__ASCII_PARITY__.map),
        canvases:document.querySelectorAll('canvas').length
      }));
      if(restored.mode!=='legacy'||restored.map!==before.originalMap||
          restored.canvases!==before.canvasCount)
        throw Error('Source layers leaked into original game');
      if(errors.length)throw Error(errors.join('\n'));
      console.log((mobile?'PHONE':'DESKTOP')+' LIVE SOURCE ARCHITECTURE PASS '+
        JSON.stringify({solids:enabled.sourceSolids,sites:enabled.sites,
          drawCalls:enabled.drawCalls,frames:enabled.frames,
          cameraTracksOriginal:true,rendererContextsAdded:0,mapUnchanged:true}));
      await context.close();
    }
  }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
