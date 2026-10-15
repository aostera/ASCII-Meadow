// Geometry-only native Three depth for the original authored stones.
// The original bakeStone3D() sprite remains the rendered artwork: this
// module reconstructs its actual noise-warped SDF surface for actor Z,
// never a rectangular card or a replacement grey rock in the glyph view.
import * as THREE from 'three';

export function nativeStoneOverlapsActor(stone,rect,CW,CH,margin=5){
  if(stone?.v?.type!=='stone'||!rect)return false;
  const x=stone.x*CW,y=stone.br*CH,r=stone.v.R;
  return x+r+margin>=rect.left&&x-r-margin<=rect.left+rect.w&&
    y+CH+margin>=rect.top&&
    y-stone.v.crownH-margin<=rect.top+rect.h;
}

export function pickNativeActorStones(flora,ranges,CW,CH,limit=8){
  const found=[],seen=new Set();
  for(const actor of ranges||[]){
    if(!actor.rect)continue;
    for(const s of flora||[]){
      if(seen.has(s)||!nativeStoneOverlapsActor(s,actor.rect,CW,CH))
        continue;
      seen.add(s);
      const dx=s.x*CW-(actor.rect.left+actor.rect.w*.5);
      const dy=s.br*CH-(actor.rect.top+actor.rect.h*.85);
      found.push({stone:s,d:dx*dx+dy*dy});
    }
  }
  return found.sort((a,b)=>a.d-b.d).slice(0,limit).map(x=>x.stone);
}

// Same seed, ellipsoid, buried base, three-octave noise and ridge term as
// src/world/trees3d.js::bakeStone3D, which only outputs static glyphs.
// Samples the zero-isosurface via radial binary search, then seats the mesh
// on the ground. It is a *depth proxy*, not rendered as coloured triangles.
export function makeNativeStoneGeometry(variant,source){
  const size=variant%3,seed=variant+61;
  const K=source.knightPx(),hash=source.hash;
  const fbm=source.fbm3,noise=source.vnoise;
  if(!(K>0)||typeof hash!=='function'||
     typeof fbm!=='function'||typeof noise!=='function')
    throw Error('Native stone SDF needs original source noise/scale');
  const rnd=k=>hash(seed*31+k,977);
  const rx=K*[.09,.15,.25][size]*( .85+rnd(1)*.3);
  const ry=rx*(.55+rnd(2)*.25);
  const rz=rx*(.75+rnd(3)*.3),sink=ry*.3;
  const ox=rnd(4)*50,oz=rnd(5)*50;
  const sdf=(x,y,z)=>{
    const q=Math.hypot(x/rx,(y+sink)/ry,z/rz)-1;
    const f=fbm(x/rx*1.6+ox,(y*.8+z)/rx*1.6+oz);
    const ridge=Math.abs(noise(
      x/rx*2.3+oz,z/rz*2.3+y/ry+ox)-.5);
    return (q+(f-.5)*.45+ridge*.25)*Math.min(rx,ry)*.8;
  };
  const geo=new THREE.IcosahedronGeometry(1,2);
  const positions=geo.getAttribute('position');
  const dir=new THREE.Vector3();
  for(let i=0;i<positions.count;i++){
    dir.fromBufferAttribute(positions,i).normalize();
    let lo=0,hi=2;
    for(let j=0;j<10;j++){
      const t=(lo+hi)*.5;
      const x=dir.x*rx*t,y=dir.y*ry*t-sink,z=dir.z*rz*t;
      if(sdf(x,y,z)>0)hi=t;else lo=t;
    }
    const t=(lo+hi)*.5;
    positions.setXYZ(i,dir.x*rx*t,
      Math.max(0,dir.y*ry*t-sink),dir.z*rz*t);
  }
  positions.needsUpdate=true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  geo.userData={seed,size,rx,ry,rz,sink,sourceSdf:true};
  return geo;
}

export class NativeStoneDepth{
  constructor(scene,material){
    this.scene=scene;this.material=material;
    this.root=new THREE.Group();
    this.root.name='original-noise-sculpted-boulder-depth';
    scene.add(this.root);
    this.templates=new Map();
    this.instances=new Map();
    this.generation=-1;
    this.stats={stones:0,variants:0,triangles:0};
  }
  clear(){
    this.root.clear();this.instances.clear();
    for(const geom of this.templates.values())geom.dispose();
    this.templates.clear();
  }
  update(source,actorRanges,CW,CH){
    this.stats={stones:0,variants:0,triangles:0};
    if(!source.flora||!source.VARS||!source.fbm3||
       !source.vnoise||!source.hash||!source.knightPx){
      this.root.clear();this.instances.clear();return 0;
    }
    if(this.generation!==source.worldGen){
      this.clear();this.generation=source.worldGen;
    }
    const selected=pickNativeActorStones(
      source.flora,actorRanges,CW,CH,8);
    const wanted=new Set(selected);
    for(const [stone,mesh] of this.instances){
      if(!wanted.has(stone)){
        this.root.remove(mesh);this.instances.delete(stone);
      }
    }
    const variants=source.VARS.filter(v=>v.type==='stone');
    const c=Math.cos(source.pitch),sn=Math.sin(source.pitch);
    const used=new Set();
    for(const stone of selected){
      const variant=variants.indexOf(stone.v);
      if(variant<0)continue;
      let geometry=this.templates.get(variant);
      if(!geometry){
        geometry=makeNativeStoneGeometry(variant,source);
        this.templates.set(variant,geometry);
      }
      let mesh=this.instances.get(stone);
      if(!mesh){
        mesh=new THREE.Mesh(geometry,this.material);
        mesh.frustumCulled=false;
        this.instances.set(stone,mesh);
        this.root.add(mesh);
      }
      // The source stone sprite is grounded at this exact authored cell.
      mesh.position.set(-Math.round(stone.x)*CW,
        -stone.br*CH*c,-stone.br*CH*sn);
      mesh.scale.set(-1,1,1);
      this.stats.stones++;
      this.stats.triangles+=geometry.getAttribute('position').count/3;
      used.add(variant);
    }
    this.stats.variants=used.size;
    return this.stats.stones;
  }
  dispose(){
    this.clear();this.scene.remove(this.root);
  }
}
