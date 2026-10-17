// T05: an NPC walking through the densest authored thickets shakes the
// bush, it never cuts it open. Real native WebGL2, desktop and phone. For
// each of the densest bushes the villager walks through the crown while
// updateFlora() runs: the boughs must visibly move and swing back and forth
// (kicks per stride, damped ringing), the crown must keep its foliage in
// front of the body (no slit), and real pixels of the bush must change.
// Then the actor leaves and the boughs must settle back to the exact source
// drawing without a jump.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const out=path.join(process.cwd(),'shots','three-native-bush-contact');
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
        '/experiments/three/native.html?edit=0',
        {waitUntil:'domcontentloaded'});
      if(!res?.ok())throw Error('Native bush contact HTTP failure');
      await page.waitForFunction(()=>window.__ASCII_NATIVE__?.ready&&
        window.__ASCII_NATIVE_NPCS__?.paletteCount>0&&
        window.__ASCII_NATIVE_BUSHES__?.counts.total>0,
        undefined,{timeout:120000});
      const result=await page.evaluate(()=>{
        const n=window.__ASCII_NATIVE__,api=window.__ASCII_NATIVE_BUSHES__;
        const gpu=n.renderer.getContext(),canvas=n.renderer.domElement;
        const mapBefore=JSON.stringify(MEADOW_MAP);
        const npc=npcs.find(x=>x.actorType==='villager');
        if(!npc)throw Error('No authored villager NPC');
        const bushes=flora.filter(f=>f.v.type==='bush');
        const dense=bushes.map(b=>({b,nb:bushes.filter(o=>o!==b&&
            Math.hypot((o.x-b.x)*CW,(o.br-b.br)*CH)<(b.v.R+o.v.R)*1.1).length}))
          .filter(x=>x.nb>=2).sort((a,b)=>b.nb-a.nb).slice(0,3).map(x=>x.b);
        if(dense.length<3)throw Error('Too few dense authored thickets');
        const image=(x0,y0,w,h)=>{
          const s=VZ*DPR;
          const x=Math.max(0,Math.floor((x0-camX*CW)*s));
          const x2=Math.min(canvas.width,Math.ceil((x0+w-camX*CW)*s));
          const y=Math.max(0,Math.floor(canvas.height-(y0+h-camY*CH)*s));
          const y2=Math.min(canvas.height,Math.ceil(canvas.height-(y0-camY*CH)*s));
          const a=new Uint8Array(Math.max(0,(x2-x)*(y2-y)*4));
          if(a.length)gpu.readPixels(x,y,x2-x,y2-y,gpu.RGBA,gpu.UNSIGNED_BYTE,a);
          return a;
        };
        const delta=(a,b)=>{let d=0;for(let i=0;i<a.length;i+=4)
          if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>24)d++;
          return d};
        const saveNpc={x:npc.x,y:npc.y,tx:npc.tx,ty:npc.ty,behavior:npc.behavior,moving:npc.moving};
        const savePlayer={x:player.x,y:player.y,tx:player.tx,ty:player.ty};
        const reset=o=>{o.nativeTwigs?.fill(0);o.nativeTwigVel?.fill(0);
          o.nativePart=0;o.nativePartCenter=0;o.nativeStride=0;o.rust=0};
        const place=(x,y)=>{npc.x=npc.tx=x;npc.y=npc.ty=y;npc.moving=true;
          player.x=player.tx=x+40;player.y=player.ty=y;updateCamera(0,true)};
        // Leaves of the bush in the body column, h .3-.95 of the crown.
        const column=(b,c,draw=drawFlora)=>{
          // Leaf by leaf (the source rustle route), so leaves are countable.
          const rust=b.rust;b.rust=1;
          const start=GB.n;draw(b);b.rust=rust;
          const H=b.v.crownH,by=b.br*CH;let k=0;
          for(let i=start;i<GB.n;i++){
            const j=i*6;if(GB.buf[j+4]===SOLID_K)continue;
            const h=(by-GB.buf[j+1])/H;
            if(h>.3&&h<.95&&Math.abs(GB.buf[j]-c)<CW*1.5)k++;
          }
          GB.n=start;return k;
        };
        try{
          npc.behavior='idle';
          const rows=[];
          for(const b of dense){
            for(const o of bushes)if(Math.abs(o.x-b.x)*CW<400)reset(o);
            const R=b.v.R/CW,y=b.br-.7,x0=b.x-R*1.2;
            place(b.x,y);
            const c=Math.round(b.x)*CW;
            const rest=column(b,c);
            render();
            const box=[b.x*CW-b.v.R*1.2,b.br*CH-b.v.crownH*1.1,b.v.R*2.4,b.v.crownH*1.2];
            // The same bush at rest with the actor standing at the centre is
            // the reference for the moving frames.
            for(const o of bushes)if(Math.abs(o.x-b.x)*CW<400)reset(o);
            const still=image(...box);
            // Walk across at 6 cells/s, 60 fps.
            let peak=0,flips=0,last=null,cut=1e9,px=0;
            const frames=Math.ceil(R*2.4/6*60);
            for(let i=0;i<=frames;i++){
              place(x0+i/60*6,y);updateFlora(1/60);
              const tw=Array.from(b.nativeTwigs||[]);
              peak=Math.max(peak,...tw.map(Math.abs));
              const mid=tw[4]||0;
              if(last!==null&&Math.abs(mid-last.v)>.004){
                const dir=Math.sign(mid-last.v);
                if(last.dir&&dir!==last.dir)flips++;
                last.dir=dir;
              }
              last={v:mid,dir:last?.dir||0};
              if(Math.abs(npc.x-b.x)<R*.3){
                const at=Math.round(b.x)*CW+(npc.x-b.x)*CW;
                cut=Math.min(cut,column(b,at)/Math.max(1,column(b,at,api.sourceDraw)));
              }
              if(i===Math.round(frames/2)){render();px=delta(still,image(...box))}
            }
            rows.push({x:Math.round(b.x),peak:+peak.toFixed(2),flips,rest,
              inColumn:+cut.toFixed(2),movedPx:px});
          }
          // Recovery: the actor leaves, the crown rings down with no jump
          // and returns to the exact source drawing.
          const b=dense[0];
          for(let i=0;i<=Math.ceil(b.v.R/CW*12);i++){place(b.x-b.v.R/CW*1.2+i*.1,b.br-.7);updateFlora(1/60)}
          if(!b.nativeTwigs.some(x=>Math.abs(x)>.05))throw Error('Recovery bush not moving');
          const probe=[-.6,-.3,-.1,.1,.3,.6].map(k=>k*b.v.R);
          const sample=()=>probe.map(x=>api.branchShift(b,x,.6));
          let last=sample(),maxStep=0,frames=0;
          place(b.x+b.v.R/CW+14,b.br-.7);
          for(;frames<900;frames++){
            updateFlora(1/60);
            const s=sample();
            for(let k=0;k<s.length;k++)maxStep=Math.max(maxStep,Math.abs(s[k]-last[k]));
            last=s;
            if(!(b.nativePart>0)&&!b.nativeTwigs.some(x=>Math.abs(x)>.012))break;
          }
          const settled=frames<900;
          b.rust=0;b.flut=0;
          let start=GB.n;drawFlora(b);const nowDraw=Array.from(GB.buf.slice(start*6,GB.n*6));
          GB.n=start;api.sourceDraw(b);const srcDraw=Array.from(GB.buf.slice(start*6,GB.n*6));
          GB.n=start;
          const identical=nowDraw.length===srcDraw.length&&nowDraw.every((v,i)=>v===srcDraw[i]);
          if(JSON.stringify(MEADOW_MAP)!==mapBefore)throw Error('Authored map mutated');
          return {rows,recovery:{settled,frames,maxStep:+maxStep.toFixed(2),identical},
            contexts:document.querySelectorAll('#three-parity-canvas').length};
        }finally{
          Object.assign(npc,saveNpc);Object.assign(player,savePlayer);
          for(const o of bushes)reset(o);
          updateCamera(0,true);render();
        }
      });
      const problems=[];
      for(const r of result.rows){
        if(r.peak<.25)problems.push('thicket '+r.x+' barely moves (peak '+r.peak+')');
        if(r.flips<3)problems.push('thicket '+r.x+' does not swing back and forth ('+r.flips+')');
        // Worst frame: share of the at-rest leaves still in front of the body.
        if(r.inColumn<.5)problems.push('thicket '+r.x+' cut open: only '+r.inColumn+' of the leaves left in front of the body');
        if(r.movedPx<40)problems.push('thicket '+r.x+' no visible pixel motion ('+r.movedPx+')');
      }
      const rc=result.recovery;
      if(!rc.settled)problems.push('boughs did not settle');
      if(!rc.identical)problems.push('recovered bush differs from source drawing');
      if(rc.maxStep>4)problems.push('bough jump '+rc.maxStep+'px in one frame');
      if(result.contexts!==1)problems.push('contexts '+result.contexts);
      if(errors.length)problems.push('JS errors: '+errors.join(' | '));
      await page.screenshot({path:path.join(out,label+'.png'),timeout:120000});
      const summary={label,...result};
      fs.writeFileSync(path.join(out,label+'.json'),JSON.stringify(summary,null,1));
      if(problems.length)throw Error(label+': '+problems.join('; ')+' '+JSON.stringify(summary));
      console.log('NATIVE BUSH CONTACT PASS '+JSON.stringify(summary));
      await ctx.close();
    }
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
