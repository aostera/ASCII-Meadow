// Tree/dead-tree/bush GPU instancing for the Three.js migration experiment.
// Build reusable variation geometry once, then draw all matching plants via
// InstancedMesh. This preserves authored x,z and deterministic variation.
// Shading is deliberately subdued to remain legible after ASCII conversion.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const variations={tree:5,dead:4,bush:4};
function makePrototype(THREE,M,type,variant) {
  const groups=new Map();
  let seed=(7919+variant*131+{tree:11,dead:31,bush:61}[type])|0;
  const rnd=()=>{
    seed ^= seed<<13;seed ^= seed>>>17;seed ^= seed<<5;
    return (seed>>>0)/4294967296;
  };
  function add(g,m) {
    if(g.index){const ni=g.toNonIndexed();g.dispose();g=ni;}
    const a=groups.get(m)||[];a.push(g);groups.set(m,a);
  }
  function orientedCylinder(a,b,r0,r1,m,segments=6) {
    const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b);
    const delta=new THREE.Vector3().subVectors(q,p);
    const length=delta.length();
    if(length<.01)return;
    const g=new THREE.CylinderGeometry(r1,r0,length,segments);
    const quat=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
    const matrix=new THREE.Matrix4().compose(p.add(q).multiplyScalar(.5),quat,new THREE.Vector3(1,1,1));
    g.applyMatrix4(matrix);
    add(g,m);
  }
  function clump(x,y,z,r,mat,detail=0) {
    const g=new THREE.IcosahedronGeometry(r,detail);
    const scale=new THREE.Matrix4().makeScale(1+rnd()*.16,.65+rnd()*.35,.75+rnd()*.28);
    const moved=new THREE.Matrix4().makeTranslation(x,y,z);
    g.applyMatrix4(moved.multiply(scale));
    add(g,mat);
  }
  const bush=type==='bush',dead=type==='dead';
  const height=bush?1.2:9.5+rnd()*2.8;
  const lean=(rnd()-.5)*(bush?.2:1.5);
  const origin=[0,0,0],trunkTop=[lean,height,0];
  if(!bush) {
    orientedCylinder(origin,trunkTop,.48,.18,M.wood,7);
    for(let i=0;i<7;i++) {
      const angle=rnd()*6.283, y=height*(.34+rnd()*.59);
      const centre=[lean*y/height,y,0], end=[
        centre[0]+Math.cos(angle)*(2.3+rnd()*2.9),
        y+(rnd()-.25)*3,
        centre[2]+Math.sin(angle)*(2.3+rnd()*2.9)];
      const radius=.17+rnd()*.16;
      orientedCylinder(centre,end,radius,radius*.25,M.wood,5);
      for(let t=0;t<2;t++){
        const tip=[end[0]+(rnd()-.5)*2.8,end[1]+rnd()*2.6,end[2]+(rnd()-.5)*2.8];
        orientedCylinder(end,tip,radius*.34,.025,M.wood,4);
        if(!dead)clump(tip[0],tip[1],tip[2],1.45+rnd()*.7,t%2===0?M.leaf:M.leaf2);
      }
      if(!dead)clump(end[0],end[1],end[2],1.3+rnd()*.8,i%3===0?M.leaf2:M.leaf);
    }
    if(!dead){
      for(let i=0;i<8;i++){
        const a=rnd()*Math.PI*2;
        const r=.6+rnd()*3.1;
        clump(lean+Math.cos(a)*r,height+(rnd()-.5)*3,Math.sin(a)*r,
          1.1+rnd()*1.3,i%3===0?M.leaf2:M.leaf);
      }
    }
  }else{
    orientedCylinder(origin,[0,1.1,0],.26,.16,M.wood,5);
    for(let i=0;i<8;i++){
      const a=i*2.39996+rnd()*.4,r=1+rnd()*.7;
      clump(Math.cos(a)*r,.7+rnd()*1.05,Math.sin(a)*r,.9+rnd()*.65,i%3?M.leaf:M.leaf2);
    }
  }
  // Tiny bark shards give fine detail without an extra draw call.
  if(!bush)for(let i=0;i<10;i++){
    const y=.9+i*.56,a=rnd()*6.28;
    clump(lean*y/height+Math.cos(a)*.32,y,Math.sin(a)*.32,.12,M.shade);
  }
  const result=[];
  for(const [mat,geos] of groups){
    const merged=mergeGeometries(geos,false);
    for(const g of geos)g.dispose();
    if(!merged)throw new Error('Forest geometry batch failed');
    result.push([merged,mat]);
  }
  return result;
}

export function createInstancedForest({THREE,parent,materials,instances}) {
  const buckets=new Map();
  for(const tree of instances) {
    const count=variations[tree.type];
    if(!count)continue;
    const variant=((tree.k%count)+count)%count;
    const key=tree.type+':'+variant;
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push(tree);
  }
  let meshes=0,trees=0,triangles=0;
  const dummy=new THREE.Object3D();
  for(const [key,items] of buckets) {
    const [type,idx]=key.split(':');
    const geometry=makePrototype(THREE,materials,type,+idx);
    for(const [geo,mat] of geometry){
      const inst=new THREE.InstancedMesh(geo,mat,items.length);
      inst.name='Instanced '+key;
      inst.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      for(let i=0;i<items.length;i++){
        const v=items[i];
        const scale=v.scale??1;
        dummy.position.set(v.x,0,v.z);
        dummy.rotation.set(0,v.yaw||0,0);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        inst.setMatrixAt(i,dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate=true;
      inst.computeBoundingSphere();
      inst.castShadow=true;inst.receiveShadow=true;
      parent.add(inst);
      triangles+=(geo.index?geo.index.count:geo.getAttribute('position').count)/3*items.length;
      meshes++;
    }
    trees+=items.length;
  }
  return {meshes,trees,triangles:Math.round(triangles)};
}
