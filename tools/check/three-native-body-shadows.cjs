// Regression: knight/NPC/cow shadows in grass fade smoothly to the rim
// instead of a full-strength block that erases blades in a hard rectangle.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const out=path.join(process.cwd(),'shots','three-native-body-shadows');
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
   const response=await page.goto(base.replace(/\/$/,'')+
    '/experiments/three/native.html',{waitUntil:'domcontentloaded'});
   if(!response?.ok())throw Error('Native body-shadow HTTP failed');
   await page.waitForFunction(()=>window.__ASCII_NATIVE__?.ready&&
    window.__ASCII_NATIVE_BODY_SHADOWS__,undefined,{timeout:180000});
   const values=await page.evaluate(()=>{
    const api=window.__ASCII_NATIVE_BODY_SHADOWS__;
    const before=JSON.stringify(MEADOW_MAP);
    const soft=shadeCapsule;
    // Contact patch + faint sun cast only: fire and lightning casts keep the
    // source profile and are checked separately below.
    const sample=fn=>{
      const fires=braziers.splice(0),bolt=flash;
      shadeCapsule=fn;flash=0;
      try{
        shadow.fill(0,SBY0*COLS,SBY1*COLS);
        castShadow(player);
        return shadow.slice();
      }finally{braziers.push(...fires);flash=bolt}
    };
    let source,refined;
    try{
      source=sample(api.source);
      refined=sample(soft);
    }finally{shadeCapsule=soft}
    let srcCells=0,newCells=0,outside=0,srcBlock=0,newBlock=0,peakSrc=0,peakNew=0;
    for(let i=0;i<source.length;i++){
      const a=source[i],b=refined[i];
      if(a>0)srcCells++;
      if(b>0){newCells++;if(a===0)outside++}
      if(b>a+1e-6)throw Error('Soft shadow darker than source at '+i);
      if(a>=.5)srcBlock++;
      if(b>=.5)newBlock++;
      peakSrc=Math.max(peakSrc,a);peakNew=Math.max(peakNew,b);
    }
    if(srcCells<10)throw Error('Knight casts no source shadow');
    if(outside)throw Error('Soft shadow leaves the source capsule: '+outside);
    if(newCells<srcCells*.9)throw Error('Soft shadow lost its footprint');
    if(newBlock>=srcBlock*.6)
      throw Error('Contact patch still a full-strength block '+
        JSON.stringify({srcBlock,newBlock}));
    if(peakNew<peakSrc*.8)throw Error('Contact shadow lost its core');
    // Sun, fire and lightning casts (non-zero fade) keep the source profile:
    // the lightning shadow is meant to stay hard.
    const cast=(fn,fade)=>{
      shadow.fill(0,SBY0*COLS,SBY1*COLS);
      const x=player.x*CW,y=(player.y+.3)*CH;
      fn(x,y,x+40*CW/8,y-20*CH/8,3*CW,1.6*CW,.6,fade,1.3);
      return shadow.slice();
    };
    let castCells=0;
    for(const fade of [.65,.5,.35]){
      const a=cast(api.source,fade),b=cast(soft,fade);
      for(let i=0;i<a.length;i++){
        if(a[i]!==b[i])throw Error('Directional cast changed (fade '+fade+') at '+i);
        if(a[i]>0)castCells++;
      }
    }
    if(castCells<10)throw Error('Directional cast sample empty');
    shadow.fill(0,SBY0*COLS,SBY1*COLS);
    if(JSON.stringify(MEADOW_MAP)!==before)throw Error('Map modified');
    return {srcCells,newCells,srcBlock,newBlock,peakSrc,peakNew,castCells};
   });
   await page.screenshot({path:path.join(out,label+'.png'),timeout:60000});
   if(errors.length)throw Error(label+' browser exceptions: '+errors.join(' | '));
   console.log('NATIVE BODY SHADOWS PASS '+label+' '+JSON.stringify(values));
   await ctx.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
