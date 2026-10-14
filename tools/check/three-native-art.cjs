// Art regression for the FULL standalone native game (not the parity lab):
// actor-responsive original bushes, actual facade convex masonry and softened
// CAST shadow boundaries. Do not fake acceptance with a 3D diagnostic inset.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const shots=path.join(process.cwd(),'shots','three-native-art');
fs.mkdirSync(shots,{recursive:true});

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
   page.on('pageerror',e=>errors.push(e.stack||e.message));
   const r=await page.goto((base.endsWith('/')?base.slice(0,-1):base)+
     '/experiments/three/native.html?edit=0',{waitUntil:'domcontentloaded'});
   if(!r?.ok())throw Error('Native architectural art response failed');
   await page.waitForFunction(()=>window.__ASCII_NATIVE__?.ready &&
     window.__ASCII_NATIVE_DETAILS__?.castleRelief>25 &&
     window.__ASCII_NATIVE_DETAILS__?.ruinRelief>18 &&
     window.__ASCII_NATIVE_SHADOWS__?.changedCells>20 &&
     window.__ASCII_NATIVE__.frameCount>3,
     undefined,{timeout:120000});
   const data=await page.evaluate(()=>{
     const original=JSON.stringify(MEADOW_MAP);
     const details=window.__ASCII_NATIVE_DETAILS__;
     const full=window.__ASCII_NATIVE_COMPLETE_ARCH__;
     if(!full)throw Error('Four Gothic buildings lack full geometry module');
     const counts=full.features;
     const essentialCastle=[
       'rose','portal','lancets','buttresses',
       'gargoylesAndSkyline','naveAndVaults'
     ];
     if(essentialCastle.some(k=>!(counts.castle[k]>=5)))
       throw Error('Castle lost modeled sketch feature '+JSON.stringify(counts.castle));
     const expected={
       'broken-gate':'brokenGate',
       'abbey-front':'abbeyRoseAndTracery',
       'cloister-walk':'cloisterVaultsAndBays'
     };
     for(const [id,category] of Object.entries(expected)){
       const f=counts.ruins[id];
       if(!f||!(f.archAndKeystone>=8)||
          !(f.weathering>=10)||!(f[category]>=6))
         throw Error('Missing actual authored Gothic detail '+id+': '+JSON.stringify(f));
     }
     const shadows=window.__ASCII_NATIVE_SHADOWS__;
     const bushes=window.__ASCII_NATIVE_BUSHES__;
     const shadowSample=new Float32Array(11*11);
     for(let y=0;y<11;y++)for(let x=0;x<11;x++)
       shadowSample[y*11+x]=x>=5?.38:0;
     const edgeL=shadows.edgeFilter(shadowSample,11,11,4,5);
     const edgeR=shadows.edgeFilter(shadowSample,11,11,5,5);
     const interior=shadows.edgeFilter(shadowSample,11,11,8,5);
     if(!(edgeL>0&&edgeR<.38&&interior===.38))
       throw Error('Masonry penumbra still sharp or rectangular: '+
         JSON.stringify({edgeL,edgeR,interior}));
     const branch=(x,h)=>bushes.branchShift({
       v:{R:50},nativeTwigs:new Float32Array([
         -.5,-.35,-.2,-.05,.2,.5,.6,.3,.15
       ])},x,h);
     const l=branch(-15,.5),right=branch(15,.5);
     const stem=branch(15,0);
     if(!(l<0&&right>0&&Math.abs(stem)<Math.abs(right)))
       throw Error('Bush boughs do not displace independently: '+
         JSON.stringify({l,right,stem}));
     const a=bushes.spring(0,0,.85,1/60);
     if(!(a[0]>0&&a[1]>0))
       throw Error('Bush contact spring was not engaged');
     const variant=ruins.map(r=>r.meshPieces);
     if(variant.some(n=>n<20))
       throw Error('Ruin masonry relief was not baked in world');
     return {
       sculptedArchitecture:counts,
       castleReliefTotal:full.castleTotal,
       distinctRuins:full.ruinTotals,
       castleRelief:details.castleRelief,
       ruinRelief:details.ruinRelief,
       sourceRuins:variant,
       softenedShadowCells:shadows.changedCells,
       edgeL,edgeR,interior,
       branchLeft:l,branchRight:right,
       allMapsPreserved:JSON.stringify(MEADOW_MAP)===original,
       threeMode:window.__ASCII_NATIVE__.mode,
       rendererDepth:window.__ASCII_NATIVE__.nativeDepth,
       singleWebglCanvas:document.querySelectorAll('#three-parity-canvas').length===1
     };
   });
   if(!data.allMapsPreserved||data.threeMode!=='three'||
      !data.singleWebglCanvas)
     throw Error(label+' new source art lost game '+JSON.stringify(data));
   await page.screenshot({
     path:path.join(shots,label+'-gothic-world.png'),timeout:60000
   });
   if(errors.length)throw Error(label+' JS exceptions '+errors.join('; '));
   console.log('NATIVE GOTHIC ART PASS '+label+' '+JSON.stringify(data));
   await ctx.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
