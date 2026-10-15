// ASCII Meadow / Ashen Vow — stand-alone articulated skeleton demonstration.
// Original 3D skeleton with two-bone IK and volumetric armor/cloth made from glyphs.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {makeGlyphShell} from './ashen-glyph-shell.mjs';
const $=id=>document.getElementById(id);
const stage=$('stage');
let renderer;
try{
 renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,matchMedia('(max-width:690px)').matches?1.35:1.75));
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.35;stage.appendChild(renderer.domElement);
}catch(e){$('fail').style.display='grid';throw e;}
const scene=new THREE.Scene();scene.background=new THREE.Color(0x0d0c10);
scene.fog=new THREE.Fog(0x0d0c10,7,15);
const camera=new THREE.PerspectiveCamera(38,1,.06,70);camera.position.set(2.8,2.03,4.6);
const controls=new OrbitControls(camera,renderer.domElement);
controls.target.set(0,1.035,0);controls.enableDamping=true;controls.dampingFactor=.075;
controls.minDistance=1.2;controls.maxDistance=9;controls.maxPolarAngle=Math.PI*.89;
scene.add(new THREE.HemisphereLight(0xabb1be,0x3a2830,2.4));
const key=new THREE.DirectionalLight(0xffe4cb,3.1);key.position.set(-3,6,4);scene.add(key);
const rim=new THREE.DirectionalLight(0xbc5b62,2.7);rim.position.set(1.5,3,-4);scene.add(rim);
const floor=new THREE.Mesh(new THREE.CylinderGeometry(1.30,1.34,.11,48),
 new THREE.MeshStandardMaterial({color:0x242126,roughness:.98,metalness:.15}));
floor.position.y=-.08;scene.add(floor);
const rimMesh=new THREE.Mesh(new THREE.TorusGeometry(1.245,.008,8,72),
 new THREE.MeshStandardMaterial({color:0x9c7760,metalness:.75,roughness:.45}));
rimMesh.position.y=-.018;rimMesh.rotation.x=-Math.PI/2;scene.add(rimMesh);
const grid=new THREE.GridHelper(10,32,0x272229,0x1d1b20);grid.position.y=-.145;scene.add(grid);
const actor=new THREE.Group();actor.name='ASHEN_VOW_ORIGINAL_SKELETON';scene.add(actor);
const bones={};
function joint(name,parent=actor,position=[0,0,0]){
 const n=new THREE.Group();n.name='JOINT_'+name;n.position.set(...position);
 parent.add(n);bones[name]=n;return n;
}
const hips=joint('hips',actor,[0,1.02,0]);
const spine=joint('spine',hips,[0,.13,0]);
const neck=joint('neck',spine,[0,.505,0]);
joint('head',neck,[0,.075,0]);
for(const s of ['L','R']){
 joint('thigh'+s);joint('shin'+s);joint('foot'+s);
 joint('upper'+s);joint('fore'+s);joint('hand'+s);
}
joint('weapon',bones.handR,[0,-.02,.105]);
joint('tabard',spine,[0,-.079,.179]);
for(let i=0;i<11;i++)joint('cape'+i,spine,[((i-5)/5)*.308,.410,-.193]);
const shell=makeGlyphShell(THREE,scene,bones);
const debugMaterial=new THREE.LineBasicMaterial({color:0x81ead8,depthTest:false,transparent:true,opacity:.95});
const paths=[
 ['hips','spine'],['spine','neck'],['neck','head'],
 ['hipL','kneeL'],['kneeL','ankleL'],['hipR','kneeR'],['kneeR','ankleR'],
 ['shoulderL','elbowL'],['elbowL','wristL'],['shoulderR','elbowR'],['elbowR','wristR'],
 ['wristR','tip']
];
const debugGeometry=new THREE.BufferGeometry();
const debugNumbers=new Float32Array(paths.length*6);
debugGeometry.setAttribute('position',new THREE.BufferAttribute(debugNumbers,3).setUsage(THREE.DynamicDrawUsage));
const skeleton=new THREE.LineSegments(debugGeometry,debugMaterial);
skeleton.frustumCulled=false;skeleton.visible=false;skeleton.renderOrder=9;scene.add(skeleton);
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const D=V(0,-1,0),scratch=V(0,0,0),coords={};
function orient(bone,start,end){
 bone.position.copy(start);
 const q=end.clone().sub(start);
 if(q.lengthSq()>1e-8)bone.quaternion.setFromUnitVectors(D,q.normalize());
}
function solveIK(start,end,length1,length2,pole){
 const delta=end.clone().sub(start),distance=Math.max(.0001,delta.length()),
  reach=Math.min(distance,length1+length2-.001),
  direction=delta.normalize(),
  offset=(length1*length1-length2*length2+reach*reach)/(2*reach);
 let side=pole.clone().sub(direction.clone().multiplyScalar(pole.dot(direction)));
 if(side.lengthSq()<1e-6)side=V(0,0,1);
 side.normalize();
 const height=Math.sqrt(Math.max(0,length1*length1-offset*offset));
 return start.clone().addScaledVector(direction,offset).addScaledVector(side,height);
}
function smoother(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);}
function footAt(f,run){
 const p=((f%1)+1)%1,stance=run?.49:.63,
 step=run?.315:.228,raise=run?.20:.115;
 if(p<stance)return {z:step*(.5-p/stance),y:.12};
 const t=(p-stance)/(1-stance);
 return {z:step*(smoother(t)-.5),y:.12+raise*Math.sin(Math.PI*t)};
}
function remember(key,point){
 coords[key]=point.clone().applyMatrix4(actor.matrixWorld);
}
const variants=['idle','walk','run','jump','attack','crouch','salute','turn'];
const metrics={transforms:0,groundChecks:0},UP=V(0,0,1);
let current='idle',frame=0,playing=true,speed=1,playtime=0;
function pose(t){
 const walking=current==='walk'||current==='run',run=current==='run';
 const cycles=run?2:1,phase=t*cycles,phaseR=2*Math.PI*phase;
 const jump=current==='jump'?Math.pow(Math.max(0,Math.sin(t*Math.PI)),1.22)*.42:0;
 let crouch=0,attack=0,salute=0;
 if(current==='jump')crouch=.075*Math.sin(t*Math.PI)**2;
 if(current==='crouch')crouch=.34*smoother(t*5)*smoother((1-t)*5);
 if(current==='attack')attack=Math.sin(Math.PI*smoother((t-.07)/.78))**2;
 if(current==='salute')salute=Math.sin(Math.PI*smoother(t))**2;
 actor.position.y=jump;actor.rotation.y=current==='turn'?Math.PI*2*t:0;
 hips.position.set(0,1.02-crouch+(walking?.016*Math.cos(phaseR*2):.007*Math.sin(t*2*Math.PI)),0);
 hips.rotation.set(0,0,walking?.012*Math.sin(phaseR):0);
 spine.position.set(0,.13,0);
 spine.rotation.set(run?.11:attack?-.1*attack:current==='crouch'?.13*smoother(t*5)*smoother((1-t)*5):0,
 0,walking?.02*Math.sin(phaseR):.13*attack);
 neck.rotation.set(salute*.15,0,0);
 bones.head.rotation.set(0,0,.012*Math.sin(t*Math.PI*2));
 actor.updateMatrixWorld(true);
 const rooted=p=>actor.worldToLocal(spine.localToWorld(p.clone()));
 remember('hips',V(0,hips.position.y,0));
 remember('spine',V(0,hips.position.y+.13,0));
 remember('neck',rooted(V(0,.505,0)));
 remember('head',rooted(V(0,.58,0)));
 for(const [side,s] of [['L',-1],['R',1]]){
  const stride=walking?footAt(phase+(side==='L'?0:.5),run):{z:side==='L'?.035:-.035,y:.12};
  const socket=V(s*.144,hips.position.y-.055,0);
  const ankle=V(s*.16,stride.y,stride.z);
  if(attack)ankle.z+=(s===1?-.086:.128)*attack;
  if(current==='jump'){ankle.y=.17;ankle.z+=s*.045;}
  const knee=solveIK(socket,ankle,.445,.445,UP);
  orient(bones['thigh'+side],socket,knee);
  orient(bones['shin'+side],knee,ankle);
  bones['foot'+side].position.copy(ankle);
  bones['foot'+side].rotation.set(walking?.075*Math.sin(phaseR+(side==='R'?Math.PI:0)):0,0,0);
  remember('hip'+side,socket);remember('knee'+side,knee);remember('ankle'+side,ankle);
  const shoulder=rooted(V(s*.335,.364,.0));
  const wrist=V(s*.397,shoulder.y-.56,.06);
  if(walking)wrist.z+=Math.sin(phaseR+(side==='L'?Math.PI:0))*(run?.19:.115);
  if(current==='jump'){wrist.y+=.12*Math.sin(t*Math.PI);wrist.z+=.06;}
  if(current==='attack'&&s===1){
    const target=V(.23,shoulder.y+.14,.39);
    wrist.lerp(target,attack);
  }
  if(current==='salute'&&s===1){
    const target=V(.18,shoulder.y+.22,.30);wrist.lerp(target,salute);
  }
  const elbow=solveIK(shoulder,wrist,.345,.34,V(s*.9,-.06,.2));
  orient(bones['upper'+side],shoulder,elbow);
  orient(bones['fore'+side],elbow,wrist);
  bones['hand'+side].position.copy(wrist);
  bones['hand'+side].quaternion.copy(bones['fore'+side].quaternion);
  remember('shoulder'+side,shoulder);remember('elbow'+side,elbow);remember('wrist'+side,wrist);
 }
 bones.weapon.rotation.set(-attack*1.1,0,attack*.21);
 bones.tabard.rotation.set((walking?(run?.14:.08):0)+.05*Math.sin(t*2*Math.PI),0,0);
 for(let i=0;i<11;i++){
  const side=(i-5)/5,flap=Math.sin(phaseR*(walking?(run?1.5:1):.5)-i*.28);
  const b=bones['cape'+i];
  b.rotation.set(-.045-(walking?(run?.27:.16):.024)*(1+.35*flap)-jump*.28,
   side*.02,side*(.015+.045*flap));
 }
 actor.updateMatrixWorld(true);
 remember('tip',actor.worldToLocal(bones.weapon.localToWorld(V(0,-.94,0))));
 let i=0;
 for(const [a,b] of paths){
  const A=coords[a],B=coords[b];if(!A||!B)continue;
  debugNumbers.set([A.x,A.y,A.z,B.x,B.y,B.z],i);i+=6;
 }
 debugGeometry.attributes.position.needsUpdate=true;
 shell.update();
 metrics.transforms++;
}
function setClip(name){
 if(!variants.includes(name))return;
 current=name;frame=0;playtime=0;playing=true;
 for(const b of document.querySelectorAll('[data-clip]'))b.classList.toggle('active',b.dataset.clip===name);
 $('frame').value=0;$('frameOut').textContent='1 / 60';$('pause').textContent='Пауза';
 pose(0);
}
$('clips').onclick=e=>{const b=e.target.closest('[data-clip]');if(b)setClip(b.dataset.clip);};
$('pause').onclick=()=>{playing=!playing;$('pause').textContent=playing?'Пауза':'Продолжить';};
$('skeleton').onclick=()=>{skeleton.visible=!skeleton.visible;
 $('skeleton').classList.toggle('active',skeleton.visible);};
$('spin').onclick=()=>{controls.autoRotate=!controls.autoRotate;
 $('spin').classList.toggle('active',controls.autoRotate);};
$('reset').onclick=()=>{camera.position.set(2.8,2.03,4.6);controls.target.set(0,1.035,0);controls.update();};
$('frame').oninput=e=>{
 playing=false;$('pause').textContent='Продолжить';frame=Number(e.target.value);
 playtime=frame/30;$('frameOut').textContent=(frame+1)+' / 60';pose(frame/59);
};
$('speed').oninput=e=>{
 speed=Number(e.target.value)/100;$('speedOut').textContent=speed.toFixed(1)+'×';
};
for(const [id,p] of [['front',[0,1.5,4]],['side',[4,1.5,0]],['back',[0,1.5,-4]]]){
 $(id).onclick=()=>{camera.position.set(...p);controls.target.set(0,1.04,0);controls.update();};
}
window.addEventListener('keydown',e=>{
 if(e.code==='Space'&&!['BUTTON','INPUT'].includes(e.target.tagName)){e.preventDefault();$('pause').click();}
});
const resize=()=>{
 const w=stage.clientWidth,h=stage.clientHeight;
 if(w<1||h<1)return;
 camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
};
window.addEventListener('resize',resize);window.addEventListener('orientationchange',resize);
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();$('fail').style.display='grid';});
renderer.domElement.addEventListener('webglcontextrestored',()=>{$('fail').style.display='none';resize();});
resize();pose(0);
let last=performance.now(),counter=0;
function draw(now){
 requestAnimationFrame(draw);
 let dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
 if(playing){playtime=(playtime+dt*speed)%2;frame=Math.min(59,Math.floor(playtime*30));pose(frame/59);}
 if(++counter%3===0&&playing){$('frame').value=frame;$('frameOut').textContent=(frame+1)+' / 60';}
 controls.update();renderer.render(scene,camera);
}
requestAnimationFrame(draw);
window.__ASHEN_GLYPH_RIG__={
 version:'glyph-skeleton-poc-1',gameIntegrated:false,scene,model:actor,
 bones,samples:shell.glyphCount,clipNames:variants,framesPerClip:60,metrics,
 choose:setClip,pose,
 get clip(){return current;},get frame(){return frame;},
 get boneCount(){return Object.keys(bones).length;},
 get ready(){return shell.glyphCount>2300&&Object.keys(bones).length>=28;},
 get debugVisible(){return skeleton.visible;},
 get samplesWorld(){return shell.mesh.geometry.attributes.aWorld.array;}
};
