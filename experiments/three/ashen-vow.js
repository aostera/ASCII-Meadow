// The Ashen Vow: independent original THREE geometry + animation workshop.
// NOT imported by native.html or the main game. No third-party model assets.
// The artist-facing meshes and motions are intentionally inspectable before acceptance.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const stage=document.getElementById('stage');
const notice=document.getElementById('notice');
const $=id=>document.getElementById(id);
let renderer;
try {
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,matchMedia('(max-width:680px)').matches?1.6:2));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.32;
  stage.appendChild(renderer.domElement);
} catch(e) { notice.style.display='grid'; throw e; }
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x111114);
scene.fog=new THREE.FogExp2(0x151417,0.085);
const camera=new THREE.PerspectiveCamera(37,1,.04,80);
camera.position.set(2.85,2.05,4.6);
const controls=new OrbitControls(camera,renderer.domElement);
controls.target.set(0,1.05,0);
controls.enableDamping=true;
controls.dampingFactor=.075;
controls.minDistance=1.4;
controls.maxDistance=10;
controls.maxPolarAngle=Math.PI*.92;
controls.autoRotate=false;
controls.autoRotateSpeed=.7;
controls.update();
scene.add(new THREE.HemisphereLight(0xbcc1d0,0x292326,1.65));
const key=new THREE.DirectionalLight(0xffe5c9,3.15);
key.position.set(-3.2,6,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);
key.shadow.camera.left=-4;key.shadow.camera.right=4;
key.shadow.camera.top=4;key.shadow.camera.bottom=-4;
key.shadow.bias=-.0002;scene.add(key);
const rim=new THREE.DirectionalLight(0xbf8b92,3.3);
rim.position.set(1.3,3.2,-3.0);scene.add(rim);
const fill=new THREE.PointLight(0x79859d,22,6);
fill.position.set(2,1,2.6);scene.add(fill);

const mat=(color,metalness=0,roughness=1,side=THREE.FrontSide)=>new THREE.MeshStandardMaterial({color,metalness,roughness,side});
const steel=mat(0x35383d,.83,.48), rimSteel=mat(0x5a5857,.76,.45);
const shadowIron=mat(0x1b1d22,.65,.7), enamel=mat(0x777673,.58,.44);
const brass=mat(0x756048,.77,.45), bronze=mat(0x4d4034,.66,.65);
const leather=mat(0x30211c,.12,.91), seam=mat(0x655247,.15,.84);
const cream=mat(0x8d7d6e,.02,.98,THREE.DoubleSide), blood=mat(0x6d282b,.03,1,THREE.DoubleSide);
const maskMat=mat(0xb3a99a,.14,.83), eyeMat=new THREE.MeshBasicMaterial({color:0x090809});
const darkWine=mat(0x401b21,.05,1,THREE.DoubleSide), capeMat=mat(0x64252b,.03,1,THREE.DoubleSide);
const swordMat=mat(0x777b7d,.91,.31), stoneMat=mat(0x2d2c2d,.11,.95);
const box=(p,w,h,d,m,x=0,y=0,z=0)=>{
 const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);
 o.castShadow=true;o.receiveShadow=true;p.add(o);return o;
};
const orb=(p,scale,m,x=0,y=0,z=0,detail=2)=>{
 const o=new THREE.Mesh(new THREE.IcosahedronGeometry(1,detail),m);
 o.scale.set(...scale);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;
};
const cyl=(p,r1,r2,h,m,x=0,y=0,z=0,n=12)=>{
 const o=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,n),m);
 o.position.set(x,y,z);o.castShadow=true;p.add(o);return o;
};
const torus=(p,R,r,m,x=0,y=0,z=0,rx=0,ry=0)=>{
 const o=new THREE.Mesh(new THREE.TorusGeometry(R,r,7,24),m);
 o.position.set(x,y,z);o.rotation.set(rx,ry,0);p.add(o);return o;
};
function shape(parent,pts,material,z=0,depth=.018){
 const sh=new THREE.Shape();pts.forEach(([x,y],i)=>i?sh.lineTo(x,y):sh.moveTo(x,y));sh.closePath();
 const geo=new THREE.ExtrudeGeometry(sh,{depth,bevelEnabled:true,bevelSegments:1,steps:1,bevelThickness:.0025,bevelSize:.0025,curveSegments:2});
 const mesh=new THREE.Mesh(geo,material);mesh.position.z=z;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function line(parent,points,color=0x756864,radius=.003){
 const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
 const m=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(4,points.length*4),radius,4,false),mat(color,.5,.75));
 parent.add(m);return m;
}
const garmentTexture=(()=> {
 const c=document.createElement('canvas');c.width=c.height=256;
 const a=c.getContext('2d');
 a.fillStyle='#a3a3a3';a.fillRect(0,0,256,256);
 let seed=1329;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<1600;i++){
   const v=Math.floor(random()*80);
   a.strokeStyle='rgba('+(50+v)+','+(40+v)+','+(40+v)+','+(.025+random()*.12)+')';
   a.lineWidth=random()*1.5+.3;a.beginPath();const x=random()*256,y=random()*256;
   a.moveTo(x,y);a.lineTo(x+random()*6-3,y+random()*15);a.stroke();
 }
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1,1);t.colorSpace=THREE.SRGBColorSpace;return t;
})();
capeMat.map=garmentTexture;capeMat.needsUpdate=true;
cream.map=garmentTexture;cream.needsUpdate=true;

// Grounded hero-scale build (approximately 1.95 m tall).
const stageFloor=new THREE.Group();scene.add(stageFloor);
const disc=new THREE.Mesh(new THREE.CylinderGeometry(1.55,1.63,.12,64),stoneMat);
disc.position.y=-.075;disc.receiveShadow=true;stageFloor.add(disc);
const ring=new THREE.Mesh(new THREE.TorusGeometry(1.41,.012,7,100),bronze);
ring.rotation.x=-Math.PI/2;ring.position.y=.005;stageFloor.add(ring);
const baseLine=new THREE.GridHelper(7,28,0x29262a,0x29262a);baseLine.position.y=-.145;scene.add(baseLine);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),mat(0x141315,0,.98));
ground.rotation.x=-Math.PI/2;ground.position.y=-.145;ground.receiveShadow=true;scene.add(ground);
for(let i=0;i<16;i++){
 let a=i*2.39996,r=.55+((i*13)%11)/13;
 let o=box(stageFloor,.07+((i*3)%4)*.023,.016,.09,stoneMat,Math.cos(a)*r,-.005,Math.sin(a)*r);
 o.rotation.y=a;o.rotation.z=.08;
}

const root=new THREE.Group();scene.add(root);
const core=new THREE.Group();root.add(core);
const pelvis=new THREE.Group();pelvis.position.y=1.02;core.add(pelvis);
orb(pelvis,[.25,.19,.17],shadowIron,0,0,0);
shape(pelvis,[[-.23,.10],[.23,.10],[.23,-.13],[.11,-.24],[-.11,-.24],[-.23,-.13]],steel,.11,.036);
for(const s of [-1,1]){
 box(pelvis,.11,.043,.31,leather,s*.18,.02,.014).rotation.z=s*.13;
 box(pelvis,.12,.035,.20,brass,s*.14,-.01,.166);
}
box(pelvis,.13,.13,.06,brass,0,0,.18);
orb(pelvis,[.047,.05,.025],enamel,0,0,.23);

const body=new THREE.Group();body.position.y=1.14;core.add(body);
orb(body,[.26,.34,.16],shadowIron,0,.12,0);
shape(body,[[-.25,.36],[.25,.36],[.28,.10],[.19,-.18],[0,-.25],[-.19,-.18],[-.28,.10]],steel,.15,.050);
shape(body,[[-.19,.26],[0,.33],[.19,.26],[.16,.06],[0,-.055],[-.16,.06]],rimSteel,.213,.016);
shape(body,[[-.17,.19],[0,.13],[.17,.19],[.06,.00],[0,-.11],[-.06,.00]],shadowIron,.242,.01);
for(const s of [-1,1]){
 shape(body,[[s*.06,.04],[s*.25,.14],[s*.23,-.055],[s*.08,-.18]],steel,.22,.015);
 line(body,[[s*.24,.29,.22],[s*.16,.05,.25],[s*.08,-.14,.20]],0x938178,.004);
 for(let k=0;k<5;k++)orb(body,[.008,.008,.006],brass,s*(.09+k*.025),.18-k*.045,.263,1);
}
const collar=cyl(body,.22,.20,.09,leather,0,.43,.01);collar.scale.z=.88;
torus(body,.23,.022,brass,0,.41,.035,Math.PI/2);
box(body,.39,.065,.035,leather,0,-.14,.205);
box(body,.20,.084,.045,brass,0,-.14,.238);
for(let k=0;k<8;k++)box(body,.035,.017,.015,brass,-.13+k*.038,-.14,.271);

// Twin articulated arms.
const arms={};const elbows={};const hands={};
for(const s of [-1,1]){
 const side=s===-1?'left':'right';
 const shoulder=new THREE.Group();shoulder.position.set(s*.335,.37,0);body.add(shoulder);arms[side]=shoulder;
 orb(shoulder,[.19,.18,.175],steel,s*.035,-.028,0);
 for(let k=0;k<3;k++){
   const plate=orb(shoulder,[.19-k*.025,.075,.19-k*.014],k===1?rimSteel:steel,s*.045,-.012-k*.067,.005,1);
   plate.rotation.z=s*.22;
 }
 torus(shoulder,.105,.009,brass,s*.09,-.08,.12,Math.PI/2);
 cyl(shoulder,.112,.093,.31,shadowIron,0,-.16,0).rotation.z=-s*.08;
 box(shoulder,.125,.22,.135,steel,0,-.19,.012);
 const elbow=new THREE.Group();elbow.position.set(0,-.34,0);shoulder.add(elbow);elbows[side]=elbow;
 orb(elbow,[.115,.10,.115],shadowIron,0,0,0);
 cyl(elbow,.091,.118,.29,steel,0,-.16,.01,10);
 shape(elbow,[[-.09,-.045],[.09,-.045],[.108,-.25],[0,-.315],[-.108,-.25]],rimSteel,.102,.024);
 for(let k=0;k<4;k++)torus(elbow,.083,.008,brass,0,-.08-k*.055,.012,Math.PI/2);
 const hand=new THREE.Group();hand.position.set(0,-.35,.012);elbow.add(hand);hands[side]=hand;
 orb(hand,[.092,.115,.081],steel,0,-.03,0,1);
 for(let k=0;k<4;k++)box(hand,.03,.09,.06,rimSteel,-.052+k*.034,-.123,.012);
 orb(hand,[.065,.075,.055],steel,s*.076,-.065,.023);
}

// Head, hood and bone mask.
const neck=new THREE.Group();neck.position.set(0,.52,.015);body.add(neck);
cyl(neck,.085,.11,.16,shadowIron,0,0,0);
const head=new THREE.Group();head.position.set(0,.145,0);neck.add(head);
orb(head,[.173,.23,.163],darkWine,0,.035,-.041,3);
const hood=orb(head,[.19,.235,.19],darkWine,0,.055,-.066,2);
hood.scale.x=.19; // leave hood dark behind the faceplate
shape(head,[[-.18,.21],[-.105,.31],[0,.325],[.125,.3],[.19,.18],[.14,-.12],[.11,-.17],[-.11,-.17],[-.16,-.10]],darkWine,.082,.057);
orb(head,[.135,.178,.083],maskMat,0,.045,.138,2);
const nasal=orb(head,[.032,.083,.043],enamel,0,.038,.216,1);
nasal.rotation.z=.08;
shape(head,[[-.12,.12],[-.032,.091],[-.016,.061],[-.115,.067]],eyeMat,.211,.013);
shape(head,[[.12,.12],[.032,.091],[.016,.061],[.115,.067]],eyeMat,.211,.013);
line(head,[[-.04,-.10,.22],[.025,-.115,.215],[.055,-.105,.195]],0x342c2a,.003);
line(head,[[-.11,.18,.204],[-.045,.12,.220],[-.06,.06,.215],[-.012,-.002,.217]],0x565050,.0023);
line(head,[[.08,-.09,.211],[.026,-.04,.226],[.052,.028,.218]],0x655750,.0025);
for(let s of [-1,1]){
 const chain=shape(head,[[s*.11,.22],[s*.145,.13],[s*.153,-.04],[s*.13,-.11],[s*.16,-.03],[s*.19,.18]],shadowIron,.112,.012);
 chain.rotation.y=s*.17;
}
torus(head,.154,.014,brass,0,.245,.003,Math.PI/2);
for(let i=0;i<7;i++){
 const a=-Math.PI*.75+i*Math.PI/4.5;
 const x=Math.sin(a)*.15,z=Math.cos(a)*.13;
 const sp=cyl(head,.006,.025,.065+(i%3)*.025,shadowIron,x,.29,z,5);
 sp.rotation.z=Math.sin(a)*.40;sp.rotation.x=-Math.cos(a)*.32;
}
const crown=cyl(head,.025,.035,.042,brass,0,.33,.025,6);

// Layered torn tabard and hems, hanging from torso.
const leftSkirt=shape(body,[[-.25,-.08],[-.045,-.08],[-.07,-.64],[-.16,-.71],[-.20,-.58],[-.26,-.67],[-.305,-.54]],steel,-.012,.030);
const rightSkirt=shape(body,[[.03,-.08],[.27,-.07],[.29,-.58],[.23,-.66],[.18,-.62],[.11,-.73],[.06,-.61]],steel,-.008,.03);
shape(body,[[-.18,-.11],[.15,-.11],[.16,-.80],[.09,-.75],[.045,-.85],[-.035,-.79],[-.13,-.87],[-.18,-.73]],cream,.21,.014);
shape(body,[[-.025,-.19],[.023,-.19],[.033,-.59],[-.031,-.59]],blood,.231,.006);
shape(body,[[-.11,-.33],[.12,-.33],[.10,-.39],[-.105,-.39]],blood,.231,.007);
line(body,[[-.16,-.17,.242],[-.13,-.56,.243],[-.13,-.77,.24]],0xc0ada0,.002);
for(let s of [-1,1]){
 const flap=shape(body,[[s*.21,-.22],[s*.27,-.18],[s*.35,-.44],[s*.30,-.48]],leather,-.13,.013);
 flap.rotation.y=s*.13;
 for(let k=0;k<3;k++)cyl(body,.014,.009,.027,brass,s*(.26+k*.018),-.25-k*.065,.09,8).rotation.z=.4;
}
const waistChain=[];
for(let k=0;k<12;k++){
 let a=(k/12)*Math.PI*1.2+.08;
 let t=torus(body,.027,.005,brass,Math.cos(a)*.22,-.23-Math.sin(a*1.2)*.035,Math.sin(a)*.19,Math.PI/2);
 t.rotation.y=a;waistChain.push(t);
}

// Legs, knees and plates.
const legs={};const knees={};
for(const s of [-1,1]){
 const side=s===-1?'left':'right';
 const hip=new THREE.Group();hip.position.set(s*.155,1.01,0);core.add(hip);legs[side]=hip;
 orb(hip,[.147,.20,.15],shadowIron,0,-.035,0);
 cyl(hip,.127,.105,.35,steel,0,-.215,0).rotation.z=s*.025;
 shape(hip,[[-.122,-.06],[.12,-.06],[.11,-.38],[0,-.425],[-.11,-.38]],rimSteel,.12,.024);
 for(let k=0;k<3;k++)line(hip,[[-.09,-.12-k*.076,.148],[.01,-.095-k*.076,.165],[.092,-.12-k*.076,.149]],0x7c6860,.004);
 const knee=new THREE.Group();knee.position.set(0,-.47,0);hip.add(knee);knees[side]=knee;
 orb(knee,[.135,.11,.13],steel,0,0,.025,1);
 cyl(knee,.093,.073,.35,shadowIron,0,-.21,0);
 shape(knee,[[-.108,-.06],[.108,-.06],[.102,-.36],[.042,-.415],[-.08,-.38]],steel,.097,.030);
 shape(knee,[[-.078,-.09],[.078,-.09],[.075,-.35],[-.075,-.35]],rimSteel,.131,.015);
 const foot=orb(knee,[.131,.105,.195],steel,0,-.44,.065,1);
 foot.rotation.x=-.10;
 orb(knee,[.125,.065,.135],rimSteel,0,-.476,.12,1);
 for(let k=0;k<4;k++)line(knee,[[-.10,-.44,.12+k*.02],[.10,-.44,.12+k*.02]],0x17191d,.003);
}

// Separate articulated scabbard and long sword, attached to right hand.
const sword=new THREE.Group();hands.right.add(sword);sword.position.set(.013,-.055,.072);
const grip=cyl(sword,.027,.03,.205,leather,0,-.055,0,10);
for(let i=0;i<8;i++)torus(sword,.029,.004,brass,0,-.145+i*.022,0,Math.PI/2);
orb(sword,[.038,.039,.038],brass,0,.071,0,1);
const guard=box(sword,.37,.040,.07,bronze,0,-.185,0);
for(let s of [-1,1]){
 const wing=box(sword,.07,.02,.06,brass,s*.163,-.192,0);
 wing.rotation.z=s*.5;orb(sword,[.024,.031,.025],brass,s*.192,-.168,0,1);
}
shape(sword,[[-.063,-.225],[.063,-.225],[.052,-.75],[0,-.93],[-.052,-.75]],swordMat,-.012,.032);
line(sword,[[0,-.24,.028],[0,-.72,.028],[0,-.90,.012]],0xd1c2b3,.0025);

// Weighted cloth is real triangle geometry, not a billboard or animated sprite.
const clothW=17,clothH=20;
const vertices=new Float32Array(clothW*clothH*3),uvs=new Float32Array(clothW*clothH*2);
const ids=[];
const rowLen=Array.from({length:clothW},(_,i)=>.88+(Math.sin(i*3.77)*.09)+(i%4===0?.045:0));
for(let j=0;j<clothH;j++){
 for(let i=0;i<clothW;i++){
  const k=j*clothW+i,u=i/(clothW-1),v=j/(clothH-1);
  uvs[2*k]=u;uvs[2*k+1]=v;
  if(j<clothH-1&&i<clothW-1){let q=k;ids.push(q,q+clothW,q+1,q+1,q+clothW,q+clothW+1);}
 }
}
const clothG=new THREE.BufferGeometry();
clothG.setAttribute('position',new THREE.BufferAttribute(vertices,3).setUsage(THREE.DynamicDrawUsage));
clothG.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
clothG.setIndex(ids);
const cloak=new THREE.Mesh(clothG,capeMat);
cloak.frustumCulled=false;cloak.castShadow=true;cloak.receiveShadow=true;body.add(cloak);
const capeTrim=shape(body,[[-.37,.39],[.37,.39],[.30,.22],[.17,.18],[0,.12],[-.21,.19],[-.32,.19]],darkWine,-.19,.03);
// Tiny pale insignia on back between shoulders.
const crest=new THREE.Group();body.add(crest);crest.position.set(0,-.08,-.35);crest.rotation.y=Math.PI;
torus(crest,.085,.006,cream,0,0,0);
box(crest,.017,.29,.012,cream,0,-.02,0);
box(crest,.14,.014,.014,cream,0,.045,.002);
for(const s of [-1,1])line(crest,[[0,.12,0],[s*.05,.14,0],[s*.075,.18,0]],0xc8b8a7,.004);

// Sparse hanging belts and buckles with perspective depth.
for(const s of [-1,1]){
 const strap=box(body,.052,.53,.022,leather,s*.22,-.35,.035);
 strap.rotation.z=-s*.24;
 for(let k=0;k<5;k++)orb(body,[.014,.014,.012],brass,s*(.22+k*.009),-.20-k*.073,.053,1);
 const pouch=box(body,.10,.13,.07,leather,s*.27,-.43,-.09);
 torus(body,.035,.008,brass,s*.27,-.42,-.035,Math.PI/2);
}
const medal=torus(body,.055,.011,brass,-.24,.31,.208);
medal.rotation.x=.07;orb(body,[.018,.024,.012],enamel,-.24,.31,.224);
line(body,[[-.24,.31,.22],[-.11,.23,.24],[.08,.04,.26]],0x8e7860,.0035);


// FINAL-ART REFINEMENT — original geometry, not purchased / generated reference GLB.
// Keep face, mantle, thorns and the sword distinct so the camera can inspect them.
const ivoryWear=mat(0x847e76,.11,.89), toothSteel=mat(0x77716a,.7,.45);
const redShadow=mat(0x351519,.03,.94,THREE.DoubleSide);
const boneFleck=mat(0xc0b5a8,.08,.85);
function jewel(p,r,m,x,y,z){
  const e=new THREE.Mesh(new THREE.OctahedronGeometry(r,0),m);
  e.position.set(x,y,z);e.castShadow=true;p.add(e);return e;
}
// Build ornate asymmetric silhouette on top of the separate face and real crown.
shape(head,[[-.118,.182],[-.148,.128],[-.15,-.04],[-.119,-.145],[-.091,-.117],[-.104,.125]],ivoryWear,.200,.009);
shape(head,[[.118,.182],[.148,.128],[.15,-.04],[.119,-.145],[.091,-.117],[.104,.125]],ivoryWear,.200,.009);
shape(head,[[-.125,.20],[-.045,.239],[.043,.243],[.127,.195],[.076,.168],[-.087,.170]],boneFleck,.209,.008);
for (const s of [-1,1]) {
  line(head,[[s*.056,.23,.215],[s*.098,.17,.215],[s*.121,.095,.205],[s*.113,-.055,.194]],0x625b55,.002);
  line(head,[[s*.038,.064,.252],[s*.079,-.01,.240],[s*.064,-.09,.218]],0x686159,.0018);
  line(head,[[s*.100,-.062,.211],[s*.071,-.137,.182]],0x867b72,.0021);
  shape(head,[[s*.18,.23],[s*.22,.09],[s*.20,-.06],[s*.13,-.15],[s*.15,.15]],redShadow,.048,.024);
  const crestHorn=cyl(head,.009,.028,.17,steel,s*.126,.34,-.04,5);
  crestHorn.rotation.z=s*.51;
  crestHorn.rotation.x=s*.09;
  const little=jewel(head,.027,brass,s*.178,.252,.07);
  little.rotation.z=s*.5;
}
shape(head,[[-.135,.302],[-.03,.337],[.08,.32],[.17,.278],[.155,.182],[.095,.21],[-.095,.23]],darkWine,.058,.026);
line(head,[[-.048,-.13,.214],[0,-.147,.227],[.049,-.134,.215]],0x504944,.0017);
for (let i=0;i<9;i++) {
  const angle=-Math.PI*.7+i*Math.PI/8.7;
  const x=Math.sin(angle)*.149,z=Math.cos(angle)*.128;
  const spike=cyl(head,.003,.013,.069+(i%3)*.031,toothSteel,x,.36,z,5);
  spike.rotation.z=Math.sin(angle)*.44;
}
// Multi-layer articulated breast plate: fluted channels and raised iron tracery.
for (const s of [-1,1]) {
  shape(body,[[s*.09,.29],[s*.22,.32],[s*.26,.17],[s*.174,.06],[s*.11,.12]],rimSteel,.214,.012);
  shape(body,[[s*.12,.14],[s*.215,.10],[s*.15,-.08],[s*.064,-.17],[s*.083,.06]],steel,.254,.012);
  for (let k=0;k<6;k++) {
    const a=k/5;
    line(body,[[s*(.12+a*.11),.245,.252],[s*(.105+a*.095),.14,.270],[s*(.07+a*.08),.014,.26]],0x8c7764,.0022);
  }
  torus(body,.046,.007,brass,s*.216,.302,.208,Math.PI/2);
  jewel(body,.022,bronze,s*.216,.302,.233);
  for (let k=0;k<4;k++) {
    jewel(pelvis,.018,brass,s*(.075+.047*k),-.085,.183);
  }
}
for (let k=0;k<12;k++) {
  const a=k*2*Math.PI/12;
  jewel(body,.011,brass,.19*Math.sin(a),.37+.05*Math.cos(a),.048);
}
line(body,[[-.17,.31,.263],[0,.39,.23],[.17,.31,.263]],0x7f6c64,.005);
line(body,[[-.13,-.12,.256],[0,-.22,.245],[.13,-.12,.256]],0x9c8871,.004);
for(const s of [-1,1]) {
  for(let k=0;k<6;k++){
    const x=s*(.018+.037*k);
    jewel(body,.011,k%3===0?brass:seam,x,-.33-(k%2)*.014,.260);
  }
}
// Heavy bronze collars and armoured fingers with scratched rivets.
for(const s of [-1,1]){
  const shoulder=arms[s<0?'left':'right'];
  const elbow=elbows[s<0?'left':'right'];
  for(let k=0;k<9;k++){
    const a=k*2*Math.PI/9;
    jewel(shoulder,.014,brass,s*.078+Math.sin(a)*.09,-.065+Math.cos(a)*.08,.149);
  }
  for(let k=0;k<7;k++) {
    const xx=-.061+k*.021;
    line(elbow,[[xx,-.056,.112],[xx,-.25,.135]],0x95857a,.0021);
  }
}
// Intricate relief on aged sword crossguard and darker central ridge.
for(let s of [-1,1]){
  const wing=cyl(sword,.013,.036,.115,toothSteel,s*.18,-.191,-.006,7);
  wing.rotation.z=s*.63;
  jewel(sword,.026,brass,s*.19,-.144,.012);
  line(sword,[[s*.027,-.25,.026],[s*.028,-.49,.027],[s*.021,-.73,.018]],0xdbd0bf,.0025);
}
jewel(sword,.043,brass,0,.099,0);
jewel(sword,.022,ivoryWear,0,-.179,.08);
// Side-slung scabbard and weathered shoulder strap; geometry rather than shader decals.
const scabbard=new THREE.Group();body.add(scabbard);
scabbard.position.set(-.233,-.15,-.086);scabbard.rotation.set(.14,.24,-.25);
cyl(scabbard,.055,.09,.76,leather,0,-.38,-.01,8);
box(scabbard,.113,.052,.062,brass,0,-.10,0);
box(scabbard,.102,.037,.055,brass,0,-.67,0);
for(let k=0;k<5;k++)torus(scabbard,.056,.007,brass,0,-.21-k*.08,0,Math.PI/2);
line(body,[[-.29,.38,.15],[-.18,.09,.275],[-.26,-.29,.17]],0x7d5144,.025);
// Ragged cape patches, pin holes and repaired seams; dynamic main cape still moves.
for(let i=0;i<12;i++){
  const x=((i*13)%17)/17-.5;
  const y=-.28-((i*23)%17)/17*.60;
  const z= -.16-(.30+(i%5)*.004)*((y+.28)/-.6);
  const patch=shape(body,[[x-.035,y+.050],[x+.024,y+.042],[x+.041,y-.039],[x-.03,y-.066]],i%3===0?redShadow:darkWine,z,.003);
  patch.rotation.y=.02;
}

// Stage easings are deterministic functions of clip time; any frame can be inspected.
const motions={idle:3.2,walk:1.05,run:.72,jump:1.20,attack:1.05,crouch:1.8,salute:1.70,turn:2.4};
let selected='idle',playing=true,clock=0,speed=1,wireframe=false;
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t)};
function pose(clip,u){
 const t=u*motions[clip],step=t*Math.PI*2/(clip==='run'?.72:1.05);
 const walking=clip==='walk'||clip==='run';
 const run=clip==='run';
 const amount=run?.74:.44;
 const gait=walking?Math.sin(step)*amount:0;
 const secondary=walking?Math.sin(step+Math.PI/2):0;
 let airborne=0,fold=0,attack=0,salute=0;
 if(clip==='jump'){
   airborne=Math.pow(Math.sin(Math.PI*u),1.05)*.37;
   fold=Math.sin(Math.PI*u)*.52;
 }
 if(clip==='crouch')fold=smooth(Math.min(u*4,1))*smooth(Math.min((1-u)*5,1))*.68;
 if(clip==='attack')attack=Math.sin(Math.PI*smooth((u-.05)/.75))**2;
 if(clip==='salute')salute=Math.sin(Math.PI*smooth(u))**2;
 const breathing=Math.sin(t*2.1)*.006;
 const sway=walking?secondary*(run?.014:.009):Math.sin(t*.7)*.006;
 core.position.y=airborne+(walking?Math.abs(secondary)*(run?.025:.008):breathing)-fold*.22;
 body.rotation.x=run?.15:walking?.055:0;
 body.rotation.z=sway+(clip==='attack'?Math.sin(Math.PI*u)*.20:0);
 body.rotation.y=clip==='turn'?u*Math.PI*2:clip==='attack'?attack*.18:Math.sin(t*.5)*.02;
 body.scale.set(1+breathing*.1,1+breathing,1+breathing*.1);
 neck.rotation.x=clip==='salute'?salute*.23:Math.sin(t*1.1)*.015;
 arms.left.rotation.set((walking?-gait:.03)+(clip==='jump'?fold*.65:0)+(clip==='attack'?-attack*.45:0),0,-.13);
 arms.right.rotation.set((walking?gait:.04)+(clip==='jump'?fold*.58:0)+(clip==='attack'?-attack*2.3:0)+(clip==='salute'?salute*1.12:0),0,.13-(clip==='attack'?attack*.82:0));
 elbows.left.rotation.x=walking?Math.max(0,gait)*-.3:-.13;
 elbows.right.rotation.x=walking?Math.max(0,-gait)*-.25:-.22;
 if(clip==='attack')elbows.right.rotation.x=-.65*attack;
 sword.rotation.set(0,0,clip==='attack'?Math.sin(u*Math.PI*2)*attack*.68:0);
 legs.left.rotation.x=(walking?gait:0)-fold*.85;
 legs.right.rotation.x=(walking?-gait:0)-fold*.85;
 knees.left.rotation.x=(walking?Math.max(0,-gait)*.65:0)+fold*.85;
 knees.right.rotation.x=(walking?Math.max(0,gait)*.65:0)+fold*.85;
 if(clip==='jump'){knees.left.rotation.x+=fold*.5;knees.right.rotation.x+=fold*.5;}
 const pos=clothG.attributes.position;
 const wind=(t*.85);
 for(let j=0;j<clothH;j++){
  let v=j/(clothH-1);
  for(let i=0;i<clothW;i++){
   const k=j*clothW+i,side=i/(clothW-1)*2-1;
   const spread=.27+v*.19+(walking?(run?.16:.08):0)*v;
   const wave=Math.sin(i*.78+t*2.0+v*2.4)*.022*v;
   let y=.38-v*(1.36*rowLen[i]);
   if(j===0)y=.38;
   const x=side*spread+wave+v*v*Math.sin(wind+i*.30)*(run?.13:.045);
   const tail= -.16 - v*v*(.30+(run?.16:walking?.09:0)) + Math.sin(t*2.7+i*.53-v*3.3)*v*.04;
   pos.setXYZ(k,x,y,tail);
  }
 }
 pos.needsUpdate=true;clothG.computeVertexNormals();
 crest.visible=true;
}
function setClip(id){
 if(!motions[id])return;
 selected=id;clock=0;playing=true;
 document.querySelectorAll('[data-clip]').forEach(b=>b.classList.toggle('active',b.dataset.clip===id));
 $('pause').textContent='Пауза';$('scrub').value=0;$('scrub-value').textContent='0%';
 pose(selected,0);
}
$('clips').addEventListener('click',e=>{const button=e.target.closest('[data-clip]');if(button)setClip(button.dataset.clip);});
$('pause').addEventListener('click',()=>{playing=!playing;$('pause').textContent=playing?'Пауза':'Продолжить';});
$('scrub').addEventListener('input',e=>{
 const u=Number(e.target.value)/1000;clock=u*motions[selected];playing=false;
 $('pause').textContent='Продолжить';$('scrub-value').textContent=Math.round(u*100)+'%';pose(selected,u);
});
$('speed').addEventListener('input',e=>{
 speed=Number(e.target.value)/100;$('speed-value').textContent=speed.toFixed(1)+'×';
});
$('reset').addEventListener('click',()=>{
 camera.position.set(2.85,2.05,4.6);controls.target.set(0,1.05,0);controls.update();
});
$('auto').addEventListener('click',e=>{controls.autoRotate=!controls.autoRotate;e.currentTarget.classList.toggle('active',controls.autoRotate);});
$('wire').addEventListener('click',e=>{
 wireframe=!wireframe;e.currentTarget.classList.toggle('active',wireframe);
 root.traverse(o=>{if(o.isMesh&&o.material){for(const m of (Array.isArray(o.material)?o.material:[o.material]))m.wireframe=wireframe;}});
});
for(const [button,p] of [['viewFront',[0,1.3,4.8]],['viewBack',[0,1.3,-4.8]],['viewSide',[4.8,1.3,0]]]){
 $(button).addEventListener('click',()=>{
   camera.position.set(...p);controls.target.set(0,1.05,0);controls.update();
 });
}
window.addEventListener('keydown',e=>{
 if(e.code==='Space'&&e.target.tagName!=='BUTTON'&&e.target.tagName!=='INPUT'){
  e.preventDefault();$('pause').click();
 }
});

const resize=()=>{
 const w=stage.clientWidth,h=stage.clientHeight;
 if(w<1||h<1)return;
 camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
};
window.addEventListener('resize',resize);
window.addEventListener('orientationchange',resize);
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();notice.style.display='grid';});
renderer.domElement.addEventListener('webglcontextrestored',()=>{notice.style.display='none';resize();});
resize();pose(selected,0);
let last=performance.now(),frame=0;
function tick(now){
 requestAnimationFrame(tick);
 let dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
 if(playing){clock+=dt*speed;clock%=motions[selected];}
 const u=clock/motions[selected];
 pose(selected,u);controls.update();renderer.render(scene,camera);
 if(++frame%3===0&&playing){$('scrub').value=Math.round(u*1000);$('scrub-value').textContent=Math.round(u*100)+'%';}
}
requestAnimationFrame(tick);
window.__ASHEN_VOW__={
 version:'preview-1',isGameIntegrated:false,model:root,motions,setClip,
 get current(){return selected;},get playing(){return playing;},
 get meshes(){let n=0;root.traverse(o=>{if(o.isMesh)n++;});return n;},
 get ready(){return Boolean(renderer&&root.children.length&&clothG.attributes.position.count>100);}
};
