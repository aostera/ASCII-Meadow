import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const $=x=>document.getElementById(x);
const root=$('viewer');
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,matchMedia('(max-width:700px)').matches?1.35:2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.25;
root.append(renderer.domElement);
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x101015);
const camera=new THREE.PerspectiveCamera(35,1,.05,60);
const starting=matchMedia('(max-width:700px)').matches?[2.3,1.95,4.4]:[2.15,1.72,3.65];
camera.position.set(...starting);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.08;
controls.target.set(0,1.04,0);controls.minDistance=.65;controls.maxDistance=13;
controls.maxPolarAngle=Math.PI*.95;controls.update();
scene.add(new THREE.HemisphereLight(0xf3e8dc,0x46414e,2.7));
const light=(col,power,loc)=>{const l=new THREE.DirectionalLight(col,power);l.position.set(...loc);scene.add(l)};
light(0xffffff,3.2,[-3,7,5]);light(0xa5a5c5,1.5,[3,3,4]);light(0xa57565,2,[0,5,-4]);
const floor=new THREE.Mesh(new THREE.CircleGeometry(1.22,72),new THREE.MeshStandardMaterial({color:0x24232a,roughness:1}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.024;scene.add(floor);
const ring=new THREE.Mesh(new THREE.TorusGeometry(1.19,.007,7,100),new THREE.MeshStandardMaterial({color:0x796061,metalness:.65,roughness:.6}));
ring.rotation.x=-Math.PI/2;ring.position.y=-.02;scene.add(ring);
let model=null,wire=false;
const asset='./assets/ashen-vow/ashen_vow_tripo_mobile.glb';
new GLTFLoader().load(asset,gltf=>{
 model=gltf.scene;scene.add(model);
 let faces=0,meshes=0;
 model.traverse(o=>{if(o.isMesh){meshes++;faces+=o.geometry.index?o.geometry.index.count/3:o.geometry.attributes.position.count/3;o.frustumCulled=false;}});
 $('status').textContent='3D-модель загружена: '+Math.round(faces).toLocaleString('ru-RU')+' треугольников.';
 window.__TRIPO_VIEW__={ready:true,meshCount:meshes,triangles:faces,isGameCharacter:false,fromTripo:true};
}, e=>{
 if(e?.total>0)$('status').textContent='Загрузка модели: '+Math.round(e.loaded/e.total*100)+'%';
},error=>{
 $('status').textContent='Не удалось загрузить GLB: '+(error?.message||String(error))+
   '. Попробуй скачать оригинал из GitHub Actions.';
 window.__TRIPO_VIEW__={ready:false,error:String(error)};
});
function look(pos){camera.position.set(...pos);controls.target.set(0,1.04,0);controls.update()}
$('front').onclick=()=>look([0,1.3,3.6]);
$('side').onclick=()=>look([3.6,1.3,0]);
$('back').onclick=()=>look([0,1.3,-3.6]);
$('reset').onclick=()=>look(starting);
$('turn').onclick=()=>{
 controls.autoRotate=!controls.autoRotate;controls.autoRotateSpeed=.7;
 $('turn').classList.toggle('active',controls.autoRotate);
};
$('wire').onclick=()=>{
 wire=!wire;$('wire').classList.toggle('active',wire);
 model?.traverse(o=>{if(o.isMesh){const m=Array.isArray(o.material)?o.material:[o.material];m.forEach(x=>x.wireframe=wire);}});
};
const fit=()=>{
 const w=root.clientWidth,h=root.clientHeight;
 if(!w||!h)return;
 camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
};
window.addEventListener('resize',fit);fit();
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera)});
