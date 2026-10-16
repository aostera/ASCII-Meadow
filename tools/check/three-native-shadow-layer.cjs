// Regression: feather masonry shadows before flora and editor snapshot.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const out=path.join(process.cwd(),'shots','three-native-shadow-layer');
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
    '/experiments/three/native.html?edit=1',
    {waitUntil:'domcontentloaded'});
   if(!response?.ok())throw Error('Native architecture-shadow HTTP failed');
   await page.waitForFunction(()=>
    window.__ASCII_NATIVE__?.ready&&
    window.__ASCII_NATIVE_SHADOWS__?.bakes>0&&
    bshadeCastle?.length===bshade.length,
    undefined,{timeout:120000});
   const values=await page.evaluate(()=>{
    const s=window.__ASCII_NATIVE_SHADOWS__;
    const before=JSON.stringify(MEADOW_MAP);
    const originalExport=mapFileText();
    const initialBakes=s.bakes,initialChanges=s.changedCells;
    const oneContext=document.querySelectorAll('#three-parity-canvas').length;
    if(s.phase!=='after-buildWorld-before-buildFlora')
      throw Error('Architecture shadow pass order not guaranteed');
    if(initialChanges<10||oneContext!==1)
      throw Error('No native stone-shadow refinement or duplicate GPU context');
    let diff=0,maxDelta=0,brightened=0,darkened=0,deepSaved=0,flatSaved=0;
    try{
      // Compare source raycast baseline and the same world with edge filter.
      s.sourceBuildWorld();
      const source=bshade.slice();
      buildWorld();
      const refined=bshade.slice();
      for(let i=0;i<source.length;i++){
        const d=refined[i]-source[i];
        if(Math.abs(d)>.0001){
          diff++;if(d>0)darkened++;else brightened++;
          maxDelta=Math.max(maxDelta,Math.abs(d));
        }
        if(i>COLS*3&&i<N-COLS*3){
          if(source[i]===0&&source[i-1]===0&&
             source[i+1]===0&&source[i-COLS]===0&&
             source[i+COLS]===0&&refined[i]===0)flatSaved++;
          if(source[i]>.25&&source[i-1]===source[i]&&
             source[i+1]===source[i]&&
             source[i-COLS]===source[i]&&
             source[i+COLS]===source[i]&&refined[i]===source[i])
            deepSaved++;
        }
      }
      if(diff<10||s.changedCells<10||darkened<2||brightened<2||
         maxDelta>.25||flatSaved<100||deepSaved<100)
        throw Error('Shadow blur changed actual ground topology '+JSON.stringify({
          diff,changed:s.changedCells,darkened,brightened,maxDelta,
          flatSaved,deepSaved}));
      edRebuildCastle();
      const fresh=bshade;
      if(!bshadeCastle||bshadeCastle.length!==fresh.length)
        throw Error('Editor missing architectural shadow snapshot');
      for(let i=0;i<fresh.length;i++)
        if(bshadeCastle[i]!==fresh[i])
          throw Error('Editor retained stale unsoftened shadow at '+i);
      // Rebuilding flora starts from bshadeCastle and overlays its OWN shade.
      const bakesBeforeFlora=s.bakes;
      rebuildMap();
      if(s.bakes!==bakesBeforeFlora)
        throw Error('Flora update triggered extra architectural shadow blur');
      const background=bshadeCastle,painted=bshade;
      let floraChanges=0;
      for(let i=0;i<background.length;i++)
        if(painted[i]>background[i]+.001)floraChanges++;
      if(floraChanges<10)
        throw Error('Native shadow order lost original flora ground-shading layer');
      if(JSON.stringify(MEADOW_MAP)!==before||mapFileText()!==originalExport)
        throw Error('Architecture penumbra test modified original authored map');
      return {sourceRaycastCells:source.length,edgeCells:diff,
        changedCells:s.changedCells,maxDelta,brightened,darkened,
        untouchedBright:flatSaved,untouchedDeep:deepSaved,
        floraAddedCells:floraChanges,bakesBefore:initialBakes,
        bakesAfter:s.bakes,oneContext,mapUnchanged:true,
        editorSnapshotMatches:true,phase:s.phase};
    }finally{
      // Restore transient baked buffers even if an intermediate assertion fails.
      try{edRebuildCastle();rebuildMap()}catch(_){}
    }
   });
   if(errors.length)throw Error(label+' browser exceptions: '+errors.join(' | '));
   await page.screenshot({path:path.join(out,label+'.png'),timeout:60000});
   console.log('NATIVE ARCHITECTURE SHADOW LAYERS PASS '+label+' '+JSON.stringify(values));
   await ctx.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
