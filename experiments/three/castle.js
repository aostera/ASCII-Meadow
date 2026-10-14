// Experimental stone castle / courtyard. Geometry-first art direction,
// bundled by material to make a dense silhouette without per-brick draw calls.
// It is NOT the game's authored raycast castle or an asset-parity replacement.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function buildPrototypeCastle({THREE,parent,materials:M}) {
  const batches=new Map(), contacts=[];
  let counter=1;
  function insert(geometry,mat,x=0,y=0,z=0,rotY=0,rotZ=0) {
    const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,rotY,rotZ));
    geometry.applyMatrix4(new THREE.Matrix4().compose(
      new THREE.Vector3(x,y,z),q,new THREE.Vector3(1,1,1)));
    if(geometry.index){
      const expanded=geometry.toNonIndexed();geometry.dispose();geometry=expanded;
    }
    const pack=batches.get(mat)||[];
    pack.push(geometry);batches.set(mat,pack);
  }
  function box(w,h,d,x,y,z,mat=M.stone,rotY=0,rotZ=0) {
    if(w<=0||h<=0||d<=0)return;
    insert(new THREE.BoxGeometry(w,h,d),mat,x,y,z,rotY,rotZ);
  }
  function cylinder(r,h,x,y,z,mat=M.stone,sides=10) {
    insert(new THREE.CylinderGeometry(r,r*1.12,h,sides),mat,x,y,z);
  }
  function cone(r,h,x,y,z,mat=M.trim,sides=8) {
    insert(new THREE.ConeGeometry(r,h,sides),mat,x,y,z);
  }
  function lancet(x,z,span,spring=10,height=16,d=3) {
    // Two stone ribs forming a genuinely open pointed gate.
    // Nothing is placed across the center of the passage.
    const half=span/2;
    const shape=points=>{
      const path=new THREE.Shape();
      points.forEach(([xx,yy],i)=>i?path.lineTo(xx,yy):path.moveTo(xx,yy));
      path.closePath();
      const g=new THREE.ExtrudeGeometry(path,{depth:d,bevelEnabled:false,steps:1});
      g.translate(0,0,z-d/2);
      insert(g,M.stone);
    };
    shape([[x-half-.9,spring-.25],[x-half,spring-.25],[x,height],
      [x,height+1.25],[x-half-1.2,spring+2]]);
    shape([[x+half+.9,spring-.25],[x+half,spring-.25],[x,height],
      [x,height+1.25],[x+half+1.2,spring+2]]);
    box(.95,1.7,d+.3,x,height-.05,z,M.trim);
    for(let s of [-1,1])for(let j=0;j<5;j++){
      const t=(j+.5)/5;
      box(.35,.46,d+.15,x+s*half*(1-t),spring+(height-spring)*t,z,M.trim);
    }
  }
  const W=75,D=67,front=D/2,back=-D/2,half=W/2;
  const gate=13;
  // Curtain walls: left and right are real separate stone volumes; the
  // central gateway is completely empty below the vaulted arch.
  for(let side of [-1,1]){
    const stretch=(W-gate)/2;
    const x=side*(gate/2+stretch/2);
    box(stretch,15,3.7,x,7.5,front,M.stone);
    contacts.push({x,z:front,w:stretch,d:3.7});
  }
  lancet(0,front,gate,12,18,4.2);
  for(let side of [-1,1]){
    const x=side*half;
    box(4,17,D,x,8.5,0,M.stone);
    contacts.push({x,z:0,w:4,d:D});
  }
  box(W,14,4,0,7,back,M.stone);
  contacts.push({x:0,z:back,w:W,d:4});
  for(let x=-W/2+2;x<W/2-1;x+=2.65){
    if(Math.abs(x)<gate/2+1.5)continue;
    if(counter++%6===0)continue;
    box(1.9,2,3.8,x,16,front,M.trim);
  }
  // Towers are genuinely tall cylinders, with stacked ring bands, overhangs,
  // slit-window trims and multiple roof tiers.
  function tower(x,z,frontTower) {
    const r=frontTower?6.5:7.5,h=frontTower?30:35;
    cylinder(r,h,x,h/2,z,M.stone,12);
    cylinder(r+1,.8,x,h*.35,z,M.trim,12);
    cylinder(r+1.15,1,x,h-.45,z,M.trim,12);
    for(let i=0;i<12;i++){
      const a=i*2*Math.PI/12;
      const px=x+Math.sin(a)*(r+.3),pz=z+Math.cos(a)*(r+.3);
      box(1.7,2.1,1.35,px,h+1,pz,i%3===0?M.trim:M.stone,a);
    }
    cylinder(r*.9,3.2,x,h+4.2,z,M.shade,12);
    cone(r*1.12,11,x,h+11,z,M.trim,12);
    cone(1.15,5,x,h+19.5,z,M.iron,7);
    for(let level=0;level<2;level++)for(let j=0;j<8;j++){
      const a=(j+.5)*Math.PI/4;
      const px=x+Math.sin(a)*(r+.03),pz=z+Math.cos(a)*(r+.03);
      // Black alcove backed by stone: decorative, not a false collision portal.
      box(.85,3.1,.13,px,11+level*9,pz,M.shade,a);
      box(.18,3.25,.27,px,11+level*9,pz,M.trim,a);
      box(1.1,.24,.23,px,12.8+level*9,pz,M.trim,a);
    }
    contacts.push({x,z,w:r*1.86,d:r*1.86});
  }
  for(const x of [-half,half])for(const z of [front,back])
    tower(x,z,z===front);
  // Flying buttresses and wall repairs; empty passages are kept between
  // structural ribs and arches.
  for(let s of [-1,1]){
    const x=s*half;
    for(let z=-D/2+12;z<D/2-7;z+=11.5){
      box(3.5,11,3.1,x+s*2.45,5.5,z,M.stone);
      box(4.3,.75,3.65,x+s*2.45,11,z,M.trim);
      cone(1.35,3.6,x+s*2.45,13.4,z,M.trim,4);
    }
  }
  // Inner keep at the far end of a traversable courtyard.
  const keepZ=-12,keepW=29,keepD=26;
  for(const s of [-1,1]){
    const x=s*keepW/2;
    box(3,27,keepD,x,13.5,keepZ,M.stone);
    box(3.5,1.0,keepD,x,26.6,keepZ,M.trim);
  }
  box(keepW,26,3.4,0,13,keepZ-keepD/2,M.stone);
  // The keep's portal is a real opening.
  const doorHalf=5;
  for(const s of [-1,1]){
    const ww=keepW/2-doorHalf;
    const xx=s*(doorHalf+ww/2);
    box(ww,25,3.4,xx,12.5,keepZ+keepD/2,M.stone);
    box(2.3,27,3.6,s*doorHalf,13.5,keepZ+keepD/2,M.trim);
    contacts.push({x:xx,z:keepZ+keepD/2,w:ww,d:3.4});
  }
  lancet(0,keepZ+keepD/2,doorHalf*2,16.5,24.7,3.8);
  box(keepW,3.8,keepD,0,29,keepZ,M.stone);
  const roofH=10;
  // Two pitched roof slabs and central ridge, leaving richly varied volume.
  for(const side of [-1,1]){
    const roof=box(keepW/2+1.4,.9,keepD+1.4,side*keepW/4,33.5,keepZ,M.trim);
    // Geometry is rotated about each slab centre.
  }
  box(keepW+3,1.35,keepD+2,0,37,keepZ,M.shade);
  for(const x of [-keepW/2,keepW/2]){
    cylinder(3.8,13,x,34.5,keepZ,M.stone,8);
    cone(4.6,10,x,46,keepZ,M.trim,8);
    contacts.push({x,z:keepZ,w:7.6,d:7.6});
  }
  for(let y=7;y<25;y+=6)for(const side of [-1,1])
    for(const z of [keepZ-keepD/2,keepZ+keepD/2]){
      box(.65,2.8,.2,side*(keepW/2+.13),y,z,M.shade);
      box(1.05,.32,.35,side*(keepW/2+.13),y+1.75,z,M.trim);
    }
  contacts.push({x:0,z:keepZ-keepD/2,w:keepW,d:3.4});
  // Chapel and memorials form a small gothic interior within the courtyard.
  for(const side of [-1,1]){
    const x=side*17,z=14;
    cylinder(1.5,6,x,3,z,M.stone,8);
    cone(1.85,3.2,x,7.4,z,M.trim,7);
    box(.8,3.1,.7,x,9.1,z,M.iron);
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2;
      box(.65,1.6,1.0,x+Math.cos(a)*2.6,.8,z+Math.sin(a)*2.6,M.shade,a);
    }
    contacts.push({x,z,w:3.4,d:3.4});
  }
  // Rubble is real geometry but deliberately deterministic.
  for(let i=0;i<70;i++){
    let x=(Math.sin(i*14.7)*.5)*W,z=(Math.sin(i*6.8)*.5)*D;
    // Keep the gate centre and main walking lane unobstructed.
    if(Math.abs(x)<7&&z>3)continue;
    const r=.45+(i%9)*.15;
    box(r*1.3,.2+(i%4)*.18,r,x,r*.3,z,
      i%5===0?M.trim:M.shade,(i%7)*.19);
  }
  // Parent can change position when map.castle points somewhere else.
  parent.userData.gothicContact={type:'castle',rectangles:contacts,gate:{x:0,z:front,width:gate}};
  let triangles=0,meshes=0;
  for(const [mat,geos]of batches){
    const merged=mergeGeometries(geos,false);
    for(const g of geos)g.dispose();
    if(!merged)throw new Error('Castle batching failed');
    const mesh=new THREE.Mesh(merged,mat);
    mesh.name='Gothic castle / batched architecture';
    mesh.castShadow=true;mesh.receiveShadow=true;
    parent.add(mesh);
    meshes++;
    triangles+=(merged.index?merged.index.count:merged.getAttribute('position').count)/3;
  }
  parent.userData.modelStats={meshCount:meshes,triangles:Math.round(triangles)};
  return parent;
}
