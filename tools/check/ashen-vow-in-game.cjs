// Test the ACTUAL playable Ashen Vow character in native.html, not the turntable.
// The same single WebGL2 renderer does model skinning offscreen and batch glyph painting.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=(process.argv[2]||'http://127.0.0.1:8181').replace(/\/$/,'');
const output=path.join(process.cwd(),'shots','ashen-vow-in-game');
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
   if(requests.some(url=>url.includes('ashen-vow-game-model.mjs')||url.includes('b469dfb7-fc09')))
     throw Error('Opt-out still downloaded GLB');

   await page.goto(base+'/experiments/three/native.html?edit=0&ashenVow=1',
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
   if(!idle.ready||idle.glyphs<90||idle.cells<idle.glyphs)
     throw Error('No skinned in-game ASCII figure '+JSON.stringify(idle));
   if(idle.canvasCount!==oldCanvasCount)
     throw Error('3D scene created duplicate GPU canvas '+JSON.stringify(idle));
   if(!requests.some(u=>u.includes('b469dfb7-fc09')))
     throw Error('No original approved-model GLB request made');
   if(!(idle.cloakCells>3))
     throw Error('Cloak is not bone linked or is not read as cloth');
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
   await page.waitForTimeout(350);
   if(!mobile){
     await page.keyboard.down('d');
     await page.waitForFunction(()=>['Walk','Run'].includes(
       window.__ASCII_NATIVE__.ashenVow?.clip),undefined,{timeout:30000});
     await shot('walk');
     await page.keyboard.down('Shift');
     await page.waitForFunction(()=>window.__ASCII_NATIVE__.ashenVow?.clip==='Run',
       undefined,{timeout:30000});
     await shot('run');
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
   if(fin.gameFrames<=idle.gameFrames)throw Error('Original game loop stalled');
   await page.screenshot({path:path.join(output,label+'-whole-game.png'),timeout:60000});
   await page.evaluate(()=>window.__ASCII_NATIVE__.dispose());
   const after=await page.evaluate(()=>window.__ASCII_NATIVE__.ashenVow?.active);
   if(after)throw Error('3D player survived renderer dispose');
   if(errors.length)throw Error('Page errors: '+errors.join('; '));
   console.log(label+' ASHEN VOW ACTUALLY PLAYABLE OK: '+
     JSON.stringify({glyphs:idle.glyphs,cloth:idle.cloakCells,frames:fin.frames,
       clip:fin.clip,canvases:fin.canvasCount,mapUnchanged:true}));
   await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
