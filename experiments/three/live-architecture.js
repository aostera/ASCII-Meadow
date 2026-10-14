// Opt-in LIVE source-based 3D architecture, in the SAME Three.WebGLRenderer
// as the pixel-perfect original ASCII Meadow glyphs. No second GL context.
// Uses the original authored world/castle/ruins and current game camera.
// An isolated diagnostic inset is deliberately used until hybrid depth
// occlusion has been visually accepted; the 1:1 main image is not modified.
import * as THREE from 'three';
import {makeSourceArchitecture} from './source-masonry.mjs';
import {createNativeSourceWorld,configureNativeCamera} from './source-world.mjs';

// CSS-pixel rectangle, anchored to the top-right of the source game canvas.
export function architectureInsetRect(width,height){
  const w=Math.max(100,Math.min(width*.41,340));
  const h=Math.max(75,Math.min(height*.32,230));
  const x=Math.max(0,width-w-14),top=14;
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
    this.active=true;
    this.frames=0;
    this.lastCamera=null;
    this.stats={frames:0,builds:0,sites:0,drawCalls:0,triangles:0};
    this.disposed=false;
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
  render({W,H,VZ,CW,CH,camX,camY,DPR}){
    if(this.disposed||!this.active||!(W>0&&H>0))return;
    const data=this.refresh();
    const rect=architectureInsetRect(W,H);
    // WebGLRenderer.setViewport/setScissor convert CSS pixels to device
    // pixels internally. Multiplying by DPR here would double-scale (and
    // sometimes push the preview entirely off-screen on Retina iPads).
    const [w,h,x,y]=[rect.width,rect.height,rect.x,H-rect.top-rect.height]
      .map(v=>Math.max(1,Math.round(v)));
    // The inset is a REAL camera on the SAME world, centred on the active
    // gameplay viewport, with a wider field so whole Gothic walls are seen.
    const zoom=VZ*.42;
    const cx=camX+(W/(2*VZ)-rect.width/(2*zoom))/CW;
    const cy=camY+(H/(2*VZ)-rect.height/(2*zoom))/CH;
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
    this.disposed=true;this.active=false;this.removeWorld();
    for(const material of Object.values(this.materials))material.dispose();
    this.scene.clear();
  }
}
