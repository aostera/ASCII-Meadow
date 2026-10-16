// T02: prove a contiguous WALKABLE route using the original knight move()
// and blocked()/surfAt() physics. A reachable pixel near the gate is not
// sufficient: the player must actually climb the source treads without
// teleporting, phase-shifting through masonry, or editing the map.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const root=(process.argv[2]||'http://127.0.0.1:8181').replace(/\/$/,'');
const dir=path.join(process.cwd(),'shots','three-native-castle-route');
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
   const response=await page.goto(root+
     '/experiments/three/native.html?edit=0&nativeCastleFramedTest=1',
     {waitUntil:'domcontentloaded'});
   if(!response?.ok())throw Error('Original native game not available');
   await page.waitForFunction(()=>window.__ASCII_NATIVE__?.ready&&
     window.__ASCII_NATIVE__.frameCount>4&&
     window.__ASCII_NATIVE_COMPLETE_ARCH__?.mainPortalRecessClear,
     undefined,{timeout:120000});
   await page.evaluate(()=>{window.requestAnimationFrame=()=>0});
   await page.waitForTimeout(180);
   const route=await page.evaluate(()=>{
     const original=JSON.stringify(MEADOW_MAP),C=cathedral;
     const center=C.kx/CW,gateY=C.gateRow;
     // Foot of the southern approach is on the actual natural field
     // beyond the first authored stair at model z=-150.
     const ymin=Math.floor(gateY-53),ymax=Math.ceil(gateY+76);
     const nx=67,x0=center-33,ny=ymax-ymin+1;
     const idx=(i,j)=>j*nx+i;
     const xy=(i,j)=>[x0+i,ymin+j];
     const startY=Math.round(gateY+67),startJ=startY-ymin,
       startI=33;
     const terrain=new Float32Array(nx*ny);
     const checked=new Uint8Array(nx*ny);
     const surface=(i,j)=>{
       const n=idx(i,j);
       if(!checked[n]){
         const [x,y]=xy(i,j);
         terrain[n]=surfAt(x,y);
         checked[n]=1;
       }
       return terrain[n];
     };
     let portalSamples=[];
     for(const h of [45,95,155,215,285])
       for(const u of (h===285?[0]:[-55,-20,0,20,55])){
         const y=120+h,sx=C.kx+u*MS,
           sy=C.ky-(y*COSP+100*SINP)*MS;
         if(pointedArch(u,y,0,150,120,290))
           portalSamples.push([Math.round(sx/CW),Math.round(sy/CH),h]);
       }
     const originalFrame={p:[player.x,player.y],camera:[camX,camY],zoom:VZ};
     function visibleFrom(x,y,h){
       // Derive exact production updateCamera(0,true), with its
       // near-gate upward drift and ORIGINAL knight's ground lift.
       const near=Math.max(0,Math.min(1,1-(y-(C.gateRow||0))/(VR*2)));
       const cx=Math.max(0,Math.min(COLS-VC,x-VC/2));
       const cy=Math.max(0,Math.min(ROWS-VR,
         y-h*COSP*MS/CH-VR*(.72+.18*near)));
       const left=Math.max(0,Math.floor(cx)-1);
       const right=Math.min(COLS-1,Math.ceil(cx+VC)+1);
       const top=Math.max(0,Math.floor(cy)-2);
       const bottom=Math.min(ROWS-1,Math.ceil(cy+VR)+3);
       let count=0,upper=0;
       for(const [sx,sy,sh] of portalSamples)
         if(sx>=left&&sx<=right&&sy>=top&&sy<=bottom){
           count++;if(sh>=215)upper++;
         }
       return {count,upper};
     }
     let start=null;
     for(const [di,dj] of [[0,0],[-2,0],[2,0],[0,4],[0,-4],
       [-6,0],[6,0],[0,8],[0,-8]]){
       const i=startI+di,j=startJ+dj;
       if(i<0||i>=nx||j<0||j>=ny)continue;
       const h=surface(i,j),[x,y]=xy(i,j);
       if(!Number.isFinite(h)||h>30)continue;
       player.x=x;player.y=y;player.hT=h;
       if(!blocked(x,y,player)){start={i,j,x,y,h};break}
     }
     if(!start) return {routeFound:false,reason:'no dry road origin',
       gateY,portalSamples:portalSamples.length,originalFrame};
     const parent=new Int32Array(nx*ny).fill(-1);
     const q=new Int32Array(nx*ny);
     let qHead=0,qTail=0,visited=0,attempted=0;
     const s=idx(start.i,start.j);parent[s]=s;q[qTail++]=s;
     let end=-1,best=null,possibleGoal=0;
     while(qHead<qTail){
       const n=q[qHead++],i=n%nx,j=(n/nx)|0,[x,y]=xy(i,j);
       const here=surface(i,j);
       visited++;
       const vis=visibleFrom(x,y,here);
       const score=vis.count+vis.upper*2;
       if(!best||score>best.score)best={x,y,h:here,score,visible:vis};
       // A genuinely reachable terrace point with a visible doorway.
       if(here>=90&&vis.count>=18&&vis.upper>=2&&y<gateY){
         possibleGoal++;end=n;break;
       }
       for(const [di,dj] of [[0,-1],[-1,0],[1,0],[0,1]]){
         const ni=i+di,nj=j+dj;
         if(ni<0||ni>=nx||nj<0||nj>=ny)continue;
         const nn=idx(ni,nj);
         if(parent[nn]>=0)continue;
         const target=surface(ni,nj);
         if(!Number.isFinite(target)||Math.abs(target-here)>STEP_UP+1e-7)
           continue;
         player.x=x;player.y=y;player.hT=here;
         const [tx,ty]=xy(ni,nj);
         attempted++;
         if(blocked(tx,ty,player))continue;
         parent[nn]=n;q[qTail++]=nn;
       }
     }
     if(end<0)return {routeFound:false,reason:'no continuous physics path',
       start,gateY,portalSamples:portalSamples.length,
       checked:visited,candidates:qTail,attempted,best,
       bounds:{x0,x1:x0+nx-1,ymin,ymax},
       originalMapUnchanged:JSON.stringify(MEADOW_MAP)===original};
     const lattice=[];
     for(let n=end;;n=parent[n]){
       const i=n%nx,j=(n/nx)|0,[x,y]=xy(i,j);
       lattice.push({x,y,h:surface(i,j)});
       if(n===s)break;
     }
     lattice.reverse();
     // More exact than a grid-only path: REPLAY the genuine physics
     // move() in four quarter-cell segments for EVERY BFS edge.
     player.x=start.x;player.y=start.y;
     player.h=player.hT=start.h;
     let failed=null,samples=0,heightChanges=0;
     const moved=[{x:player.x,y:player.y,h:player.hT}];
     for(let k=1;k<lattice.length;k++){
       const from=lattice[k-1],to=lattice[k];
       const dx=to.x-from.x,dy=to.y-from.y;
       const dh=to.h-from.h;
       if(dh)heightChanges++;
       for(let a=0;a<4;a++){
         const dt=dy!==0?.25*CH/CW:.25;
         move(player,dx,dy,dt,1);
         samples++;
         if(!Number.isFinite(player.hT)||!Number.isFinite(player.x)||
            !Number.isFinite(player.y)){
           failed={k,a,problem:'invalid physical move'};break;
         }
       }
       if(failed)break;
       if(Math.hypot(player.x-to.x,player.y-to.y)>.075){
         failed={k,expected:to,actual:[player.x,player.y],
           hT:player.hT,problem:'original move blocked or slid away'};
         break;
       }
       if(k%Math.max(1,Math.floor(lattice.length/6))===0||
         k===lattice.length-1)
         moved.push({x:player.x,y:player.y,h:player.hT});
     }
     const finish=lattice.at(-1),visible=visibleFrom(
       player.x,player.y,player.hT);
     const result={
       routeFound:!failed,
       reason:failed?.problem||'original move() traversed the route',
       failure:failed,start,finish,
       frames:{gameZoom:1,view:visible,sourcePortalSamples:portalSamples.length},
       scanned:{visited,candidates:qTail,attempted},
       route:{steps:lattice.length-1,microSteps:samples,
         changesInSurfaceHeight:heightChanges,
         minHeight:Math.min(...lattice.map(p=>p.h)),
         maxHeight:Math.max(...lattice.map(p=>p.h)),
         samples:moved},
       gateY,oneNativeContext:
         window.__ASCII_NATIVE__.mode==='three'&&
         document.querySelectorAll('#three-parity-canvas').length===1,
       originalMapUnchanged:JSON.stringify(MEADOW_MAP)===original,
       geometryPass:window.__ASCII_NATIVE_COMPLETE_ARCH__.mainPortalRecessClear,
       originalPlayer:originalFrame.p
     };
     if(result.routeFound){
       VZ=1;updateCamera(0,true);cloudTick=2;render();
       result.actualCamera=[camX,camY,VZ];
       result.actualView=[VX0,VY0,VX1,VY1];
     }
     return result;
   });
   fs.writeFileSync(path.join(dir,label+'-route.json'),
     JSON.stringify(route,null,2)+'\n');
   console.log('NATIVE CASTLE PHYSICAL WALK ROUTE '+label+' '+
     JSON.stringify({...route,route:route.route&&{
       ...route.route,samples:route.route.samples.length}}));
   if(route.routeFound){
     await page.screenshot({
       path:path.join(dir,label+'-walk-route-finish-hud.png'),timeout:60000
     });
     await page.addStyleTag({
       content:'.hud,.stats{visibility:hidden!important}'
     });
     await page.evaluate(()=>{cloudTick=2;render()});
     await page.screenshot({
       path:path.join(dir,label+'-walk-route-finish-clean.png'),timeout:60000
     });
   }
   if(errors.length)throw Error('Original game page errors '+errors.join(' | '));
   if(!route.routeFound||!route.oneNativeContext||
     !route.originalMapUnchanged||!route.geometryPass||
     route.frames?.view?.count<18||route.route.steps<12||
     route.route.changesInSurfaceHeight<2)
     throw Error(label+' connected stair-to-gate route not proven '+
       JSON.stringify(route).slice(0,3200));
   await ctx.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
