// Navigable castle interior on the existing native Three WebGL2 renderer.
// Cutaway Gothic stone rooms: true gate, two tower corridors and side chambers.
// Native-only. Source map, production castle and character atlas are untouched.
import * as THREE from 'three';
import {CASTLE_ROOMS,CASTLE_SPAWN,castleMove,castleLocation,castleNearExit} from './castle-interior-layout.mjs';

export class CastleInterior{
 constructor(renderer,{onLeave,canEnter}){
  this.renderer=renderer;this.canEnter=canEnter;this.onLeave=onLeave;
  this.active=false;this.frame=0;this.pos={...CASTLE_SPAWN};
  this.keys=new Set();
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x0b0e10);
  this.scene.fog=new THREE.Fog(0x0b0e10,43,95);
  this.scene.add(new THREE.HemisphereLight(0xaab6bb,0x101416,1.7));
  const sun=new THREE.DirectionalLight(0xc5ccd0,1.25);sun.position.set(-18,36,25);this.scene.add(sun);
  this.camera=new THREE.OrthographicCamera(-18,18,18,-18,.1,180);
  this.group=new THREE.Group();this.scene.add(this.group);
  const palette={floor:0x292c2e,wall:0x4c4e4e,rib:0x63686a,iron:0x293033,
   stone:0x737a7c,black:0x14181b};
  this.mat={};for(const [name,color]of Object.entries(palette))
   this.mat[name]=new THREE.MeshLambertMaterial({color,flatShading:true});
  this.build();this.initUi();this.installInput();
 }
 box(x,y,z,w,h,d,mat='wall',parent=this.group){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),this.mat[mat]);
  mesh.position.set(x,y,z);parent.add(mesh);return mesh;
 }
 xWall(x,z0,z1,h=7){this.box(x,h/2,(z0+z1)/2,.85,h,z1-z0)}
 zWall(z,x0,x1,h=7){this.box((x0+x1)/2,h/2,z,x1-x0,h,.85)}
 arch(x,z,alongX,half){
  // Above-door pointed lintels. Openings below are real and traversable.
  for(const sign of [-1,1]){
   const a=this.box(x+(alongX?sign*half*.5:0),5.75,
     z+(alongX?0:sign*half*.5),alongX?half+.6:.7,.7,alongX?.7:half+.6,'rib');
   if(alongX)a.rotation.z=sign*.41;else a.rotation.x=sign*.41;
  }
 }
 xOpen(x,z0,z1,holes,h=7){
  let last=z0;for(const [a,b]of holes){
   if(a>last)this.xWall(x,last,a,h);
   this.arch(x,(a+b)/2,false,(b-a)/2);last=b;
  }if(last<z1)this.xWall(x,last,z1,h);
 }
 zOpen(z,x0,x1,holes,h=7){
  let last=x0;for(const [a,b]of holes){
   if(a>last)this.zWall(z,last,a,h);
   this.arch((a+b)/2,z,true,(b-a)/2);last=b;
  }if(last<x1)this.zWall(z,last,x1,h);
 }
 pillar(x,z){
  this.box(x,3.3,z,1.25,6.6,1.25);
  this.box(x,.6,z,1.85,.42,1.85,'rib');
  this.box(x,6.25,z,1.8,.6,1.8,'rib');
 }
 floor(p){
  this.box((p.x0+p.x1)/2,-.27,(p.z0+p.z1)/2,
   p.x1-p.x0,.5,p.z1-p.z0,'floor');
  // Broad stone slab joints only; no fine-grained texture noise.
  for(let z=Math.ceil(p.z0/7)*7;z<p.z1;z+=7)
   this.box((p.x0+p.x1)/2,.001,z,p.x1-p.x0,.02,.055,'black');
 }
 stair(cx,cz,reverse=false){
  for(let i=0;i<8;i++){
   const a=-.9+i*.4;
   const b=this.box(cx+Math.cos(a)*2.4,.16+i*.19,
     cz+Math.sin(a)*2.4,2,.32,.72,i%3===0?'rib':'wall');
   b.rotation.y=(reverse?-1:1)*a;
  }
 }
 build(){
  for(const room of CASTLE_ROOMS)this.floor(room);
  // Central nave, open north sanctuary, south gate cut away for view.
  this.zOpen(-18,-11,11,[[-3.2,3.2]]);
  this.zOpen(18,-11,11,[[-3.2,3.2]],2.3);
  this.xOpen(-11,-18,18,[[-3.2,3.2],[10.1,15.9]]);
  this.xOpen(11,-18,18,[[-3.2,3.2],[10.1,15.9]]);
  this.zWall(-31,-8,8);this.xWall(-8,-31,-18);this.xWall(8,-31,-18);
  this.xWall(-4,18,25,4);this.xWall(4,18,25,4);
  this.zOpen(25,-4,4,[[-2.5,2.5]],2.1);
  // A tower genuinely connects to the hall through a narrow tunnel.
  for(const side of [-1,1]){
   const inner=side*11,out=side*18,far=side*29;
   this.zWall(-3,Math.min(inner,out),Math.max(inner,out));
   this.zWall(3,Math.min(inner,out),Math.max(inner,out),4);
   this.xOpen(out,-9,9,[[-3.2,3.2]]);
   this.xWall(far,-9,9);
   this.zWall(-9,Math.min(out,far),Math.max(out,far));
   this.zWall(9,Math.min(out,far),Math.max(out,far),2.3);
   this.stair(side*25,-2,side<0);
   // Crypt chapel left, armory right; each has a real nave doorway.
   const edge=side*25;
   this.xWall(edge,10,22);
   this.zWall(10,Math.min(inner,edge),Math.max(inner,edge));
   this.zWall(22,Math.min(inner,edge),Math.max(inner,edge),2.1);
  }
  // A believable Gothic six-pier rhythm, without solid obstructing roofs.
  for(const z of [-11,-3,5])for(const x of [-8.5,8.5])this.pillar(x,z);
  for(const z of [-11,-3,5])for(const sign of [-1,1]){
   const rib=this.box(sign*4.15,7.25,z,8,.32,.34,'rib');
   rib.rotation.z=sign*.23;
  }
  // Sparse objects. Center aisle and doors are left completely clear.
  for(const z of [-9,0,9])for(const x of [-6,6]){
   this.box(x,.42,z,4,.84,1.35,'iron');
   this.box(x,.94,z-.35,4,.57,.36,'wall');
  }
  this.box(0,.8,-27,5,1.6,2,'stone');
  this.box(0,1.75,-27.7,4.2,.6,.35,'rib');
  for(const x of [-21,-16]){
   this.box(x,.42,17,2.2,.84,4.2,'wall');
   this.box(x,.9,17,2.5,.16,4.45,'rib');
  }
  for(const x of [16,21]){
   this.box(x,.55,18.5,1.8,1.1,.75,'iron');
   this.box(x,1.55,18.5,2.2,1.5,.15,'rib');
  }
  for(const x of [-10.6,10.6])for(const z of [-12,-4,5]){
   this.box(x,4.65,z,.12,1.7,.78,'black');
   this.box(x,5.55,z,.15,.25,1.1,'rib');
  }
  this.box(0,.03,23,3.1,.07,1.55,'rib');
  this.buildPlayer();
 }
 buildPlayer(){
  const p=new THREE.Group();this.avatar=p;
  const cape=new THREE.Mesh(new THREE.ConeGeometry(.84,2.0,5),this.mat.black);
  cape.position.y=1.15;p.add(cape);
  this.box(0,1.55,0,.75,1.2,.67,'iron',p);
  const helm=new THREE.Mesh(new THREE.SphereGeometry(.48,7,5),this.mat.iron);
  helm.position.y=2.42;p.add(helm);
  this.box(0,1.95,.36,.5,.12,.16,'rib',p);
  const sword=this.box(.77,1.28,0,.11,1.92,.11,'stone',p);sword.rotation.z=-.2;
  this.scene.add(p);
 }
 initUi(){
  const shell=document.createElement('section');
  shell.className='castle-interior-ui';shell.hidden=true;
  shell.setAttribute('aria-label','Внутренние помещения замка');
  shell.innerHTML='<div class="castle-interior-head">'+
   '<small>ASCII MEADOW / ЗАМОК</small><strong class="castle-interior-room"></strong>'+
   '<span>WASD / стрелки — идти · Shift — бег · E — выход у ворот · Esc — наружу</span></div>'+
   '<div class="castle-interior-pad" aria-label="Управление движением">'+
   '<button data-key="ArrowUp" aria-label="Вперёд">▲</button><div>'+
   '<button data-key="ArrowLeft" aria-label="Влево">◀</button>'+
   '<button data-key="ArrowDown" aria-label="Назад">▼</button>'+
   '<button data-key="ArrowRight" aria-label="Вправо">▶</button></div></div>'+
   '<button class="castle-interior-leave">Вернуться во двор</button>';
  document.body.append(shell);this.ui=shell;
  this.roomLabel=shell.querySelector('.castle-interior-room');
  this.leaveButton=shell.querySelector('.castle-interior-leave');
  this.leaveButton.addEventListener('click',()=>this.leave());
  for(const b of shell.querySelectorAll('[data-key]')){
   const key=b.dataset.key;
   b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();
    b.setPointerCapture(e.pointerId);this.keys.add(key)});
   const up=e=>{e.preventDefault();this.keys.delete(key)};
   for(const name of ['pointerup','pointercancel','lostpointercapture'])
    b.addEventListener(name,up);
  }
  this.gateButton=document.createElement('button');
  this.gateButton.type='button';this.gateButton.className='castle-enter';
  this.gateButton.textContent='Войти в замок · E';this.gateButton.hidden=true;
  this.gateButton.addEventListener('click',()=>{if(this.canEnter())this.enter()});
  document.body.append(this.gateButton);
 }
 installInput(){
  const control=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown',
   'ArrowLeft','ArrowRight','KeyE','Escape','ShiftLeft','ShiftRight'];
  this.down=e=>{
   if(!this.active||!control.includes(e.code))return;
   e.preventDefault();e.stopImmediatePropagation();this.keys.add(e.code);
   if(!e.repeat&&(e.code==='Escape'||e.code==='KeyE'&&castleNearExit(this.pos.x,this.pos.z)))
    this.leave();
  };
  this.up=e=>{
   if(!this.active||!control.includes(e.code))return;
   this.keys.delete(e.code);e.preventDefault();e.stopImmediatePropagation();
  };
  this.blur=()=>this.keys.clear();
  window.addEventListener('keydown',this.down,true);
  window.addEventListener('keyup',this.up,true);
  window.addEventListener('blur',this.blur);
  document.addEventListener('visibilitychange',this.blur);
 }
 syncGate(spot){
  if(!spot||spot._nativeInterior)return;
  spot._nativeInterior=true;spot.label='войти в замок';
  spot.action='use';spot.need=()=>true;spot.use=()=>this.enter();
 }
 updateGateUi(near){this.gateButton.hidden=this.active||!near||!this.canEnter()}
 enter(){
  if(this.active)return;
  this.active=true;this.frame=0;this.pos={...CASTLE_SPAWN};
  this.keys.clear();this.ui.hidden=false;this.gateButton.hidden=true;
  document.getElementById('c').style.visibility='hidden';
  document.querySelector('.hud')?.classList.add('castle-interior-hidden');
  document.querySelector('.stats')?.classList.add('castle-interior-hidden');
  this.renderer.domElement.style.visibility='visible';
 }
 leave(){
  if(!this.active)return;
  this.active=false;this.keys.clear();this.ui.hidden=true;
  document.getElementById('c').style.visibility='visible';
  document.querySelector('.hud')?.classList.remove('castle-interior-hidden');
  document.querySelector('.stats')?.classList.remove('castle-interior-hidden');
  this.onLeave?.();
 }
 update(dt){
  if(!this.active)return;
  const has=(...codes)=>codes.some(c=>this.keys.has(c));
  let x=0,z=0;
  if(has('KeyA','ArrowLeft'))x--;
  if(has('KeyD','ArrowRight'))x++;
  if(has('KeyW','ArrowUp'))z--;
  if(has('KeyS','ArrowDown'))z++;
  if(x||z){
   const speed=has('ShiftLeft','ShiftRight')?11:6.7;
   const step=Math.min(.08,Math.max(0,dt))*speed/Math.hypot(x,z);
   this.pos=castleMove(this.pos,x*step,z*step);
   this.avatar.rotation.y=Math.atan2(x,-z);
  }
  this.avatar.position.set(this.pos.x,0,this.pos.z);
  this.roomLabel.textContent=castleLocation(this.pos.x,this.pos.z);
  this.leaveButton.hidden=!castleNearExit(this.pos.x,this.pos.z);
 }
 render(){
  if(!this.active)return;
  const w=Math.max(1,window.innerWidth),h=Math.max(1,window.innerHeight),aspect=w/h;
  const span=w<650?29:37;
  this.camera.left=-span*aspect/2;this.camera.right=span*aspect/2;
  this.camera.top=span/2;this.camera.bottom=-span/2;this.camera.updateProjectionMatrix();
  this.camera.position.set(this.pos.x+20,33,this.pos.z+24);
  this.camera.lookAt(this.pos.x,0,this.pos.z);
  this.renderer.setRenderTarget(null);
  this.renderer.setViewport(0,0,w,h);this.renderer.setScissorTest(false);
  this.renderer.clear(true,true,true);
  this.renderer.render(this.scene,this.camera);this.frame++;
 }
 get stats(){return{active:this.active,frames:this.frame,x:this.pos.x,z:this.pos.z,
  room:castleLocation(this.pos.x,this.pos.z),rooms:CASTLE_ROOMS.length,
  exitNearby:castleNearExit(this.pos.x,this.pos.z),usesNativeRenderer:true}}
 dispose(){
  this.leave();this.gateButton.remove();this.ui.remove();
  window.removeEventListener('keydown',this.down,true);
  window.removeEventListener('keyup',this.up,true);
  window.removeEventListener('blur',this.blur);
  document.removeEventListener('visibilitychange',this.blur);
  this.scene.traverse(o=>o.geometry?.dispose());
  for(const mat of Object.values(this.mat))mat.dispose();this.scene.clear();
 }
}
