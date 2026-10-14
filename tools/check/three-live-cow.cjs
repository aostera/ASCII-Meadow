// Test original-state-driven 3D cow in one GPU context, desktop and mobile.
// It MUST NOT change the underlying original ASCII art or source map.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const dir=path.join(process.cwd(),'shots','three-cow');
fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
  for(const mobile of [false,true]){
   const name=mobile?'phone':'desktop';
   const ctx=await browser.newContext({
    viewport:mobile?{width:390,height:844}:{width:1100,height:740},
    deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile
   });
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.stack||e.message));
   const res=await page.goto(base.replace(/\/$/,'')+
    '/experiments/three/?parityTest=1',{waitUntil:'domcontentloaded'});
   if(!res?.ok())throw Error('Native source cow preview failed to load');
   await page.waitForFunction(()=>window.__ASCII_PARITY__?.ready,undefined,{timeout:90000});
   const authored=await page.evaluate(()=>JSON.stringify(window.__ASCII_PARITY__.map));
   await page.evaluate(()=>{
    window.__ASCII_PARITY__.freezeForTest();
    window.__ASCII_PARITY__.captureReferenceForTest();
    window.__ASCII_PARITY__.captureThreeForTest();
   });
   await page.addStyleTag({content:'.hud,.stats,#parity-toolbar,.ed,.ed-open{visibility:hidden!important}'});
   const gpuCanvasBaseline=await page.evaluate(()=>document.querySelectorAll('canvas').length);
   await page.screenshot({path:path.join(dir,name+'-base.png'),animations:'disabled'});
   if(!await page.evaluate(()=>window.__ASCII_PARITY__.setCowMode(true)))
    throw Error('Failed to enable true-source native cow diagnostic');
   await page.evaluate(()=>window.__ASCII_PARITY__.captureThreeForTest());
   const active=await page.evaluate(()=>({
    ...window.__ASCII_PARITY__.liveArchitecture,
    map:JSON.stringify(window.__ASCII_PARITY__.map),
    canvases:document.querySelectorAll('canvas').length
   }));
   if(!active.active||!active.cowRig||active.cowMeshes<20||
      !active.cowActorFoot||active.map!==authored||active.canvases!==gpuCanvasBaseline)
    throw Error('Missing native source cow or leaked GPU context '+JSON.stringify(active));
   await page.screenshot({path:path.join(dir,name+'-cow.png'),animations:'disabled'});
   const stages=[];
   for(const [action,steps] of [['cow-walk',2],['cow-run',2],['cow-hop',1],['cow-graze',4]]){
    for(let i=0;i<steps;i++){
      const frame=await page.evaluate(a=>window.__ASCII_PARITY__.advanceThreeForTest(.12,a),
        i===0?action:'');
      if(!frame?.cowFoot)throw Error('Source animal no longer drives Three rig');
      stages.push(frame);
    }
    if(action==='cow-hop'&&!stages.some(f=>f.cow==='hop'))
      throw Error('Original hop never reached native cow');
    if(action==='cow-graze'&&!stages.some(f=>f.cow==='graze'&&f.cowHead>0))
      throw Error('Original head-down grazing not reflected in native rig');
    await page.screenshot({path:path.join(dir,name+'-'+action+'.png'),animations:'disabled'});
   }
   if(!stages.some(f=>f.cow==='walk')||!stages.some(f=>f.cow==='run'))
      throw Error('Source cow walk/run not observed');
   if(!await page.evaluate(()=>window.__ASCII_PARITY__.setCowMode(false)))
      throw Error('Could not dispose source cow 3D model');
   const after=await page.evaluate(()=>({
     active:window.__ASCII_PARITY__.liveArchitecture?.cowRig||false,
     map:JSON.stringify(window.__ASCII_PARITY__.map),
     mode:window.__ASCII_PARITY__.mode,
     canvases:document.querySelectorAll('canvas').length
   }));
   if(after.active||after.map!==authored||after.mode!=='three'||after.canvases!==gpuCanvasBaseline)
      throw Error('Native cow cleanup or source map failure '+JSON.stringify(after));
   if(errors.length)throw Error('Cow 3D JS exceptions: '+errors.join('\n'));
   console.log(name.toUpperCase()+' NATIVE SOURCE COW PASS '+JSON.stringify({
    meshes:active.cowMeshes,states:['walk','run','hop','graze'],
    headDown:Math.max(...stages.map(s=>s.cowHead)),originalMapUnchanged:true,
    extraCanvasContexts:0,disposed:true
   }));
   await ctx.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
