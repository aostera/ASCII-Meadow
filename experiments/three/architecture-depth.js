// The ORIGINAL source castle/ruins rendered to an actual GPU depth texture.
// Shared WebGLRenderer only; does NOT alter original image brightness or alpha.
// Depth texture is the next-stage input for scene occlusion/animated objects.
import * as THREE from 'three';
import {configureNativeCamera} from './source-world.mjs';
import {architectureInsetRect} from './live-architecture.js';

const DEPTH_VS=[
 'varying vec2 vUv;',
 'void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}'
].join('\n');
const DEPTH_FS=[
 'uniform sampler2D uDepth;',
 'varying vec2 vUv;',
 'void main(){',
 'float d=texture2D(uDepth,vUv).r;',
 'float occupied=1.-step(.999999,d);',
 'gl_FragColor=vec4(vec3(occupied),1.);',
 '}'
].join('\n');

export class ArchitectureDepthPass {
  constructor(renderer,sourceScene){
    this.renderer=renderer;
    this.sourceScene=sourceScene;
    this.camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,40000);
    this.depthMaterial=new THREE.MeshDepthMaterial({side:THREE.DoubleSide});
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
    this.target.texture.generateMipmaps=false;
    this.previewScene=new THREE.Scene();
    this.previewMaterial=new THREE.ShaderMaterial({
      uniforms:{uDepth:{value:this.target.depthTexture}},
      vertexShader:DEPTH_VS,fragmentShader:DEPTH_FS,
      depthTest:false,depthWrite:false,toneMapped:false
    });
    this.previewMesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.previewMaterial);
    this.previewMesh.frustumCulled=false;
    this.previewScene.add(this.previewMesh);
    this.previewCamera=new THREE.Camera();
    this.frames=0;this.disposed=false;
    this.stats={frames:0,width:0,height:0,sites:0,drawCalls:0,
      hasDepthTexture:true,viewport:null};
  }
  render({W,H,VZ,CW,CH,camX,camY,pitch,sites}){
    if(this.disposed||!(W>0&&H>0))return;
    // Reduced-resolution native depth avoids excessive mobile fill-rate.
    const dw=Math.max(1,Math.round(W*.5));
    const dh=Math.max(1,Math.round(H*.5));
    if(this.target.width!==dw||this.target.height!==dh)
      this.target.setSize(dw,dh);
    const projection=configureNativeCamera(THREE,this.camera,{
      W,H,VZ,CW,CH,camX,camY,pitch
    });
    const renderer=this.renderer,scene=this.sourceScene;
    const oldTarget=renderer.getRenderTarget();
    const viewport=renderer.getViewport(new THREE.Vector4());
    const scissor=renderer.getScissor(new THREE.Vector4());
    const test=renderer.getScissorTest();
    const oldClear=renderer.getClearColor(new THREE.Color()).clone();
    const oldAlpha=renderer.getClearAlpha();
    const oldAutoClear=renderer.autoClear;
    const oldMaterial=scene.overrideMaterial;
    const rect=architectureInsetRect(W,H);
    try{
      // The color attachment of this pass is NEVER blended into the original
      // ASCII world. We capture real 3D depth from the exact source camera.
      renderer.setRenderTarget(this.target);
      renderer.setViewport(0,0,dw,dh);
      renderer.setScissorTest(false);
      renderer.setClearColor(0x000000,1);
      renderer.autoClear=true;
      scene.overrideMaterial=this.depthMaterial;
      renderer.info.reset();
      renderer.clear(true,true,false);
      renderer.render(scene,this.camera);
      const calls=renderer.info.render.calls;
      scene.overrideMaterial=oldMaterial;
      // Occupancy diagnostic, in a small inset only.
      renderer.setRenderTarget(null);
      renderer.setViewport(Math.round(rect.x),
        Math.round(H-rect.top-rect.height),
        Math.round(rect.width),Math.round(rect.height));
      renderer.setScissor(Math.round(rect.x),
        Math.round(H-rect.top-rect.height),
        Math.round(rect.width),Math.round(rect.height));
      renderer.setScissorTest(true);
      renderer.clear(true,true,false);
      this.previewMaterial.uniforms.uDepth.value=this.target.depthTexture;
      renderer.render(this.previewScene,this.previewCamera);
      this.stats={frames:++this.frames,width:dw,height:dh,
        sites,drawCalls:calls,hasDepthTexture:!!this.target.depthTexture,
        viewport:rect,cameraTarget:projection.target};
    }finally{
      scene.overrideMaterial=oldMaterial;
      renderer.setRenderTarget(oldTarget);
      renderer.setViewport(viewport);
      renderer.setScissor(scissor);
      renderer.setScissorTest(test);
      renderer.setClearColor(oldClear,oldAlpha);
      renderer.autoClear=oldAutoClear;
    }
  }
  get depthTexture(){return this.target?.depthTexture||null}
  dispose(){
    if(this.disposed)return;
    this.disposed=true;
    this.target.dispose();
    this.target.depthTexture?.dispose();
    this.depthMaterial.dispose();
    this.previewMesh.geometry.dispose();
    this.previewMaterial.dispose();
    this.previewScene.clear();
  }
}