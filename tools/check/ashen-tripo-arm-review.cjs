// Fast real-GLB pose snapshots. Not a substitute for the full native-game CI.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=(process.argv[2]||'http://127.0.0.1:8181').replace(/\/$/,'');
const out='shots/ashen-arm-review';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:780}});
  await page.goto(base+'/experiments/three/ashen-tripo-animation-workshop.html',
    {waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__ASHEN_ANIMATION_LAB__?.ready,
   undefined,{timeout:90000});
  await page.waitForFunction(()=>window.__ASHEN_ANIMATION_LAB__?.frame>38,
   undefined,{timeout:25000});
  const inspect=()=>page.evaluate(()=>{
   const root=window.__ASHEN_ANIMATION_LAB__.model;
   let bones;root.traverse(o=>{if(!bones&&o.isSkinnedMesh)bones=o.skeleton.bones;});
   const V=bones[6].position.constructor;
   const pos=b=>{const p=new V();b.getWorldPosition(p);return [p.x,p.y,p.z];};
   const arm=(s,h)=>{
     const a=pos(bones[s]),b=pos(bones[h]);
     return {spread:Math.hypot(a[0]-b[0],a[2]-b[2]),drop:a[1]-b[1]};
   };
   const sword=root.userData.weapon;
   const hilt=pos(sword);
   const tip=sword.localToWorld(new V(0,sword.userData.tipLocalY,0));
   return {left:arm(6,9),right:arm(16,19),hilt,tip:[tip.x,tip.y,tip.z],
      pose:root.userData.pose()};
  });
  for(const [mode,view] of [['Idle','front'],['Walk','front'],['Run','side'],['Jump','front']]){
   await page.locator('[data-motion="'+mode+'"]').click();
   await page.locator('[data-view="'+view+'"]').click();
   await page.waitForTimeout(500);
   const data=await inspect();
   // Always retain a genuine render even when an anatomy assertion fails.
   await page.screenshot({path:path.join(out,mode.toLowerCase()+'-'+view+'.png')});
   if(mode==='Idle'){
    for(const arm of [data.left,data.right]){
     if(arm.spread<.24||arm.spread>.59||arm.drop<.25)
      throw Error('Gauntlet still misplaced: '+JSON.stringify(data));
    }
    if(data.hilt[0]>-.17||data.hilt[1]-data.tip[1]<.3)
      throw Error('Sword crosses the abdomen: '+JSON.stringify(data));
   }
   console.log(mode+' anatomical frame',JSON.stringify(data));
  }
  await browser.close();
 }catch(e){await browser.close();throw e}
})().catch(e=>{console.error(e);process.exitCode=1});
