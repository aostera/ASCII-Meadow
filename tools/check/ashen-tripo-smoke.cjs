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
    return {error:l.error,bones:l.bones,loaded:l.ready,weapon:l.weaponAttached};
  });
  if(!data.loaded||data.error||data.bones!==40||!data.weapon)
    throw Error('Real 40-bone Tripo GLB/real wrist sword failed to load: '+JSON.stringify(data));
  for(const mode of ['Idle','Walk','Run','Jump']){
    await page.locator('[data-motion="'+mode+'"]').click();
    await page.waitForFunction(m=>{
      const a=window.__ASHEN_ANIMATION_LAB__;
      return a?.model?.userData?.gltf?.clip===m;
    },mode,{timeout:13000});
    const state=await page.evaluate(()=>{
      const a=window.__ASHEN_ANIMATION_LAB__,p=a.state;
      return {mode:a.model.userData.gltf.clip,bones:a.bones,
        version:p.animationVersion,weapon:p.weaponAttached,
        soleReads:p.soleVertexReads,contact:p.footContact};
    });
    if(state.version!=='Tripo-IK-v18-sampled-stance-fastpath'||
       !state.weapon||state.bones!==40||
       !Number.isInteger(state.soleReads)||state.soleReads>64)
      throw Error(mode+' wrong authentic Tripo rig/per-frame skinning: '+JSON.stringify(state));
    await page.screenshot({path:path.join(out,mode.toLowerCase()+'.png'),timeout:30000});
    console.log('PASS '+mode+': '+JSON.stringify(state));
  }
  if(failures.length)throw Error('Page errors: '+JSON.stringify(failures));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
