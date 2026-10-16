// Native Three.js world grounding: feather GRASS at the actual castle and
// rotated Gothic ruin stone feet, not at their broad bounding rectangles.
// The source painter and physical wall masks remain completely authoritative.
//
// The base source paintStoneGrassContact already suppresses blades directly
// next to masonry. This native-only refinement adds a narrow irregular skirt
// OUTSIDE those physical footprints, using its existing campGround scalar.
// It never rewrites kind, height, bmask, player collision, shadows or map data.
const nativeSourcePaintStoneGrassContact=paintStoneGrassContact;
const nativeGroundClamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let nativeGroundEnabled=true;
let nativeGroundBakes=0;
let nativeGroundStats={castle:0,ruins:0,ruinSites:0,enhanced:0,
  maxGain:0,algorithm:'source-footprints-not-building-AABBs'};

// Grass contribution from one nearby source stone edge. Stable variation
// prevents the skirt from terminating on a straight axis-aligned grass cell.
function nativeGroundApply(i,d,r,scale,stats,key){
  if(kind[i]!==1||bmask[i]||!(d>0&&d<r))return;
  const uneven=.84+.27*seed[i];
  const gain=scale*Math.pow(1-d/r,1.24)*uneven;
  if(gain<=campGround[i]+.00001)return;
  const old=campGround[i];
  campGround[i]=Math.min(.78,gain);
  if(campGround[i]>old+.00001){
    stats[key]++;stats.enhanced++;
    stats.maxGain=Math.max(stats.maxGain,campGround[i]-old);
  }
}

function nativeGroundCastle(stats){
  const C=cathedral;
  if(!C?.cv)return;
  const y0=Math.max(5,Math.floor((C.ky-1100*SINP*MS)/CH)-5);
  const y1=Math.min(ROWS-6,Math.ceil((C.ky+145*SINP*MS)/CH)+5);
  const x0=Math.max(5,C.cx0-5);
  const x1=Math.min(COLS-6,C.cx0+C.BW+5);
  const edgeOffsets=[];
  const radius=4.3;
  for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
    const d=Math.hypot(dx*CW,dy*CH)/Math.max(CW,CH);
    if(d>0&&d<radius)edgeOffsets.push([dx,dy,d]);
  }
  // Interior stone never paints grass. Walk just the physical edge cells,
  // not 5x5 over every empty tile in the entire architecture AABB.
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const p=y*COLS+x;
    if(!bmask[p])continue;
    if(bmask[p-1]&&bmask[p+1]&&
       bmask[p-COLS]&&bmask[p+COLS])continue;
    for(const [dx,dy,d] of edgeOffsets){
      const i=(y+dy)*COLS+x+dx;
      nativeGroundApply(i,d,radius,.53,stats,'castle');
    }
  }
}

function nativeGroundRuins(stats){
  const radius=58;
  for(const r of ruins){
    if(!r.walls?.length)continue;
    // Ground positions are projected from *rotated* authored ruin geometry.
    // The AABB only bounds work; never use it to darken or flatten the field.
    const boundary=[],margin=radius+8;
    for(const x of [-r.width/2-margin,r.width/2+margin])
      for(const z of [-r.depth/2-margin,r.depth/2+margin])
        boundary.push(mapToCell(...ruinWorldXZ(r,x,z)));
    const xa=nativeGroundClamp(Math.floor(Math.min(...boundary.map(p=>p[0]))),2,COLS-3);
    const xb=nativeGroundClamp(Math.ceil(Math.max(...boundary.map(p=>p[0]))),2,COLS-3);
    const ya=nativeGroundClamp(Math.floor(Math.min(...boundary.map(p=>p[1]))),2,ROWS-3);
    const yb=nativeGroundClamp(Math.ceil(Math.max(...boundary.map(p=>p[1]))),2,ROWS-3);
    if(xb<xa||yb<ya)continue;
    let siteChanges=0;
    for(let y=ya;y<=yb;y++)for(let x=xa;x<=xb;x++){
      const i=y*COLS+x;
      if(kind[i]!==1||bmask[i])continue;
      const [wx,wz]=toModelXZ(x,y);
      const [lx,lz]=ruinLocalXZ(r,wx,wz);
      let min=radius;
      for(const w of r.walls){
        const dx=Math.max(w[0]-lx,0,lx-w[1]);
        const dz=Math.max(w[2]-lz,0,lz-w[3]);
        if(dx===0&&dz===0){min=0;break;}
        const d=Math.hypot(dx,dz);
        if(d<min)min=d;
      }
      const before=stats.ruins;
      nativeGroundApply(i,min,radius,.55,stats,'ruins');
      if(stats.ruins>before)siteChanges++;
    }
    if(siteChanges>0)stats.ruinSites++;
  }
}

function nativeGroundRefine(){
  const stats={castle:0,ruins:0,ruinSites:0,enhanced:0,maxGain:0,
    algorithm:'source-footprints-not-building-AABBs'};
  if(!campGround||!bmask||!seed||!cathedral?.cv||!ruins)
    return stats;
  nativeGroundCastle(stats);
  nativeGroundRuins(stats);
  return stats;
}

// Called at the identical point where original placeFlora() applies the
// existing contact layer. RebuildFlora/editor restore a fresh campGround
// array on every edit, so this operation is not cumulative.
paintStoneGrassContact=function(){
  const result=nativeSourcePaintStoneGrassContact();
  nativeGroundBakes++;
  nativeGroundStats=nativeGroundEnabled?nativeGroundRefine():
    {castle:0,ruins:0,ruinSites:0,enhanced:0,maxGain:0,
      algorithm:'source-only-fixture'};
  return result;
};

window.__ASCII_NATIVE_GROUND__={
  get bakes(){return nativeGroundBakes;},
  get stats(){return {...nativeGroundStats};},
  get enabled(){return nativeGroundEnabled;},
  // Only in the dedicated browser regression fixture; no runtime UI flag.
  setEnabledForTest(on){
    if(!new URLSearchParams(location.search).has('nativeGroundTest'))
      return false;
    nativeGroundEnabled=Boolean(on);
    return true;
  }
};
