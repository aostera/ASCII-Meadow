// User-reported critical arm/pauldron defect: compare REAL original 40-bone
// Tripo GLB vs calibrated pose from 3 directions and during Run.
// Never hide shoulders behind tint, debug bones or new sword glamour.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const base=(process.argv[2]||'http://127.0.0.1:8181').replace(/\/$/,'');
const out=path.join(process.cwd(),'shots','ashen-v21-shoulder-review');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
  const page=await browser.newPage({viewport:{width:1360,height:850}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(base+'/experiments/three/ashen-tripo-ab-review.html',
    {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>{
   const a=window.__ASHEN_AB_COMPARE__;return a?.ready||a?.error;
  },undefined,{timeout:90000});
  const getPose=()=>page.evaluate(()=>{
   const a=window.__ASHEN_AB_COMPARE__;
   const root=a.animated,skin=[];
   root.traverse(x=>{if(x.isSkinnedMesh)skin.push(x)});
   const bones=skin[0]?.skeleton?.bones;
   if(!bones||bones.length!==40)throw Error('Actual Tripo bones not loaded');
   root.updateMatrixWorld(true);
   const joints=[6,7,8,9,16,17,18,19].map(i=>{
     const v=new root.position.constructor();
     bones[i].getWorldPosition(v);
     return v.toArray();
   });
   const metric=(index)=>{
     const [s,e,w,h]=joints.slice(index*4,index*4+4);
     const length=Math.hypot(...s.map((v,i)=>e[i]-v));
     const forearm=Math.hypot(...e.map((v,i)=>w[i]-v));
     return {drop:(s[1]-e[1])/length,
       out:Math.hypot(e[0]-s[0],e[2]-s[2])/length,
       wristBelowElbow:w[1]<e[1],
       forearmDrop:(e[1]-w[1])/forearm,
       forearmOut:Math.hypot(w[0]-e[0],w[2]-e[2])/forearm,
       length,forearm,
       shoulder:s,elbow:e,wrist:w,hand:h};
   };
   return {boneCount:bones.length,pose:a.visualPose,
     arms:[metric(0),metric(1)],sourceMaterialEqual:a.materialMatch,
     palette:a.styleEnabled,frames:a.frames,mode:a.mode};
  });
  await page.locator('[data-mode="Idle"]').click();
  await page.waitForFunction(()=>window.__ASHEN_AB_COMPARE__.frames>=60,
    undefined,{timeout:60000});
  const front=await getPose();
  if(front.pose?.animationVersion!=='Tripo-IK-v22-segment-aligned-arms'||
     front.palette||!front.sourceMaterialEqual)
    throw Error('Not authentic unpainted v21 source: '+JSON.stringify(front));
  for(const [i,arm] of front.arms.entries()){
   if(!Number.isFinite(arm.drop)||arm.drop<.90||arm.drop>.995||
      arm.forearmDrop<.82||arm.forearmDrop>.999||
      arm.length<.10||arm.forearm<.08||!arm.wristBelowElbow)
    throw Error('Broken shoulder->elbow or forearm chain '+i+': '+JSON.stringify(arm));
  }
  async function screenshot(name,metrics){
   await page.evaluate(value=>{
    let node=document.getElementById('joint-qa-overlay');
    if(!node){
      node=document.createElement('div');node.id='joint-qa-overlay';
      Object.assign(node.style,{position:'fixed',top:'75px',right:'14px',
        background:'#18151ae9',color:'#e9e2dd',zIndex:'100',
        padding:'10px',font:'12px monospace',whiteSpace:'pre',
        pointerEvents:'none'});
      document.body.append(node);
    }
    node.textContent=value;
   },metrics);
   await page.screenshot({path:path.join(out,name+'.png'),timeout:30000});
  }
  await screenshot('01-original-vs-repaired-idle-front',
    'V22 SHOULDER + ELBOW SEGMENT ALIGNMENT\nFront: same GLB, unchanged materials\n'+
    front.arms.map((a,i)=>'Arm '+i+'  down='+a.drop.toFixed(3)+
      '  length='+a.length.toFixed(3)).join('\n'));
  // Two 45-degree turns; 0.65 seconds to settle damping and avoid mismatched yaw.
  for(let i=0;i<2;i++)await page.locator('#turn').click();
  await page.waitForFunction(()=>window.__ASHEN_AB_COMPARE__.frames>=105,
    undefined,{timeout:60000});
  await screenshot('02-original-vs-repaired-idle-side',
    'V22 SHOULDER + ELBOW \n90 degree identical cameras / real GLB');
  for(let i=0;i<2;i++)await page.locator('#turn').click();
  await page.waitForFunction(()=>window.__ASHEN_AB_COMPARE__.frames>=154,
    undefined,{timeout:60000});
  await screenshot('03-original-vs-repaired-idle-back',
    'V22 PAULDRON AND ARM \n180 degree same camera / source mesh');
  for(let i=0;i<4;i++)await page.locator('#turn').click();
  await page.locator('[data-mode="Run"]').click();
  const before=(await getPose()).frames;
  await page.waitForFunction(start=>{
    const a=window.__ASHEN_AB_COMPARE__;
    return a.frames>=start+55&&a.visualPose?.armPose?.shoulderSwing!==undefined;
  },before,{timeout:60000});
  const running=await getPose();
  await screenshot('04-original-vs-repaired-running-arms',
    'V22 RUN / source Tripo pose LEFT / new hinge swing RIGHT\n'+
    running.arms.map((a,i)=>'Arm '+i+' down='+a.drop.toFixed(3)).join('  '));
  if(errors.length)throw Error('Page errors '+JSON.stringify(errors));
  console.log('PASS V22 shoulder + forearm A/B front+side+back+run, 4 REAL GLB images: '+
    JSON.stringify({arms:front.arms.map(a=>({drop:a.drop,
      outward:a.out,forearm:a.forearm})),boneCount:front.boneCount,
      run:running.arms.map(a=>({drop:a.drop,out:a.out}))}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
