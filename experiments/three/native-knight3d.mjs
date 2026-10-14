// Opt-in (?knight3d) skinned 3D player knight in the MAIN native picture.
// Same WebGLRenderer and the same orthographic game camera as the glyph pass:
// it is drawn right after the glyph framebuffer, at the real source player's
// foot, scaled to the original sprite height and driven by the source player's
// movement. No depth against glyphs or masonry yet: the knight is always on top.
import * as THREE from 'three';
import {configureNativeCamera} from './source-world.mjs';
import {createGltfKnight} from './knight-gltf.js';
import {createAnimatedKnight} from './knight-rig.js';
import {projectOriginalActor,sourceKnightMotion} from './source-motion.mjs';

export class NativeKnight3D {
  constructor(renderer){
    this.renderer=renderer;
    this.scene=new THREE.Scene();
    this.camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,40000);
    this.scene.add(new THREE.HemisphereLight(0xe8e8e8,0x303030,1.6));
    const key=new THREE.DirectionalLight(0xffffff,2.2);
    key.position.set(-450,950,-680);
    this.scene.add(key,key.target);
    this.materials={
      iron:new THREE.MeshStandardMaterial({color:0x737373,roughness:.74}),
      trim:new THREE.MeshStandardMaterial({color:0x9c9c9c,roughness:.54}),
      red:new THREE.MeshStandardMaterial({color:0x3a3436,roughness:1}),
      wood:new THREE.MeshStandardMaterial({color:0x272727,roughness:1})
    };
    this.stats={frames:0,loaded:false,error:null,clip:null,motion:'idle',
      timeScale:1,foot:null,drawCalls:0};
    this.knight=createGltfKnight(THREE,{
      fallback:()=>createAnimatedKnight(THREE,this.materials),
      onLoad:rig=>{
        this.stats.loaded=true;
        this.stats.clips=Object.keys(rig.userData.gltf.actions);
      },
      onError:err=>{this.stats.error=String(err?.message||err)}
    });
    this.knight.name='native-3d-player-knight';
    this.scene.add(this.knight);
    this.sample=null;this.clock=null;this.disposed=false;
  }
  render({player,gameTime,sourceHeight,W,H,VZ,CW,CH,camX,camY,pitch}){
    if(this.disposed||!player||!(W>0&&H>0&&sourceHeight>0))return;
    const now=Number(gameTime)||0;
    const dt=this.clock===null?1/60:Math.max(1/240,Math.min(.05,now-this.clock));
    const motion=sourceKnightMotion(player,this.sample,dt,CW,CH);
    const project=projectOriginalActor(player,CW,CH,pitch,sourceHeight);
    this.knight.position.set(...project.position);
    this.knight.scale.setScalar(project.scale);
    this.knight.userData.pxPerMeter=sourceHeight/1.9;
    this.stats.motion=this.knight.userData.animate(dt,motion.movement,now);
    this.sample=motion.sample;this.clock=now;
    const g=this.knight.userData.gltf;
    this.stats.clip=g.clip;this.stats.timeScale=g.timeScale;
    this.stats.foot=project.sourceScreen;
    configureNativeCamera(THREE,this.camera,{W,H,VZ,camX,camY,CW,CH,pitch});
    const r=this.renderer,auto=r.autoClear;
    try{
      // Glyphs stay in the colour buffer; only depth is cleared for the knight.
      r.autoClear=false;
      r.clearDepth();
      r.info.reset();
      r.render(this.scene,this.camera);
      this.stats.drawCalls=r.info.render.calls;
      this.stats.frames++;
    }finally{r.autoClear=auto}
  }
  dispose(){
    if(this.disposed)return;
    this.disposed=true;
    this.scene.remove(this.knight);
    this.knight.userData.dispose?.();
    for(const m of Object.values(this.materials))m.dispose();
    this.scene.clear();
  }
}
