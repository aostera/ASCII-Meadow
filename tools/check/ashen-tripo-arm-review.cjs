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
      anchor:{valid:sword.userData.palmAnchorValid,
        count:sword.userData.palmVertexCount,
        local:sword.userData.palmLocal},
      pose:root.userData.pose()};
  });
  for(const [mode,view] of [['Idle','front'],['Walk','front'],['Run','side'],['Jump','front']]){
   await page.locator('[data-motion="'+mode+'"]').click();
   await page.locator('[data-view="'+view+'"]').click();
   await page.waitForTimeout(500);
   const data=await inspect();
   // Always retain a genuine render even when an anatomy assertion fails.
   await page.screenshot({path:path.join(out,mode.toLowerCase()+'-'+view+'.png')});
   if(data.pose.animationVersion!=='Tripo-IK-v6-arm-followthrough')
      throw Error('Wrong shoulder/elbow controller: '+data.pose.animationVersion);
   if(mode==='Idle'){
    if(!data.anchor.valid||data.anchor.count<12)
      throw Error('Weapon did not find weighted wrist vertices: '+JSON.stringify(data));
    for(const arm of [data.left,data.right]){
     if(arm.spread<.24||arm.spread>.59||arm.drop<.25)
      throw Error('Gauntlet still misplaced: '+JSON.stringify(data));
    }
    if(data.hilt[0]>-.17||data.hilt[1]-data.tip[1]<.3)
      throw Error('Sword crosses the abdomen: '+JSON.stringify(data));
   }
   console.log(mode+' anatomical frame',JSON.stringify(data));
  }
  // One 60 Hz pose scan per movement and compass heading. No reliance
  // on screenshots or labels alone: evaluate the actual wrist socket and
  // complete separate sword mesh in player-local/world space. These
  // clearances are conservative proxies, not mesh-triangle collision tests.
  await page.locator('#pause').click();
  const clearances=await page.evaluate(()=>{
    const root=window.__ASHEN_ANIMATION_LAB__.model;
    const tipY=root.userData.weapon.userData.tipLocalY;
    const V=root.position.constructor;
    const tipWorld=new V(),hiltWorld=new V();
    const samples=[];
    const specs=[['Idle',0,false],['Walk',8,false],['Run',15,true],['Jump',0,false]];
    for(const [mode,speed,run] of specs){
      for(const deg of [0,45,90,135,180,225,270,315]){
        let lowestTip=Infinity,minClearance=Infinity,minVertical=Infinity;
        const total=mode==='Jump'?90:60;
        for(let i=0;i<total;i++){
          const t=(i+1)/60;
          root.position.y=mode==='Jump'?.36*Math.sin(Math.PI*Math.min(t,1.49)/1.49):0;
          root.userData.animate(1/60,{
            speed,run,heading:deg*Math.PI/180,
            jumpClipTime:mode==='Jump'?t:undefined
          },t);
          const weapon=root.userData.weapon;
          weapon.getWorldPosition(hiltWorld);
          weapon.localToWorld(tipWorld.set(0,tipY,0));
          const tipLocal=root.worldToLocal(tipWorld.clone());
          const hiltLocal=root.worldToLocal(hiltWorld.clone());
          lowestTip=Math.min(lowestTip,tipWorld.y);
          minClearance=Math.min(minClearance,-hiltLocal.x,-tipLocal.x);
          minVertical=Math.min(minVertical,hiltWorld.y-tipWorld.y);
        }
        samples.push({mode,deg,lowestTip,minClearance,minVertical});
      }
    }
    root.position.y=0;
    return samples;
  });
  for(const scan of clearances){
    if(scan.lowestTip<.01||scan.minClearance<.16||scan.minVertical<.62)
      throw Error('Sword crossed right-side clearance envelope or floor: '+
        JSON.stringify(scan));
  }
  console.log('32 sword-clearance sweeps OK: '+JSON.stringify({
    minTipY:Math.min(...clearances.map(x=>x.lowestTip)),
    minHipDistance:Math.min(...clearances.map(x=>x.minClearance)),
    minBladeDrop:Math.min(...clearances.map(x=>x.minVertical))
  }));
  // Save a REAL 60 Hz Run gait as 12 sequence frames, not a still chosen
  // at a flattering moment. The screenshots use the actual Tripo GPU skin.
  await page.locator('[data-motion="Run"]').click();
  await page.locator('[data-view="side"]').click();
  await page.evaluate(()=>{
    const root=window.__ASHEN_ANIMATION_LAB__.model;
    root.position.y=0;
    for(let i=0;i<45;i++)root.userData.animate(1/60,
      {speed:15,run:true,heading:0},i/60);
  });
  const poseSamples=[];
  for(let i=0;i<12;i++){
    for(let j=0;j<3;j++)await page.locator('#frame').click();
    const pose=await page.evaluate(()=>window.__ASHEN_ANIMATION_LAB__.state);
    poseSamples.push({
      phase:pose.phase,shoulder:pose.armPose.shoulderSwing,
      elbow:pose.armPose.leftElbow,rightElbow:pose.armPose.rightElbow
    });
    await page.screenshot({
      path:path.join(out,'run-cycle-'+String(i).padStart(2,'0')+'.png'),
      clip:{x:300,y:92,width:415,height:635},timeout:30000
    });
  }
  const swingRange=Math.max(...poseSamples.map(p=>p.shoulder))-
    Math.min(...poseSamples.map(p=>p.shoulder));
  const elbowRange=Math.max(...poseSamples.map(p=>p.rightElbow))-
    Math.min(...poseSamples.map(p=>p.rightElbow));
  if(swingRange<.17||elbowRange<.035)
    throw Error('Rigid arm run cycle: '+JSON.stringify({swingRange,elbowRange,poseSamples}));
  console.log('12 true 60 Hz run-swing images OK: '+JSON.stringify({swingRange,elbowRange}));
  await browser.close();
 }catch(e){await browser.close();throw e}
})().catch(e=>{console.error(e);process.exitCode=1});
