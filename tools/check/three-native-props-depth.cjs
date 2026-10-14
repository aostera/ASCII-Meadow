// Integration proof: original-source 3D tents and fences (not opaque quads)
// share the native actor Z pass; NPCs pass between palisade posts.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const dir=path.join(process.cwd(),'shots','three-native-props');
fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
  for(const mobile of [false,true]){
   const label=mobile?'phone':'desktop';
   const ctx=await browser.newContext({
     viewport:mobile?{width:390,height:844}:{width:1100,height:740},
     deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile
   });
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   const response=await page.goto((base.endsWith('/')?base.slice(0,-1):base)+
     '/experiments/three/native.html?nativeDepthTest=1&edit=0',
     {waitUntil:'domcontentloaded'});
   if(!response?.ok())throw Error('Native authored prop depth HTTP failure');
   await page.waitForFunction(()=>window.__ASCII_NATIVE__?.ready&&
     window.__ASCII_NATIVE_NPCS__?.paletteCount>0,
     undefined,{timeout:120000});
   const data=await page.evaluate(()=>{
     const n=window.__ASCII_NATIVE__,oldMap=JSON.stringify(MEADOW_MAP);
     const npc=npcs.find(w=>w.actorType==='villager');
     const items=flora.filter(f=>f.v.type==='tent'||f.v.type==='fence');
     if(!npc||!items.some(f=>f.v.type==='tent')||
        !items.some(f=>f.v.type==='fence'))
       throw Error('Tent, fence or test villager missing');
     const oldNpc={x:npc.x,y:npc.y,tx:npc.tx,ty:npc.ty,
       behavior:npc.behavior,nativeForceFar:npc._nativeForceFar};
     const oldPlayer={x:player.x,y:player.y,tx:player.tx,ty:player.ty};
     const oldDraw=drawFlora,renderer=n.renderer,gl=renderer.getContext();
     let best={pixelDelta:0};
     const sightings={tent:0,fence:0};
     function screenshot(rect){
       const scale=VZ*DPR,canvas=renderer.domElement;
       const x=Math.max(0,Math.floor((rect.left-camX*CW)*scale));
       const x1=Math.min(canvas.width,Math.ceil(
         (rect.left+rect.w-camX*CW)*scale));
       const y=Math.max(0,Math.floor(canvas.height-
         (rect.top+rect.h-camY*CH)*scale));
       const y1=Math.min(canvas.height,Math.ceil(canvas.height-
         (rect.top-camY*CH)*scale));
       if(x1<=x||y1<=y)return new Uint8Array(0);
       const result=new Uint8Array((x1-x)*(y1-y)*4);
       gl.readPixels(x,y,x1-x,y1-y,gl.RGBA,gl.UNSIGNED_BYTE,result);
       return result;
     }
     try{
       // Temporarily suppress *only* the existing authored 2D image to
       // isolate the physical Three Z result. Normal game pixels untouched.
       drawFlora=()=>{};npc._nativeForceFar=true;
       npc.behavior='idle';
       for(const prop of items.sort((a,b)=>
         (a.v.type==='tent'?0:1)-(b.v.type==='tent'?0:1)).slice(0,12)){
         npc.x=prop.x;npc.y=prop.br-.9;
         npc.tx=npc.x;npc.ty=npc.y;
         player.x=prop.x;player.y=npc.y;
         player.tx=player.x;player.ty=player.y;
         updateCamera(0,true);
         const rect=geomOf(npc);
         n.setDepthMaskForTest(true);render();
         const without=screenshot(rect);
         n.setDepthMaskForTest(false);render();
         const withZ=screenshot(rect),stat=n.nativeDepth;
         sightings.tent=Math.max(sightings.tent,stat.tents);
         sightings.fence=Math.max(sightings.fence,stat.fences);
         let diff=0;
         if(without.length===withZ.length)for(let j=0;j<withZ.length;j+=4)
           if(without[j]!==withZ[j]||
             without[j+1]!==withZ[j+1]||
             without[j+2]!==withZ[j+2])diff++;
         if(diff>best.pixelDelta)best={
           pixelDelta:diff,tents:stat.tents,fences:stat.fences,
           realTriangles:stat.propTriangles,drawCalls:stat.drawCalls,
           depthFrames:stat.frames,maskIsGpu:n.stats.depthEnabled,
           contexts:document.querySelectorAll('#three-parity-canvas').length
         };
         if(best.pixelDelta>8&&sightings.tent&&sightings.fence)break;
       }
       if(best.pixelDelta<4||best.realTriangles<20||
          !sightings.tent||!sightings.fence||
          best.drawCalls<1||best.contexts!==1)
         throw Error('Physical tent/fence Z not confirmed '+JSON.stringify({best,sightings}));
       if(JSON.stringify(MEADOW_MAP)!==oldMap)
         throw Error('Tent/fence GPU proxy changed authored map');
       return {...best,sightings,mapUnchanged:true};
     }finally{
       Object.assign(npc,oldNpc);
       Object.assign(player,oldPlayer);
       drawFlora=oldDraw;
       n.setDepthMaskForTest(false);
       updateCamera(0,true);render();
     }
   });
   if(errors.length)throw Error(label+' JS errors '+errors.join('; '));
   await page.screenshot({path:path.join(dir,label+'.png'),timeout:60000});
   console.log('NATIVE SOURCE TENT FENCE DEPTH PASS '+label+
     ' '+JSON.stringify(data));
   await ctx.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
