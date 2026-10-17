// Navigable castle interior on the existing native Three WebGL2 renderer.
// Cutaway Gothic stone rooms: true gate, two tower corridors and side chambers.
// Native-only. Source map, production castle and character atlas are untouched.
import * as THREE from 'three';
import {CASTLE_ROOMS,CASTLE_UPPER_ROOMS,CASTLE_UPPER_HEIGHT,CASTLE_STAIRS,CASTLE_SPAWN,castleMove,castleLocation,castleNearExit,castleNearbyStair} from './castle-interior-layout.mjs';

export class CastleInterior{
 constructor(renderer,{onLeave,canEnter}){
  this.renderer=renderer;this.canEnter=canEnter;this.onLeave=onLeave;
  this.active=false;this.frame=0;this.pos={...CASTLE_SPAWN};
  this.level=0;this.y=0;this.transition=null;this.moving=false;this.walkPhase=0;
  this.keys=new Set();
  // Native glyph backend explicitly outputs LINEAR RGB to preserve its
  // authored source pixels. Material hex colours would be converted from
  // sRGB a second time and become nearly black, so specify linear channels.
  const linear=hex=>new THREE.Color().setRGB(
    ((hex>>16)&255)/255,((hex>>8)&255)/255,(hex&255)/255,
    THREE.LinearSRGBColorSpace);
  this.scene=new THREE.Scene();this.scene.background=linear(0x0b0e10);
  this.scene.fog=new THREE.Fog(linear(0x0b0e10),43,95);
  this.scene.add(new THREE.HemisphereLight(linear(0xaab6bb),linear(0x303639),1.55));
  const sun=new THREE.DirectionalLight(linear(0xc5ccd0),1.15);
  sun.position.set(-18,36,25);this.scene.add(sun);
  this.camera=new THREE.OrthographicCamera(-18,18,18,-18,.1,180);
  this.group=new THREE.Group();this.scene.add(this.group);
  this.upperGroup=new THREE.Group();this.group.add(this.upperGroup);
  this.upperGroup.visible=false;
  const palette={floor:0x292c2e,wall:0x4c4e4e,rib:0x63686a,iron:0x293033,
   stone:0x737a7c,black:0x14181b};
  this.mat={};for(const [name,color]of Object.entries(palette))
   this.mat[name]=new THREE.MeshLambertMaterial({
    color:linear(color),flatShading:true});
  // Cold light only: pale moonlight and ash-blue braziers, no orange/red.
  this.lampMat=new THREE.MeshBasicMaterial({color:linear(0x8cabb3)});
  this.lights=[];
  this.build();this.initUi();this.installInput();
 }
 box(x,y,z,w,h,d,mat='wall',parent=this.group){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),this.mat[mat]);
  mesh.position.set(x,y,z);parent.add(mesh);return mesh;
 }
 xWall(x,z0,z1,h=7){this.box(x,h/2,(z0+z1)/2,.85,h,z1-z0)}
 zWall(z,x0,x1,h=7){this.box((x0+x1)/2,h/2,z,x1-x0,h,.85)}
 arch(x,z,alongX,half,h=7){
  // Two true, connected pointed voussoir beams, each springing from the
  // wall jamb and meeting at one apex. No floating zigzag ornament.
  if(h<4)return; // near-camera cutaway walls intentionally have no crown
  const peak=new THREE.Vector3(x,h-.05,z);
  for(const side of [-1,1]){
   const spring=new THREE.Vector3(
     alongX?x+side*half:x,h-2.5,alongX?z:z+side*half);
   const delta=new THREE.Vector3().subVectors(peak,spring);
   const b=new THREE.Mesh(new THREE.BoxGeometry(.6,delta.length(),.68),this.mat.rib);
   b.position.copy(peak).add(spring).multiplyScalar(.5);
   b.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
   this.group.add(b);
  }
 }
 xOpen(x,z0,z1,holes,h=7){
  let last=z0;for(const [a,b]of holes){
   if(a>last)this.xWall(x,last,a,h);
   this.arch(x,(a+b)/2,false,(b-a)/2,h);last=b;
  }if(last<z1)this.xWall(x,last,z1,h);
 }
 zOpen(z,x0,x1,holes,h=7){
  let last=x0;for(const [a,b]of holes){
   if(a>last)this.zWall(z,last,a,h);
   this.arch((a+b)/2,z,true,(b-a)/2,h);last=b;
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
  // Twelve genuine helical treads leading to the playable upper tower;
  // E by the stair animates the player's climb to the next level.
  for(let i=0;i<12;i++){
   const a=i*Math.PI*1.84/11+(reverse?Math.PI:0);
   const b=this.box(cx+Math.cos(a)*1.95,.17+i*(CASTLE_UPPER_HEIGHT/12),
     cz+Math.sin(a)*1.95,1.7,.34,.82,i%4===0?'rib':'wall');
   b.rotation.y=-a;
  }
  this.box(cx,CASTLE_UPPER_HEIGHT/2,cz,.9,CASTLE_UPPER_HEIGHT, .9,'rib');
 }
 lamp(x,z,h=3.25){
  // One cold luminaire per space; keep light source count small for WebGL2 phones.
  const ember=new THREE.Mesh(new THREE.OctahedronGeometry(.22,0),this.lampMat);
  ember.position.set(x,h,z);this.group.add(ember);
  this.box(x,h-.42,z,.06,.9,.06,'iron');
  if(this.lights.length<5){
   const light=new THREE.PointLight(0xa0c0c9,.9,12,2);
   light.position.set(x,h,z);this.scene.add(light);this.lights.push(light);
  }
 }
 buildUpper(){
  // Two tower upper storeys and their adjacent stone galleries. Floors and
  // railings are real model geometry, but remain hidden on the ground floor
  // so a roof cannot obscure the player in this cutaway camera.
  for(const room of CASTLE_UPPER_ROOMS){
   const cx=(room.x0+room.x1)/2,cz=(room.z0+room.z1)/2;
   this.box(cx,CASTLE_UPPER_HEIGHT-.26,cz,
     room.x1-room.x0,.5,room.z1-room.z0,'floor',this.upperGroup);
   // Irregular, broad slabs rather than noisy high-poly tile textures.
   for(let z=Math.ceil(room.z0/5)*5;z<room.z1;z+=5)
    this.box(cx,CASTLE_UPPER_HEIGHT+.004,z,
     room.x1-room.x0,.02,.06,'black',this.upperGroup);
   const railY=CASTLE_UPPER_HEIGHT+.52;
   this.box(cx,railY,room.z0,.19,1.05,.2,'rib',this.upperGroup);
   this.box(cx,railY,room.z1,.19,1.05,.2,'rib',this.upperGroup);
  }
  for(const side of [-1,1]){
   const x=side*28.5;
   this.box(x,CASTLE_UPPER_HEIGHT+.75,0,.5,1.5,16,'wall',this.upperGroup);
   // An inner guardrail keeps the elevated walkway visually believable.
   this.box(side*11.5,CASTLE_UPPER_HEIGHT+.48,0,.2,.96,5,'rib',this.upperGroup);
   for(const z of [-6.5,6.5])
    this.box(side*23,CASTLE_UPPER_HEIGHT+.64,z,7,.3,.38,'rib',this.upperGroup);
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
  // Sparse, grounded details: keep the nave, doors and aisle unobstructed.
  for(const [x,z] of [[-9,-25],[9,-25],[-9,12],[9,12],[-25,5],[25,5]])
   this.lamp(x,z);
  for(const x of [-6.2,6.2]){
   this.box(x,2.7,-29,.48,5.4,.48,'rib');
   const finial=new THREE.Mesh(new THREE.ConeGeometry(.48,1.5,4),this.mat.stone);
   finial.position.set(x,5.65,-29);this.group.add(finial);
  }
  // Consistent wall tracery where there is real masonry, no fake passage.
  for(const x of [-10.52,10.52])for(const z of [-11,-3,5]){
   this.box(x,4.7,z,.2,2.3,.3,'black');
   this.box(x,6,z,.25,.24,.75,'rib');
  }
  this.buildUpper();
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
  this.legs=[];
  for(const x of [-.25,.25]){
   const leg=new THREE.Group();leg.position.set(x,1,0);
   this.box(0,-.46,0,.23,.92,.27,'iron',leg);
   this.box(0,-.93,-.13,.28,.16,.5,'black',leg);
   p.add(leg);this.legs.push(leg);
  }
  this.scene.add(p);
 }
 initUi(){
  const shell=document.createElement('section');
  shell.className='castle-interior-ui';shell.hidden=true;
  shell.setAttribute('aria-label','Внутренние помещения замка');
  shell.innerHTML='<div class="castle-interior-head">'+
   '<small>ASCII MEADOW / ЗАМОК · <b class="castle-interior-floor">I ЯРУС</b></small>'+
   '<strong class="castle-interior-room" aria-live="polite"></strong>'+
   '<span>WASD / стрелки — ходьба · Shift — бег · E — лестница / ворота · Esc — наружу</span></div>'+
   '<div class="castle-interior-pad" aria-label="Управление движением">'+
   '<button data-key="ArrowUp" aria-label="Вперёд">▲</button><div>'+
   '<button data-key="ArrowLeft" aria-label="Влево">◀</button>'+
   '<button data-key="ArrowDown" aria-label="Назад">▼</button>'+
   '<button data-key="ArrowRight" aria-label="Вправо">▶</button></div></div>'+
   '<button class="castle-interior-action" type="button" hidden></button>'+
   '<button class="castle-interior-leave">Вернуться во двор</button>';
  document.body.append(shell);this.ui=shell;
  this.roomLabel=shell.querySelector('.castle-interior-room');
  this.floorLabel=shell.querySelector('.castle-interior-floor');
  this.actionButton=shell.querySelector('.castle-interior-action');
  this.actionButton.addEventListener('click',()=>this.useNearby());
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
   if(!e.repeat&&(e.code==='Escape'||e.code==='KeyE'))
    this.useNearby(e.code==='Escape');
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
  spot.action='use';spot.need=()=>this.canEnter();
  spot.use=()=>{if(this.canEnter())this.enter()};
 }
 updateGateUi(near){this.gateButton.hidden=this.active||!near||!this.canEnter()}
 enter(){
  if(this.active)return;
  this.active=true;this.frame=0;this.pos={...CASTLE_SPAWN};
  this.level=0;this.y=0;this.transition=null;this.moving=false;
  this.upperGroup.visible=false;
  this.keys.clear();this.ui.hidden=false;this.gateButton.hidden=true;
  document.getElementById('c').style.visibility='hidden';
  document.querySelector('.hud')?.classList.add('castle-interior-hidden');
  document.querySelector('.stats')?.classList.add('castle-interior-hidden');
  this.renderer.domElement.style.visibility='visible';
 }
 leave(){
  if(!this.active)return;
  this.active=false;this.keys.clear();this.ui.hidden=true;
  this.transition=null;this.level=0;this.y=0;this.upperGroup.visible=false;
  document.getElementById('c').style.visibility='visible';
  document.querySelector('.hud')?.classList.remove('castle-interior-hidden');
  document.querySelector('.stats')?.classList.remove('castle-interior-hidden');
  this.onLeave?.();
 }
 stairAction(stair){
  if(!stair||this.transition)return false;
  const startY=this.y,targetLevel=1-this.level;
  this.transition={stair,from:this.level,to:targetLevel,fromY:startY,
    toY:targetLevel*CASTLE_UPPER_HEIGHT,t:0,
    start:{...this.pos}};
  this.keys.clear();
  // Make the upper landing appear before reaching it, but avoid hiding the
  // lower nave until the player actually starts climbing.
  this.upperGroup.visible=true;
  return true;
 }
 useNearby(forceLeave=false){
  if(!this.active)return false;
  if(forceLeave){this.leave();return true;}
  if(this.transition)return false;
  if(castleNearExit(this.pos.x,this.pos.z,this.level)){
   this.leave();return true;
  }
  return this.stairAction(castleNearbyStair(this.pos.x,this.pos.z,this.level));
 }
 update(dt){
  if(!this.active)return;
  const elapsed=Math.min(.08,Math.max(0,dt));
  if(this.transition){
   const tr=this.transition;
   tr.t=Math.min(1,tr.t+elapsed/1.15);
   const phase=tr.t;
   const smooth=phase*phase*(3-2*phase);
   this.y=tr.fromY+(tr.toY-tr.fromY)*smooth;
   const a=phase*Math.PI*1.9;
   const orbit={x:tr.stair.x+Math.cos(a)*1.35,z:tr.stair.z+Math.sin(a)*1.35};
   const join=Math.min(1,phase*3);
   this.pos={x:tr.start.x+(orbit.x-tr.start.x)*join,
     z:tr.start.z+(orbit.z-tr.start.z)*join};
   if(phase===1){
    this.level=tr.to;this.transition=null;
    this.pos={x:tr.stair.x+1.35,z:tr.stair.z};
    this.y=this.level*CASTLE_UPPER_HEIGHT;
    this.upperGroup.visible=this.level===1;
   }
  }else{
   const has=(...codes)=>codes.some(c=>this.keys.has(c));
   let x=0,z=0;
   if(has('KeyA','ArrowLeft'))x--;
   if(has('KeyD','ArrowRight'))x++;
   if(has('KeyW','ArrowUp'))z--;
   if(has('KeyS','ArrowDown'))z++;
   this.moving=!!(x||z);
   if(this.moving){
    const speed=has('ShiftLeft','ShiftRight')?11:6.7;
    const step=elapsed*speed/Math.hypot(x,z);
    this.pos=castleMove(this.pos,x*step,z*step,.55,this.level);
    this.avatar.rotation.y=Math.atan2(x,-z);
    this.walkPhase+=elapsed*speed*1.75;
   }
   this.y=this.level*CASTLE_UPPER_HEIGHT;
  }
  this.avatar.position.set(this.pos.x,this.y,this.pos.z);
  for(let i=0;i<this.legs.length;i++)
   this.legs[i].rotation.x=this.moving&&!this.transition
     ?Math.sin(this.walkPhase+Math.PI*i)*.36:0;
  this.roomLabel.textContent=castleLocation(this.pos.x,this.pos.z,this.level);
  this.floorLabel.textContent=this.level?'II ЯРУС':'I ЯРУС';
  const stair=this.transition?null:castleNearbyStair(this.pos.x,this.pos.z,this.level);
  const leave=castleNearExit(this.pos.x,this.pos.z,this.level);
  this.actionButton.hidden=!(stair||leave)||!!this.transition;
  if(stair)this.actionButton.textContent=this.level?
     'E · Спуститься по '+stair.label.toLowerCase():
     'E · Подняться по '+stair.label.toLowerCase();
  if(leave)this.actionButton.textContent='E · Выйти через ворота';
  this.leaveButton.hidden=!leave;
 }

 render(){
  if(!this.active)return;
  const w=Math.max(1,window.innerWidth),h=Math.max(1,window.innerHeight),aspect=w/h;
  const span=w<650?29:37;
  this.camera.left=-span*aspect/2;this.camera.right=span*aspect/2;
  this.camera.top=span/2;this.camera.bottom=-span/2;this.camera.updateProjectionMatrix();
  // Look slightly into the hall so the player stays in the lower third
  // instead of staring at the empty field outside the castle gate.
  const focusZ=this.pos.z-6.5;
  // Keep the existing native renderer resolution in sync after phone rotate,
  // without allocating a second WebGL context.
  const size=this.renderer.getSize(new THREE.Vector2());
  if(Math.abs(size.x-w)>.5||Math.abs(size.y-h)>.5)
   this.renderer.setSize(w,h,false);
  this.camera.position.set(this.pos.x+20,this.y+33,focusZ+24);
  this.camera.lookAt(this.pos.x,this.y,focusZ);
  this.renderer.setRenderTarget(null);
  this.renderer.setViewport(0,0,w,h);this.renderer.setScissorTest(false);
  this.renderer.clear(true,true,true);
  this.renderer.render(this.scene,this.camera);this.frame++;
 }
 get stats(){return{active:this.active,frames:this.frame,x:this.pos.x,z:this.pos.z,
  room:castleLocation(this.pos.x,this.pos.z,this.level),rooms:CASTLE_ROOMS.length,
  upperRooms:CASTLE_UPPER_ROOMS.length,level:this.level,
  height:this.y,transitioning:!!this.transition,
  stairNearby:castleNearbyStair(this.pos.x,this.pos.z,this.level)?.id||null,
  exitNearby:castleNearExit(this.pos.x,this.pos.z,this.level),usesNativeRenderer:true}}
 dispose(){
  this.leave();this.gateButton.remove();this.ui.remove();
  window.removeEventListener('keydown',this.down,true);
  window.removeEventListener('keyup',this.up,true);
  window.removeEventListener('blur',this.blur);
  document.removeEventListener('visibilitychange',this.blur);
  this.scene.traverse(o=>o.geometry?.dispose());
  for(const mat of Object.values(this.mat))mat.dispose();
  this.lampMat.dispose();this.scene.clear();
 }
}
