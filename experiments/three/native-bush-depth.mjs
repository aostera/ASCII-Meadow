// Native Three.js depth for the original articulated meadow bushes.
// The rendered bush is STILL the original authored ASCII atlas. Only the
// glyph actor depth mask receives source t3Tree('bush') 3D clumps and wood.
// Contact springs are read from native-bushes.js, so the Z geometry opens
// together with its leaves instead of leaving a rigid invisible rectangle.
import * as THREE from 'three';

const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));

export function nativeBushOverlapsActor(bush,rect,CW,CH,margin=5){
  if(bush?.v?.type!=='bush'||!rect)return false;
  const x=Math.round(bush.x)*CW,y=bush.br*CH,r=bush.v.R;
  return x+r*1.2+margin>=rect.left&&
    x-r*1.2-margin<=rect.left+rect.w&&
    y+CH+margin>=rect.top&&
    y-bush.v.crownH-margin<=rect.top+rect.h;
}

export function pickNativeActorBushes(flora,actors,CW,CH,limit=5){
  const near=[],visited=new Set();
  for(const actor of actors||[]){
    if(!actor.rect)continue;
    const r=actor.rect,by=r.top+r.h*.72,bx=r.left+r.w*.5;
    for(const bush of flora||[]){
      if(visited.has(bush)||!nativeBushOverlapsActor(bush,r,CW,CH))
        continue;
      visited.add(bush);
      const dx=Math.round(bush.x)*CW-bx,dy=bush.br*CH-by;
      near.push({bush,dist:dx*dx+dy*dy});
    }
  }
  return near.sort((a,b)=>a.dist-b.dist)
    .slice(0,limit).map(x=>x.bush);
}

export class NativeBushDepth{
  constructor(scene,capacity=8000){
    this.scene=scene;this.capacity=capacity;
    this.geometry=new THREE.IcosahedronGeometry(1,1);
    this.material=new THREE.MeshBasicMaterial({color:0x808080});
    this.mesh=new THREE.InstancedMesh(this.geometry,this.material,capacity);
    this.mesh.name='native-original-spring-parted-bush-clumps-depth';
    this.mesh.count=0;
    this.mesh.frustumCulled=false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
    this.matrix=new THREE.Matrix4();
    this.cache=new Map();this.generation=-1;
    this.stats={bushes:0,wood:0,leaves:0,instances:0,moved:0};
  }
  update(source,actorRanges,CW,CH){
    this.mesh.count=0;
    this.stats={bushes:0,wood:0,leaves:0,instances:0,moved:0};
    if(!source?.flora||!source.VARS||!source.t3Tree||
      typeof source.nativeBushBranchShift!=='function')return 0;
    if(this.generation!==source.worldGen){
      this.cache.clear();this.generation=source.worldGen;
    }
    const bushes=pickNativeActorBushes(source.flora,actorRanges,CW,CH,5);
    if(!bushes.length)return 0;
    const variants=source.VARS.filter(v=>v.type==='bush');
    const cp=Math.cos(source.pitch),sp=Math.sin(source.pitch);
    let count=0,wood=0,leaves=0,moved=0,drawn=0;
    for(const f of bushes){
      const variant=variants.indexOf(f.v);
      if(variant<0)continue;
      let shape=this.cache.get(variant);
      if(!shape){
        shape=source.t3Tree('bush',variant+41);
        shape.nativeTop=Math.max(1,...shape.S.map(s=>s[1]));
        this.cache.set(variant,shape);
      }
      const originX=-Math.round(f.x)*CW;
      const originY=-f.br*CH*cp,originZ=-f.br*CH*sp;
      const lean=(f.sw||0)*2;
      let used=0;
      for(let i=0;i<shape.S.length&&count<this.capacity;i++){
        const [x,y,z,r,kind]=shape.S[i];
        // Preserve perforated foliage. Thick wood never disappears.
        if(kind===0&&((i*7+variant*13)%5)<2)continue;
        const h=clamp((y*cp+z*sp)/Math.max(1,f.v.crownH),0,1);
        const sway=lean*h*Math.sqrt(h);
        // EXACT same independent nine-twig spring interpolation used when
        // the source ASCII backing and leaves move in native-bushes.js.
        const radius=r*(kind===0?.73:1);
        // The clump follows the actor's wake by its own radius, so its
        // edge, not only its centre, moves as the leaves show; a pushed
        // bough also sags, exactly like the ASCII leaves around it.
        const clearH=y/shape.nativeTop;
        const shift=source.nativeBushBranchShift(f,x+sway,h,radius,clearH);
        const sag=source.nativeBushBranchShift.drop?.(f,x+sway,h,radius,clearH)||0;
        this.matrix.makeScale(radius,radius,radius);
        this.matrix.setPosition(originX-x-sway-shift,
          originY+y-sag/Math.max(.3,cp),originZ+z);
        this.mesh.setMatrixAt(count++,this.matrix);
        if(Math.abs(shift)>.4)moved++;
        if(kind===0)leaves++;else wood++;
        used++;
      }
      if(used)drawn++;
    }
    this.mesh.count=count;
    if(count)this.mesh.instanceMatrix.needsUpdate=true;
    this.stats={bushes:drawn,wood,leaves,instances:count,moved};
    return count;
  }
  dispose(){
    this.scene.remove(this.mesh);
    this.geometry.dispose();this.material.dispose();
    this.cache.clear();this.mesh.count=0;
  }
}
