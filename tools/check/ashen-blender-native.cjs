// The Blender-repaired Ashen Vow knight in the native game (native.html, the default model):
// its GLB loads into the same WebGL context, its baked clips follow real input (Walk / Run /
// Jump), its render becomes knight glyphs in the source batch, cloth cells reach the cloak's
// firelight block, no extra canvas, the map is untouched; ?ashenVow=0 loads nothing 3D.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=(process.argv[2]||'http://127.0.0.1:8181').replace(/\/$/,'');
const shots=path.join(process.cwd(),'shots','ashen-blender-native');
fs.mkdirSync(shots,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
  for(const mobile of [false,true]){
   const name=mobile?'phone':'desktop';
   const context=await browser.newContext({
    viewport:mobile?{width:390,height:844}:{width:1100,height:740},
    deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile
   });
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.stack||e.message));
   // Without the flag the native page must not even load the 3D knight module.
   const requested=[];
   page.on('request',r=>requested.push(r.url()));
   await page.goto(base+'/experiments/three/native.html?edit=0&ashenVow=0',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__ASCII_NATIVE__?.ready&&
     window.__ASCII_NATIVE__.frameCount>2,undefined,{timeout:90000});
   if(await page.evaluate(()=>window.__ASCII_NATIVE__.ashenVow)!==null)
     throw Error('3D knight active with ?ashenVow=0');
   if(requested.some(u=>/native-ashen-blender|ashen_tripo_blender_repaired/.test(u)))
     throw Error('3D knight assets requested with ?ashenVow=0');
   const baseCanvases=await page.evaluate(()=>document.querySelectorAll('canvas').length);

   const glbPresent=await page.evaluate(async()=>{
     try{return (await fetch('experiments/three/assets/ashen-vow/ashen_tripo_blender_repaired_v01.glb',
       {method:'HEAD'})).ok}catch(_){return false}
   });
   await page.goto(base+'/experiments/three/native.html?edit=0',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>{
     const n=window.__ASCII_NATIVE__,k=n?.ashenVow;
     return n?.ready&&n.frameCount>3&&k&&(k.error||k.frames>2);
   },undefined,{timeout:90000});
   const before=await page.evaluate(()=>({
     map:JSON.stringify(window.__ASCII_NATIVE__.originalMap),
     canvases:document.querySelectorAll('canvas').length,
     mode:window.__ASCII_NATIVE__.mode
   }));
   if(before.mode!=='three')throw Error('Native page fell back to Canvas2D');
   if(before.canvases!==baseCanvases)
     throw Error(`3D knight added a canvas: ${baseCanvases} -> ${before.canvases}`);
   const state=()=>page.evaluate(()=>{
     const k=window.__ASCII_NATIVE__.ashenVow;
     // source foot on screen, CSS pixels
     const sx=(player.x*CW-camX*CW)*VZ,sy=((player.y+.7)*CH-camY*CH)*VZ;
     return {...k,screen:[sx,sy],h:KG.art*charDims(player).fch*VZ};
   });
   const shot=async(tag)=>{
     const s=await state();
     const h=Math.max(80,s.h*1.6),vp=page.viewportSize();
     const x=Math.max(0,Math.min(vp.width-h,s.screen[0]-h/2));
     const y=Math.max(0,Math.min(vp.height-h,s.screen[1]-h*.85));
     await page.screenshot({path:path.join(shots,`${name}-${tag}.png`),
       clip:{x,y,width:Math.min(h,vp.width),height:Math.min(h,vp.height)}});
     return s;
   };
   await page.addStyleTag({content:'.hud,.stats,.ed,.ed-open{visibility:hidden!important}'});
   const idle=await shot('idle');
   if(glbPresent&&!idle.loaded)throw Error('GLB present but not loaded: '+idle.error);
   if(idle.model!=='ashen-blender-v01')throw Error('default knight is not the Blender model: '+idle.model);
   if(idle.lod!==(mobile?'mobile':'full'))throw Error(`${name} loaded the ${idle.lod} model`);
   if(glbPresent&&(idle.clips||[]).join()!=='Idle,Walk,Run,Jump')throw Error('clips: '+idle.clips);
   if(!glbPresent&&(!idle.error||idle.frames))
     throw Error('GLB absent: the original ASCII knight must stay, got '+JSON.stringify(idle));
   if(glbPresent&&!(idle.glyphs>300&&idle.cells>=idle.glyphs))
     throw Error('3D knight printed too few glyphs: '+JSON.stringify(idle));
   if(glbPresent&&!(idle.cloakCells>20))throw Error('No cloak cells for the crimson block');

   // SwiftShader renders a few frames per second: wait for states, not for time.
   const seen=new Set([idle.clip]);
   const until=async(clips,tag)=>{
     if(glbPresent)await page.waitForFunction(c=>c.includes(
       window.__ASCII_NATIVE__.ashenVow.clip),clips,{timeout:30000});
     else await sleep(1500);
     seen.add((await shot(tag)).clip);
   };
   if(!mobile){
     await page.keyboard.down('d');
     await until(['Walk','Run'],'walk');
     await page.keyboard.down('Shift');
     await until(['Run'],'run');
     await page.keyboard.up('Shift');await page.keyboard.up('d');
     await until(['Idle'],'stop');
     await page.keyboard.press('Space');
     await until(['Jump'],'jump');
     await until(['Idle'],'landed');
   }else{
     // Phone: drag on the canvas, like the real touch control.
     const vp=page.viewportSize(),cx=vp.width/2,cy=vp.height*.6;
     await page.mouse.move(cx,cy);await page.mouse.down();
     await page.mouse.move(cx+60,cy,{steps:4});
     await until(['Walk','Run'],'walk');
     await page.mouse.up();
     await until(['Idle'],'stop');
   }
   const after=await state();
   if(glbPresent){
     if(!seen.has('Walk')&&!seen.has('Run'))
       throw Error('No locomotion clip from source input: '+[...seen]);
     if(!mobile&&!(seen.has('Jump')&&seen.has('Run')))
       throw Error('No Run/Jump clip from Shift/Space: '+[...seen]);
   }
   const map=await page.evaluate(()=>JSON.stringify(window.__ASCII_NATIVE__.originalMap));
   if(map!==before.map)throw Error('Source map changed');
   await page.evaluate(()=>window.__ASCII_NATIVE__.dispose());
   const disposed=await page.evaluate(()=>window.__ASCII_NATIVE__.ashenVow?.active);
   if(disposed)throw Error('3D knight survived dispose');
   if(errors.length)throw Error('Page errors:\n'+errors.join('\n'));
   console.log(`${name.toUpperCase()} NATIVE ASHEN BLENDER KNIGHT PASS`,JSON.stringify({
     glb:glbPresent?'loaded':'ABSENT - original ASCII knight kept',
     clips:[...seen],frames:after.frames,glyphs:after.glyphs,cloakCells:after.cloakCells,
     canvases:before.canvases,mapUnchanged:true,disposed:true
   }));
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
