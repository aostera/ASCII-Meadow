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
  // Diagnosis: inspect the real bone pivots/ancestry, since a theoretical IK
  // limb length is not evidence of the GLB's actual knee/ankle hierarchy.
  const legSkeleton=await page.evaluate(()=>{
    const root=window.__ASHEN_ANIMATION_LAB__.model;
    let bones;root.traverse(o=>{if(!bones&&o.isSkinnedMesh)bones=o.skeleton.bones;});
    const V=bones[0].position.constructor;
    const d=(i)=>{
      const bone=bones[i],v=new V();bone.getWorldPosition(v);
      return {id:i,name:bone.name,parent:bone.parent?.name||'none',
        p:v.toArray().map(n=>+n.toFixed(5)),local:bone.position.toArray().map(n=>+n.toFixed(5))};
    };
    return {left:[31,32,33,34].map(d),right:[26,27,28,29].map(d),
      spine:d(1),pelvis:d(0)};
  });
  console.log('REAL TRIPO LEG BONE GEOMETRY '+JSON.stringify(legSkeleton));
  for(const [mode,view] of [['Idle','front'],['Walk','front'],['Run','side'],['Jump','front']]){
   await page.locator('[data-motion="'+mode+'"]').click();
   await page.locator('[data-view="'+view+'"]').click();
   await page.waitForTimeout(500);
   const data=await inspect();
   // Always retain a genuine render even when an anatomy assertion fails.
   await page.screenshot({path:path.join(out,mode.toLowerCase()+'-'+view+'.png')});
   if(Math.abs(data.pose.legCalibration.left.thigh-.209)>.008 ||
      Math.abs(data.pose.legCalibration.right.shin-.169)>.008)
      throw Error('Leg calibration must use real Tripo joints');
   if(data.pose.kneeBend.some(k=>k<0||k>1.25))
      throw Error('Leg must never hyperflex: '+JSON.stringify(data.pose.kneeBend));
   if(data.pose.animationVersion!=='Tripo-IK-v12-planar-boot-pins')
      throw Error('Wrong shoulder/elbow controller: '+data.pose.animationVersion);
   if(mode==='Idle'){
    if(data.pose.kneeBend.some(k=>k<0||k>1.23))
      throw Error('Invalid forward-knee IK flexion: '+JSON.stringify(data.pose.kneeBend));
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
  // True foot-to-floor QA: sample actual GLB toe/boot pivot world
  // coordinates over moving frames, not the synthetic foot-contact labels.
  const groundProbe=await page.evaluate(()=>{
    const root=window.__ASHEN_ANIMATION_LAB__.model;
    let bones;root.traverse(o=>{if(!bones&&o.isSkinnedMesh)bones=o.skeleton.bones;});
    const V=new (bones[0].position.constructor)();
    const summary=[];
    for(const [name,speed,run] of [['Walk',8,false],['Run',15,true]]){
      const ground=[],swing=[],pelvis=[],knees=[],footX=[];
      for(let i=0;i<200;i++){
        root.userData.animate(1/60,{speed,run,heading:0},i/60);
        const pose=root.userData.pose();
        if(i<60)continue; // allow transitions/stride speed to settle
        bones[0].getWorldPosition(V);pelvis.push(V.y);
        knees.push(...pose.kneeBend);
        for(const [idx,side] of [[34,0],[29,1]]){
          bones[idx].getWorldPosition(V);
          (pose.footContact[side]?ground:swing).push(V.y);
          footX.push(V.z);
        }
      }
      const range=a=>[Math.min(...a),Math.max(...a)];
      summary.push({name,ground:range(ground),swing:range(swing),
        pelvis:range(pelvis),knee:range(knees),footForward:range(footX)});
    }
    return summary;
  });
  console.log('REAL GLB TOE PLANTING AND PELVIS QA '+JSON.stringify(groundProbe));
  for(const m of groundProbe){
    if(m.ground[0]<-.07||m.ground[1]>.13||
      m.pelvis[1]-m.pelvis[0]>.09||m.knee[1]>1.25)
      throw Error('Boot-ground / pelvis out of bounds: '+JSON.stringify(m));
  }
  // Real actor-ground travel: a planted foot must remain at one
  // world-relative horizontal coordinate even though the sprite itself
  // is always rendered at the screen centre. This uses the genuine
  // 40-bone rig, never fake positions or static state labels.
  const footLock=await page.evaluate(()=>{
    const root=window.__ASHEN_ANIMATION_LAB__.model;
    const holds=[[],[]],slip=[0,0],last=[null,null];
    // Compare actual boot bone positions to virtual actor map distance.
    // Unlike virtual footAnchorWorldX, this detects IK reach clamping.
    let bones;root.traverse(o=>{if(!bones&&o.isSkinnedMesh)bones=o.skeleton.bones;});
    const realSlip=[0,0],lastReal=[null,null],firstReal=[null,null],
      totalRealSlip=[0,0];
    const bootPos=new (root.position.constructor)();
    const normToSource=root.userData.sourceUnitsPerMetre;
    let distance=0,pinnedFrames=0;
    for(let i=0;i<300;i++){
      distance+=.009;
      root.userData.animate(1/60,{
        speed:15,run:true,heading:0,travelSource:distance
      },i/60);
      const p=root.userData.pose();
      for(let j=0;j<2;j++){
        if(p.footPinned[j]){
          pinnedFrames++;
          if(last[j]!==null)slip[j]=Math.max(slip[j],
            Math.abs(p.footAnchorWorldX[j]-last[j]));
          last[j]=p.footAnchorWorldX[j];holds[j].push(last[j]);
          bones[j===0?34:29].getWorldPosition(bootPos);
          root.worldToLocal(bootPos);
          // Source-model local +X maps to game-facing +Z under oriented parent.
          const trueBootX=distance+bootPos.z*normToSource;
          if(lastReal[j]!==null)realSlip[j]=Math.max(realSlip[j],
            Math.abs(trueBootX-lastReal[j]));
          if(firstReal[j]===null)firstReal[j]=trueBootX;
          totalRealSlip[j]=Math.max(totalRealSlip[j],
            Math.abs(trueBootX-firstReal[j]));
          lastReal[j]=trueBootX;
        }else{last[j]=null;lastReal[j]=null;firstReal[j]=null;}
      }
    }
    const stoppedPhase=root.userData.pose().phase;
    for(let i=0;i<30;i++)
      root.userData.animate(1/60,{
        speed:15,run:true,heading:0,travelSource:distance
      },i/60);
    return {pinnedFrames,slip,realBootSlipPerTick:realSlip,
      maxRealBootContactDrift:totalRealSlip,
      stationaryPhaseError:
      Math.abs(root.userData.pose().phase-stoppedPhase),
      travelSource:root.userData.pose().travelSource};
  });
  console.log('REAL MAP-DISTANCE FOOT-PINNING QA '+JSON.stringify(footLock));
  if(footLock.pinnedFrames<80||footLock.slip.some(n=>n>.0004)||
     footLock.maxRealBootContactDrift.some(n=>n>.03)||
     footLock.stationaryPhaseError>.000001)
    throw Error('Planted feet slipped or character moonwalked into a wall: '+
      JSON.stringify(footLock));
  // Planar game-map contact: 4 segments at 60 Hz with straight,
  // diagonal, sideways, and gradually turning source actor movement.
  // Check the true original boot bones independently of reported pose data.
  const planarSweep=await page.evaluate(()=>{
    const root=window.__ASHEN_ANIMATION_LAB__.model;
    let bones;root.traverse(o=>{if(!bones&&o.isSkinnedMesh)bones=o.skeleton.bones;});
    const actual=new (root.position.constructor)();
    let groundX=0,groundZ=0,distance=0;
    const planted=[0,0],largest=[0,0],sum=[0,0];
    let maxAbduction=0,maxKnee=0,maxDiagnosticError=0;
    for(let i=0;i<280;i++){
      const a=i<70?0:i<140?Math.PI/4:i<210?Math.PI/2:
        Math.PI/2+(i-210)/70*Math.PI/4;
      // Fixed step distance in real Tripo source-bone coordinates.
      groundX+=.006*Math.sin(a);
      groundZ+=.006*Math.cos(a);
      distance+=.006;
      root.userData.animate(1/60,{
        speed:15,run:true,heading:a,travelSource:distance,
        groundX,groundZ
      },i/60);
      const p=root.userData.pose();
      if(p.animationVersion!=='Tripo-IK-v12-planar-boot-pins')
        throw Error('Wrong planar IK version');
      maxKnee=Math.max(maxKnee,...p.kneeBend);
      maxAbduction=Math.max(maxAbduction,...p.hipAbduction.map(Math.abs));
      const c=Math.cos(p.heading),ss=Math.sin(p.heading);
      for(let j=0;j<2;j++){
        if(!p.planarFootPinned[j])continue;
        if(!p.footPinWorldXZ[j]||!p.trueBootWorldXZ[j])
          throw Error('Planar foot pin has no real boot evidence');
        planted[j]++;
        bones[j===0?34:29].getWorldPosition(actual);
        root.worldToLocal(actual);
        const scale=root.userData.sourceUnitsPerMetre;
        const bx=actual.x*scale,bz=actual.z*scale;
        const physical=[groundX+c*bx+ss*bz,groundZ-ss*bx+c*bz];
        const diagnostic=p.trueBootWorldXZ[j];
        maxDiagnosticError=Math.max(maxDiagnosticError,
          Math.hypot(physical[0]-diagnostic[0],physical[1]-diagnostic[1]));
        const anchor=p.footPinWorldXZ[j];
        const error=Math.hypot(physical[0]-anchor[0],physical[1]-anchor[1]);
        if(!Number.isFinite(error))throw Error('Non-finite Tripo foot bone');
        sum[j]+=error;largest[j]=Math.max(largest[j],error);
      }
    }
    return {planted,largest,mean:sum.map((v,j)=>v/Math.max(1,planted[j])),
      maxKnee,maxAbduction,maxDiagnosticError,steps:280};
  });
  console.log('TRUE TRIPO XZ PLANTED-BOOT TEST '+JSON.stringify(planarSweep));
  if(planarSweep.planted.some(n=>n<45)||
     planarSweep.largest.some(n=>n>.085)||
     planarSweep.maxAbduction>.231||
     planarSweep.maxKnee>1.25||
     planarSweep.maxDiagnosticError>.00001)
    throw Error('2D planted boot solver slips or hyperflexes: '+
      JSON.stringify(planarSweep));
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
