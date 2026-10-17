// Native bush mechanic browser acceptance: actual authored foliage glyphs,
// animated collision opening, 1:1 glyph IDs/alpha, restoration after release.
// Both desktop and mobile run real WebGL2 (SwiftShader software CI).
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const dir=path.join(process.cwd(),'shots','three-native-bush');
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
   if(!response?.ok())throw Error('Native bush test cannot load world');
   await page.waitForFunction(()=>window.__ASCII_NATIVE__?.ready&&
     window.__ASCII_NATIVE_BUSHES__?.counts.total>0,
     undefined,{timeout:90000});
   const result=await page.evaluate(()=>{
     const api=window.__ASCII_NATIVE_BUSHES__;
     const source=JSON.stringify(MEADOW_MAP);
     if(!(api.shift(-8,0,50,1)<0&&api.shift(8,0,50,1)>0)||
        api.shift(100,0,50,1)!==0)
       throw Error('Parting function does not displace away from actor');
     // Choose a real authored/generated bush, not a synthetic re-created
     // atlas with invented glyphs.
     const f=flora.find(f=>f.v.type==='bush'&&f.v.list.length>12);
     if(!f)throw Error('No actual bush foliage asset');
     const oldPlayer={x:player.x,y:player.y,tx:player.tx,ty:player.ty,
       moving:player.moving};
     const oldState={sw:f.sw,rust:f.rust,flut:f.flut,nativePart:f.nativePart,
       nativePartCenter:f.nativePartCenter,fade:f.fade};
     const oldCount=GB.n;
     try{
       player.x=f.x;player.y=f.br-.7;
       player.tx=f.x;player.ty=player.y;player.moving=true;
       updateCamera(0,true);
       for(let i=0;i<40;i++)updateFlora(1/60);
       const opened=f.nativePart;
       if(!(opened>.45&&opened<=1))
         throw Error('Contact did not bend real bush: '+opened);
       // Freezing the source plant movement isolates geometry only. Render
       // the same plant with both methods and compare every leaf glyph id
       // and unchanged RGB/alpha. Leaves move sideways; a pushed bough may
       // only sag a little (down, never up), as it rotates about its root.
       // A source bush at rest uses 14 atlas slices. Force its EXISTING\n       // per-leaf rustle route for a like-for-like glyph comparison.\n       f.sw=0;f.rust=1;f.flut=0;f.fade=1;
       GB.n=0;api.sourceDraw(f);
       const getLeaves=()=>Array.from({length:GB.n},(_,i)=>{
         const j=i*6,b=GB.buf;
         return [b[j],b[j+1],b[j+4],b[j+5]];
       }).filter(r=>r[2]!==SOLID_K);
       const before=getLeaves();
       GB.n=0;drawFlora(f);
       const after=getLeaves();
       if(before.length!==after.length||before.length<4)
         throw Error('Bush replacement removed or invented leaves');
       let shifted=0,alphaChanged=0,sourceChanged=0,maxSag=0;
       for(let j=0;j<before.length;j++){
         const a=before[j],b=after[j];
         if(a[0]!==b[0])shifted++;
         if(a[3]!==b[3])alphaChanged++;
         const sag=b[1]-a[1];maxSag=Math.max(maxSag,sag);
         if(a[2]!==b[2]||sag<-1e-6||sag>f.v.crownH*.12)sourceChanged++;
       }
       if(shifted<2||alphaChanged||sourceChanged)
         throw Error('Foliage mismatch '+JSON.stringify({
           leaves:before.length,shifted,alphaChanged,sourceChanged,maxSag}));
       player.x=-999999;player.y=-999999;
       for(let i=0;i<240;i++)updateFlora(1/60);
       const returned=f.nativePart||0;
       if(returned>.01)throw Error('Bush did not spring closed '+returned);
       if(JSON.stringify(MEADOW_MAP)!==source)throw Error('Authored map mutated');
       return {opened,returned,leaves:before.length,shifted,
         alphaChanged,sourceChanged,mapUnchanged:true};
     }finally{
       Object.assign(player,oldPlayer);Object.assign(f,oldState);
       GB.n=oldCount;updateCamera(0,true);
     }
   });
   await page.screenshot({path:path.join(dir,label+'-game.png'),timeout:60000});
   if(errors.length)throw Error(label+' browser errors '+errors.join('; '));
   console.log('NATIVE BUSH PHYSICAL PASS '+label+' '+JSON.stringify(result));
   await ctx.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
