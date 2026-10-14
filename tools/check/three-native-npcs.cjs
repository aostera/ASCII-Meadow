// Native NPC draw-order acceptance: NPC bodies belong to the world glyph
// buffer rather than the always-front #c canvas. Source faces/tint map stay.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const dest=path.join(process.cwd(),'shots','three-native-npcs');
fs.mkdirSync(dest,{recursive:true});
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
     '/experiments/three/native.html?edit=0',{waitUntil:'domcontentloaded'});
   if(!res?.ok())throw Error('Native NPC URL failed');
   await page.waitForFunction(()=>window.__ASCII_NATIVE__?.ready&&
     window.__ASCII_NATIVE_NPCS__?.paletteCount>=2,
     undefined,{timeout:100000});
   const proof=await page.evaluate(()=>{
     const sourceMap=JSON.stringify(MEADOW_MAP);
     const villager=npcs.find(e=>e.actorType==='villager');
     const hermit=ACTOR_TYPES.get('hermit');
     if(!villager||!hermit)throw Error('Original catalog actors missing');
     const oldPlayer=[player.x,player.y,player.tx,player.ty];
     const oldGB=GB.n;
     const originalFill=ctx.fillText;
     let textCalls=0;
     try{
       player.x=villager.x;player.y=villager.y;
       player.tx=player.x;player.ty=player.y;
       updateCamera(0,true);
       GB.n=0;
       ctx.fillText=function(...args){textCalls++;return originalFill.apply(this,args)};
       drawEntity(villager);
       const n=GB.n,characterCount=villager.nativeDepthGlyphs||0;
       if(!(n>30&&characterCount>10))
         throw Error('NPC body was not painted into GPU world');
       if(textCalls>3)
         throw Error('NPC body was still painted on always-front canvas: '+textCalls);
       const ids=[];
       for(let i=0;i<n;i++)ids.push(GB.buf[i*6+4]);
       if(!ids.every(id=>id>=0&&id<GB.spr.length))
         throw Error('Invalid native NPC palette index');
       const actorBodies=ids.filter(id=>id!==SOLID_K).length;
       if(actorBodies<characterCount)
         throw Error('GPU glyphs missing actual animated NPC');
       // Original trees and actors now use the SAME painter buffer.
       const bush=flora.find(f=>f.v.type==='bush');
       if(!bush)throw Error('No source flora');
       const countBefore=GB.n;
       drawFlora(bush);
       const countAfter=GB.n;
       if(countAfter<=countBefore)throw Error('Flora and NPC do not share glyph painter');
       if(JSON.stringify(MEADOW_MAP)!==sourceMap)
         throw Error('NPC migration modified the author's map');
       return {paletteCount:window.__ASCII_NATIVE_NPCS__.paletteCount,
         npcGlyphs:characterCount,bodyOnGPU:n,
         overlayTextCalls:textCalls,
         foregroundFloraDraws:countAfter-countBefore,
         paletteValid:true,mapUnchanged:true};
     }finally{
       ctx.fillText=originalFill;
       GB.n=oldGB;
       [player.x,player.y,player.tx,player.ty]=oldPlayer;
       updateCamera(0,true);
     }
   });
   await page.screenshot({path:path.join(dest,label+'.png'),timeout:60000});
   if(errors.length)throw Error(label+' native NPC exceptions '+errors.join('; '));
   console.log('NATIVE NPC DEPTH PASS '+label+' '+JSON.stringify(proof));
   await ctx.close();
  }
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
