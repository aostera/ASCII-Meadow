// Integration proof: authored camp fires in native keep the source painter
// order against the knight (behind the fire -> the pot and flames cover his
// legs; in front -> he covers them), stay solid through the shared source
// collision, and leave the authored map untouched. Desktop and phone.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const dir=path.join(process.cwd(),'shots','three-native-camp-fire');
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
     '/experiments/three/native.html?edit=0',{waitUntil:'domcontentloaded'});
   if(!response?.ok())throw Error('Native camp fire HTTP failure');
   await page.waitForFunction(()=>window.__ASCII_NATIVE__?.ready,
     undefined,{timeout:120000});
   const data=await page.evaluate(()=>{
     const n=window.__ASCII_NATIVE__,oldMap=JSON.stringify(MEADOW_MAP);
     const fires=braziers.filter(b=>b.ground);
     if(fires.length<2||!fires.some(b=>b.cook))
       throw Error('Authored ground fires or cook pot missing');
     const oldPlayer={x:player.x,y:player.y,tx:player.tx,ty:player.ty};
     const oldBrazier=drawBrazier,oldEntity=drawEntity;
     const gl=n.renderer.getContext(),canvas=n.renderer.domElement;
     const spans=[];
     function region(f){
       // Fire base and pot: a few cells around the authored fire foot.
       const scale=VZ*DPR,x0=(f.x-3-camX)*CW*scale,x1=(f.x+3-camX)*CW*scale;
       const top=(f.y-2-camY)*CH*scale,bottom=(f.y+2-camY)*CH*scale;
       const x=Math.max(0,Math.floor(x0)),w=Math.min(canvas.width,Math.ceil(x1))-x;
       const y=Math.max(0,Math.floor(canvas.height-bottom));
       const h=Math.min(canvas.height,Math.ceil(canvas.height-top))-y;
       if(w<=0||h<=0)return new Uint8Array(0);
       const out=new Uint8Array(w*h*4);
       gl.readPixels(x,y,w,h,gl.RGBA,gl.UNSIGNED_BYTE,out);
       return out;
     }
     function place(f,dy){
       player.x=f.x;player.y=f.y+dy;player.tx=player.x;player.ty=player.y;
       updateCamera(0,true);
       spans.length=0;render();
       const fire=spans.find(s=>s.kind==='fire'&&s.src===f);
       const knight=spans.find(s=>s.kind==='knight');
       return {fire,knight,pixels:region(f)};
     }
     const results=[];
     try{
       drawBrazier=function(b){
         const start=GB.n;oldBrazier(b);
         spans.push({kind:'fire',src:b,start,end:GB.n});
       };
       drawEntity=function(e){
         const start=GB.n;oldEntity(e);
         if(e===player)spans.push({kind:'knight',start,end:GB.n});
       };
       for(const f of fires){
         // Just outside the solid fire ellipse (source collisions.js).
         const behind=place(f,-1.9),front=place(f,3.3);
         if(!behind.fire||!behind.knight||!front.fire||!front.knight)continue;
         let diff=0;
         if(behind.pixels.length===front.pixels.length)
           for(let j=0;j<front.pixels.length;j+=4)
             if(behind.pixels[j]!==front.pixels[j]||
                behind.pixels[j+1]!==front.pixels[j+1]||
                behind.pixels[j+2]!==front.pixels[j+2])diff++;
         results.push({
           x:+f.x.toFixed(1),y:+f.y.toFixed(1),cook:!!f.cook,
           fireGlyphs:behind.fire.end-behind.fire.start,
           behindPaintsFirst:behind.knight.end<=behind.fire.start,
           frontPaintsLast:front.fire.end<=front.knight.start,
           pixelDelta:diff,
           solidCentre:blocked(f.x,f.y+.7,player),
           openBehind:!fireBlocksMove(f.x,f.y-1.9,f,
             {x:f.x,y:f.y-2.4}),
           openFront:!fireBlocksMove(f.x,f.y+3.3,f,{x:f.x,y:f.y+3.8})
         });
       }
     }finally{
       drawBrazier=oldBrazier;drawEntity=oldEntity;
       Object.assign(player,oldPlayer);updateCamera(0,true);render();
     }
     const bad=results.filter(r=>!r.behindPaintsFirst||!r.frontPaintsLast||
       !r.solidCentre||!r.openBehind||!r.openFront||r.fireGlyphs<4);
     if(results.length<2||bad.length||!results.some(r=>r.pixelDelta>=20))
       throw Error('Camp fire order/collision not confirmed '+
         JSON.stringify(results));
     if(JSON.stringify(MEADOW_MAP)!==oldMap)
       throw Error('Camp fire check changed authored map');
     return {fires:results,contexts:
       document.querySelectorAll('#three-parity-canvas').length,
       mapUnchanged:true};
   });
   if(errors.length)throw Error(label+' JS errors '+errors.join('; '));
   if(data.contexts!==1)throw Error(label+' expected one WebGL context');
   await page.screenshot({path:path.join(dir,label+'.png'),timeout:60000});
   console.log('NATIVE CAMP FIRE ORDER COLLISION PASS '+label+' '+
     JSON.stringify(data));
   await ctx.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
