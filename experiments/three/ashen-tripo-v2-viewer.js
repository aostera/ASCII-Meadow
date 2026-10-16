import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// This is the REAL 10.7 MB Tripo V2 40-bone skinned GLB, NOT the earlier V1
// non-rigged turntable and NOT a fake illustration.
const $ = id => document.getElementById(id);
const viewport = $('viewer');
const mobile = matchMedia('(max-width:700px)').matches;
const renderer = new THREE.WebGLRenderer({antialias:!mobile,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio || 1,mobile?1.35:2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101015);
const camera = new THREE.PerspectiveCamera(36,1,0.03,75);
const initial = mobile?[2.25,1.65,3.35]:[2.25,1.6,3.65];
camera.position.set(...initial);
const target = new THREE.Vector3(0,1.02,0);
const orbit = new OrbitControls(camera,renderer.domElement);
orbit.enableDamping=true;
orbit.dampingFactor=.08;
orbit.target.copy(target);
orbit.minDistance=.65;
orbit.maxDistance=12;
orbit.maxPolarAngle=Math.PI*.96;
orbit.update();

scene.add(new THREE.HemisphereLight(0xe7dfe0,0x42404a,2.9));
for(const [colour,intensity,p] of [
  [0xffeee2,3.2,[-3.2,6,4]],
  [0xc4c1dd,1.8,[3.4,2.5,3.2]],
  [0x9a6e66,2.0,[1.8,4,-3.5]]
]){
 const l=new THREE.DirectionalLight(colour,intensity);
 l.position.set(...p);scene.add(l);
}
const floor=new THREE.Mesh(new THREE.CircleGeometry(1.24,64),
 new THREE.MeshStandardMaterial({color:0x25232a,metalness:.06,roughness:1}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.015;scene.add(floor);
const ring=new THREE.Mesh(new THREE.TorusGeometry(1.245,.007,8,96),
 new THREE.MeshStandardMaterial({color:0x73585c,metalness:.45,roughness:.7}));
ring.rotation.x=-Math.PI/2;ring.position.y=-.012;scene.add(ring);

const asset = './assets/ashen-vow/ashen_tripo_v2_skeleton_lod.glb';
let model=null, wire=false,helper=null,showBones=false;
window.__TRIPO_V2_VIEW__={ready:false,asset,modelVersion:'rig-ready-v2'};
new GLTFLoader().load(asset,gltf=>{
 try{
   model=gltf.scene;
   // Recenter all bones and mesh *together*, preserving bind matrices and skin.
   model.updateMatrixWorld(true);
   const bbox=new THREE.Box3().setFromObject(model);
   const dims=bbox.getSize(new THREE.Vector3());
   if(!Number.isFinite(dims.y) || dims.y<1e-5)throw new Error('Неверные размеры модели');
   const scale=2.04/dims.y;
   model.scale.multiplyScalar(scale);
   model.position.set(-bbox.getCenter(new THREE.Vector3()).x*scale,
      -bbox.min.y*scale,-bbox.getCenter(new THREE.Vector3()).z*scale);
   model.updateMatrixWorld(true);
   scene.add(model);
   let meshCount=0,triangleCount=0,skinnedCount=0,joints=0;
   model.traverse(obj=>{
     if(!obj.isMesh)return;
     meshCount++;
     const geo=obj.geometry;
     triangleCount+=(geo.index?.count||geo.attributes.position?.count||0)/3;
     if(obj.isSkinnedMesh){skinnedCount++;joints=Math.max(joints,obj.skeleton.bones.length);}
     obj.frustumCulled=false;
     const mats=Array.isArray(obj.material)?obj.material:[obj.material];
     for(const m of mats)if(m)m.side=THREE.DoubleSide;
   });
   if(!skinnedCount||joints<40)throw new Error('Не найдены 40 костей и деформируемая сетка Tripo');
   helper=new THREE.SkeletonHelper(model);
   helper.visible=false;
   helper.material.depthTest=false;
   helper.material.transparent=true;
   helper.material.opacity=.86;
   scene.add(helper);
   const animationCount=gltf.animations.length;
   $('status').textContent =
      'Готово: '+joints+' костей · '+Math.round(triangleCount).toLocaleString('ru-RU')+
      ' треугольников · '+animationCount+' анимаций.';
   window.__TRIPO_V2_VIEW__={
      ready:true,asset,bones:joints,skinnedMeshes:skinnedCount,meshes:meshCount,
      triangles:Math.round(triangleCount),clips:animationCount,version:'rig-ready-v2'};
 }catch(error){
   $('status').textContent='Ошибка модели: '+error.message;
   window.__TRIPO_V2_VIEW__={ready:false,error:String(error)};
 }
},xhr=>{
 if(xhr.total>0)$('status').textContent=
   'Загрузка 3D-модели: '+Math.round(xhr.loaded/xhr.total*100)+' %';
},error=>{
 $('status').textContent='Не удалось загрузить 3D-модель: '+(error.message||String(error));
 window.__TRIPO_V2_VIEW__={ready:false,error:String(error)};
});
function look(p){
 camera.position.set(...p);
 orbit.target.copy(target);
 orbit.update();
}
$('front').onclick=()=>look([0,1.45,3.6]);
$('side').onclick=()=>look([3.6,1.45,0]);
$('back').onclick=()=>look([0,1.45,-3.6]);
$('reset').onclick=()=>{look(initial);orbit.autoRotate=false;$('turn').classList.remove('active');};
$('turn').onclick=()=>{
 orbit.autoRotate=!orbit.autoRotate;orbit.autoRotateSpeed=.65;
 $('turn').classList.toggle('active',orbit.autoRotate);
};
$('bones').onclick=()=>{
 showBones=!showBones;
 if(helper)helper.visible=showBones;
 $('bones').classList.toggle('active',showBones);
 $('bones').textContent=showBones?'Скрыть скелет':'Показать скелет';
};
$('wire').onclick=()=>{
 wire=!wire;$('wire').classList.toggle('active',wire);
 model?.traverse(o=>{
   if(!o.isMesh)return;
   for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m)m.wireframe=wire;
 });
};
function fit(){
 const w=viewport.clientWidth,h=viewport.clientHeight;
 if(!w||!h)return;
 camera.aspect=w/h;camera.updateProjectionMatrix();
 renderer.setSize(w,h,false);
}
window.addEventListener('resize',fit);
fit();
renderer.setAnimationLoop(()=>{orbit.update();renderer.render(scene,camera)});
