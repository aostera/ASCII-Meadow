// Native foundation grounding: source castle and correctly rotated Gothic
// ruin stone feet must yield a tapered living-grass skirt, without changing
// any author map, collision, terrain kind, raycast light, or original pixels.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const dest=path.join(process.cwd(),'shots','three-native-foundation-ground');
fs.mkdirSync(dest,{recursive:true});

(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
  for(const mobile of [false,true]){
   const label=mobile?'phone':'desktop';
   const context=await browser.newContext({
    viewport:mobile?{width:390,height:844}:{width:1100,height:740},
    deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile
   });
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   const response=await page.goto(base.replace(/\/$/,'')+
    '/experiments/three/native.html?edit=1&nativeGroundTest=1',
    {waitUntil:'domcontentloaded'});
   if(!response?.ok())throw Error('Native source ground HTTP failed');
   await page.waitForFunction(()=>window.__ASCII_NATIVE__?.ready&&
     window.__ASCII_NATIVE_GROUND__?.bakes>0&&
     window.__ASCII_NATIVE__?.mode==='three'&&
     campGround?.length===kind.length,
     undefined,{timeout:120000});
   const result=await page.evaluate(()=>{
     const n=window.__ASCII_NATIVE__,g=window.__ASCII_NATIVE_GROUND__;
     const sourceMap=JSON.stringify(MEADOW_MAP),sourceExport=mapFileText();
     const contextCount=document.querySelectorAll('#three-parity-canvas').length;
     if(contextCount!==1)throw Error('Multiple Three GPU contexts');
     const sum=a=>{let n=0;for(const v of a)n+=v;return n};
     const checksum=a=>{
       const b=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
       let h=2166136261;
       for(const v of b)h=Math.imul(h^v,16777619);
       return h>>>0;
     };
     if(!g.setEnabledForTest(false))
       throw Error('Ground diagnostic test gate disabled');
     try{
       rebuildFlora();
       const baseGround=campGround.slice();
       const kinds=kind.slice(),originalMask=bmask.slice(),
         originalShade=bshade.slice(),originalHeights=height.slice(),
         originalSeed=seed.slice(),originalFlat=flat.slice();
       const baseline={flora:flora.length,ruins:ruins.length,
         castle:Boolean(cathedral.cv),sourceGroundSum:sum(baseGround),
         mapUnchanged:JSON.stringify(MEADOW_MAP)===sourceMap};
       if(!baseline.castle||baseline.ruins<3||!baseline.flora)
         throw Error('Original authored scene not loaded');
       g.setEnabledForTest(true);
       rebuildFlora();
       const metrics=g.stats;
       const ground=campGround.slice();
       let extras=0,maximum=0,foundationGrass=0,untouched=0;
       for(let i=0;i<ground.length;i++){
         const diff=ground[i]-baseGround[i];
         if(diff<-.00001)
           throw Error('Native contact removed source tent/stone grounding at '+i);
         if(diff>.00001){
           extras++;
           maximum=Math.max(maximum,diff);
           if(kind[i]!==1||bmask[i])
             throw Error('Native contact changed a blocked or grassless cell '+i);
         }else untouched++;
         if(kind[i]!==kinds[i]||bmask[i]!==originalMask[i])
           throw Error('Stone path/collision changed at '+i);
         if(Math.abs(bshade[i]-originalShade[i])>.00001)
           throw Error('Author light/shadow changed from foundation overlay at '+i);
         if(seed[i]!==originalSeed[i]||height[i]!==originalHeights[i])
           throw Error('Author grass seed/height changed at '+i);
         if(kind[i]===1&&ground[i]>.06)foundationGrass++;
       }
       if(metrics.castle<10||metrics.ruins<10||
          metrics.ruinSites<1||metrics.enhanced<25||
          extras<25||maximum>.54||foundationGrass<50)
         throw Error('No meaningful physical foundation fringe '+JSON.stringify({
           metrics,extras,maximum,foundationGrass
         }));
       const beforeRepeat=checksum(campGround);
       rebuildFlora();
       const afterRepeat=checksum(campGround);
       if(beforeRepeat!==afterRepeat)
         throw Error('Foundation fringe accumulated on repeated editor rebuild');
       if(JSON.stringify(MEADOW_MAP)!==sourceMap||
          mapFileText()!==sourceExport)
         throw Error('Native ground finish mutated original authored layout/export');
       if(flora.length!==baseline.flora||ruins.length!==baseline.ruins)
         throw Error('Flora or ruins removed by ground effect');
       if(n.mode!=='three'||contextCount!==1)
         throw Error('Native GPU context changed during grass regeneration');
       // World field had over a million cells: still only a thin band changes.
       return {...baseline,metrics,extraGrassCells:extras,
         untouchedCells:untouched,maxContactIncrease:maximum,
         foundationGrass,worldCells:N,contextCount,
         shadeUnchanged:true,physicsUnchanged:true,
         heightsAndSeedUnchanged:true,identicalEditorRebuild:true,
         sourceMapAndExportUnchanged:true,groundChecksum:afterRepeat};
     }finally{
       g.setEnabledForTest(true);
       rebuildFlora();
     }
   });
   if(errors.length)throw Error(label+' browser errors '+errors.join(' | '));
   await page.screenshot({path:path.join(dest,label+'.png'),timeout:60000});
   console.log('NATIVE ROTATED FOUNDATION GRASS PASS '+label+
      ' '+JSON.stringify(result));
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
