// Preview-only: sculpt-based Hunyuan3D GLB with faithful concept details from owner-approved
// front/side/back art. Not the rejected 3D primitive or glyph bubble.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const ASSET="https://d2ol7oe51mr4n9.cloudfront.net/user_3DREk3h2KN9SwfHIFei2XoVxjD4/2dbd388d-14db-478a-8527-b8f74dd083ee.glb";
const $=id=>document.getElementById(id);
const stage=$('stage');let renderer;
try{
 renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.7;
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,matchMedia('(max-width:690px)').matches?1.4:2));
 stage.appendChild(renderer.domElement);
}catch(err){$('fail').style.display='flex';throw err}
const scene=new THREE.Scene();scene.background=new THREE.Color(0x111115);
scene.fog=new THREE.FogExp2(0x121217,.075);
const camera=new THREE.PerspectiveCamera(36,1,.05,70);
const resetPosition=matchMedia('(max-width:690px)').matches?[2.25,2.02,4.65]:[2.25,1.88,3.5];
camera.position.set(...resetPosition);
const orbit=new OrbitControls(camera,renderer.domElement);
orbit.target.set(0,1.03,0);orbit.enableDamping=true;
orbit.dampingFactor=.07;orbit.minDistance=.9;orbit.maxDistance=12;
orbit.maxPolarAngle=Math.PI*.93;orbit.update();
scene.add(new THREE.HemisphereLight(0xd6d1ce,0x4b454b,3.1));
const key=new THREE.DirectionalLight(0xffe3d2,4.0);key.position.set(-2,6,5);scene.add(key);
const frontFill=new THREE.DirectionalLight(0xa6bcd7,2.0);frontFill.position.set(4,3,4);scene.add(frontFill);
const backFill=new THREE.DirectionalLight(0xb78b87,3.5);backFill.position.set(0,4,-4);scene.add(backFill);
const plinth=new THREE.Mesh(new THREE.CylinderGeometry(1.26,1.32,.11,48),
 new THREE.MeshStandardMaterial({color:0x292529,roughness:.94,metalness:.1}));
plinth.position.y=-.092;scene.add(plinth);
const ring=new THREE.Mesh(new THREE.TorusGeometry(1.18,.011,7,96),
 new THREE.MeshStandardMaterial({color:0x8f665a,metalness:.7,roughness:.52}));
ring.rotation.x=-Math.PI/2;ring.position.y=-.028;scene.add(ring);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),
 new THREE.MeshStandardMaterial({color:0x121115,roughness:1}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.151;scene.add(floor);
let model=null,originalMaterials=new Map(),wire=false,naked=false;
const grey=new THREE.MeshStandardMaterial({color:0x999398,metalness:.37,roughness:.68,side:THREE.DoubleSide});
function repaint(){
 if(!model)return;
 model.traverse(o=>{
  if(!o.isMesh)return;
  const original=originalMaterials.get(o);
  o.material=naked?grey:original;
  if(Array.isArray(o.material)){for(const m of o.material)m.wireframe=wire}
  else o.material.wireframe=wire;
 });
}
const loader=new GLTFLoader();
loader.load(ASSET,gltf=>{
 model=gltf.scene;
 scene.add(model);
 let meshes=0,triangles=0;
 model.traverse(o=>{
  if(!o.isMesh)return;
  meshes++;
  if(o.material)originalMaterials.set(o,o.material);
  triangles+=o.geometry.index?o.geometry.index.count/3:o.geometry.attributes.position.count/3;
  o.frustumCulled=false;
 });
 repaint();
 $('load').textContent='GLB загружен · '+Math.round(triangles).toLocaleString('ru-RU')+' треугольников, '+meshes+' деталей';
 window.__ASHEN_REFERENCE__={ready:true,meshCount:meshes,triangles,gameIntegrated:false,hasRig:false,model};
},e=>{
 if(e?.total>0)$('load').textContent='Загрузка GLB '+Math.round(e.loaded/e.total*100)+'%';
},e=>{
 $('load').textContent='Ошибка загрузки GLB: '+String(e?.message||e);
 $('fail').style.display='flex';
});
function cam(pos){camera.position.set(...pos);orbit.target.set(0,1.03,0);orbit.update()}
$('front').onclick=()=>cam([0,1.30,4]);
$('side').onclick=()=>cam([4,1.30,0]);
$('back').onclick=()=>cam([0,1.30,-4]);
$('reset').onclick=()=>cam(resetPosition);
$('orbit').onclick=()=>{
 orbit.autoRotate=!orbit.autoRotate;orbit.autoRotateSpeed=.8;
 $('orbit').classList.toggle('active',orbit.autoRotate);
};
$('texture').onclick=()=>{
 naked=!naked;$('texture').classList.toggle('active',naked);
 $('texture').textContent=naked?'Текстуры':'Без текстур';
 repaint();
};
$('wire').onclick=()=>{wire=!wire;$('wire').classList.toggle('active',wire);repaint()};
$('closer').onclick=()=>{camera.position.sub(orbit.target).multiplyScalar(.81).add(orbit.target);orbit.update()};
$('farther').onclick=()=>{camera.position.sub(orbit.target).multiplyScalar(1.22).add(orbit.target);orbit.update()};
window.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='r')$('reset').click()});
const resize=()=>{
 const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;
 camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
};
window.addEventListener('resize',resize);window.addEventListener('orientationchange',resize);
resize();
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();$('fail').style.display='flex'});
renderer.domElement.addEventListener('webglcontextrestored',()=>{$('fail').style.display='none';resize()});
function draw(){requestAnimationFrame(draw);orbit.update();renderer.render(scene,camera)}
draw();
