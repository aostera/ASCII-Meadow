// Verify the REAL Cloudflare published response and browser execution.
// A green local dist build is NOT sufficient: Cloudflare _headers can combine
// multiple CSPs and silently block the pinned Three.js import.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=(process.argv[2]||'').replace(/\/$/,'');
if(!/^https:\/\/[a-z0-9-]+\.aloster36\.workers\.dev$/.test(base))
  throw Error('Provide an allowlisted ASCII Meadow Cloudflare preview URL');
const errors=[];
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
      const page=await context.newPage();
      const issues=[];
      page.on('pageerror',e=>issues.push(String(e.message).slice(0,260)));
      page.on('console',m=>{
        if(m.type()==='error'&&/content security policy|refused to load|importmap|module|three/i.test(m.text()))
          issues.push(m.text().slice(0,260));
      });
      const url=base+'/experiments/three/native.html?edit=0&castleInterior=1';
      const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
      assert.equal(response.status(),200,'Published native.html unavailable');
      const headers=response.headers();
      assert(headers['content-security-policy']?.includes('cdn.jsdelivr.net'),
        'Missing THREE CDN allowance in deployed document CSP');
      await page.waitForFunction(()=>window.__ASCII_NATIVE__?.castleInterior?.active===true&&
          window.__ASCII_NATIVE__?.mode==='three'&&
          window.__ASCII_NATIVE__.castleInterior.frames>4,
        undefined,{timeout:45000}).catch(e=>{
          throw Error(label+' deployed Three castle failed: '+JSON.stringify(issues)+' '+e.message);
        });
      const state=await page.evaluate(()=>({
        mode:window.__ASCII_NATIVE__.mode,
        rooms:window.__ASCII_NATIVE__.castleInterior.rooms,
        drawCount:window.__ASCII_NATIVE__.castleInterior.frames,
        canvas:document.querySelectorAll('#three-parity-canvas').length
      }));
      assert.equal(state.rooms,9);
      assert.equal(state.canvas,1);
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>window.__ASCII_NATIVE__.castleInterior.active===false);
      console.log('PASS PUBLISHED CASTLE',label,JSON.stringify(state));
      await context.close();
    }
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
