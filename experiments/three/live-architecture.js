// Opt-in LIVE source-based 3D architecture, in the SAME Three.WebGLRenderer
// as the pixel-perfect original ASCII Meadow glyphs. No second GL context.
// Uses the original authored world/castle/ruins and current game camera.
// An isolated diagnostic inset is deliberately used until hybrid depth
// occlusion has been visually accepted; the 1:1 main image is not modified.
import * as THREE from 'three';
import {makeSourceArchitecture} from './source-masonry.mjs';
import {createNativeSourceWorld,configureNativeCamera} from './source-world.mjs';
import {createAnimatedKnight} from './knight-rig.js';
import {projectOriginalActor,sourceKnightMotion} from './source-motion.mjs';
import {createAnimatedCow} from './cow-rig.js';
import {sourceCowPose,projectSourceCow} from './source-cow-motion.mjs';

// CSS-pixel rectangle, anchored to the top-right of the source game canvas.
export function architectureInsetRect(width,height){
  const w=Math.max(100,Math.min(width*.41,340));
  const h=Math.max(75,Math.min(height*.32,230));
  const x=Math.max(0,width-w-14);
  // The mobile settings toolbar spans the top of the scene; keep the native
  // preview BELOW it so that tapping buttons never hides most of the 3D view.
  const top=width<650?Math.min(244,Math.max(14,height-h-14)):14;
  return {x,top,width:w,height:h};
}

export class LiveSourceArchitecture {
  constructor(renderer,getSource){
    this.renderer=renderer;
    this.getSource=getSource;
    this.scene=new THREE.Scene();
    this.scene.background=new THREE.Color().setRGB(12/255,12/255,12/255,
      THREE.LinearSRGBColorSpace);
    this.camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,40000);
    // Actor diagnostic on layer 1; source masonry and native depth stay on layer 0.
    this.camera.layers.enable(1);
    this.scene.add(new THREE.HemisphereLight(0xe1e1e1,0x2b2b2b,1.2));
    const sun=new THREE.DirectionalLight(0xdadada,1.7);
    sun.position.set(-450,950,680);this.scene.add(sun);
    this.materials={
      wall:new THREE.MeshStandardMaterial({color:0x989898,roughness:1}),
      roof:new THREE.MeshStandardMaterial({color:0x696969,roughness:1}),
      spire:new THREE.MeshStandardMaterial({color:0x777777,roughness:1}),
      rock:new THREE.MeshStandardMaterial({color:0x565656,roughness:1}),
      step:new THREE.MeshStandardMaterial({color:0xb1b1b1,roughness:1})
    };
    this.world=null;
    this.generation=null;
    this.depthPass=null;
    this.depthPending=false;
    this.active=true;
    this.frames=0;
    this.lastCamera=null;
    this.stats={frames:0,builds:0,sites:0,drawCalls:0,triangles:0};
    this.disposed=false;
    // This rig is opt-in and never draws over the authored glyph framebuffer.
    this.knightRig=null;this.knightMaterials=null;
    this.knightSample=null;this.knightClock=null;
    this.knightEnabled=false;
    this.stats.knightRig=false;
    this.cowRig=null;this.cowMaterials=null;
    this.cowClock=null;this.cowSample=null;this.cowEnabled=false;
    this.stats.cowRig=false;
  }
  setCowRig(enabled){
    if(this.disposed&&enabled)return false;
    if(!enabled){
      if(this.cowRig){
        this.scene.remove(this.cowRig);
        this.cowRig.userData.dispose();
        for(const mat of Object.values(this.cowMaterials||{}))mat.dispose();
      }
      this.cowRig=null;this.cowMaterials=null;
      this.cowClock=null;this.cowSample=null;
      this.cowEnabled=false;this.stats.cowRig=false;
      this.stats.cowMotion='off';this.stats.cowHeadLowering=0;
      return true;
    }
    if(!this.cowRig){
      this.cowMaterials={
        hide:new THREE.MeshStandardMaterial({color:0x444444,roughness:.91}),
        armor:new THREE.MeshStandardMaterial({color:0x777777,roughness:.82}),
        hoof:new THREE.MeshStandardMaterial({color:0x282828,roughness:1}),
        shadow:new THREE.MeshStandardMaterial({color:0x292929,roughness:1}),
        muzzle:new THREE.MeshStandardMaterial({color:0x676767,roughness:.97}),
        horn:new THREE.MeshStandardMaterial({color:0x9b9b9b,roughness:.87})
      };
      this.cowRig=createAnimatedCow(THREE,this.cowMaterials);
      this.cowRig.traverse(o=>o.layers.set(1));
      this.scene.add(this.cowRig);
      this.stats.cowMeshes=0;
      this.cowRig.traverse(o=>{if(o.isMesh)this.stats.cowMeshes++});
    }
    this.cowEnabled=true;this.stats.cowRig=true;
    return true;
  }
  updateCowFromSource(data,CW,CH){
    if(!this.cowEnabled||!this.cowRig||!data.cows?.length)return;
    const sourceCow=data.cows[0];
    const now=Number(data.gameTime)||0;
    const dt=this.cowClock===null?1/60:
      Math.max(1/240,Math.min(.05,now-this.cowClock));
    const pose=sourceCowPose(sourceCow,this.cowSample,dt,CW,CH,now);
    const projected=projectSourceCow(sourceCow,CW,CH,data.pitch,data.cowSourceHeight);
    this.cowRig.position.set(...projected.position);
    this.cowRig.scale.setScalar(projected.scale);
    const status=this.cowRig.userData.animateFromSource(dt,pose);
    this.cowSample=pose.sample;this.cowClock=now;
    this.stats.cowMotion=status;
    this.stats.cowHeadLowering=pose.lowerHead;
    this.stats.cowHop=pose.hop;
    this.stats.cowGait=pose.gait;
    this.stats.cowOriginalState=sourceCow.state;
    this.stats.cowActorFoot=projected.sourceScreen;
    this.stats.cowNativePosition=projected.position;
    this.stats.cowHeading=pose.heading;
  }
  setKnightRig(enabled){
    if(this.disposed&&enabled)return false;
    if(!enabled){
      if(this.knightRig){
        this.scene.remove(this.knightRig);
        this.knightRig.traverse(o=>{if(o.geometry)o.geometry.dispose()});
        for(const mat of Object.values(this.knightMaterials||{}))mat.dispose();
      }
      this.knightRig=null;this.knightMaterials=null;
      this.knightSample=null;this.knightClock=null;
      this.knightEnabled=false;this.stats.knightRig=false;
      return true;
    }
    if(!this.knightRig){
      this.knightMaterials={
        iron:new THREE.MeshStandardMaterial({color:0x737373,roughness:.74}),
        trim:new THREE.MeshStandardMaterial({color:0x9c9c9c,roughness:.54}),
        red:new THREE.MeshStandardMaterial({color:0x3a3436,roughness:1}),
        wood:new THREE.MeshStandardMaterial({color:0x272727,roughness:1})
      };
      this.knightRig=createAnimatedKnight(THREE,this.knightMaterials);
      this.knightRig.name='source-player-driven-3D-rig-diagnostic';
      this.knightRig.traverse(o=>o.layers.set(1));
      this.scene.add(this.knightRig);
      this.stats.knightMeshes=0;
      this.knightRig.traverse(o=>{if(o.isMesh)this.stats.knightMeshes++});
    }
    this.knightEnabled=true;this.stats.knightRig=true;
    return true;
  }
  updateKnightFromSource(data,CW,CH){
    if(!this.knightEnabled||!this.knightRig||!data.player)return;
    const now=Number(data.gameTime)||0;
    const dt=this.knightClock===null?1/60:
      Math.max(1/240,Math.min(.05,now-this.knightClock));
    const motion=sourceKnightMotion(data.player,this.knightSample,dt,CW,CH);
    const project=projectOriginalActor(data.player,CW,CH,
      data.pitch,data.knightSourceHeight);
    this.knightRig.position.set(...project.position);
    this.knightRig.scale.setScalar(project.scale);
    const state=this.knightRig.userData.animate(dt,motion.movement,now);
    this.knightSample=motion.sample;
    this.knightClock=now;
    this.stats.knightMotion=state;
    this.stats.knightActorFoot=project.sourceScreen;
    this.stats.knightHeading=motion.movement.heading;
    this.stats.knightNativePosition=project.position;
    this.stats.knightSourceJump=motion.sample.jumping;
  }
  refresh(){
    const data=this.getSource();
    if(!this.world||this.generation!==data.worldGen){
      if(this.world)this.removeWorld();
      this.world=createNativeSourceWorld(THREE,{
        ...data,materials:this.materials,makeSourceArchitecture
      });
      this.scene.add(this.world);
      this.generation=data.worldGen;
      this.stats.builds++;
      this.stats.sites=this.world.userData.sourceSites.length;
      this.stats.sourceSolids=this.world.userData.sourceCounts.reduce((s,v)=>s+v.solids,0);
    }
    return data;
  }
  removeWorld(){
    if(!this.world)return;
    this.world.traverse(object=>{if(object.geometry)object.geometry.dispose()});
    this.scene.remove(this.world);
    this.world=null;
  }
  async setDepthPreview(enabled){
    if(!enabled){
      if(this.depthPass){this.depthPass.dispose();this.depthPass=null}
      this.stats.depthFrames=0;
      return true;
    }
    if(this.disposed)return false;
    if(!this.depthPass){
      this.depthPending=true;
      try{
        const {ArchitectureDepthPass}=await import('./architecture-depth.js');
        if(this.disposed||!this.depthPending)return false;
        this.depthPass=new ArchitectureDepthPass(this.renderer,this.scene);
      }finally{this.depthPending=false}
    }
    return true;
  }
  get depthInfo(){return this.depthPass?{
    ...this.depthPass.stats,
    active:true
  }:null}
  render({W,H,VZ,CW,CH,camX,camY,DPR}){
    if(this.disposed||!this.active||!(W>0&&H>0))return;
    const data=this.refresh();
    this.updateKnightFromSource(data,CW,CH);
    this.updateCowFromSource(data,CW,CH);
    if(this.depthPass){
      this.depthPass.render({
        W,H,VZ,CW,CH,camX,camY,pitch:data.pitch,sites:this.stats.sites
      });
      this.stats.depthFrames=this.depthPass.stats.frames;
      this.stats.depthDrawCalls=this.depthPass.stats.drawCalls;
      this.stats.frames++;
      this.lastCamera={
        worldGen:this.generation,viewport:this.depthPass.stats.viewport,
        depth:true,cameraTarget:this.depthPass.stats.cameraTarget
      };
      return;
    }
    const rect=architectureInsetRect(W,H);
    // WebGLRenderer.setViewport/setScissor convert CSS pixels to device
    // pixels internally. Multiplying by DPR here would double-scale (and
    // sometimes push the preview entirely off-screen on Retina iPads).
    const [w,h,x,y]=[rect.width,rect.height,rect.x,H-rect.top-rect.height]
      .map(v=>Math.max(1,Math.round(v)));
    // The inset is a REAL camera on the SAME world, centred on the active
    // gameplay viewport, with a wider field so whole Gothic walls are seen.
    // Gothic source volumes range from hundreds to thousands of original
    // screen pixels. A wider diagnostic FOV is necessary to reveal the
    // complete ruins instead of a heavily clipped striped wall close-up.
    // Player-driven rig gets a camera-closeup ONLY inside the inset, so that
    // knees, arms and cape motion are visible on both desktop and narrow phones.
    // The actual ASCII camera/image remains completely untouched.
    const actorMode=this.cowEnabled&&data.cows?.length?'cow':
      this.knightEnabled&&data.player?'knight':null;
    const focusActor=actorMode==='cow'?data.cows[0]:data.player;
    const sourceHeight=actorMode==='cow'?data.cowSourceHeight:data.knightSourceHeight;
    const zoom=actorMode?
      Math.max(.1,Math.min(1.45,rect.height*.60/sourceHeight)):
      VZ*.14*Math.min(1,rect.width/340);
    const actorSx=focusActor?(focusActor.x*CW):0;
    const actorSy=focusActor?((focusActor.y+.7)*CH-sourceHeight*.5):0;
    const cx=actorMode?
      (actorSx-rect.width/(2*zoom))/CW:
      camX+(W/(2*VZ)-rect.width/(2*zoom))/CW;
    const cy=actorMode?
      (actorSy-rect.height/(2*zoom))/CH:
      camY+(H/(2*VZ)-rect.height/(2*zoom))/CH;
    const view=configureNativeCamera(THREE,this.camera,{
      W:rect.width,H:rect.height,VZ:zoom,
      camX:cx,camY:cy,CW,CH,pitch:data.pitch
    });
    const renderer=this.renderer;
    const viewport=renderer.getViewport(new THREE.Vector4());
    const scissor=renderer.getScissor(new THREE.Vector4());
    const scissorEnabled=renderer.getScissorTest();
    const clearColor=renderer.getClearColor(new THREE.Color()).clone();
    const clearAlpha=renderer.getClearAlpha();
    const previousTarget=renderer.getRenderTarget();
    const oldAutoClear=renderer.autoClear;
    renderer.info.reset();
    try{
      renderer.setRenderTarget(null);
      renderer.setViewport(x,y,w,h);
      renderer.setScissor(x,y,w,h);
      renderer.setScissorTest(true);
      renderer.setClearColor(this.scene.background,1);
      renderer.autoClear=true;
      renderer.render(this.scene,this.camera);
      this.stats.drawCalls=renderer.info.render.calls;
      this.stats.triangles=renderer.info.render.triangles;
      this.stats.frames++;
      this.lastCamera={center:view.target,position:view.position,
        worldGen:this.generation,viewport:rect};
    }finally{
      // Never leak the preview viewport into the full-screen glyph draw.
      renderer.setRenderTarget(previousTarget);
      renderer.setViewport(viewport);
      renderer.setScissor(scissor);
      renderer.setScissorTest(scissorEnabled);
      renderer.setClearColor(clearColor,clearAlpha);
      renderer.autoClear=oldAutoClear;
    }
  }
  dispose(){
    if(this.disposed)return;
    this.disposed=true;this.active=false;
    this.depthPending=false;
    if(this.depthPass){this.depthPass.dispose();this.depthPass=null}
    this.removeWorld();
    this.setKnightRig(false);
    this.setCowRig(false);
    for(const material of Object.values(this.materials))material.dispose();
    this.scene.clear();
  }
}
