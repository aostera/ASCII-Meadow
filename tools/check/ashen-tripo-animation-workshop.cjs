// Browser-level character workshop regression. Tests the REAL Tripo V2 GLB,
// 40 deformable bones and wrist-bound sword; never replaces them with mocks.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const base=(process.argv[2]||'http://127.0.0.1:8181').replace(/\/$/,'');
const out=path.join(process.cwd(),'shots','ashen-tripo-animation-workshop');
fs.mkdirSync(out,{recursive:true});

(async()=>{
 const browser=await chromium.launch({headless:true,args:[
   '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
   for(const phone of [false,true]){
     const name=phone?'phone':'desktop';
     const ctx=await browser.newContext({
       viewport:phone?{width:390,height:844}:{width:1100,height:780},
       deviceScaleFactor:phone?2:1,isMobile:phone,hasTouch:phone
     });
     const page=await ctx.newPage(),errors=[];
     page.on('pageerror',e=>errors.push(String(e)));
     const response=await page.goto(
       base+'/experiments/three/ashen-tripo-animation-workshop.html',
       {waitUntil:'domcontentloaded',timeout:60000}
     );
     assert.equal(response.status(),200,'Animation workshop route');
     await page.waitForFunction(()=>{
       const lab=window.__ASHEN_ANIMATION_LAB__;
       return lab&&(lab.ready||lab.error);
     },undefined,{timeout:120000});
     const lab=()=>page.evaluate(()=>{
       const q=window.__ASHEN_ANIMATION_LAB__;
       return {ready:q.ready,error:q.error,bones:q.bones,
         frame:q.frame,mode:q.mode,pose:q.state,
         weapon:q.weaponAttached,jumpHeight:q.jumpHeight,
         paletteActive:q.paletteActive,autoTurn:q.autoTurn,headingTarget:q.headingTarget,
         clip:q.model?.userData.gltf?.clip,
         skinnedMeshes:q.model?.userData.gltf?.skinnedMeshes,
         canvasCount:document.querySelectorAll('#viewport canvas').length
       };
     });
     let s=await lab();
     assert.equal(s.ready,true,'Tripo V2 should load: '+s.error);
     assert.equal(s.bones,40);
     assert.ok(s.skinnedMeshes>=1,'Actual skin meshes are required');
     assert.equal(s.weapon,true,'Sword should stay parented to the wrist');
     assert.equal(s.canvasCount,1,'One model WebGL canvas');
     assert.equal(s.paletteActive,true,'Gothic studio palette defaults on');

     await page.waitForFunction(()=>window.__ASHEN_ANIMATION_LAB__.frame>=35,
       undefined,{timeout:20000});
     s=await lab();
     assert.equal(s.mode,'Idle');
     assert.equal(s.clip,'Idle');
     assert.deepEqual(s.pose.footContact,[true,true],
       'Both idle feet should be treated as planted');
     assert.equal(s.pose.animationVersion,'Tripo-IK-v8-rest-calibrated-gait');
     // Measure actual world-space skinned joints, not merely pose labels.
     // A T-pose has wrist far from shoulder; the resting armored hands must
     // be lower and substantially closer to the body. The separate sword
     // should point DOWN rather than crossing the torso.
     const anatomy=()=>page.evaluate(()=>{
       const root=window.__ASHEN_ANIMATION_LAB__.model;
       let bones=null;root.traverse(o=>{
         if(!bones&&o.isSkinnedMesh)bones=o.skeleton.bones;
       });
       if(!bones)throw Error('Real Tripo skeleton not found');
       const V=bones[6].position.constructor;
       const pos=b=>{const v=new V();b.getWorldPosition(v);
         return {x:v.x,y:v.y,z:v.z};};
       const wrist=root.userData.weapon;
       const hilt=pos(wrist);
       const bladeTip=wrist.localToWorld(new V(0,wrist.userData.tipLocalY,0));
       const toMetrics=(shoulder,hand)=>{
         const a=pos(bones[shoulder]),b=pos(bones[hand]);
         return {drop:a.y-b.y,spread:Math.hypot(a.x-b.x,a.z-b.z)};
       };
       return {left:toMetrics(6,9),right:toMetrics(16,19),
         swordDrop:hilt.y-bladeTip.y,
         weaponSocketBone:wrist.userData.socketBoneIndex,
         swordHilt:hilt, swordTip:{x:bladeTip.x,y:bladeTip.y,z:bladeTip.z}};
     });
     const idleAnatomy=await anatomy();
     assert.equal(idleAnatomy.weaponSocketBone,19,'True right wrist joint');
     assert.ok(s.pose.palmAnchorValid&&s.pose.palmVertexCount>=12,
       'Sword grip should sample REAL palm vertices, not arbitrary wrist origin: '+JSON.stringify(s.pose));
     for(const side of ['left','right']){
       assert.ok(idleAnatomy[side].drop>.24,
         side+' wrist should be BELOW shoulder, not in a T-pose: '+
         JSON.stringify(idleAnatomy));
       assert.ok(idleAnatomy[side].spread>.24&&idleAnatomy[side].spread<.59,
         side+' glove should hang BESIDE the hips, neither T-pose nor folded onto groin: '+
         JSON.stringify(idleAnatomy));
     }
     assert.ok(idleAnatomy.swordDrop>.28,
       'Sword blade must hang below the right fist: '+JSON.stringify(idleAnatomy));
     assert.ok(idleAnatomy.swordHilt.x<-.17,
       'Right-hand sword must hang outside the abdomen, not over the belt buckle: '+
       JSON.stringify(idleAnatomy));
     await page.screenshot({path:path.join(out,name+'-idle-front.png')});

     await page.locator('[data-motion="Walk"]').click();
     await page.waitForFunction(()=>window.__ASHEN_ANIMATION_LAB__?.model?.userData?.gltf?.clip==='Walk',
       undefined,{timeout:15000});
     let walking=await lab();
     assert.equal(walking.mode,'Walk');
     assert.equal(walking.pose.kneeBend.length,2);
     assert.ok(walking.pose.kneeBend.every(k=>k>=0&&k<1.25),
       'Walk knees must not fold through the thighs');
     assert.equal(walking.weapon,true);
     await page.screenshot({path:path.join(out,name+'-walk-front.png')});

     await page.locator('[data-motion="Run"]').click();
     await page.waitForFunction(()=>window.__ASHEN_ANIMATION_LAB__?.model?.userData?.gltf?.clip==='Run',
       undefined,{timeout:15000});
     let running=await lab();
     assert.ok(running.pose.kneeBend.every(k=>k>=0&&k<=1.03),
       'Run knees must stay within the anatomical IK arc');
     const calib=running.pose.legCalibration;
     assert.ok(Math.abs(calib.left.thigh-.209)<.01 &&
       Math.abs(calib.right.shin-.169)<.01,
       'Gait must use measured Tripo bone lengths, not guessed segments');
     assert.ok(Math.abs(calib.left.restHip)>0.015 &&
       Math.abs(calib.left.restShin)>0.015,
       'IK should compensate the GLB non-straight knee rest pose');
     assert.ok(running.pose.stepFrequencyHz<2.1 &&
       running.pose.stepFrequencyHz>1.1,
       'Human run must not produce 7+ fast footfalls per second');
     assert.ok(running.pose.phase>walking.pose.phase,'Gait phase must not restart on Run');
     assert.ok(running.pose.armPose.rightElbow>.25 &&
       running.pose.armPose.leftElbow<-.22,
       'Arms should flex during running rather than hang in a rigid T-pose');
     assert.equal(running.pose.capeDeflection?.length,3,'Original three cape joints');
     assert.ok(running.pose.capeDeflection.every(pair=>
       pair.length===2&&pair.every(v=>Number.isFinite(v)&&Math.abs(v)<.12)),
       'Cloak secondary motion must remain bounded even while sprinting');
     await page.locator('[data-view="side"]').click();
     await page.screenshot({path:path.join(out,name+'-run-side.png')});

     // A heading change changes rig orientation, not model size, and 360 wrap
     // is compared by shortest angular distance rather than raw subtraction.
     for(const degree of [0,45,90,135,180,225,270,315]){
       await page.locator('#direction').selectOption(String(degree));
       await page.waitForFunction(target=>{
         const a=window.__ASHEN_ANIMATION_LAB__?.state?.heading;
         return Number.isFinite(a)&&Math.abs(Math.atan2(
           Math.sin(target-a),Math.cos(target-a)))<.14;
       },degree*Math.PI/180,{timeout:5000});
     }
     // Unlike the source 8-way sprites, the real 3D rig supports every
     // heading. Exercise an angle that is deliberately NOT a preset.
     await page.locator('#yaw').evaluate(el=>{el.value='137';el.dispatchEvent(new Event('input',{bubbles:true}));});
     await page.waitForFunction(()=>{
       const lab=window.__ASHEN_ANIMATION_LAB__;
       const a=lab?.state?.heading,target=137*Math.PI/180;
       return Number.isFinite(a)&&Math.abs(Math.atan2(
         Math.sin(target-a),Math.cos(target-a)))<.14;
     },undefined,{timeout:5000});
     assert.equal(await page.locator('#yaw-value').textContent(),'137°');
     // Automatic full-body turn must advance heading in the actual skin rig,
     // and stop without overriding the user's manually chosen angle.
     const headingBefore=(await lab()).headingTarget;
     await page.locator('#turn').click();
     await page.waitForFunction(previous=>{
       const q=window.__ASHEN_ANIMATION_LAB__;
       return q?.autoTurn&&Number.isFinite(q.headingTarget)&&
         Math.abs(Math.atan2(Math.sin(q.headingTarget-previous),
           Math.cos(q.headingTarget-previous)))>.25;
     },headingBefore,{timeout:15000});
     await page.locator('#turn').click();
     assert.equal((await lab()).autoTurn,false);
     await page.locator('[data-view="back"]').click();
     await page.screenshot({path:path.join(out,name+'-run-back.png')});

     // The studio lift is purely visual: the native game's jump physics
     // are not modified. Root moves off the pedestal as the bone pose tucks.
     await page.locator('[data-motion="Jump"]').click();
     await page.waitForFunction(()=>{
       const q=window.__ASHEN_ANIMATION_LAB__;
       return q?.mode==='Jump'&&q.jumpHeight>.20&&q.state?.airborne;
     },undefined,{timeout:10000});
     const jumping=await lab();
     assert.equal(jumping.clip,'Jump');
     assert.ok(jumping.jumpHeight>.20,'Whole body must visibly leave ground');
     await page.screenshot({path:path.join(out,name+'-jump.png')});

     await page.locator('#pause').click();
     await page.waitForTimeout(110);
     const before=await lab();
     await page.waitForTimeout(145);
     const still=await lab();
     assert.equal(still.frame,before.frame,'Pause must freeze simulation');
     await page.locator('#frame').click();
     await page.waitForTimeout(145);
     const stepped=await lab();
     assert.equal(stepped.frame,still.frame+1,'Step exactly 1/60 second');
     await page.locator('#skeleton').click();
     assert.equal(await page.locator('#skeleton').getAttribute('aria-pressed'),'true');
     await page.screenshot({path:path.join(out,name+'-bones.png')});
     await page.locator('#wire').click();
     assert.equal(await page.locator('#wire').getAttribute('aria-pressed'),'true');
     assert.ok((await lab()).weapon,'Weapon must remain wrist-attached across animation and controls');
     // Compare shaded surfaces, NOT wireframes or skeleton overlays.
     await page.locator('#wire').click();
     await page.locator('#skeleton').click();
     await page.locator('[data-motion="Idle"]').click();
     await page.locator('[data-view="front"]').click();
     await page.locator('#yaw').evaluate(el=>{
       el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));
     });
     await page.locator('#frame').click();
     // The recolor is NON-DESTRUCTIVE. Verify that the same loaded Tripo
     // mesh can return to original material and be recolored again.
     await page.locator('#palette').click();
     assert.equal((await lab()).paletteActive,false);
     await page.screenshot({path:path.join(out,name+'-original-material.png')});
     await page.locator('#palette').click();
     assert.equal((await lab()).paletteActive,true);
     await page.screenshot({path:path.join(out,name+'-gothic-palette.png')});

     if(errors.length)throw Error(name+' page errors: '+errors.join(' | '));
     console.log('TRIPO WORKSHOP '+name+' OK: '+JSON.stringify({
       bones:s.bones,skinnedMeshes:s.skinnedMeshes,armAnatomy:idleAnatomy,
       sampledHeadings:'8 presets + 137° custom',motions:['Idle','Walk','Run','Jump'],
       jumpHeight:jumping.jumpHeight,steppedFrame:stepped.frame
     }));
     await ctx.close();
   }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});