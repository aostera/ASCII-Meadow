// Test the ACTUAL playable Ashen Vow character in native.html, not the turntable.
// The same single WebGL2 renderer does model skinning offscreen and batch glyph painting.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=(process.argv[2]||'http://127.0.0.1:8181').replace(/\/$/,'');
const output=path.join(process.cwd(),'shots','ashen-tripo-v2-motion-sword');
fs.mkdirSync(output,{recursive:true});
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
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.stack||e.message));
   const requests=[];
   page.on('request',r=>requests.push(r.url()));
   // Opt-out proves we did not break the old sprite code or map/editor.
   await page.goto(base+'/experiments/three/native.html?edit=0&ashenVow=0',
     {waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__ASCII_NATIVE__?.ready&&
     window.__ASCII_NATIVE__.frameCount>3,undefined,{timeout:90000});
   const oldCanvasCount=await page.evaluate(()=>document.querySelectorAll('canvas').length);
   if(await page.evaluate(()=>window.__ASCII_NATIVE__.ashenVow)!==null)
     throw Error('3D player active after explicit opt-out');
   if(requests.some(url=>url.includes('ashen-tripo-native-rig.mjs')||url.includes('ashen_tripo_v2_skeleton_lod.glb')))
     throw Error('Opt-out still downloaded GLB');

   await page.goto(base+'/experiments/three/native.html?edit=0&ashenVow=1&tripoV2=1',
     {waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>{
     const n=window.__ASCII_NATIVE__;
     return n?.ready&&n?.mode==='three'&&n?.frameCount>4&&
       (n.ashenVow?.frames>1||n.ashenVow?.error);
   },undefined,{timeout:120000});
   const read=()=>page.evaluate(()=>{
     const state=window.__ASCII_NATIVE__,a=state.ashenVow;
     const p=player,k=charDims(p),screenX=(p.x-camX)*CW*VZ;
     const screenY=((p.y+.7-camY)*CH)*VZ;
     return {...a,map:JSON.stringify(MEADOW_MAP),source:[p.x,p.y,p.d8,p.jump],
       canvasCount:document.querySelectorAll('canvas').length,
       screen:[screenX,screenY],height:KG.art*k.fch*VZ,
       gameFrames:state.frameCount,sourceGlyphs:state.stats?.visibleGlyphs};
   });
   const idle=await read();
   if(idle.error)throw Error('GLB/skin/ASCII player failed '+idle.error);
   if(!idle.ready||idle.glyphs<300||idle.cells<idle.glyphs||
      (idle.bounds?.[3]-idle.bounds?.[1])<28)
     throw Error('Skinned in-game knight too small/absent '+JSON.stringify({
       cells:idle.cells,glyphs:idle.glyphs,bounds:idle.bounds,error:idle.error,clip:idle.clip,
       loaded:idle.loaded,cloth:idle.cloakCells}));
   if(!await page.evaluate(()=>window.__ASCII_NATIVE__?.tripoV2===true)) throw Error('Not running Tripo V2 player');
   if(idle.canvasCount!==oldCanvasCount)
     throw Error('3D scene created duplicate GPU canvas '+JSON.stringify(idle));
   if(!requests.some(u=>u.includes('ashen_tripo_v2_skeleton_lod.glb')))
     throw Error('No original approved-model GLB request made');
   if(!idle.proceduralStates?.includes('Run')||idle.clips?.length!==0) throw Error('Expected in-engine bone animation, no paid GLB animations '+JSON.stringify(idle));
   if(idle.weapon!=='detached Gothic longsword'||idle.weaponSocketBone!==19)
     throw Error('Sword is NOT a separate real mesh attached to Tripo right wrist: '+JSON.stringify({weapon:idle.weapon,bone:idle.weaponSocketBone}));
   if(idle.cloakCells<5)
     throw Error('No cloak shading regions read from model surface: '+idle.cloakCells);
   if(idle.pose?.animationVersion!=='Tripo-IK-v4-anatomical-arm-hinges')
     throw Error('New planted-feet IK gait controller did not load');

   const shot=async(name)=>{
     const s=await read(),vp=page.viewportSize();
     const size=Math.min(Math.max(95,s.height*1.8),Math.min(vp.width,vp.height));
     const x=Math.max(0,Math.min(vp.width-size,s.screen[0]-size*.5));
     const y=Math.max(0,Math.min(vp.height-size,s.screen[1]-size*.85));
     await page.screenshot({path:path.join(output,label+'-'+name+'.png'),
       clip:{x,y,width:size,height:size},timeout:60000});
     return s;
   };
   // Capture actual source player, source world, native glyphs (not the lab).
   await page.addStyleTag({content:'.hud,.stats,.ed,.ed-open{visibility:hidden!important}'});
   await shot('idle');
   if(!(idle.bones===40&&idle.skinnedMeshes>=1&&idle.geometry?.includes('Tripo')))
     throw Error('Expected genuine TRIPO 40-bone skinned 3D player: '+JSON.stringify({bones:idle.bones,meshes:idle.skinnedMeshes,geometry:idle.geometry}));
   if(!mobile){
     // Also inspect the narrow ivory mask from the actual source game camera,
     // not only the rear cloak at the map's north-facing spawn.
     await page.evaluate(()=>{player.d8=0;});
     await page.waitForTimeout(450);
     await shot('face-front-in-game');
     await page.evaluate(()=>{player.d8=4;});
     await page.waitForTimeout(250);
   }
   await page.waitForTimeout(350);
   if(!mobile){
     await page.keyboard.down('d');
     await page.waitForFunction(()=>['Walk','Run'].includes(
       window.__ASCII_NATIVE__.ashenVow?.clip),undefined,{timeout:30000});
     const walk=await shot('walk');
     if(!walk.pose?.footContact||walk.pose.kneeBend?.length!==2||
       !walk.pose.weaponAttached)
       throw Error('IK leg pose, foot contacts or detached sword socket missing: '+JSON.stringify(walk.pose));
     await page.keyboard.down('Shift');
     await page.waitForFunction(()=>window.__ASCII_NATIVE__.ashenVow?.clip==='Run',
       undefined,{timeout:30000});
     const sprint=await shot('run');
     if(sprint.pose?.phase<=walk.pose?.phase)
       throw Error('Walking->running phase restarted instead of being continuous');
     await page.keyboard.up('Shift');await page.keyboard.up('d');
     await page.keyboard.press('Space');
     await page.waitForFunction(()=>window.__ASCII_NATIVE__.ashenVow?.clip==='Jump',
       undefined,{timeout:30000});
     await shot('jump');
   }else{
     const vp=page.viewportSize(),cx=vp.width*.5,cy=vp.height*.55;
     await page.mouse.move(cx,cy);await page.mouse.down();
     await page.mouse.move(cx+58,cy,{steps:4});
     await page.waitForFunction(()=>['Walk','Run'].includes(
       window.__ASCII_NATIVE__.ashenVow?.clip),undefined,{timeout:30000});
     await shot('walk');
     await page.mouse.up();
   }
   const fin=await read();
   if(fin.map!==idle.map)throw Error('Original authored map changed');
   if(!fin.pose||!(fin.pose.phase>=0))throw Error('No live bone-animation controller state');
   if(fin.pose?.animationVersion!=='Tripo-IK-v4-anatomical-arm-hinges'||!fin.pose.weaponAttached)
     throw Error('New animated sword and IK state lost during play');
   if(!mobile&&fin.pose?.speed<0&&fin.pose?.heading===undefined)
     throw Error('Bad gameplay pose state');
   if(fin.gameFrames<=idle.gameFrames)throw Error('Original game loop stalled');
   await page.screenshot({path:path.join(output,label+'-whole-game.png'),timeout:60000});
   await page.evaluate(()=>window.__ASCII_NATIVE__.dispose());
   const after=await page.evaluate(()=>window.__ASCII_NATIVE__.ashenVow?.active);
   if(after)throw Error('3D player survived renderer dispose');
   if(!mobile){
     // User-facing optional close inspection is STILL the full real game.
     await page.goto(base+'/experiments/three/native.html?edit=0&ashenVow=1&tripoV2=1&ashenInspect=1',
       {waitUntil:'domcontentloaded'});
     await page.waitForFunction(()=>{
       const n=window.__ASCII_NATIVE__;
       return n?.ready&&n.ashenVow?.frames>1&&n.ashenInspect===true&&VZ>1.65;
     },undefined,{timeout:90000});
     const close=await page.evaluate(()=>({
       z:VZ,x:(player.x-camX)*CW*VZ,width:W,
       map:JSON.stringify(MEADOW_MAP),canvasCount:document.querySelectorAll('canvas').length
     }));
     if(Math.abs(close.x-close.width/2)>close.width*.10||close.map!==idle.map||
        close.canvasCount!==oldCanvasCount)
       throw Error('Real game closeup camera broke world parity '+JSON.stringify({z:close.z,x:close.x,w:close.width}));
     await page.screenshot({path:path.join(output,'desktop-in-world-closeup.png'),timeout:60000});
   }
   if(errors.length)throw Error('Page errors: '+errors.join('; '));
   console.log(label+' ASHEN VOW ACTUALLY PLAYABLE OK: '+
     JSON.stringify({glyphs:idle.glyphs,cloth:idle.cloakCells,frames:fin.frames,
       clip:fin.clip,canvases:fin.canvasCount,mapUnchanged:true}));
   await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
