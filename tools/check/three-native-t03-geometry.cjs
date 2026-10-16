// T03 physical 3D silhouette/yaw/portal/shadow QA. Runs on the real native
// game and captures separately OPENABLE PNGs, never just one contact sheet.
// Do not mistake browser-emulated touch for an actual iPhone or Android.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const dir=path.join(process.cwd(),'shots','three-native-t03-angles');
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
   const res=await page.goto(base.replace(/\/$/,'')+
     '/experiments/three/native.html?edit=0',
     {waitUntil:'domcontentloaded'});
   if(!res?.ok())throw Error('T03 native game not reachable');
   await page.waitForFunction(()=>window.__ASCII_NATIVE__?.ready&&
     window.__ASCII_NATIVE_COMPLETE_ARCH__?.features?.ruins?.['cloister-walk']&&
     ruins.length===3,undefined,{timeout:120000});
   const report=await page.evaluate(()=>{
     const original=JSON.stringify(MEADOW_MAP);
     window.__ASCII_T03_CHECK_MAP__=original;
     const raw=window.__ASCII_NATIVE_COMPLETE_ARCH__;
     const savedLength=solids.length;
     const out=[];
     function assert(ok,msg){if(!ok)throw Error(msg)}
     // Raycast is against actual convex planes, after ruinRotateMesh.
     // The same mesh is consumed by the source glyph and shadow bakers.
     function ray(mesh,site,lx,y,lz,ldx,ldz){
       const [wx,wz]=ruinWorldXZ(site,lx,lz);
       const c=Math.cos(site.yaw||0),s=Math.sin(site.yaw||0);
       return cast(wx-site.x,y,wz-site.z,
         ldx*c+ldz*s,0,-ldx*s+ldz*c,0,mesh);
     }
     const hitChanged=(a,b)=>Boolean(a)!==Boolean(b)||
       (a&&b&&Math.abs(a.t-b.t)>1.5);
     for(const site of ruins){
       const n={gate:6,abbey:6,cloister:8}[site.type];
       assert(n&&raw.features.ruins[site.id].massiveBrokenSilhouette===n,
         'Missing distinct ruin source '+site.id);
       // The original source raster ceiling is 1.08*height. Verify the
       // new monumental stones respect it without modifying src/world/ruins.js.
       const angles=[];
       let highestNewStone=0;
       for(const angle of [0,Math.PI/5,-Math.PI/5]){
         const variant={...site,yaw:(site.yaw||0)+angle};
         const start=solids.length;
         ruinDetail(variant);
         const mesh=solids.splice(start);
         assert(mesh.length===site.meshPieces,
           'Rotated ruin mesh size changed '+site.id);
         const bare=mesh.slice(0,-n);
         const newHeight=mesh.slice(-n).reduce((h,so)=>Math.max(h,so.bb[3]),0);
         highestNewStone=Math.max(highestNewStone,newHeight);
         assert(newHeight<=site.height*1.08-0.01,
           'T03 new solid above legacy raster bounds '+site.id+' '+
           JSON.stringify({newHeight,limit:site.height*1.08}));
         assert(mesh.every(so=>so.bb[0]<so.bb[1]&&
           so.bb[2]<so.bb[3]&&so.bb[4]<so.bb[5]&&
           so.bb.every(Number.isFinite)&&
           so.pl.every(p=>p.every(Number.isFinite))),
           'Degenerate rotated convex ruin '+site.id);
         ruinRotateMesh(mesh,variant);
         const testY=Math.min(site.archHeight*.29,site.archHeight-15);
         const z0=-site.depth*.5-90,z1=site.depth*.5+90;
         assert(!ray(mesh,variant,0,testY,z0,0,1)&&
           !ray(mesh,variant,0,testY,z1,0,-1),
           'Physical arch blocked by new upper rib '+site.id);
         const pierX=site.arch*.5+Math.min(25,(site.width-site.arch)*.12);
         assert(ray(mesh,variant,pierX,testY,z0,0,1),
           'Pier became see-through '+site.id);
         // Physically different world-space views of projected 3D masonry.
         let frontDelta=0,sideDelta=0,shadowDelta=0;
         const yLo=Math.max(site.archHeight+38,site.height*.66);
         const yHi=Math.max(yLo+10,newHeight-5);
         for(let iy=0;iy<13;iy++)for(let ix=0;ix<15;ix++){
           const y=yLo+(yHi-yLo)*(iy+.25)/13;
           const x=(ix/14-.5)*site.width*1.08;
           const z=(ix/14-.5)*site.depth*1.45;
           const fa=ray(mesh,variant,x,y,z0,0,1);
           const fb=ray(bare,variant,x,y,z0,0,1);
           if(hitChanged(fa,fb))frontDelta++;
           const la=ray(mesh,variant,-site.width*.5-110,y,z,1,0);
           const lb=ray(bare,variant,-site.width*.5-110,y,z,1,0);
           if(hitChanged(la,lb))sideDelta++;
         }
         if(angle===0){
           // Same sun-ray as src/world/ruins.js::paintRuinGroundShadows.
           // If the new tall shapes cast NO distinct sunlight occlusion,
           // the silhouette is visual-only and not physically integrated.
           for(let iz=0;iz<30;iz++)for(let ix=0;ix<30;ix++){
             const lx=-site.width*.7+
               ix*(site.width*1.55+site.sourceTop*.9)/29;
             const lz=-site.depth*.7+
               iz*(site.depth*1.15+site.sourceTop*.95)/29;
             const [wx,wz]=ruinWorldXZ(variant,lx,lz);
             const px=wx-site.x,pz=wz-site.z;
             const a=cast(px,.5,pz,LGT[0],LGT[1],LGT[2],.01,mesh);
             const b=cast(px,.5,pz,LGT[0],LGT[1],LGT[2],.01,bare);
             if(hitChanged(a,b))shadowDelta++;
           }
         }
         angles.push({yaw:variant.yaw,frontDelta,sideDelta,shadowDelta,
           portalFrontOpen:true,portalRearOpen:true,pierBlocks:true});
       }
       assert(angles.some(a=>a.frontDelta>3),
         'T03 upper silhouette is invisible from front '+site.id+' '+
         JSON.stringify(angles));
       assert(angles.some(a=>a.sideDelta>1),
         'T03 upper silhouette is a flat facade '+site.id+' '+
         JSON.stringify(angles));
       assert(angles[0].shadowDelta>1,
         'T03 high Gothic stone casts no unique actual sun rays '+
         site.id+' '+JSON.stringify(angles));
       out.push({id:site.id,highestNewStone,
         legacyRasterCeiling:site.height*1.08,
         siteHeight:site.height,bakedCells:site.gridW*site.gridH,
         meshPieces:site.meshPieces,newSolids:n,angles});
     }
     assert(solids.length===savedLength,
       'T03 QA leaked source solids into the castle renderer');
     assert(JSON.stringify(MEADOW_MAP)===original,
       'T03 rotated architecture QA changed original authored map');
     return {viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,
       native:window.__ASCII_NATIVE__.mode,
       sameMap:true,rendererCount:
         document.querySelectorAll('#three-parity-canvas').length,
       ruins:out};
   });
   if(report.native!=='three'||report.rendererCount!==1||
     !report.sameMap||report.ruins.length!==3)
     throw Error('T03 source raycast contract '+JSON.stringify(report));
   fs.writeFileSync(path.join(dir,label+'-multiangle-physics.json'),
     JSON.stringify(report,null,2)+'\n');
   // Distinct actual gameplay follow-camera approaches in one engine.
   // These are camera QA poses; do NOT present them as played travel routes.
   await page.addStyleTag({
     content:'.hud,.stats{visibility:hidden!important}'
   });
   for(const r of report.ruins)for(const direction of ['front','side','back']){
     const pos=await page.evaluate(({id,direction})=>{
       const ruin=ruins.find(r=>r.id===id);
       if(!ruin)throw Error('Missing native 3D ruin '+id);
       const [wx,wz]=direction==='front'?
         ruinWorldXZ(ruin,0,-ruin.depth*.5-65):
         direction==='back'?
           ruinWorldXZ(ruin,0,ruin.depth*.5+65):
           ruinWorldXZ(ruin,-ruin.width*.5-70,0);
       const [x,y]=mapToCell(wx,wz);
       player.x=player.tx=x;player.y=player.ty=y;
       player.h=player.hT=surfAt(x,y);
       VZ=1;updateCamera(0,true);cloudTick=2;FG.tick=0;render();
       return {x,y,camX,camY,VZ,mode:window.__ASCII_NATIVE__.mode,
         mapOK:JSON.stringify(MEADOW_MAP)===
           window.__ASCII_T03_CHECK_MAP__};
     },{id:r.id,direction});
     if(pos.VZ!==1||pos.mode!=='three')
       throw Error('T03 native pose not real zoom=1 '+JSON.stringify(pos));
     await page.screenshot({
       path:path.join(dir,label+'-'+r.id+'-'+direction+'.png'),
       timeout:60000
     });
   }
   if(errors.length)throw Error('Native T03 JS errors '+label+' '+errors.join('; '));
   console.log('T03 MULTI ANGLE PHYSICAL RUINS '+label+' '+
     JSON.stringify(report));
   await ctx.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
