// Full-frame source architecture Z pass for the native game. Never presents
// an inset, never creates a second context and never substitutes original
// authored stone pixels with grey 3D meshes. A depth texture is produced in
// the SAME Three renderer as the full-world glyph painter.
import * as THREE from 'three';
import {makeSourceArchitecture} from './source-masonry.mjs';
import {createNativeSourceWorld,configureNativeCamera} from './source-world.mjs';
import {NativeTreeDepth,pickNativeActorTrees} from './native-tree-depth.mjs';
import {NativePropDepth,pickNativeActorProps} from './native-props-depth.mjs';
import {NativeStoneDepth,pickNativeActorStones} from './native-stone-depth.mjs';
import {NativeBushDepth,pickNativeActorBushes} from './native-bush-depth.mjs';

export function sourceArchitectureOverlaps(rect,source,CW,CH,margin=12){
  if(!rect)return false;
  const x0=rect.left-margin,y0=rect.top-margin;
  const x1=rect.left+rect.w+margin,y1=rect.top+rect.h+margin;
  const overlaps=(a,b,c,d)=>x1>=a&&x0<=c&&y1>=b&&y0<=d;
  const C=source.cathedral;
  if(C?.cv&&overlaps(C.cx0*CW,C.cy0*CH,
    (C.cx0+C.BW)*CW,(C.cy0+C.BH)*CH))return true;
  for(const r of source.ruins||[])
    if(overlaps(r.x0*CW,r.y0*CH,r.x1*CW,r.y1*CH))return true;
  return false;
}

export class NativeArchitectureDepth{
  constructor(renderer){
    this.renderer=renderer;
    this.scene=new THREE.Scene();
    this.treeDepth=new NativeTreeDepth(this.scene);
    this.bushDepth=new NativeBushDepth(this.scene);
    this.propDepth=new NativePropDepth(this.scene,
      new THREE.MeshBasicMaterial({color:0x808080}));
    this.stoneDepth=new NativeStoneDepth(this.scene,
      new THREE.MeshBasicMaterial({color:0x808080}));
    this.camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,40000);
    this.material=new THREE.MeshDepthMaterial({side:THREE.DoubleSide});
    this.material.depthWrite=true;
    this.material.depthTest=true;
    this.filler=new THREE.MeshBasicMaterial({color:0x808080});
    this.materials=Object.fromEntries(
      ['wall','roof','spire','rock','step'].map(k=>[k,this.filler]));
    this.target=new THREE.WebGLRenderTarget(1,1,{
      depthBuffer:true,stencilBuffer:false,format:THREE.RGBAFormat,
      minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,
      generateMipmaps:false
    });
    this.target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
    this.target.depthTexture.format=THREE.DepthFormat;
    this.target.depthTexture.minFilter=THREE.NearestFilter;
    this.target.depthTexture.magFilter=THREE.NearestFilter;
    this.target.depthTexture.generateMipmaps=false;
    this.world=null;this.generation=-1;this.disposed=false;
    this.stats={frames:0,builds:0,drawCalls:0,sites:0,visible:false,
      activeActors:0,width:0,height:0,
      treeClusters:0,deadTrees:0,deadSegments:0,treeWood:0,treeLeaves:0,
      tents:0,fences:0,propTriangles:0,stones:0,stoneVariants:0,
      stoneTriangles:0,bushes:0,bushWood:0,bushLeaves:0,
      bushInstances:0,bushMoved:0};
  }
  removeWorld(){
    if(!this.world)return;
    this.scene.remove(this.world);
    this.world.traverse(o=>{if(o.geometry)o.geometry.dispose()});
    this.world=null;
  }
  ensureWorld(source){
    if(this.world&&this.generation===source.worldGen)return;
    this.removeWorld();
    this.world=createNativeSourceWorld(THREE,{
      ...source,materials:this.materials,makeSourceArchitecture
    });
    this.scene.add(this.world);
    this.generation=source.worldGen;
    this.stats.builds++;
    this.stats.sites=this.world.userData.sourceSites.length;
  }
  // No expensive prepass when there are no bodies near masonry. Screen
  // footprints come from the SAME source geomOf() used to draw each actor.
  prepare({source,W,H,VZ,CW,CH,camX,camY,actorRanges}){
    if(this.disposed||!(W>0&&H>0))return null;
    const nearArchitecture=(actorRanges||[]).filter(a=>
      sourceArchitectureOverlaps(a.rect,source,CW,CH));
    const nearTrees=pickNativeActorTrees(
      source.flora||[],actorRanges,CW,CH);
    const nearProps=pickNativeActorProps(
      source.flora||[],actorRanges,CW,CH);
    const nearStones=pickNativeActorStones(
      source.flora||[],actorRanges,CW,CH);
    const nearBushes=pickNativeActorBushes(
      source.flora||[],actorRanges,CW,CH);
    this.stats.activeActors=nearArchitecture.length+nearTrees.length+
      nearProps.length+nearStones.length+nearBushes.length;
    this.stats.visible=false;
    this.stats.treeClusters=0;this.stats.deadTrees=0;this.stats.deadSegments=0;
    this.stats.treeWood=0;this.stats.treeLeaves=0;
    this.stats.tents=0;this.stats.fences=0;this.stats.propTriangles=0;
    this.stats.stones=0;this.stats.stoneVariants=0;
    this.stats.stoneTriangles=0;
    this.stats.bushes=0;this.stats.bushWood=0;
    this.stats.bushLeaves=0;this.stats.bushInstances=0;
    this.stats.bushMoved=0;
    if(!nearArchitecture.length&&!nearTrees.length&&!nearProps.length&&
       !nearStones.length&&!nearBushes.length)return null;
    // Do not pay the castle+three-ruin geometry build/draw cost when only
    // tree contact is nearby. Tree trunks and branches use one InstancedMesh.
    if(nearArchitecture.length)this.ensureWorld(source);
    else if(this.world)this.world.visible=false;
    if(this.world)this.world.visible=!!nearArchitecture.length;
    this.treeDepth.update(source,actorRanges,CW,CH);
    this.stats.treeClusters=this.treeDepth.stats.trees;
    this.stats.deadTrees=this.treeDepth.stats.deadTrees;
    this.stats.deadSegments=this.treeDepth.stats.deadSegments;
    this.stats.treeWood=this.treeDepth.stats.woodInstances;
    this.stats.treeLeaves=this.treeDepth.stats.leafInstances;
    this.bushDepth.update(source,actorRanges,CW,CH);
    this.stats.bushes=this.bushDepth.stats.bushes;
    this.stats.bushWood=this.bushDepth.stats.wood;
    this.stats.bushLeaves=this.bushDepth.stats.leaves;
    this.stats.bushInstances=this.bushDepth.stats.instances;
    this.stats.bushMoved=this.bushDepth.stats.moved;
    this.propDepth.update(source,actorRanges,CW,CH);
    this.stats.tents=this.propDepth.stats.tents;
    this.stats.fences=this.propDepth.stats.fences;
    this.stats.propTriangles=this.propDepth.stats.triangles;
    this.stoneDepth.update(source,actorRanges,CW,CH);
    this.stats.stones=this.stoneDepth.stats.stones;
    this.stats.stoneVariants=this.stoneDepth.stats.variants;
    this.stats.stoneTriangles=this.stoneDepth.stats.triangles;
    // Half-screen pass limits fill rate on high-DPR iPads while maintaining
    // geometric depth in the actual game camera.
    const dw=Math.max(1,Math.ceil(W*.5));
    const dh=Math.max(1,Math.ceil(H*.5));
    if(this.target.width!==dw||this.target.height!==dh)
      this.target.setSize(dw,dh);
    configureNativeCamera(THREE,this.camera,{
      W,H,VZ,CW,CH,camX,camY,pitch:source.pitch
    });
    const r=this.renderer;
    const oldTarget=r.getRenderTarget();
    const viewport=r.getViewport(new THREE.Vector4());
    const scissor=r.getScissor(new THREE.Vector4());
    const test=r.getScissorTest();
    const color=r.getClearColor(new THREE.Color()).clone();
    const alpha=r.getClearAlpha();
    const auto=r.autoClear;
    const oldMaterial=this.scene.overrideMaterial;
    try{
      r.setRenderTarget(this.target);
      r.setViewport(0,0,dw,dh);
      r.setScissorTest(false);
      r.setClearColor(0x000000,1);
      r.autoClear=true;
      this.scene.overrideMaterial=this.material;
      r.info.reset();
      r.clear(true,true,false);
      r.render(this.scene,this.camera);
      this.stats.frames++;
      this.stats.width=dw;this.stats.height=dh;
      this.stats.drawCalls=r.info.render.calls;
      this.stats.visible=true;
      return this.target.depthTexture;
    }finally{
      this.scene.overrideMaterial=oldMaterial;
      r.setRenderTarget(oldTarget);
      r.setViewport(viewport);
      r.setScissor(scissor);
      r.setScissorTest(test);
      r.setClearColor(color,alpha);
      r.autoClear=auto;
    }
  }
  dispose(){
    if(this.disposed)return;
    this.disposed=true;
    this.removeWorld();
    this.treeDepth.dispose();
    this.bushDepth.dispose();
    this.propDepth.dispose();
    this.stoneDepth.dispose();
    this.target.dispose();
    this.target.depthTexture.dispose();
    this.material.dispose();
    this.propDepth.material.dispose();
    this.stoneDepth.material.dispose();
    this.filler.dispose();
    this.scene.clear();
  }
}
