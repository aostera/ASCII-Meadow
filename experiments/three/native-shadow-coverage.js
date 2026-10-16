// Native-only geometric fixes to castle and ruin ground shadows.
// 1. The source casts castle shadows only inside a fixed window, so tower
//    and spire shadows were cut off along a straight row and column.
// 2. It bakes ONE sun ray per map cell, so every shadow boundary lands on
//    the cell grid as a hard 0 / .38 step: edges read as stacked rectangles. Here each boundary cell is re-sampled with a 3x3 grid
// of rays against the SAME solids, LGT and BINS.sun the source uses, and its
// shade becomes the true covered fraction. Interior shadow, fully lit ground,
// arch openings, ruin yaw and the map stay exactly as the source computed.
// Runs inside buildWorld (castle, then ruins), before native-shadow-soften.js
// and before flora, so the editor's bshadeCastle snapshot, rebuild, undo and
// redo all receive the same result.
const NATIVE_SHADOW_SUB=3;
const nativeSourcePaintRuinShadows=paintRuinGroundShadows;
const nativeShadowStats={castleEdgeCells:0,castleGrownCells:0,ruinEdgeCells:0,partialCells:0,bakes:0,
  castleWindow:null,sourceWindow:null};

// A cell needs sub-samples only where its single source ray disagrees with
// a neighbour; everywhere else the 3x3 result would equal the centre ray.
function nativeShadowEdge(hit,w,h,x,y){
  const v=hit[y*w+x];
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const xx=x+dx,yy=y+dy;
    if(xx<0||yy<0||xx>=w||yy>=h)continue;
    if(hit[yy*w+xx]!==v)return true;
  }
  return false;
}

function nativeCastleShadowCoverage(){
  const C=cathedral;
  if(!C||!C.cv||!bshade||!bshade.length||!BINS.sun)return 0;
  // Same frame and window as castle.js build(): kx/ky is where the castle
  // stands (after its map offset), cx0..sx1 x fy0..fy1 the source window.
  const ox=C.kx,oy=C.ky,SH=.38;
  const sy0=Math.max(0,Math.floor((oy-1060*SINP*MS)/CH));
  const sy1=Math.min(ROWS-1,Math.ceil((oy+120*SINP*MS)/CH));
  const sx0=C.cx0,sx1=Math.min(COLS-1,Math.ceil((ox+1400*MS)/CW));
  // The source window stops 1060 units behind the gate and 1400 east, but
  // the sun throws tower and spire shadows north-east well past both: the
  // shadow was cut along a straight row and column. Grow the window to the
  // ground projection of every solid along -LGT.
  const dx=-LGT[0]/LGT[1],dz=-LGT[2]/LGT[1];
  let gx0=Infinity,gx1=-Infinity,gz0=Infinity,gz1=-Infinity;
  for(const so of solids){
    const b=so.bb,h=Math.max(0,b[3]);
    gx0=Math.min(gx0,b[0],b[0]+dx*h);gx1=Math.max(gx1,b[1],b[1]+dx*h);
    gz0=Math.min(gz0,b[4],b[4]+dz*h);gz1=Math.max(gz1,b[5],b[5]+dz*h);
  }
  const x0=Math.max(0,Math.min(sx0,Math.floor((ox+gx0*MS)/CW)-1));
  const x1=Math.min(COLS-1,Math.max(sx1,Math.ceil((ox+gx1*MS)/CW)+1));
  const fy0=Math.max(0,Math.min(sy0,Math.floor((oy-gz1*SINP*MS)/CH)-1));
  const fy1=Math.min(ROWS-1,Math.max(sy1,Math.ceil((oy-gz0*SINP*MS)/CH)+1));
  const w=x1-x0+1,h=fy1-fy0+1;
  if(w<=0||h<=0)return 0;
  const castCell=(px,py)=>{
    const gx=(px*CW-ox)/MS,gz=-(py*CH-oy)/(SINP*MS);
    return cast(gx,.5,gz,LGT[0],LGT[1],LGT[2],.01,BINS.sun(gx,.5,gz));
  };
  // Inside the source window, read its own centre ray back; outside it,
  // cast the same centre ray the source would have cast.
  const hit=new Uint8Array(w*h);
  let grown=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const cx=x0+x,cy=fy0+y,i=cy*COLS+cx;
    if(cx>=sx0&&cx<=sx1&&cy>=sy0&&cy<=sy1)hit[y*w+x]=bshade[i]>=SH-1e-6?1:0;
    else if(!bmask[i]&&castCell(cx+.5,cy+.5)){hit[y*w+x]=1;bshade[i]=SH;grown++}
  }
  nativeShadowStats.castleGrownCells=grown;
  let edges=0;
  const S=NATIVE_SHADOW_SUB,total=S*S;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const cx=x0+x,cy=fy0+y,i=cy*COLS+cx;
    if(bmask[i]||!nativeShadowEdge(hit,w,h,x,y))continue;
    let covered=0;
    for(let sy=0;sy<S;sy++)for(let sx=0;sx<S;sx++)
      if(castCell(cx+(sx+.5)/S,cy+(sy+.5)/S))covered++;
    bshade[i]=SH*covered/total;
    edges++;
    if(covered>0&&covered<total)nativeShadowStats.partialCells++;
  }
  nativeShadowStats.castleWindow=[x0,fy0,x1,fy1];
  nativeShadowStats.sourceWindow=[sx0,sy0,sx1,sy1];
  return edges;
}

// Same projection, contact patch and additive blend as the source
// paintRuinGroundShadows(); only the cast term becomes a covered fraction.
function nativeRuinShadowCoverage(){
  if(!bshade||!bshade.length)return 0;
  let edges=0;
  const S=NATIVE_SHADOW_SUB,total=S*S,SH=.34;
  for(const r of ruins){
    const mesh=r.shadowMesh;
    if(!mesh||!mesh.length)continue;
    const dx=-LGT[0]/LGT[1],dz=-LGT[2]/LGT[1];
    let xMin=Infinity,xMax=-Infinity,zMin=Infinity,zMax=-Infinity;
    for(const so of mesh){
      const b=so.bb,h=Math.max(0,b[3]);
      xMin=Math.min(xMin,b[0],b[0]+dx*h);
      xMax=Math.max(xMax,b[1],b[1]+dx*h);
      zMin=Math.min(zMin,b[4],b[4]+dz*h);
      zMax=Math.max(zMax,b[5],b[5]+dz*h);
    }
    const [mx0,my0]=mapToCell(r.x+xMin-16,r.z+zMax+16);
    const [mx1,my1]=mapToCell(r.x+xMax+16,r.z+zMin-16);
    const x0=Math.max(1,Math.floor(Math.min(mx0,mx1)));
    const x1=Math.min(COLS-2,Math.ceil(Math.max(mx0,mx1)));
    const y0=Math.max(1,Math.floor(Math.min(my0,my1)));
    const y1=Math.min(ROWS-2,Math.ceil(Math.max(my0,my1)));
    if(x0>x1||y0>y1)continue;
    const w=x1-x0+1,h=y1-y0+1;
    const castAt=(x,y)=>{
      const [wx,wz]=toModelXZ(x,y);
      return cast(wx-r.x,.5,wz-r.z,LGT[0],LGT[1],LGT[2],.01,mesh)?1:0;
    };
    const hit=new Uint8Array(w*h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)hit[y*w+x]=castAt(x0+x,y0+y);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const cx=x0+x,cy=y0+y;
      let cover=hit[y*w+x];
      if(nativeShadowEdge(hit,w,h,x,y)){
        let n=0;
        // Sub-samples straddle the source's sample point (x, y+.7 in
        // toModelXZ), so fully-lit and fully-shaded cells are unchanged.
        for(let sy=0;sy<S;sy++)for(let sx=0;sx<S;sx++)
          n+=castAt(cx+(sx+.5)/S-.5,cy+(sy+.5)/S-.5);
        cover=n/total;
        edges++;
        if(n>0&&n<total)nativeShadowStats.partialCells++;
      }
      let shade=SH*cover;
      const [wx,wz]=toModelXZ(cx,cy);
      const [lx,lz]=ruinLocalXZ(r,wx,wz);
      for(const wall of r.walls){
        const ax=Math.max(0,wall[0]-lx,lx-wall[1]);
        const az=Math.max(0,wall[2]-lz,lz-wall[3]);
        const dist=Math.hypot(ax,az);
        if(dist<9)shade=Math.max(shade,.29*(1-dist/9));
      }
      if(shade>0){
        const i=cy*COLS+cx;
        bshade[i]=Math.min(.7,bshade[i]+shade);
      }
    }
  }
  return edges;
}

// buildRuins() calls this right after buildCathedral() has written the
// castle's binary shade, so the castle is refined first, then ruins add.
paintRuinGroundShadows=function(){
  nativeShadowStats.partialCells=0;
  try{
    nativeShadowStats.castleEdgeCells=nativeCastleShadowCoverage();
    nativeShadowStats.ruinEdgeCells=nativeRuinShadowCoverage();
    nativeShadowStats.bakes++;
  }catch(error){
    // Never leave the world without its source shadows.
    console.warn('Native shadow coverage failed; source shadows kept:',error);
    nativeShadowStats.ruinEdgeCells=0;
    nativeSourcePaintRuinShadows();
  }
};

window.__ASCII_NATIVE_SHADOW_COVERAGE__={
  get stats(){return {...nativeShadowStats,sub:NATIVE_SHADOW_SUB}},
  castle:nativeCastleShadowCoverage,
  sourcePaintRuins:nativeSourcePaintRuinShadows
};
