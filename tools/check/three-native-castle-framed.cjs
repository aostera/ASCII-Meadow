// T02 source-aware full-silhouette art QA from the actual native game.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const root=(process.argv[2]||'http://127.0.0.1:8181').replace(/\/$/,'');
const dir=path.join(process.cwd(),'shots','three-native-castle-framed');
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
   page.on('pageerror',e=>errors.push(e.stack||e.message));
   const reply=await page.goto(root+
     '/experiments/three/native.html?edit=0&nativeCastleFramedTest=1',
     {waitUntil:'domcontentloaded'});
   if(!reply?.ok())throw Error('Native game not available');
   await page.waitForFunction(()=>window.__ASCII_NATIVE__?.ready&&
     window.__ASCII_NATIVE__.frameCount>4&&
     window.__ASCII_NATIVE_COMPLETE_ARCH__?.features?.castle?.centralBrokenGables>=30,
     undefined,{timeout:120000});
   // Freeze the test page after its current RAF; production camera is untouched.
   await page.evaluate(()=>{window.requestAnimationFrame=()=>0});
   await page.waitForTimeout(150);
   const data=await page.evaluate(()=>{
     const c=cathedral,native=window.__ASCII_NATIVE__;
     const mapOriginal=JSON.stringify(MEADOW_MAP);
     if(native.mode!=='three'||editing||!c.cv)
       throw Error('Not in original playable Three mode');
     let n=0,x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
     // The source raycast raster includes all castle stones and spires.
     for(let y=0;y<c.BH;y++)for(let x=0;x<c.BW;x++){
       if(c.lum[y*c.BW+x]<0)continue;
       n++;
       x0=Math.min(x0,c.cx0+x);x1=Math.max(x1,c.cx0+x);
       y0=Math.min(y0,c.cy0+y);y1=Math.max(y1,c.cy0+y);
     }
     if(n<500)throw Error('Missing authored castle raster');
     const z=Math.min(.7,W*.84/((x1-x0+1)*CW),
       H*.84/((y1-y0+1)*CH));
     if(!(z>=.08&&z<=.7))throw Error('Cannot frame '+z);
     // Same source VZ and camera cropping used by the map editor;
     // this changes no production camera, object or render pipeline.
     VZ=z;
     camX=Math.max(0,Math.min(Math.max(0,COLS-VC/VZ),
       (x0+x1+1)/2-VC/(2*VZ)));
     camY=Math.max(0,Math.min(Math.max(0,ROWS-VR/VZ),
       (y0+y1+1)/2-VR/(2*VZ)));
     setView();cloudTick=2;render();
     const rect=[(x0-camX)*CW*VZ,(y0-camY)*CH*VZ,
       (x1+1-camX)*CW*VZ,(y1+1-camY)*CH*VZ];
     const margins=[rect[0],rect[1],W-rect[2],H-rect[3]];
     let visible=0;
     for(let y=0;y<c.BH;y++)for(let x=0;x<c.BW;x++){
       if(c.lum[y*c.BW+x]<0)continue;
       const cx=c.cx0+x,cy=c.cy0+y;
       if(cx>=VX0&&cx<=VX1&&cy>=VY0&&cy<=VY1)visible++;
     }
     const canvas=native.renderer.domElement;
     const result={
       viewport:[W,H],canvas:[canvas.width,canvas.height],
       sourceCells:n,visibleCells:visible,coverage:visible/n,
       zoom:VZ,withinEditorZoomRange:VZ>=.35,
       sourceBounds:[x0,y0,x1,y1],rect,margins,
       mode:native.mode,mapPreserved:mapOriginal===JSON.stringify(MEADOW_MAP),
       gameplayNotEditing:!editing,solids:solids.length,
       oneWebGLCanvas:document.querySelectorAll('#three-parity-canvas').length===1
     };
     if(result.coverage<.995||Math.min(...margins)<-1||
        !result.mapPreserved||!result.gameplayNotEditing||
        !result.oneWebGLCanvas)
       throw Error('Full castle still clipped / altered '+JSON.stringify(result));
     return result;
   });
   await page.screenshot({path:path.join(dir,label+'-full-hud.png'),timeout:60000});
   // Only in the second screenshot hide the actual DOM HUD, not the stones.
   await page.addStyleTag({content:'.hud,.stats{visibility:hidden!important}'});
   await page.evaluate(()=>{cloudTick=2;setView();render()});
   await page.screenshot({path:path.join(dir,label+'-full-clean.png'),timeout:60000});
   fs.writeFileSync(path.join(dir,label+'-framing.json'),
     JSON.stringify(data,null,2)+'\n');
   if(errors.length)throw Error(label+' browser exception '+errors.join(' | '));
   console.log('NATIVE FULL CASTLE FRAME '+label+' '+JSON.stringify(data));
   await ctx.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
