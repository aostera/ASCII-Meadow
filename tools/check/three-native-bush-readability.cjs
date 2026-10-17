// T05: an NPC walking through the densest authored thickets stays readable,
// and the crown recovers after contact. Real native WebGL2 pixels, desktop
// and phone. For each of the densest bush clusters the villager is placed in
// the bush, contact runs through updateFlora(), and the visible NPC pixels
// (frame with the NPC minus frame without it) are compared with the same NPC
// at the same spot with no bushes at all and with the previous behaviour (no body clearance).
// Then the actor leaves and the boughs must settle back to the exact source
// drawing without a jump.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const out=path.join(process.cwd(),'shots','three-native-bush-readability');
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
      if(!res?.ok())throw Error('Native bush readability HTTP failure');
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
          .filter(x=>x.nb>=2).sort((a,b)=>b.nb-a.nb).slice(0,5).map(x=>x.b);
        if(dense.length<3)throw Error('Too few dense authored thickets');
        const image=rect=>{
          const s=VZ*DPR;
          const x=Math.max(0,Math.floor((rect.left-camX*CW)*s));
          const x2=Math.min(canvas.width,Math.ceil((rect.left+rect.w-camX*CW)*s));
          const y=Math.max(0,Math.floor(canvas.height-(rect.top+rect.h-camY*CH)*s));
          const y2=Math.min(canvas.height,Math.ceil(canvas.height-(rect.top-camY*CH)*s));
          const a=new Uint8Array(Math.max(0,(x2-x)*(y2-y)*4));
          if(a.length)gpu.readPixels(x,y,x2-x,y2-y,gpu.RGBA,gpu.UNSIGNED_BYTE,a);
          return a;
        };
        const delta=(a,b)=>{let d=0;for(let i=0;i<a.length;i+=4)
          if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>24)d++;
          return d};
        const sourceEntity=drawEntity;let hidden=null;
        drawEntity=function(e){if(e!==hidden)return sourceEntity(e)};
        const saveNpc={x:npc.x,y:npc.y,tx:npc.tx,ty:npc.ty,behavior:npc.behavior,moving:npc.moving};
        const savePlayer={x:player.x,y:player.y,tx:player.tx,ty:player.ty};
        const place=(x,y)=>{npc.x=npc.tx=x;npc.y=npc.ty=y;npc.moving=true;
          // The knight stands well clear: the camera frames the NPC only.
          player.x=player.tx=x+40;player.y=player.ty=y;
          updateCamera(0,true);};
        const visible=()=>{
          updateCamera(0,true);const rect=geomOf(npc);
          hidden=null;render();const a=image(rect);
          hidden=npc;render();const b=image(rect);hidden=null;
          return delta(a,b);
        };
        const touched=new Set();
        const settle=(frames)=>{for(let i=0;i<frames;i++)updateFlora(1/60)};
        try{
          npc.behavior='idle';
          const rows=[];
          for(const b of dense){
            for(const o of bushes)if(Math.abs(o.x-b.x)*CW<400){
              touched.add(o);o.nativeTwigs?.fill(0);
              o.nativeTwigVel?.fill(0);o.nativePart=0;
            }
            place(b.x,b.br-.7);settle(40);
            if(!(b.nativePart>.4&&b.nativePartWidth>0))
              throw Error('Contact did not open dense bush '+JSON.stringify(
                {part:b.nativePart,width:b.nativePartWidth}));
            const now=visible();
            // Reference at the same spot and light: no bush at all, neither
            // the ASCII crowns nor their 3D depth clumps.
            const sourceFlora=drawFlora,sourceShift=nativeBushBranchShift;
            drawFlora=f=>{if(f.v.type!=='bush')sourceFlora(f)};
            nativeBushBranchShift=null;
            let clear;
            try{clear=visible()}finally{drawFlora=sourceFlora;nativeBushBranchShift=sourceShift}
            if(clear<200)throw Error('NPC not drawn without bushes '+clear);
            // Previous behaviour: identical springs, no body clearance.
            const widths=new Map();
            for(const o of touched){widths.set(o,o.nativePartWidth);o.nativePartWidth=0}
            const before=visible();
            for(const [o,w] of widths)o.nativePartWidth=w;
            // No leaf of the bush itself may stay inside the body column
            // above its anchored woody base.
            const start=GB.n;drawFlora(b);
            const c=Math.round(b.x)*CW+b.nativePartCenter,H=b.v.crownH;
            const column=b.nativePartWidth*b.nativePart*.8,by=b.br*CH;
            let inside=0,leaves=0;
            for(let i=start;i<GB.n;i++){
              const j=i*6;if(GB.buf[j+4]===SOLID_K)continue;
              leaves++;
              const h=(by-GB.buf[j+1])/H;
              if(h>.3&&h<.95&&Math.abs(GB.buf[j]-c)<column*.6)inside++;
            }
            GB.n=start;
            rows.push({x:Math.round(b.x),clear,now,before,leaves,inside});
          }
          // Recovery: the actor leaves, the crown closes with no jump and
          // returns to the exact source drawing.
          const b=dense[0];
          place(b.x,b.br-.7);settle(40);
          const probe=[-.6,-.3,-.1,.1,.3,.6].map(k=>k*b.v.R);
          const sample=()=>probe.map(x=>api.branchShift(b,x,.6));
          let last=sample(),maxStep=0,frames=0;
          // Out of reach but still on screen, so updateFlora keeps simulating it.
          place(b.x+b.v.R/CW+14,b.br-.7);
          for(;frames<600;frames++){
            updateFlora(1/60);
            const s=sample();
            for(let k=0;k<s.length;k++)maxStep=Math.max(maxStep,Math.abs(s[k]-last[k]));
            last=s;
            if(!(b.nativePart>0)&&!b.nativeTwigs.some(x=>Math.abs(x)>.012))break;
          }
          const settled=frames<600;
          b.rust=0;b.flut=0;
          let start=GB.n;drawFlora(b);const nowDraw=Array.from(GB.buf.slice(start*6,GB.n*6));
          GB.n=start;api.sourceDraw(b);const srcDraw=Array.from(GB.buf.slice(start*6,GB.n*6));
          GB.n=start;
          const identical=nowDraw.length===srcDraw.length&&nowDraw.every((v,i)=>v===srcDraw[i]);
          if(JSON.stringify(MEADOW_MAP)!==mapBefore)throw Error('Authored map mutated');
          return {rows,recovery:{settled,frames,maxStep:+maxStep.toFixed(2),
            identical,width:b.nativePartWidth,center:b.nativePartCenter},
            contexts:document.querySelectorAll('#three-parity-canvas').length};
        }finally{
          drawEntity=sourceEntity;
          Object.assign(npc,saveNpc);Object.assign(player,savePlayer);
          for(const o of touched){o.nativeTwigs?.fill(0);o.nativeTwigVel?.fill(0);
            o.nativePart=0;o.nativePartWidth=0;o.nativePartCenter=0}
          updateCamera(0,true);render();
        }
      });
      const now=result.rows.map(r=>r.now/r.clear).sort((a,b)=>a-b);
      const sumNow=result.rows.reduce((s,r)=>s+r.now,0);
      const sumBefore=result.rows.reduce((s,r)=>s+r.before,0);
      const median=now[now.length>>1];
      const problems=[];
      if(median<.6)problems.push('median visibility '+median.toFixed(2)+' < 0.60');
      if(now[0]<.4)problems.push('worst thicket visibility '+now[0].toFixed(2)+' < 0.40');
      if(sumNow<sumBefore*1.5)problems.push('clearance gain '+(sumNow/sumBefore).toFixed(2)+' < 1.5');
      for(const r of result.rows){
        if(r.now<r.before*.95)problems.push('thicket '+r.x+' got worse');
        if(r.inside)problems.push('thicket '+r.x+' has '+r.inside+' leaves inside the body column');
      }
      const rc=result.recovery;
      if(!rc.settled)problems.push('boughs did not settle');
      if(!rc.identical)problems.push('recovered bush differs from source drawing');
      if(rc.width||rc.center)problems.push('contact column not cleared after recovery');
      if(rc.maxStep>3)problems.push('bough jump '+rc.maxStep+'px in one frame');
      if(result.contexts!==1)problems.push('contexts '+result.contexts);
      if(errors.length)problems.push('JS errors: '+errors.join(' | '));
      await page.screenshot({path:path.join(out,label+'.png'),timeout:120000});
      const summary={label,median:+median.toFixed(2),worst:+now[0].toFixed(2),
        gain:+(sumNow/sumBefore).toFixed(2),...result};
      fs.writeFileSync(path.join(out,label+'.json'),JSON.stringify(summary,null,1));
      if(problems.length)throw Error(label+': '+problems.join('; ')+' '+JSON.stringify(summary));
      console.log('NATIVE BUSH READABILITY PASS '+JSON.stringify(summary));
      await ctx.close();
    }
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
