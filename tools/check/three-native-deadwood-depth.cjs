// Physical source-deadwood regression: each branch of the 2D source's
// deterministic crooked tree is represented by a real 3D segment on the
// shared GPU depth pass. Never substitute a solid occluding rectangle.
const {chromium}=require('playwright');
const path=require('node:path'),fs=require('node:fs');
const base=process.argv[2]||'http://127.0.0.1:8181';
const dir=path.join(process.cwd(),'shots','three-native-deadwood');
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
   const res=await page.goto((base.endsWith('/')?base.slice(0,-1):base)+
    '/experiments/three/native.html?edit=0&nativeDepthTest=1',
    {waitUntil:'domcontentloaded'});
   if(!res?.ok())throw Error('Native deadwood source depth HTTP failed');
   await page.waitForFunction(()=>window.__ASCII_NATIVE__?.ready&&
     window.__ASCII_NATIVE_NPCS__?.paletteCount>0,
     undefined,{timeout:120000});
   const data=await page.evaluate(()=>{
     const n=window.__ASCII_NATIVE__,sourceMap=JSON.stringify(MEADOW_MAP);
     const npc=npcs.find(w=>w.actorType==='villager');
     const candidates=flora.filter(f=>f.v.type==='dead'&&f.v.R>10);
     if(!npc||!candidates.length)
       throw Error('No authored deadwood or villager to test');
     const oldNpc={x:npc.x,y:npc.y,tx:npc.tx,ty:npc.ty,
       behavior:npc.behavior,nativeForceFar:npc._nativeForceFar};
     const oldPlayer={x:player.x,y:player.y,tx:player.tx,ty:player.ty};
     const oldDraw=drawFlora;
     const gl=n.renderer.getContext(),canvas=n.renderer.domElement;
     let best={pixelDelta:0,deadTrees:0,deadSegments:0,drawCalls:0};
     function readActor(rect){
       const ratio=VZ*DPR;
       const x=Math.max(0,Math.floor((rect.left-camX*CW)*ratio));
       const right=Math.min(canvas.width,Math.ceil(
         (rect.left+rect.w-camX*CW)*ratio));
       const bottom=Math.max(0,Math.floor(canvas.height-
         (rect.top+rect.h-camY*CH)*ratio));
       const top=Math.min(canvas.height,Math.ceil(canvas.height-
         (rect.top-camY*CH)*ratio));
       if(right<=x||top<=bottom)return new Uint8Array(0);
       const img=new Uint8Array((right-x)*(top-bottom)*4);
       gl.readPixels(x,bottom,right-x,top-bottom,
         gl.RGBA,gl.UNSIGNED_BYTE,img);
       return img;
     }
     try{
       // Test-only: hide source vegetation draw to isolate real THREE deadwood
       // branch Z from the normal painter-order source overlap.
       drawFlora=()=>{};
       npc._nativeForceFar=true;
       npc.behavior='idle';
       for(const tree of candidates.slice(0,12)){
         npc.x=tree.x;npc.y=tree.br-1.1;
         npc.tx=npc.x;npc.ty=npc.y;
         player.x=npc.x;player.y=npc.y;
         player.tx=player.x;player.ty=player.y;
         updateCamera(0,true);
         const rect=geomOf(npc);
         n.setDepthMaskForTest(true);
         render();
         const without=readActor(rect);
         n.setDepthMaskForTest(false);
         render();
         const withMask=readActor(rect);
         const stats=n.nativeDepth;
         let diff=0;
         if(withMask.length===without.length)
           for(let i=0;i<withMask.length;i+=4)
             if(withMask[i]!==without[i]||
               withMask[i+1]!==without[i+1]||
               withMask[i+2]!==without[i+2])diff++;
         if(diff>best.pixelDelta)best={
           pixelDelta:diff,deadTrees:stats.deadTrees,
           deadSegments:stats.deadSegments,
           drawCalls:stats.drawCalls,
           depthFrames:stats.frames,
           instances:stats.treeWood+stats.treeLeaves+stats.deadSegments,
           nativeGlyphs:n.stats.glyphs,
           contexts:document.querySelectorAll('#three-parity-canvas').length
         };
         if(best.pixelDelta>12&&best.deadTrees>=1&&best.deadSegments>50)break;
       }
       if(best.deadTrees<1||best.deadSegments<50||
          best.drawCalls<1||best.depthFrames<1||best.contexts!==1)
         throw Error('Deadwood source-branch 3D depth not rendered '+JSON.stringify(best));
       if(best.pixelDelta<4)
         throw Error('Deadwood branch Z never clipped an actor '+JSON.stringify(best));
       if(JSON.stringify(MEADOW_MAP)!==sourceMap)
         throw Error('Deadwood 3D pass changed authored map');
       return {...best,mapUnchanged:true,sourceDeadVariants:4};
     }finally{
       Object.assign(npc,oldNpc);
       Object.assign(player,oldPlayer);
       drawFlora=oldDraw;
       n.setDepthMaskForTest(false);
       updateCamera(0,true);render();
     }
   });
   if(errors.length)throw Error(label+' errors '+errors.join('; '));
   await page.screenshot({path:path.join(dir,label+'.png'),timeout:60000});
   console.log('NATIVE SOURCE DEADWOOD GPU DEPTH PASS '+label+' '+JSON.stringify(data));
   await ctx.close();
  }
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
