// Architectural source-geometry relief for native Three game, NOT a UI
// overlay. The original WebGL ray-baker AND native Gothic Z pass see these
// exact additional convex stone solids, keeping depth, silhouette and
// ornament consistent. Production buildModel/ruinDetail remain untouched.
//
// No universal brightness/alpha/lighting change. These are physical mouldings,
// detached ribs, narrow pilasters and broken parapet details; portals stay open.
const nativeOriginalBuildModel=buildModel;
const nativeOriginalRuinDetail=ruinDetail;
let nativeCastleRelief=0,nativeRuinRelief=0;

function nativeStoneBox(x0,x1,y0,y1,z0,z1,meta={}){
  const before=solids.length;
  addBox(x0,x1,y0,y1,z0,z1,'wall',meta);
  return solids.length-before;
}
buildModel=function(){
  nativeOriginalBuildModel();
  const first=solids.length,Y=120;
  // Gatehouse: four stepped archivolts and outer pilasters of the GREAT
  // front doorway. The opening at |x|<75 remains completely untouched.
  for(const side of [-1,1]){
    for(const [xoff,depth] of [[92,5],[108,9],[128,13]]){
      const x=side*xoff;
      nativeStoneBox(x-5,x+5,Y+28,Y+326,84-depth,100-depth,{
        courses:[Y+110,Y+210],corbels:Y+315
      });
    }
    // Thick Gothic side fins and staggered finials on the gate towers.
    for(let j=0;j<4;j++){
      const x=side*(198+j*22),yy=Y+310+j*35;
      nativeStoneBox(x-5,x+5,yy,yy+125,79,91,{
        courses:[yy+32,yy+91]
      });
      addCone(x,85,7,4,yy+125,yy+153,'spire');
    }
    // Extra silhouette depth at the eastern/western west-front pillars.
    for(const x0 of [side*210,side*265]){
      nativeStoneBox(x0-8,x0+8,Y+415,Y+825,277,302,{
        courses:[Y+490,Y+660,Y+808],corbels:Y+800
      });
      addCone(x0,288,12,4,Y+825,Y+920,'spire');
    }
  }
  // Carved alternating corbels at the main portal's high gallery.
  // These genuinely stick out of the dark 3D masonry face.
  for(let x=-142;x<=142;x+=29){
    if(Math.abs(x)<74)continue;
    nativeStoneBox(x-8,x+8,Y+353,Y+378,79,95,{
      courses:[Y+369]
    });
  }
  // Ruined, uneven skyline edges rather than a long rectangular parapet.
  for(const side of [-1,1])for(let j=0;j<6;j++){
    const x=side*(300+j*38),high=(j%3===0?48:29);
    nativeStoneBox(x-9,x+9,Y+420,Y+420+high,119,135,{
      courses:[Y+428]
    });
  }
  // Source solid bookkeeping is required by both the CPU baker's sun bins
  // and createNativeSourceWorld when a castle is rebuilt on mobile rotate.
  for(let i=first;i<solids.length;i++){
    const so=solids[i],b=so.bb;
    so.id=i;so.cx=(b[0]+b[1])*.5;
    so.cy=(b[2]+b[3])*.5;so.cz=(b[4]+b[5])*.5;
  }
  nativeCastleRelief=solids.length-first;
};
ruinDetail=function(site){
  nativeOriginalRuinDetail(site);
  const start=solids.length;
  const {width:w,depth:d,height:h,arch:a,archHeight:ah}=site;
  const front=-d/2,edge=a*.5+12;
  // Narrow real stone pilasters flank the *existing passable arch*, not a
  // fake dark paint band masking the portal. Broken relief is asymmetric.
  for(const side of [-1,1]){
    const x=side*edge;
    nativeStoneBox(x-5,x+5,8,h*.68,front-10,front+4,{
      courses:[h*.19,h*.36,h*.55]
    });
    nativeStoneBox(x-11,x+11,h*.58,h*.61,front-13,front+4,{
      courses:[h*.59]
    });
    // Buttress setbacks, distinctive projecting sides.
    const outer=side*(w*.5-16);
    nativeStoneBox(outer-6,outer+6,h*.25,h*.63,front-11,front+5,{
      courses:[h*.35,h*.51]
    });
    // Visible upper coping and jagged finial, safely above the walkable
    // doorway including tall arched openings.
    nativeStoneBox(outer-13,outer+13,h*.64,h*.68,front-10,front+9,{
      courses:[h*.655]
    });
    if(side<0||site.type==='cloister')
      addCone(outer,front+1,9,4,h*.68,h*.82,'spire');
  }
  // Short, discontinuous pointed tracery ribs over the existing arch crown.
  // Gaps leave the broken gothic skyline visibly perforated.
  for(const side of [-1,1]){
    const inner=side*(a*.48),outer=side*(a*.76);
    addBeam(Math.min(inner,outer),Math.max(inner,outer),
      front-9,front-3,h*.72,h*.88,6,'wall');
  }
  // Uneven fallen parapet stones: no screen-space rectangles or cast decals.
  for(let i=0;i<5;i++){
    const x=-w*.42+i*w*.21;
    if(Math.abs(x)<a*.42)continue;
    const yy=h*(i%2===0?.72:.65);
    nativeStoneBox(x-9,x+8,yy,yy+12+(i%3)*9,
      front-5,front+10,{courses:[yy+7]});
  }
  nativeRuinRelief+=solids.length-start;
};
window.__ASCII_NATIVE_DETAILS__={
  get castleRelief(){return nativeCastleRelief},
  get ruinRelief(){return nativeRuinRelief},
  sourceBuildModel:nativeOriginalBuildModel,
  sourceRuinDetail:nativeOriginalRuinDetail
};
