// Native-only architectural detail expansion. Physically modeled Gothic
// masonry for the main cathedral castle and all THREE ruin landmarks.
// These are genuine source convex solids, so castle/ruin CPU raytracing,
// source lighting, shadows and Three depth use the SAME ornamented geometry.
// No new billboard paintings, RGB/alpha modifications, map edits, collision
// walls in existing gate clearances or deletion of original source features.
//
// Authored models available in this repository: cathedral/gatehouse,
// broken-gate, abbey-front, cloister-walk. Historical sketch image files were
// not attached to the repo; this faithfully extends the documented building
// vocabulary rather than claiming pixel-identical unseen images.
const nativeBeforeFullCastle=buildModel;
const nativeBeforeFullRuin=ruinDetail;
const nativeFullArchitecturalCounts={castle:{},ruins:{}};
let nativeWestPortalReliefClear=true,nativeWestCurtainProjects=false;
let nativeWestTraceryEnabled=true;
let nativeOuterTowerReliefEnabled=true;
let nativeOuterTowerReliefClear=true;
let nativeOuterTowerIntrusions=[];

function nativeGothicBox(x0,x1,y0,y1,z0,z1,meta) {
  if(!(x1>x0&&y1>y0&&z1>z0))return;
  addBox(x0,x1,y0,y1,z0,z1,'wall',meta||{});
}
function nativeGothicBand(x0,x1,y,z,w=7,meta){
  nativeGothicBox(x0,x1,y,y+w,z-5,z+5,meta);
}
function nativeGothicBeam(ax,ay,bx,by,z,width=6){
  if(Math.abs(bx-ax)<.8){
    nativeGothicBox(ax-width*.45,ax+width*.45,Math.min(ay,by),
      Math.max(ay,by),z-3,z+3);
    return;
  }
  if(ax>bx){const tx=ax;ax=bx;bx=tx;const ty=ay;ay=by;by=ty}
  addBeam(ax,bx,z-4,z+4,ay,by,width,'wall');
}
function nativeGothicRing(cx,cy,r,z,segments=20,thickness=6){
  for(let i=0;i<segments;i++){
    const t=i*Math.PI*2/segments,u=(i+1)*Math.PI*2/segments;
    nativeGothicBeam(cx+Math.cos(t)*r,cy+Math.sin(t)*r,
      cx+Math.cos(u)*r,cy+Math.sin(u)*r,z,thickness);
  }
}
function nativeGothicRose(cx,cy,r,z){
  nativeGothicRing(cx,cy,r+4,z,24,8);
  nativeGothicRing(cx,cy,r*.62,z-2,20,5);
  nativeGothicRing(cx,cy,r*.16,z-4,10,6);
  for(let j=0;j<12;j++){
    const a=j*Math.PI/6;
    nativeGothicBeam(cx+Math.cos(a)*r*.16,cy+Math.sin(a)*r*.16,
      cx+Math.cos(a)*r*.9,cy+Math.sin(a)*r*.9,z-3,5);
  }
}
function nativeGothicPointedCrown(cx,half,base,peak,z,th=7){
  nativeGothicBeam(cx-half,base,cx,peak,z,th);
  nativeGothicBeam(cx,peak,cx+half,base,z,th);
  nativeGothicBox(cx-half-5,cx-half+3,base-26,base+8,z-4,z+5);
  nativeGothicBox(cx+half-3,cx+half+5,base-26,base+8,z-4,z+5);
}
function nativeGothicWindowsOnFace(cxList,base,height,width,z){
  for(const x of cxList){
    nativeGothicBox(x-width/2-9,x-width/2-3,base,base+height*.8,z-4,z+5,
      {courses:[base+height*.29,base+height*.56]});
    nativeGothicBox(x+width/2+3,x+width/2+9,base,base+height*.8,z-4,z+5,
      {courses:[base+height*.29,base+height*.56]});
    nativeGothicPointedCrown(x,width*.64,base+height*.75,
      base+height,z,5);
    nativeGothicBand(x-width*.66,x+width*.66,base+height*.08,z,4);
  }
}
function nativeGothicBrokenCoping(xStart,xEnd,y,z,salt){
  for(let x=xStart,i=0;x<xEnd;x+=24,i++){
    const n=(i*17+salt)%9;
    if(n===2||n===6)continue;
    nativeGothicBox(x,Math.min(x+13,xEnd),y,y+8+(n%4)*6,
      z-8,z+10,{courses:[y+5]});
  }
}
function nativeGothicGargoyles(positions,y){
  // Narrow brackets with downward jaws protrude from the actual ledge:
  // sculptural silhouettes, not icons or unlit screen sprites.
  for(const [x,z] of positions){
    nativeGothicBox(x-8,x+8,y-12,y+6,z-16,z+11);
    nativeGothicBox(x-5,x+5,y-23,y-11,z-27,z-12);
    nativeGothicBox(x-3,x+3,y-32,y-21,z-34,z-24);
  }
}
function nativeBuildCompleteCastle(){
  nativeBeforeFullCastle();
  const start=solids.length,Y=120,front=330;
  const feature={};
  let before=solids.length;
  // The west facade: a raised 24-piece rose-window stone ring, outer
  // tracery, 12 flying spokes and central boss; existing glass still exists.
  nativeGothicRose(0,Y+580,110,front-23);
  feature.rose=solids.length-before;before=solids.length;

  // Deep front portal: four offset lintels, pointed rib pairs and carved
  // voussoir joints. All lower blocks live OUTSIDE |x|<75 walk corridor.
  for(const side of [-1,1])for(let step=0;step<4;step++){
    const off=87+step*14,z=95-step*5;
    nativeGothicBox(side*off-6,side*off+6,Y+40,
      Y+270+step*13,z-4,z+7,{
        courses:[Y+106,Y+184,Y+247],corbels:Y+259
      });
    nativeGothicBeam(side*off,Y+278+step*11,0,
      Y+359+step*11,z-2,6);
  }
  for(let x=-152;x<=152;x+=21){
    if(Math.abs(x)<72)continue;
    nativeGothicBox(x-5,x+5,Y+381,Y+400,
      82,100,{courses:[Y+392]});
  }
  feature.portal=solids.length-before;before=solids.length;

  // Side towers and cathedral west front: actual thin window jambs,
  // gothic hood mouldings and multiple upper tracery bays.
  nativeGothicWindowsOnFace(
    [-279,-234,234,279],Y+540,220,21,front-66);
  nativeGothicWindowsOnFace(
    [-464,-385,385,464],Y+270,95,15,135);
  feature.lancets=solids.length-before;before=solids.length;

  // Every crossing buttress gets two recessed structural bands and a
  // pinnacle, with staggered lengths to avoid repetitive block stacks.
  for(const side of [-1,1])for(let j=0;j<7;j++){
    const z=425+j*59,x=side*(286+j%2*13);
    const y=Y+350+(j%3)*12;
    nativeGothicBox(x-9,x+9,y-25,y+18,z-11,z+11,{
      courses:[y-5,y+12]
    });
    addCone(x,z,11,6,y+18,y+65, 'spire',{axis:[x,z],n:6});
    nativeGothicBeam(side*175,Y+532,x,y+24,z-5,7);
  }
  feature.buttresses=solids.length-before;before=solids.length;

  // Sculptural gargoyles on real (front-facing) terrace brackets and
  // battlements, plus individual ruined crenels and finials.
  nativeGothicGargoyles(
    [[-512,112],[-380,112],[-250,112],[250,112],[380,112],[512,112]],
    Y+295);
  for(const side of [-1,1]){
    nativeGothicBrokenCoping(side<0?-522:258,
      side<0?-258:522,Y+304,149,side<0?1:5);
    for(const x of [side*390,side*458,side*525]){
      nativeGothicBox(x-7,x+7,Y+316,Y+352,137,156,{
        courses:[Y+329]
      });
      addCone(x,148,10,4,Y+352,Y+398,'spire');
    }
  }
  feature.gargoylesAndSkyline=solids.length-before;before=solids.length;

  // Inner nave: short rib-vault keystones under rooflines and small
  // grouped tracery columns; none of these occupy the main doorway.
  for(let z=424;z<=813;z+=74){
    for(const sx of [-1,1]){
      const x=sx*163;
      nativeGothicBox(x-6,x+6,Y+478,Y+612,z-8,z+7,{
        courses:[Y+504,Y+555]
      });
      nativeGothicBeam(sx*163,Y+612,0,Y+668,z,7);
    }
    nativeGothicBox(-8,8,Y+655,Y+673,z-12,z+12);
  }
  feature.naveAndVaults=solids.length-before;before=solids.length;

  // Four physically projecting west-front lancet canopies. The gate is
  // deliberately NOT a billboard: each hood has stone jambs, two ascending
  // ogival ribs, an offset keystone, relief bosses and broken sill courses.
  // These start beyond |x|=150 and y>=Y+155: the original central gateway
  // (|x|<75), its grounded collision and every passage remain unchanged.
  // Deliberately non-uniform rise and missing coping pieces prevent the
  // uniform horizontal rows seen in the baseline ASCII facade captures.
  if(nativeWestTraceryEnabled)for(const side of [-1,1])for(let bay=0;bay<2;bay++){
    // Inter-buttress bays of the outer curtain. Nearer z (towards the
    // camera) than the original front wall at z=140; never embedded in
    // existing gatehouse prisms centered x=+/-172, z=108, radius 52.
    const cx=side*(342+bay*81),z=103-bay*4;
    const base=Y+155+bay*15,shoulder=base+118+bay*9;
    const peak=shoulder+51+bay*8;
    const jamb=bay===0?19:23;
    for(const edge of [-1,1]){
      const x=cx+edge*jamb;
      nativeGothicBox(x-5,x+5,base,shoulder+6,z-5,z+7,{
        courses:[base+29,base+68,base+101]
      });
      // Splintered, high-relief stones descend the vertical edge; they do
      // not fill the window gap or paint a rectangular dark decal.
      for(let k=0;k<3;k++){
        if((k+bay+(side>0?1:0))%4===0)continue;
        const yy=base+19+k*31;
        nativeGothicBox(x+edge*4-4,x+edge*4+4,
          yy,yy+7+(k%2)*5,z-11,z-4,{
            courses:[yy+4]
          });
      }
      nativeGothicBeam(cx+edge*jamb,shoulder,
        cx,peak,z-5,5);
      // Projected ribs run just proud of the masonry, casting real source
      // shadows rather than changing the global material lightness.
      nativeGothicBeam(cx+edge*(jamb+8),shoulder-4,
        cx,peak+9,z-12,4);
    }
    nativeGothicBox(cx-6,cx+6,peak-3,peak+13,z-14,z+4,{
      courses:[peak+7]
    });
    for(let k=0;k<4;k++){
      const ox=(k-1.5)*13;
      if(k===bay+(side>0?1:0))continue;
      const yy=base-15+(k%2)*3;
      nativeGothicBox(cx+ox-6,cx+ox+5,yy,yy+8,
        z-12,z+7,{courses:[yy+3]});
    }
    // Narrow single stone corbel below each bay, never at ground level.
    nativeGothicBox(cx-12,cx+12,base-23,base-15,
      z-16,z+8,{courses:[base-20]});
  }
  feature.portalSideTracery=solids.length-before;
  // Guard the actual new 3D halfspaces, not a flat-screen impression.
  const curtainDetails=solids.slice(before);
  nativeWestPortalReliefClear=curtainDetails.every(so=>
    so.bb[1]<=-300||so.bb[0]>=300);
  nativeWestCurtainProjects=[-423,-342,342,423].every(x=>
    curtainDetails.some(so=>so.bb[0]<x+8&&so.bb[1]>x-8&&
      so.bb[4]<115));

  // The two forward corner towers are existing octagonal source masonry.
  // Add genuinely projecting, intentionally sparse tower silhouettes: two
  // narrow blind lancet hoods in each front face, a chipped crown and
  // discontinuous crockets following the sloped conical roof. A broad
  // repeating band would make the already noisy ASCII wall less legible.
  // These stones sit outside |x|>480 and far ABOVE the walkable entrance;
  // none alters the underlying tower, source palette or the main gate.
  before=solids.length;
  if(nativeOuterTowerReliefEnabled)for(const side of [-1,1]){
    const tx=side*560,tz=170,lipZ=44,roofBase=Y+760+36;
    for(const [slot,offset] of [[0,-31],[1,31]]){
      const cx=tx+offset,base=Y+365+slot*25;
      const shoulder=base+164-slot*18,peak=shoulder+49+slot*5;
      // Physical face reveals, not solid black cards. A gap remains
      // between the raised jambs, framed by the original stone wall.
      for(const edge of [-1,1]){
        const jx=cx+edge*15;
        nativeGothicBox(jx-5,jx+5,base,shoulder,lipZ-10,lipZ+11,{
          courses:[base+41,base+113]
        });
        nativeGothicBeam(jx,shoulder,cx,peak,lipZ-9,6);
      }
      nativeGothicBox(cx-8,cx+8,peak-4,peak+11,lipZ-18,lipZ+7,{
        courses:[peak+4]
      });
      if(slot===0)nativeGothicBox(cx-18,cx+18,base-19,base-11,
        lipZ-21,lipZ+7);
    }
    // Keep the cornice discontinuous, with missing stones and uneven
    // heights: distinct protrusions instead of a single bright stripe.
    for(let k=0;k<9;k++){
      if(k===2||k===6)continue;
      const x=tx-82+k*20,yy=roofBase-17+(k%3)*5;
      nativeGothicBox(x-7,x+7,yy,yy+12+(k%2)*12,
        46-(k%2)*9,70,{courses:[yy+5]});
    }
    // Four sparse pairs of stone crockets trace the REAL sloping spire.
    // At normalized height t its eight-sided cone shrinks with (1-t).
    // Project only slightly beyond that radius, so the main silhouette
    // breaks into individual Gothic finials rather than a sawtooth band.
    for(const [tier,t] of [0.17,0.32,0.48,0.65].entries()){
      const y=roofBase+620*t,rad=108*(1-t);
      for(const edge of [-1,1]){
        const x=tx+edge*(rad+13);
        nativeGothicBox(x-6,x+6,y-13,y+9,
          tz-17,tz+10,{courses:[y-4]});
        nativeGothicBeam(tx+edge*(rad-6),y-10,
          x+edge*13,y+21,tz-5,5);
        if((tier+(side>0?1:0))%3!==0)
          addCone(x+edge*7,tz-6,7,4,y+9,y+38,'spire');
      }
    }
    // Stepped, chipped shoulders on the OUTER silhouette, not on the
    // face covering the pier's arrow-slits. This breaks tower symmetry.
    for(let i=0;i<3;i++){
      if(side>0&&i===1)continue;
      const x=tx+side*(87+i*10);
      const y=Y+445+i*79+(side>0?13:0);
      nativeGothicBox(x-7,x+7,y,y+42-i*8,
        tz-17-i*7,tz+9,{courses:[y+11]});
    }
  }
  feature.outerTowerRelief=solids.length-before;
  nativeOuterTowerIntrusions=solids.slice(before)
    .filter(so=>!(so.bb[1]<-460||so.bb[0]>460))
    .map(so=>so.bb.slice());
  nativeOuterTowerReliefClear=nativeOuterTowerIntrusions.length===0;

  for(let i=start;i<solids.length;i++){
    const s=solids[i],b=s.bb;
    s.id=i;s.cx=(b[0]+b[1])*.5;
    s.cy=(b[2]+b[3])*.5;s.cz=(b[4]+b[5])*.5;
  }
  nativeFullArchitecturalCounts.castle=feature;
}

function nativeRuinGothicComplete(site){
  const {width:w,depth:d,height:h,arch:a,archHeight:ah}=site;
  const front=-d/2,back=d/2;
  const half=a/2;
  const feature={};
  let before=solids.length;
  // Physical portal depth: raised voussoirs, keystone and double reveals on
  // BOTH faces; the clear opening at +/- half the arch stays empty.
  for(const z of [front-8,back+8])for(const side of [-1,1]){
    for(let n=0;n<7;n++){
      const u=n/7,span=half+9+u*7;
      const bottom=ah*.61+(ah*.37)*u;
      const top=bottom+ah*.37/7;
      const x=side*span;
      nativeGothicBox(x-5,x+5,bottom,top,z-5,z+6,{
        courses:[bottom+3]
      });
    }
    nativeGothicBox(side*(half+13)-5,side*(half+13)+5,12,
      ah*.61,z-6,z+6,{courses:[ah*.28,ah*.47]});
    nativeGothicBand(side<0?-w*.48:half+6,
      side<0?-half-6:w*.48,ah*.71,z,7);
  }
  nativeGothicBox(-10,10,ah+4,ah+17,front-17,front-4);
  feature.archAndKeystone=solids.length-before;before=solids.length;

  // Recessed relief: uneven buttress offsets, worn stone courses, missing
  // coping blocks and several rubble shelves, all inside existing pier
  // footprints beneath the walkable opening.
  for(const side of [-1,1])for(let j=0;j<6;j++){
    const z=-d*.4+j*d*.16,x=side*(w*.5-12);
    const y=h*(.18+.04*(j%3));
    nativeGothicBox(x-6,x+6,y,y+13+j%3*5,z-7,z+8,{
      courses:[y+5]
    });
    if(j%2===0)nativeGothicBox(x-12,x+12,y+23,y+28,
      z-9,z+9);
  }
  nativeGothicBrokenCoping(-w*.45,-half-17,h*.72,front-8,11);
  nativeGothicBrokenCoping(half+17,w*.45,h*.72,front-8,17);
  feature.weathering=solids.length-before;before=solids.length;

  if(site.type==='gate'){
    // The broken gate: surviving crenellated corner turret with narrow
    // arrow-slits, jagged tower cap, deep arch rings and projecting noses.
    const x=-w*.5+18,z=front+18;
    nativeGothicWindowsOnFace([x],h*.35,h*.22,13,front-10);
    nativeGothicBrokenCoping(x-17,x+26,h*.93,front+2,13);
    for(let j=0;j<4;j++){
      const yy=h*(.31+j*.12);
      nativeGothicBox(x-22,x-14,yy,yy+18,front-15,front+1);
    }
    nativeGothicGargoyles([[x,front-2]],h*.89);
    feature.brokenGate=solids.length-before;
  }else if(site.type==='abbey'){
    // The ruined abbey facade: still-visible radial tracery and oculus
    // above its open portal, asymmetrical pinnacles, broken upper arches.
    // Keep the circle below the missing apex but ABOVE its walk-through.
    const cy=Math.max(ah+43,h*.73),r=Math.min(w*.17,h*.105);
    nativeGothicRose(0,cy,r,front-15);
    nativeGothicWindowsOnFace(
      [-w*.34,w*.34],h*.28,h*.25,17,front-13);
    for(const [x,high] of [[-w*.43,h*.74],[w*.43,h*.66]]){
      nativeGothicBox(x-7,x+7,high-30,high+8,front-7,front+6);
      addCone(x,front,12,4,high+8,high+37,'spire');
    }
    nativeGothicBrokenCoping(-w*.4,-w*.16,h*.89,front-2,7);
    feature.abbeyRoseAndTracery=solids.length-before;
  }else{
    // The three-dimensional open cloister has distinct pointed bays,
    // clustered pier ribs, vaulted cross arches, gargoyle brackets and
    // battered open roof spans. No new side exits or sealed interior.
    for(let bay=0;bay<3;bay++){
      const z=-d*.3+bay*d*.3;
      // The old arch clearance is through to ah. Decorative roof ribs must
      // begin ABOVE it; otherwise the new 3D detail seals the walkway.
      const base=ah+10;
      for(const side of [-1,1]){
        const x=side*(w*.5-18);
        nativeGothicBox(x-8,x+8,9,base,z-8,z+9,{
          courses:[ah*.24,ah*.5]
        });
        nativeGothicBox(x-12,x+12,base-6,base+7,z-10,z+12);
      }
      nativeGothicPointedCrown(0,w*.36,base,
        Math.min(h*.94,base+46),z-10,8);
      if(bay!==1)nativeGothicGargoyles(
        [[-w*.42,z],[w*.42,z]],h*.61);
    }
    nativeGothicBrokenCoping(-w*.5,-w*.38,h*.67,back,29);
    nativeGothicBrokenCoping(w*.38,w*.5,h*.67,back,31);
    feature.cloisterVaultsAndBays=solids.length-before;
  }
  nativeFullArchitecturalCounts.ruins[site.id]=feature;
}

buildModel=nativeBuildCompleteCastle;
ruinDetail=function(site){
  nativeBeforeFullRuin(site);
  nativeRuinGothicComplete(site);
};
window.__ASCII_NATIVE_COMPLETE_ARCH__={
  get features(){return JSON.parse(JSON.stringify(nativeFullArchitecturalCounts))},
  get westPortalReliefClear(){return nativeWestPortalReliefClear},
  get westCurtainProjects(){return nativeWestCurtainProjects},
  get facadeEnabled(){return nativeWestTraceryEnabled},
  get outerTowerReliefEnabled(){return nativeOuterTowerReliefEnabled},
  get outerTowerReliefClear(){return nativeOuterTowerReliefClear},
  get outerTowerIntrusions(){return nativeOuterTowerIntrusions.map(a=>a.slice())},
  setOuterTowerReliefEnabledForTest(on){
    if(!new URLSearchParams(location.search).has('nativeCastleFacadeTest'))
      return false;
    nativeOuterTowerReliefEnabled=Boolean(on);
    return true;
  },
  setFacadeEnabledForTest(on){
    if(!new URLSearchParams(location.search).has('nativeCastleFacadeTest'))
      return false;
    nativeWestTraceryEnabled=Boolean(on);
    return true;
  },
  get castleTotal(){return Object.values(nativeFullArchitecturalCounts.castle)
    .reduce((a,b)=>a+b,0)},
  get ruinTotals(){return Object.fromEntries(Object.entries(nativeFullArchitecturalCounts.ruins)
    .map(([key,x])=>[key,Object.values(x).reduce((a,b)=>a+b,0)]))},
  sourceCastle:nativeBeforeFullCastle,
  sourceRuin:nativeBeforeFullRuin
};
