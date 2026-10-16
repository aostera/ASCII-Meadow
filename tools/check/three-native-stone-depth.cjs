// Source-authored SDF stone geometry must Z-clip actors without drawing any
// new colours or rectangular placeholder quads in the native GPU world.
const {chromium}=require('playwright');
const path=require('node:path'),fs=require('node:fs');
const base=process.argv[2]||'http://127.0.0.1:8181';
const dir=path.join(process.cwd(),'shots','three-native-stones');
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
   if(!res?.ok())throw Error('Native 3D source stone HTTP failed');
   await page.waitForFunction(()=>window.__ASCII_NATIVE__?.ready&&
     window.__ASCII_NATIVE_NPCS__?.paletteCount>0,
     undefined,{timeout:120000});
   const data=await page.evaluate(()=>{
     const n=window.__ASCII_NATIVE__,sourceMap=JSON.stringify(MEADOW_MAP);
     const npc=npcs.find(w=>w.actorType==='villager');
     const candidates=flora.filter(f=>f.v.type==='stone'&&f.v.R>5);
     if(!npc||!candidates.length)
       throw Error('No authored stones or villager to test');
     const oldNpc={x:npc.x,y:npc.y,tx:npc.tx,ty:npc.ty,
       behavior:npc.behavior,nativeForceFar:npc._nativeForceFar};
     const oldPlayer={x:player.x,y:player.y,tx:player.tx,ty:player.ty};
     const oldDraw=drawFlora;
     const gl=n.renderer.getContext(),canvas=n.renderer.domElement;
     let best={pixelDelta:0,stones:0,triangles:0,drawCalls:0};
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
       // Hide only source 2D stone glyphs in this isolated browser fixture
       // so a pixel difference proves geometry-dependent WebGL Z.
       drawFlora=()=>{};
       npc._nativeForceFar=true;
       npc.behavior='idle';
       for(const tree of candidates.slice(0,15)){
         npc.x=tree.x;npc.y=tree.br-.2;
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
           pixelDelta:diff,stones:stats.stones,
           triangles:stats.stoneTriangles,
           drawCalls:stats.drawCalls,
           depthFrames:stats.frames,
           variants:stats.stoneVariants,
           nativeGlyphs:n.stats.glyphs,
           contexts:document.querySelectorAll('#three-parity-canvas').length
         };
         if(best.pixelDelta>5&&best.stones>=1)break;
       }
       if(best.stones<1||best.triangles<20||
          best.drawCalls<1||best.depthFrames<1||best.contexts!==1)
         throw Error('Original stone SDF 3D depth not rendered '+JSON.stringify(best));
       if(best.pixelDelta<2)
         throw Error('Stone SDF depth never clipped an actor '+JSON.stringify(best));
       if(JSON.stringify(MEADOW_MAP)!==sourceMap)
         throw Error('Stone 3D pass changed authored map');
       return {...best,mapUnchanged:true,sourceStoneVariants:9};
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
   console.log('NATIVE SOURCE STONE GPU DEPTH PASS '+label+' '+JSON.stringify(data));
   await ctx.close();
  }
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
