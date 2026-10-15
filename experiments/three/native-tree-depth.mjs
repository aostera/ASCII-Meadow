// Source-derived tree geometry for the ONE native Three depth pass.
// This is not a generic solid oval in front of the character. Reuses
// the ORIGINAL 3D tree generator's individual limb and foliage clumps,
// including gaps and wind displacement; existing ASCII sprites / alpha are
// never replaced. Only actor fragments behind actual wood/leaves are masked.
import * as THREE from 'three';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const UP=new THREE.Vector3(0,1,0);

// Mirrors the source dead-tree branch growth from flora.js::bakeVariant.
// Returns thin wood segments, not solid silhouette cards or leafy crowns.
export function nativeSourceDeadwood(seed,K,fw,fh,hash){
  if(!(K>0&&fw>0&&fh>0)||typeof hash!=='function')return [];
  const rnd=k=>hash(seed*31+k,977),strokes=[];
  const grow=(x,y,a,len,w,depth,spread,branchId)=>{
    let px=x,py=y,ang=a;
    const steps=Math.max(2,Math.ceil(len/(fh*.7)));
    // Shallow variation in scene depth; screen-space branch centres remain exact.
    const z=(hash(seed*911+branchId*13,743)-.5)*Math.min(K*.16,fw*3);
    for(let i=0;i<steps;i++){
      ang+=(rnd(depth*97+i*13+x)-.5)*.35;
      const nx=px+Math.sin(ang)*len/steps;
      const ny=py-Math.cos(ang)*len/steps;
      strokes.push([px,py,nx,ny,w*(1-i/steps*.35),z]);
      px=nx;py=ny;
    }
    if(depth<=0)return;
    const nb=2+(rnd(depth*7+len)>.55?1:0);
    for(let k=0;k<nb;k++){
      const angle=(k-(nb-1)/2)*spread+(rnd(depth*31+k+len)-.5)*.5;
      grow(px,py,ang+angle,len*(.62+rnd(depth*11+k)*.2),
        Math.max(fw*.7,w*.6),depth-1,spread*.95,branchId*3+k+1);
    }
  };
  grow(0,0,(rnd(4)-.5)*.25,K*(.6+rnd(2)*.25),K*.08,5,.7,1);
  return strokes;
}

export function nativeTreeOverlapsActor(tree,rect,CW,CH,margin=4){
  if(!tree||!['tree','dead'].includes(tree.v?.type)||!rect)return false;
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
    this.mesh.name='original-tree-and-deadwood-open-branches-depth';
    this.mesh.count=0;this.mesh.frustumCulled=false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.mesh);
    this.matrix=new THREE.Matrix4();
    // Recycle transform scratch storage: deadwood can have thousands of
    // segments, so allocating Vector3/Quaternion per frame causes mobile GC.
    this.deadA=new THREE.Vector3();
    this.deadB=new THREE.Vector3();
    this.deadDirection=new THREE.Vector3();
    this.deadCentre=new THREE.Vector3();
    this.deadScale=new THREE.Vector3();
    this.deadRotation=new THREE.Quaternion();
    this.cache=new Map();
    this.generation=-1;
    this.stats={trees:0,deadTrees:0,deadSegments:0,woodInstances:0,leafInstances:0,instances:0};
  }
  reset(){
    this.mesh.count=0;
    this.stats={trees:0,deadTrees:0,deadSegments:0,woodInstances:0,leafInstances:0,instances:0};
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
    const variants={
      tree:source.VARS.filter(v=>v.type==='tree'),
      dead:source.VARS.filter(v=>v.type==='dead')
    };
    const c=Math.cos(source.pitch),sin=Math.sin(source.pitch);
    const fd=source.charDims?.(source.player);
    const K=source.knightPx?.(),hash=source.hash;
    let count=0,wood=0,leaves=0,living=0,deadTrees=0,deadSegments=0;
    for(const tree of trees){
      const type=tree.v.type;
      const variant=variants[type].indexOf(tree.v);
      if(variant<0)continue;
      const key=type+':'+variant;
      if(type==='dead'){
        if(!(c>.1)||!fd||!K||!hash)continue;
        let strokes=this.cache.get(key);
        if(!strokes){
          strokes=nativeSourceDeadwood(variant+21,K,fd.fcw,fd.fch,hash);
          this.cache.set(key,strokes);
        }
        const originX=-Math.round(tree.x)*CW;
        const originY=-tree.br*CH*c,originZ=-tree.br*CH*sin;
        const lean=(tree.sw||0)*6, height=Math.max(1,tree.v.crownH);
        const toWorld=(out,x,y,z)=>{
          const hf=clamp(-y/height,0,1);
          const sx=x+lean*hf*Math.sqrt(hf);
          return out.set(originX-sx,originY+(-y-z*sin)/c,originZ+z);
        };
        let drawn=0;
        for(const [ax,ay,bx,by,w,z] of strokes){
          if(count>=this.capacity)break;
          const a=toWorld(this.deadA,ax,ay,z);
          const b=toWorld(this.deadB,bx,by,z);
          const direction=this.deadDirection.subVectors(b,a);
          const length=direction.length();
          if(length<.00001)continue;
          const radius=Math.max(fd.fcw*.48,w*.5);
          this.deadRotation.setFromUnitVectors(
            UP,direction.multiplyScalar(1/length));
          this.deadCentre.addVectors(a,b).multiplyScalar(.5);
          this.deadScale.set(radius,length*.5+radius,radius);
          this.matrix.compose(this.deadCentre,this.deadRotation,this.deadScale);
          this.mesh.setMatrixAt(count++,this.matrix);
          drawn++;
        }
        if(drawn){deadTrees++;deadSegments+=drawn;}
        continue;
      }
      let shape=this.cache.get(key);
      if(!shape){
        shape=source.t3Tree('tree',variant+1);
        this.cache.set(key,shape);
      }
      living++;
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
    this.stats={trees:living,deadTrees,deadSegments,
      woodInstances:wood,leafInstances:leaves,instances:count};
    return count;
  }
  dispose(){
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
    this.cache.clear();
  }
}
