// Source-derived tree geometry for the ONE native Three depth pass.
// This is not a generic solid oval in front of the character. Reuses
// the ORIGINAL 3D tree generator's individual limb and foliage clumps,
// including gaps and wind displacement; existing ASCII sprites / alpha are
// never replaced. Only actor fragments behind actual wood/leaves are masked.
import * as THREE from 'three';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function nativeTreeOverlapsActor(tree,rect,CW,CH,margin=4){
  if(!tree||tree.v?.type!=='tree'||!rect)return false;
  const x=tree.x*CW,y=tree.br*CH,R=tree.v.R;
  const minX=x-R*1.2-margin,maxX=x+R*1.2+margin;
  const minY=y-tree.v.crownH-margin,maxY=y+CH+margin;
  return rect.left+rect.w>=minX&&rect.left<=maxX&&
    rect.top+rect.h>=minY&&rect.top<=maxY;
}

export function pickNativeActorTrees(trees,actorRanges,CW,CH,maxTrees=6){
  const selected=[],seen=new Set();
  for(const actor of actorRanges||[]){
    const r=actor?.rect;
    if(!r)continue;
    const near=[];
    for(const tree of trees||[]){
      if(!nativeTreeOverlapsActor(tree,r,CW,CH))continue;
      const dx=tree.x*CW-(r.left+r.w*.5);
      const dy=tree.br*CH-(r.top+r.h*.75);
      near.push({tree,d:dx*dx+dy*dy});
    }
    near.sort((a,b)=>a.d-b.d);
    for(const item of near.slice(0,3))
      if(!seen.has(item.tree)){
        seen.add(item.tree);selected.push(item);
      }
  }
  selected.sort((a,b)=>a.d-b.d);
  return selected.slice(0,maxTrees).map(x=>x.tree);
}

export class NativeTreeDepth{
  constructor(scene,capacity=12000){
    this.scene=scene;
    this.capacity=capacity;
    this.geometry=new THREE.IcosahedronGeometry(1,1);
    this.material=new THREE.MeshBasicMaterial({color:0x808080});
    this.mesh=new THREE.InstancedMesh(this.geometry,this.material,capacity);
    this.mesh.name='original-3d-tree-branches-and-open-foliage-depth';
    this.mesh.count=0;this.mesh.frustumCulled=false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.mesh);
    this.matrix=new THREE.Matrix4();
    this.cache=new Map();
    this.generation=-1;
    this.stats={trees:0,woodInstances:0,leafInstances:0,instances:0};
  }
  reset(){
    this.mesh.count=0;
    this.stats={trees:0,woodInstances:0,leafInstances:0,instances:0};
  }
  update(source,actorRanges,CW,CH){
    this.reset();
    if(!source?.flora||!source?.t3Tree||!source?.VARS)return 0;
    if(this.generation!==source.worldGen){
      this.cache.clear();this.generation=source.worldGen;
    }
    const trees=pickNativeActorTrees(
      source.flora,actorRanges,CW,CH,6);
    if(!trees.length)return 0;
    const variants=source.VARS.filter(v=>v.type==='tree');
    const c=Math.cos(source.pitch),sin=Math.sin(source.pitch);
    let count=0,wood=0,leaves=0;
    for(const tree of trees){
      const variant=variants.indexOf(tree.v);
      if(variant<0)continue;
      let shape=this.cache.get(variant);
      if(!shape){
        shape=source.t3Tree('tree',variant+1);
        this.cache.set(variant,shape);
      }
      const originX=-tree.x*CW;
      const originY=-tree.br*CH*c;
      const originZ=-tree.br*CH*sin;
      const lean=(tree.sw||0)*5;
      for(let i=0;i<shape.S.length&&count<this.capacity;i++){
        const [x,y,z,r,kind]=shape.S[i];
        // Sparse leaf proxies: the authored material contains perforations
        // and small dither holes, unlike a fully solid ellipsoid. The wood
        // mesh always occludes; small foliage clumps partly occlude.
        if(kind===0&&((i*7+variant*13)%5)<2)continue;
        const h=clamp(y/Math.max(1,shape.H),0,1);
        const sway=lean*h*h*(3-2*h);
        const radius=r*(kind===0?.78:1);
        this.matrix.makeScale(radius,radius,radius);
        this.matrix.setPosition(originX-x-sway,originY+y,originZ+z);
        this.mesh.setMatrixAt(count++,this.matrix);
        if(kind===0)leaves++;else wood++;
      }
    }
    this.mesh.count=count;
    if(count)this.mesh.instanceMatrix.needsUpdate=true;
    this.stats={trees:trees.length,woodInstances:wood,
      leafInstances:leaves,instances:count};
    return count;
  }
  dispose(){
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
    this.cache.clear();
  }
}
