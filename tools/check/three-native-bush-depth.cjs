// Native Gothic bush test: the SAME spring moves authored ASCII foliage
// and source-generated physical 3D Z clumps. Never accept a solid card that
// makes actors disappear behind the entire shrub silhouette.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const out=path.join(process.cwd(),'shots','three-native-bushes');
fs.mkdirSync(out,{recursive:true});

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
      const res=await page.goto(base.replace(/\/$/,'')+
        '/experiments/three/native.html?edit=0&nativeDepthTest=1',
        {waitUntil:'domcontentloaded'});
      if(!res?.ok())throw Error('Source-bush native HTTP failure');
      await page.waitForFunction(()=>
        window.__ASCII_NATIVE__?.ready&&
        window.__ASCII_NATIVE_NPCS__?.paletteCount>0,
        undefined,{timeout:120000});
      const result=await page.evaluate(()=>{
        const n=window.__ASCII_NATIVE__,mapBefore=JSON.stringify(MEADOW_MAP);
        const npc=npcs.find(x=>x.actorType==='villager');
        // Dense thickets may legitimately hide the entire NPC even
        // while moving. Test an isolated source bush first, where motion
        // must open a visible slit instead of a second shrub filling it.
        const bushes=flora.filter(x=>x.v.type==='bush'&&x.v.R>8)
          .map(b=>{
            let separation=Infinity;
            for(const f of flora){
              if(f===b||f.v.type==='lily')continue;
              const dx=(b.x-f.x)*CW,dy=(b.br-f.br)*CH;
              const clear=Math.hypot(dx,dy)-(b.v.R+f.v.R)*.8;
              separation=Math.min(separation,clear);
            }
            return {b,separation};
          })
          .sort((a,b)=>b.separation-a.separation)
          .map(x=>x.b);
        if(!npc||bushes.length<3)
          throw Error('Missing authored bushes or native NPC');
        const saveNpc={x:npc.x,y:npc.y,tx:npc.tx,ty:npc.ty,
          behavior:npc.behavior,nativeForceFar:npc._nativeForceFar};
        const savePlayer={x:player.x,y:player.y,tx:player.tx,ty:player.ty};
        const drawSource=drawFlora,affected=new Map();
        const gpu=n.renderer.getContext(),canvas=n.renderer.domElement;
        let best={pixelDelta:0,movementPixels:0,gpuMovementPixels:0,bushes:0,leaves:0};
        function actorImage(rect){
          const scale=VZ*DPR;
          const x=Math.max(0,Math.floor((rect.left-camX*CW)*scale));
          const x2=Math.min(canvas.width,Math.ceil(
            (rect.left+rect.w-camX*CW)*scale));
          const bottom=Math.max(0,Math.floor(canvas.height-
            (rect.top+rect.h-camY*CH)*scale));
          const top=Math.min(canvas.height,Math.ceil(canvas.height-
            (rect.top-camY*CH)*scale));
          if(x2<=x||top<=bottom)return new Uint8Array(0);
          const rgba=new Uint8Array((x2-x)*(top-bottom)*4);
          gpu.readPixels(x,bottom,x2-x,top-bottom,gpu.RGBA,
            gpu.UNSIGNED_BYTE,rgba);
          return rgba;
        }
        function pixelDelta(a,b){
          if(a.length!==b.length)return -1;
          let delta=0;
          for(let i=0;i<a.length;i+=4)
            if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])
              delta++;
          return delta;
        }
        try{
          drawFlora=()=>{}; // Hide only authored foliage in this test fixture.
          npc.behavior='idle';npc._nativeForceFar=true;
          for(const bush of bushes.slice(0,16)){
            if(!affected.has(bush))
              affected.set(bush,{twigs:bush.nativeTwigs,part:bush.nativePart});
            bush.nativeTwigs=new Float32Array(9);
            bush.nativePart=0;
            npc.x=bush.x;npc.y=bush.br-.65;
            npc.tx=npc.x;npc.ty=npc.y;
            player.x=npc.x;player.y=npc.y;
            player.tx=player.x;player.ty=player.y;
            updateCamera(0,true);
            const rect=geomOf(npc);
            n.setDepthMaskForTest(true);render();
            const noMask=actorImage(rect);
            n.setDepthMaskForTest(false);render();
            const resting=actorImage(rect);
            // Read the actual Three depth render target as well. An NPC
            // may stay fully hidden in a dense thicket after one bush bends,
            // but geometry motion MUST change the real GPU depth pixels.
            const restingGpu=n.readNativeDepthForTest();
            const stat=n.nativeDepth;
            const depthChange=pixelDelta(noMask,resting);
            // Opposing boughs create a real, wide pass-through gap rather
            // than sliding the entire crown horizontally as one solid blob.
            for(let j=0;j<9;j++)
              bush.nativeTwigs[j]=j<4?-1.5:1.5;
            bush.nativePart=1;
            render();
            const bent=actorImage(rect);
            const bentGpu=n.readNativeDepthForTest();
            const movement=pixelDelta(resting,bent);
            const gpuMovement=restingGpu&&bentGpu&&
              restingGpu.width===bentGpu.width&&
              restingGpu.height===bentGpu.height?
              pixelDelta(restingGpu.pixels,bentGpu.pixels):-1;
            const bendStat=n.nativeDepth;
            if((gpuMovement>best.gpuMovementPixels&&depthChange>2)||
               (gpuMovement===best.gpuMovementPixels&&
                (movement>best.movementPixels||
                 (movement===best.movementPixels&&depthChange>best.pixelDelta)))){
              best={
                pixelDelta:depthChange,movementPixels:movement,
                gpuMovementPixels:gpuMovement,
                bushes:stat.bushes,wood:stat.bushWood,
                leaves:stat.bushLeaves,instances:stat.bushInstances,
                movingClumps:bendStat.bushMoved,
                depthFrames:stat.frames,drawCalls:stat.drawCalls,
                contexts:document.querySelectorAll('#three-parity-canvas').length
              };
            }
            // Keep the next candidate at rest until deliberately bent.
            bush.nativeTwigs.fill(0);bush.nativePart=0;
            if(best.pixelDelta>4&&best.gpuMovementPixels>2&&
               best.movingClumps>5)break;
          }
          if(best.pixelDelta<3||best.gpuMovementPixels<2||
             best.bushes<1||best.wood<1||best.leaves<1||
             best.movingClumps<5||best.drawCalls<1||
             best.contexts!==1)
            throw Error('Native moving bush geometry did not mask/bend: '+
              JSON.stringify(best));
          if(JSON.stringify(MEADOW_MAP)!==mapBefore)
            throw Error('Native bush Z mutated the authored map');
          return {...best,mapUnchanged:true};
        }finally{
          for(const [b,old] of affected){
            if(old.twigs===undefined)delete b.nativeTwigs;
            else b.nativeTwigs=old.twigs;
            if(old.part===undefined)delete b.nativePart;
            else b.nativePart=old.part;
          }
          Object.assign(npc,saveNpc);
          Object.assign(player,savePlayer);
          drawFlora=drawSource;
          n.setDepthMaskForTest(false);
          updateCamera(0,true);render();
        }
      });
      if(errors.length)throw Error(label+' JS errors: '+errors.join(' | '));
      await page.screenshot({path:path.join(out,label+'.png'),timeout:60000});
      console.log('NATIVE ARTICULATED BUSH Z PASS '+label+' '+JSON.stringify(result));
      await ctx.close();
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
