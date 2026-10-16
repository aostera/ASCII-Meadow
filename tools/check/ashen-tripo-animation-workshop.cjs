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

     await page.waitForFunction(()=>window.__ASHEN_ANIMATION_LAB__.frame>=35,
       undefined,{timeout:20000});
     s=await lab();
     assert.equal(s.mode,'Idle');
     assert.equal(s.clip,'Idle');
     assert.deepEqual(s.pose.footContact,[true,true],
       'Both idle feet should be treated as planted');
     assert.equal(s.pose.animationVersion,'Tripo-IK-v3-model-space-axes');
     await page.screenshot({path:path.join(out,name+'-idle-front.png')});

     await page.locator('[data-motion="Walk"]').click();
     await page.waitForFunction(()=>window.__ASHEN_ANIMATION_LAB__?.model?.userData?.gltf?.clip==='Walk',
       undefined,{timeout:15000});
     let walking=await lab();
     assert.equal(walking.mode,'Walk');
     assert.equal(walking.pose.kneeBend.length,2);
     assert.equal(walking.weapon,true);
     await page.screenshot({path:path.join(out,name+'-walk-front.png')});

     await page.locator('[data-motion="Run"]').click();
     await page.waitForFunction(()=>window.__ASHEN_ANIMATION_LAB__?.model?.userData?.gltf?.clip==='Run',
       undefined,{timeout:15000});
     let running=await lab();
     assert.ok(running.pose.phase>walking.pose.phase,'Gait phase must not restart on Run');
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

     if(errors.length)throw Error(name+' page errors: '+errors.join(' | '));
     console.log('TRIPO WORKSHOP '+name+' OK: '+JSON.stringify({
       bones:s.bones,skinnedMeshes:s.skinnedMeshes,
       sampledHeadings:'8 presets + 137° custom',motions:['Idle','Walk','Run','Jump'],
       jumpHeight:jumping.jumpHeight,steppedFrame:stepped.frame
     }));
     await ctx.close();
   }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});