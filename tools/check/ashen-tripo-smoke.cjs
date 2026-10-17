// Fast 4-state gate for the authentic, unreplaced 40-bone Tripo GLB.
// The long contact/sword regression remains separate. This quick check
// gives an early playable-integration signal and four real 3D screenshots.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const rootUrl=(process.argv[2]||'http://127.0.0.1:8181').replace(/\/$/,'');
const out=path.join(process.cwd(),'shots','ashen-tripo-smoke');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
   '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
  const page=await browser.newPage({viewport:{width:1120,height:780}});
  const failures=[];
  page.on('pageerror',e=>failures.push(String(e)));
  const res=await page.goto(rootUrl+'/experiments/three/ashen-tripo-animation-workshop.html',
    {waitUntil:'domcontentloaded',timeout:60000});
  if(res.status()!==200)throw Error('No original studio HTML');
  await page.waitForFunction(()=>{
    const l=window.__ASHEN_ANIMATION_LAB__;
    return l&&(l.ready||l.error);
  },undefined,{timeout:90000});
  const data=await page.evaluate(()=>{
    const l=window.__ASHEN_ANIMATION_LAB__;
    return {error:l.error,bones:l.bones,loaded:l.ready,
      weapon:l.weaponAttached,paletteActive:l.paletteActive};
  });
  if(!data.loaded||data.error||data.bones!==40||!data.weapon||
     data.paletteActive!==false)
    throw Error('Real 40-bone Tripo GLB/real wrist sword failed to load: '+JSON.stringify(data));
  for(const mode of ['Idle','Walk','Run','Jump']){
    const before=await page.evaluate(()=>window.__ASHEN_ANIMATION_LAB__.frame);
    await page.locator('[data-motion="'+mode+'"]').click();
    // A selected button is NOT evidence of a completed motion pose:
    // wait for >= 14 genuine fixed-timestep bone updates and both
    // native GLB clip and palette integrity BEFORE taking a photo.
    await page.waitForFunction(({mode,before})=>{
      const a=window.__ASHEN_ANIMATION_LAB__;
      return a?.frame>=before+14 &&
        a?.model?.userData?.gltf?.clip===mode&&
        a?.paletteActive===false;
    },{mode,before},{timeout:45000});
    const state=await page.evaluate(()=>{
      const a=window.__ASHEN_ANIMATION_LAB__,p=a.state;
      return {mode:a.model.userData.gltf.clip,bones:a.bones,
        version:p.animationVersion,weapon:p.weaponAttached,
        soleReads:p.soleVertexReads,contact:p.footContact};
    });
    if(state.version!=='Tripo-IK-v22-segment-aligned-arms'||
       !state.weapon||state.bones!==40||
       !Number.isInteger(state.soleReads)||state.soleReads>64)
      throw Error(mode+' wrong authentic Tripo rig/per-frame skinning: '+JSON.stringify(state));
    await page.evaluate(()=>new Promise(resolve=>
      requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.screenshot({path:path.join(out,mode.toLowerCase()+'.png'),timeout:30000});
    console.log('PASS '+mode+': '+JSON.stringify(state));
  }
  // The game opts out of optional SECOND diagnostic skin sampling.
  // Check the real v18 controller without loading replacement geometry.
  const nativeFastPath=await page.evaluate(()=>{
    const rig=window.__ASHEN_ANIMATION_LAB__.model;
    rig.userData.animate(1/60,{
      speed:15,run:true,heading:0,inspectSoles:false
    },0);
    const p=rig.userData.pose();
    return {surface:p.soleSurface,reads:p.soleVertexReads,
      correction:p.contactCorrection};
  });
  if(nativeFastPath.surface!==null||
     nativeFastPath.reads<0||nativeFastPath.reads>24||
     !Number.isFinite(nativeFastPath.correction))
    throw Error('Native CPU skin fastpath failed: '+JSON.stringify(nativeFastPath));
  console.log('PASS production sole fastpath: '+JSON.stringify(nativeFastPath));
  // Baseline image from the NEVER-RECOLORED 40-bone source viewer.
  // Compare visually against the workshop to reject unexpected materials,
  // distorted shading or clothing before declaring the character complete.
  await page.goto(rootUrl+'/experiments/three/ashen-tripo-v2-viewer.html',
    {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>{
    const v=window.__TRIPO_V2_VIEW__;
    return v?.ready||v?.error;
  },undefined,{timeout:90000});
  const original=await page.evaluate(()=>window.__TRIPO_V2_VIEW__);
  if(!original.ready||original.bones!==40)
    throw Error('Original untouched Tripo reference was unavailable: '+
      JSON.stringify(original));
  await page.locator('#side').click(); // Raw GLB +X is authored forward.
  await page.evaluate(()=>new Promise(resolve=>
    requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.screenshot({path:path.join(out,'original-tripo-baseline.png'),
    timeout:30000});
  console.log('PASS original GLB material baseline captured');
  if(failures.length)throw Error('Page errors: '+JSON.stringify(failures));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
