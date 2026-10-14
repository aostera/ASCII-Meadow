// Original medieval tents and palisade fences in the same GPU actor-depth
// scene as original castle and living trees. Exact authored wedge/rope/wood
// solids from campTent/campFence: NOT an opaque box or fake rectangular shadow.
// Existing sprites, shadows, colors and alpha remain the canonical image.
import * as THREE from 'three';
import {makeSourceArchitecture} from './source-masonry.mjs';

const tentDefs=[
 ['ridge',101,.36],['ridge',104,-.48],['torn',103,.78],
 ['torn',107,-.69],['ridge',109,1.05],['ridge',112,-1.03],
 ['torn',115,1.27],['torn',119,-.21]
];
const fenceDefs=[
 [0,0],[Math.PI/2,0],[Math.PI/4,0],[-Math.PI/4,0],
 [0,1],[Math.PI/2,1]
];

export function nativePropOverlapsActor(prop,actorRect,CW,CH,margin=6){
  if(!prop||!['tent','fence'].includes(prop.v?.type)||!actorRect)
    return false;
  const v=prop.v,cx=prop.x*CW,y=prop.br*CH;
  return cx+v.R+margin>=actorRect.left &&
    cx-v.R-margin<=actorRect.left+actorRect.w&&
    y+CH+margin>=actorRect.top&&
    y-v.crownH-margin<=actorRect.top+actorRect.h;
}
export function pickNativeActorProps(flora,actorRanges,CW,CH,limit=6){
  const unique=new Set(),found=[];
  for(const actor of actorRanges||[]){
    if(!actor.rect)continue;
    for(const p of flora||[]){
      if(!nativePropOverlapsActor(p,actor.rect,CW,CH)||unique.has(p))
        continue;
      unique.add(p);
      const dx=p.x*CW-(actor.rect.left+actor.rect.w*.5);
      const dy=p.br*CH-(actor.rect.top+actor.rect.h*.8);
      found.push({p,dist:dx*dx+dy*dy});
    }
  }
  return found.sort((a,b)=>a.dist-b.dist)
    .slice(0,limit).map(x=>x.p);
}

function authoredCampVariant(source,type,index){
  if(type==='tent'){
    const [kind,seed,yaw]=tentDefs[index]||tentDefs[0];
    return source.campTurn(source.campTent(kind,seed),yaw);
  }
  const [angle,stakes]=fenceDefs[index]||fenceDefs[0];
  return source.campFence(angle,stakes,111+index);
}

export class NativePropDepth {
  constructor(scene,material){
    this.scene=scene;this.material=material;
    this.root=new THREE.Group();
    this.root.name='source-medieval-tent-and-fence-depth';
    scene.add(this.root);
    this.cache=new Map();
    this.instances=new Map();
    this.generation=-1;
    this.stats={props:0,tents:0,fences:0,sourceSolids:0,triangles:0};
  }
  clear(){
    this.root.clear();
    this.instances.clear();
    for(const m of this.cache.values())
      m.traverse(o=>{if(o.geometry)o.geometry.dispose()});
    this.cache.clear();
  }
  reset(){
    this.stats={props:0,tents:0,fences:0,sourceSolids:0,triangles:0};
  }
  update(source,actorRanges,CW,CH){
    this.reset();
    if(!source.flora||!source.VARS||
       !source.campTent||!source.campFence||!source.campTurn){
      this.root.clear();this.instances.clear();
      return 0;
    }
    if(this.generation!==source.worldGen){
      this.clear();this.generation=source.worldGen;
    }
    const props=pickNativeActorProps(
      source.flora,actorRanges,CW,CH,6);
    const wanted=new Set(props);
    for(const [oldProp,instance] of this.instances){
      if(!wanted.has(oldProp)){
        this.root.remove(instance);this.instances.delete(oldProp);
      }
    }
    const variants={
      tent:source.VARS.filter(v=>v.type==='tent'),
      fence:source.VARS.filter(v=>v.type==='fence')
    };
    const c=Math.cos(source.pitch),s=Math.sin(source.pitch);
    for(const p of props){
      const type=p.v.type,index=variants[type].indexOf(p.v);
      if(index<0)continue;
      const key=type+':'+index;
      let template=this.cache.get(key);
      if(!template){
        const model=authoredCampVariant(source,type,index);
        const solids=model.S.map(shape=>({
          kind:'wall',pl:shape.p,meta:{},
          bb:[shape.bs[0]-shape.bs[3],shape.bs[0]+shape.bs[3],
              shape.bs[1]-shape.bs[3],shape.bs[1]+shape.bs[3],
              shape.bs[2]-shape.bs[3],shape.bs[2]+shape.bs[3]]
        }));
        template=makeSourceArchitecture(THREE,solids,{wall:this.material});
        this.cache.set(key,template);
      }
      let instance=this.instances.get(p);
      if(!instance){
        instance=template.clone(true);
        this.instances.set(p,instance);
        this.root.add(instance);
      }
      instance.position.set(-p.x*CW,-p.br*CH*c,-p.br*CH*s);
      instance.scale.set(-1,1,1);
      this.stats.props++;
      this.stats[type==='tent'?'tents':'fences']++;
      this.stats.sourceSolids+=template.userData.sourceStatistics.solids;
      this.stats.triangles+=template.userData.sourceStatistics.triangles;
    }
    return this.root.children.length;
  }
  dispose(){
    this.clear();this.scene.remove(this.root);
  }
}
