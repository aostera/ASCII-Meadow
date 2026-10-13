// Procedural gothic stonework for the isolated Three.js migration experiment.
// Geometry is real 3D (arched openings are empty volumes), generated once per scene,
// merged by material to keep draw calls relatively low. Never modifies the author map.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function buildGothicRuin({ THREE, parent, materials: M, type, seed = 1 }) {
  const batches = new Map();
  let prng = (seed >>> 0) || 1;
  function random() {
    prng ^= prng << 13; prng ^= prng >>> 17; prng ^= prng << 5;
    return (prng >>> 0) / 4294967296;
  }
  function insert(geo, mat, x=0, y=0, z=0, ry=0) {
    const transform = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0));
    transform.compose(new THREE.Vector3(x,y,z), q, new THREE.Vector3(1,1,1));
    geo.applyMatrix4(transform);
    const list = batches.get(mat) || [];
    list.push(geo);
    batches.set(mat,list);
  }
  const box = (w,h,d,x,y,z,mat=M.stone,ry=0) => {
    if (w <= 0 || h <= 0 || d <= 0) return;
    insert(new THREE.BoxGeometry(w,h,d),mat,x,y,z,ry);
  };
  function wedge(points, depth, x, z, mat=M.stone) {
    const shape = new THREE.Shape();
    for (let i=0;i<points.length;i++) {
      const [px,py] = points[i];
      if(i===0)shape.moveTo(px,py);else shape.lineTo(px,py);
    }
    shape.closePath();
    // Extru(de) in local +Z, centre on the masonry wall axis.
    const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:3,steps:1});
    geo.translate(x,0,z-depth/2);
    insert(geo,mat);
  }
  function column(x,z,h=13) {
    box(2.15,h,2.5,x,h/2,z,M.stone);
    box(2.85,.55,2.85,x,1.4,z,M.trim);
    box(2.75,.6,2.95,x,h-.7,z,M.trim);
    // Rectangular flutes and narrow moulded ribs are three-dimensional.
    for(const face of [-1,1]) {
      box(.18,h-2.6,.3,x+face*1.13,(h-2.6)/2+1.5,z,M.shade);
      box(.32,h-2.6,.16,x+face*.65,(h-2.6)/2+1.5,z-1.33,M.trim);
    }
  }
  function lancet(x,z,w,h,thick) {
    // Each arch consists of two stone vault wedges and an empty pointed centre;
    // there is NO quad across the passage and the arch is traversable by design.
    const a=w*.5, apex=h, shoulder=h*.57, crown=apex+thick;
    const ext=a+thick*.5;
    wedge([[-ext,shoulder-.15],[-a,shoulder-.15],[0,apex],[0,crown],[-ext,shoulder+thick]],2.65,x,z,M.stone);
    wedge([[ext,shoulder-.15],[a,shoulder-.15],[0,apex],[0,crown],[ext,shoulder+thick]],2.65,x,z,M.stone);
    // Voussoirs, pointed tracery and a small keystone.
    for(let s of [-1,1]) {
      for(let k=0;k<5;k++) {
        const tt=(k+.5)/5;
        const xx=x+s*a*(1-tt);
        const yy=shoulder+(apex-shoulder)*tt;
        box(.3,.55,2.85,xx,yy,z-.05,M.trim);
      }
    }
    box(.67,1.5,3.15,x,apex-.05,z,M.trim);
  }
  const isGate = type==='gate', isAbbey = type==='abbey', cloister=type==='cloister';
  const W=isGate?25:isAbbey?35:38, D=isGate?14:isAbbey?27:23;
  const bays=cloister?4:isAbbey?3:1, gap=W/bays;
  const opening=Math.max(4.5,Math.min(gap-3,cloister?6.3:8));
  const facadeZ = D*.48;
  // Ground-level facade with arches; columns carry the interrupted upper wall.
  for(let j=0;j<=bays;j++) {
    const x=-W/2+gap*j, tallest=(j===0||j===bays)?2.2:0;
    column(x,facadeZ,12.8+tallest);
    if(j===0||j===bays) {
      box(3.1,17,3.7,x,8.5,-D*.48,M.stone);
      box(4.2,1.1,4.0,x,17.5,-D*.48,M.trim);
      // Spire fragments with jagged tips; a missing stone is a real space.
      for(let s of [-1,1])wedge([[x+s*2.1,18],[x+s*.7,18],[x+s*.5,21+random()*2]],3.2,0,-D*.48,M.stone);
    }
  }
  for(let j=0;j<bays;j++) {
    const cx=-W/2+gap*(j+.5);
    lancet(cx,facadeZ,opening,15.1,1.1);
    // Upper broken course, not a rectangular overlay on the passage.
    const ymax=18.9+(j%2===0?1.6:0);
    box(gap-.45, Math.max(.6,ymax-17.9),2.8,cx,(ymax+17.9)/2,facadeZ,j%2?M.shade:M.stone);
    for(let i=0;i<4;i++){
      const w=(gap-.8)/4, off=(i-1.5)*w;
      if(random()<.22)continue; // truly missing crenellation
      box(w-.17, 1.25+random()*.7,2.7,cx+off,ymax+.6,facadeZ,M.stone);
    }
    // Cracked mortar seams in each surviving solid horizontal stone course.
    for(let level=0;level<3;level++){
      const sy=18.2+level*.48;
      box(gap-.85,.075,2.88,cx,sy,facadeZ,M.shade);
    }
  }
  // Side walls: each bay has a distinct broken roof line and physical stone thickness.
  for(const s of [-1,1]){
    const x=s*(W/2-.7);
    for(let j=0;j<12;j++){
      const z=-D/2+(j+.5)*D/12;
      const jag=random(), h=3.6+jag*8+(j===1||j===9?6:0);
      box(1.8,h,D/12+.08,x,h/2,z,j%4===0?M.shade:M.stone);
      for(let k=1;k<h/1.7;k++)box(.09,.075,D/12+.12,x-s*.94,k*1.7,z,M.shade);
      if(j%3===1)box(2.45,.6,D/12+.24,x,h-.3,z,M.trim);
    }
    // Exterior buttresses, large enough to read at glyph resolution.
    for(let j=0;j<4;j++){
      const z=-D/2+(j+.5)*D/4;
      const h=9+j%2*2.3;
      box(1.75,h,2.1,s*(W/2+1.15),h/2,z,M.stone);
      box(3.1,.4,2.7,s*(W/2+1.1),h-.4,z,M.trim);
      wedge([[s*(W/2+2.9),h],[s*(W/2+1.3),h+2.4],[s*(W/2+.4),h]],2.3,0,z,M.stone);
    }
  }
  // Back wall: real missing bays and narrow lancet windows, built around holes.
  for(let j=0;j<8;j++){
    const cx=-W/2+(j+.5)*W/8;
    const h=4+random()*10, w=W/8-.13;
    if(j%3===1){
      box(.8,h,2.1,cx-w*.42,h/2,-D/2,M.stone);
      box(.8,h,2.1,cx+w*.42,h/2,-D/2,M.stone);
      wedge([[cx-w*.42,h*.68],[cx,h*.92],[cx-w*.42,h]],2.3,0,-D/2,M.stone);
      wedge([[cx+w*.42,h*.68],[cx,h*.92],[cx+w*.42,h]],2.3,0,-D/2,M.stone);
    }else box(w,h,2.3,cx,h/2,-D/2,j%2?M.shade:M.stone);
  }
  // Broken floor, stones, rubble piles and distant columns use real depth.
  for(let i=0;i<65;i++){
    const x=(random()-.5)*(W+11),z=(random()-.5)*(D+10);
    const size=.2+random()*1.4, h=.15+random()*.65;
    box(size*1.5,h,size*1.2,x,h/2,z,i%5===0?M.trim:M.shade,random()*1.4);
  }
  if(isAbbey||cloister){
    for(let i=0;i<5;i++){
      const x=-W*.34+i*W*.17;
      box(.9,4.3,.9,x,2.15,-D*.15,M.stone);
      box(1.7,.37,1.7,x,4.2,-D*.15,M.trim);
    }
  }
  let triangleCount=0;
  const names = new Map([[M.stone,'stone'],[M.trim,'trim'],[M.shade,'shade']]);
  for(const [mat,geos] of batches){
    const merged=mergeGeometries(geos,false);
    for(const g of geos)g.dispose();
    if(!merged)throw new Error('Cannot merge Gothic ruin geometries');
    triangleCount+=merged.index?merged.index.count/3:merged.getAttribute('position').count/3;
    const obj=new THREE.Mesh(merged,mat);
    obj.name='Gothic '+type+' / '+(names.get(mat)||'masonry');
    obj.castShadow=true;obj.receiveShadow=true;
    parent.add(obj);
  }
  // Footprint data for future precise grass & colliders. Portals remain unblocked.
  const wallThickness=2.3;
  parent.userData.gothicContact={
    type, width:W, depth:D, archCount:bays,
    rectangles:[
      ...Array.from({length:bays+1},(_,j)=>({x:-W/2+j*gap,z:facadeZ,w:2.25,d:3})),
      {x:-W/2,z:0,w:2.1,d:D},{x:W/2,z:0,w:2.1,d:D},
      {x:0,z:-D/2,w:W,d:wallThickness}
    ],
    portals:Array.from({length:bays},(_,j)=>({x:-W/2+gap*(j+.5),z:facadeZ,width:opening}))
  };
  parent.userData.modelStats={meshCount:batches.size,triangles:Math.round(triangleCount)};
  return parent;
}
