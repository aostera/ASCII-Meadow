// Regression: castle shadows reach past the source cast window and every
// castle/ruin shadow edge is a geometric covered fraction, while interior
// shadow, fully-lit ground, arch openings and the authored map are unchanged.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const out=path.join(process.cwd(),'shots','three-native-shadow-coverage');
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
    '/experiments/three/native.html?edit=1',{waitUntil:'domcontentloaded'});
   if(!response?.ok())throw Error('Native shadow-coverage HTTP failed');
   await page.waitForFunction(()=>
    window.__ASCII_NATIVE__?.ready&&
    window.__ASCII_NATIVE_SHADOW_COVERAGE__?.stats.bakes>0&&
    bshadeCastle?.length===bshade.length,undefined,{timeout:180000});
   const values=await page.evaluate(()=>{
    const cov=window.__ASCII_NATIVE_SHADOW_COVERAGE__;
    const soft=window.__ASCII_NATIVE_SHADOWS__;
    const before=JSON.stringify(MEADOW_MAP),exported=mapFileText();
    const coverPaint=paintRuinGroundShadows;
    try{
      // Raw architecture shade (before the penumbra feather), same frame.
      paintRuinGroundShadows=cov.sourcePaintRuins;
      soft.sourceBuildWorld();
      const source=bshade.slice();
      paintRuinGroundShadows=coverPaint;
      soft.sourceBuildWorld();
      const covered=bshade.slice();
      const st=cov.stats;
      soft.sourceBuildWorld();
      const again=bshade.slice();
      for(let i=0;i<covered.length;i++)if(covered[i]!==again[i])
        throw Error('Shadow coverage not deterministic at '+i);
      const [sx0,sy0,sx1,sy1]=st.sourceWindow;
      let interiorKept=0,openKept=0,partial=0,beyond=0,maxDelta=0;
      for(let y=sy0+1;y<sy1;y++)for(let x=sx0+1;x<sx1;x++){
        const i=y*COLS+x,v=source[i];
        let flat=true;
        for(let dy=-1;dy<=1&&flat;dy++)for(let dx=-1;dx<=1;dx++)
          if(source[i+dy*COLS+dx]!==v){flat=false;break}
        if(flat){
          if(covered[i]!==v)throw Error('Coverage changed a cell away from '+
            'any shadow edge at '+x+','+y+' '+v+'->'+covered[i]);
          if(v>0)interiorKept++;else openKept++;
        }
        maxDelta=Math.max(maxDelta,Math.abs(covered[i]-v));
        if(covered[i]>0&&covered[i]<.38-1e-6&&!bmask[i])partial++;
      }
      for(let y=0;y<sy0;y++)for(let x=0;x<COLS;x++)
        if(covered[y*COLS+x]>0)beyond++;
      for(let x=sx1+1;x<COLS;x++)for(let y=sy0;y<=sy1;y++)
        if(covered[y*COLS+x]>0)beyond++;
      for(let i=0;i<covered.length;i++){
        if(covered[i]>.7+1e-6)throw Error('Shadow exceeds source cap at '+i);
        if(bmask[i]&&covered[i]!==source[i])
          throw Error('Shadow written inside castle footprint at '+i);
      }
      if(st.castleGrownCells<100||beyond<100)
        throw Error('Castle shadow still clipped by source window '+
          JSON.stringify({grown:st.castleGrownCells,beyond}));
      if(st.castleEdgeCells<100||st.ruinEdgeCells<100||st.partialCells<100||
         partial<100)
        throw Error('No geometric shadow-edge coverage '+JSON.stringify(st));
      if(interiorKept<1000||openKept<1000)
        throw Error('Too few untouched interior/open cells checked');
      edRebuildCastle();
      for(let i=0;i<bshade.length;i++)if(bshadeCastle[i]!==bshade[i])
        throw Error('Editor snapshot differs from refined shadow at '+i);
      if(JSON.stringify(MEADOW_MAP)!==before||mapFileText()!==exported)
        throw Error('Shadow coverage modified authored map');
      return {...st,interiorKept,openKept,partial,beyondSourceWindow:beyond,
        maxDelta,deterministic:true,mapUnchanged:true,
        oneContext:document.querySelectorAll('#three-parity-canvas').length};
    }finally{
      paintRuinGroundShadows=coverPaint;
      try{edRebuildCastle();rebuildMap()}catch(_){}
    }
   });
   if(values.oneContext!==1)throw Error('Expected one WebGL canvas');
   // Look at the north-east ground the castle shadow now reaches.
   await page.evaluate(()=>{
     editing=false;
     const C=cathedral;
     player.x=player.tx=(C.kx+700*MS)/CW;
     player.y=player.ty=(C.ky-1150*SINP*MS)/CH;
     updateCamera(0,true);render();
   });
   await page.waitForTimeout(400);
   await page.screenshot({path:path.join(out,label+'-castle-ne.png'),timeout:60000});
   if(errors.length)throw Error(label+' browser exceptions: '+errors.join(' | '));
   console.log('NATIVE SHADOW COVERAGE PASS '+label+' '+JSON.stringify(values));
   await ctx.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
