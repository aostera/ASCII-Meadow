// Separate, replaceable game-time gothic longsword mesh (NO paid 3D call).
// Intentionally attached to the *existing Tripo wrist bone*, not welded to
// the player's skin. Geometric proportions are in source GLB metre units:
// blade points down and stays outside the torso during motion.
// Can later be swapped for an artist/Tripo-exported separate sword GLB.
import * as THREE from 'three';
import {ASHEN_BLADE_STATIONS} from './ashen-blade-envelope.mjs';
const mat=(color,metalness=.6,roughness=.6)=>new THREE.MeshStandardMaterial({
  color,metalness,roughness,side:THREE.DoubleSide
});
const steel=mat(0xadb5b8,.83,.32);
const edge=mat(0xdde0de,.89,.28);
const fuller=mat(0x525b62,.81,.56);
const iron=mat(0x575558,.83,.42);
const gold=mat(0x93765a,.75,.4);
const grip=mat(0x242024,.15,.87);
const gem=mat(0x62232c,.25,.22);
function mesh(group,geometry,material,name){
  const o=new THREE.Mesh(geometry,material);o.name=name;
  o.castShadow=true;o.receiveShadow=false;group.add(o);
  return o;
}
function bladeLoft(stations,material,name,parent){
  // Blade with *actual diamond cross-section*, two bright sharpened bevels.
  // stations [y, halfWidth, ridgeDepth] from guard to tip (Y decreasing).
  const vertices=[],uv=[],faces=[];
  const vx=(w,d)=>[
    [-w,0],[0,d],[w,0],[0,-d]
  ];
  for(const [y,w,depth] of stations){
    for(const [x,z] of vx(w,depth)){
      vertices.push(x,y,z);uv.push((x/(stations[0][1]*2))+.5,y);
    }
  }
  for(let j=0;j<stations.length-1;j++)for(let side=0;side<4;side++){
    const a=j*4+side,b=j*4+(side+1)%4,c=(j+1)*4+(side+1)%4,d=(j+1)*4+side;
    faces.push(a,b,c,a,c,d);
  }
  for(let i=1;i<3;i++)faces.push(0,4-i,i);
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(faces);g.computeVertexNormals();
  return mesh(parent,g,material,name);
}
function bar(group,a,b,r1,r2,material,name){
  const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b);
  const direction=bv.clone().sub(av),middle=av.clone().add(bv).multiplyScalar(.5);
  const o=mesh(group,new THREE.CylinderGeometry(r2,r1,direction.length(),7,1),material,name);
  o.position.copy(middle);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
  return o;
}
function band(group,y,r,material,name,half=0.01){
  const m=mesh(group,new THREE.CylinderGeometry(r,r,half,10),material,name);
  m.position.y=y;return m;
}
export function createAshenGothicLongsword(){
  const sword=new THREE.Group();sword.name='Ashen Vow / detached Gothic longsword / wrist-bound';
  // Sword grip center at origin: the hilt/socket is in the hand. Tip hangs
  // toward boot height in neutral pose. Total approx 0.48 source-metres.
  // Double-edged distal taper with long narrow point and central ridge.
  bladeLoft(ASHEN_BLADE_STATIONS,steel,
    'Blade / six tapered bevels / true diamond cross-section',sword);
  // Separate polished longitudinal edges. A groove (fuller) ends well
  // before the tip, and never forms a second imaginary sword.
  for(const s of [-1,1]){
    const edgePath=[[-.046,.022*s,0],[-.13,.0195*s,0],[-.29,.014*s,0],[-.42,.0055*s,0]];
    for(let i=0;i<edgePath.length-1;i++)bar(sword,
      [edgePath[i][1],edgePath[i][0],edgePath[i][2]],
      [edgePath[i+1][1],edgePath[i+1][0],edgePath[i+1][2]],.00125,.0008,edge,
      'Sharpened edge '+s+' / '+i);
  }
  for(const s of [-1,1]){
    bar(sword,[0,-.061,s*.0056],[0,-.293,s*.0028],.0016,.0007,fuller,
      'Long recessed fuller '+s);
  }
  // Gothic forward-swept quillons with separate faceted claws and finials.
  for(const s of [-1,1]){
    bar(sword,[s*.010,-.042,0],[s*.030,-.044,-.003],.0057,.004,iron,'Quillon inner '+s);
    bar(sword,[s*.030,-.044,-.003],[s*.055,-.029,-.008],.004,.0028,iron,'Quillon claw '+s);
    bar(sword,[s*.055,-.029,-.008],[s*.065,-.015,-.009],.0028,.0002,edge,'Quillon spire '+s);
    band(sword,-.041,.008,gold,'Guard ferrule '+s,.008);
  }
  // Narrow rain-guard at base of blade.
  const rain=mesh(sword,new THREE.BoxGeometry(.046,.012,.012),iron,'Gothic rain-guard');
  rain.position.y=-.052;
  const flared=mesh(sword,new THREE.OctahedronGeometry(.011,0),iron,'Crossguard central spike');
  flared.position.y=-.04;flared.scale.set(1,.85,.65);
  // Hilt: grip, leather helix, bronze bands, diamond pommel and red cabochon.
  const handle=mesh(sword,new THREE.CylinderGeometry(.008,.009,.086,10),grip,
    'Separate dark leather grip');
  handle.position.y=.005;
  for(let i=0;i<12;i++){
    const y=-.034+i*.007;
    const a=i*.66;
    const o=mesh(sword,new THREE.TorusGeometry(.0095,.00095,4,12),gold,'Grip wire '+i);
    o.rotation.x=Math.PI/2;o.rotation.z=a;o.position.y=y;
  }
  band(sword,-.038,.011,iron,'Grip lower collar',.009);
  band(sword,.051,.012,iron,'Grip upper collar',.009);
  const pommel=mesh(sword,new THREE.OctahedronGeometry(.019,0),iron,'Eight-facet iron pommel');
  pommel.position.y=.071;pommel.scale.set(.84,1.15,.54);
  const ruby=mesh(sword,new THREE.OctahedronGeometry(.008,0),gem,'Pommel burgundy cabochon');
  ruby.position.set(0,.074,.010);ruby.scale.set(.9,1,.5);
  // Avoid accidentally adding it to the legacy geometry atlas: it is
  // rendered dynamically on the same 3D->ASCII pass as the animated arm.
  sword.userData.weapon='detached';
  sword.userData.provisional=true;
  sword.userData.tipLocalY=-.475;
  return sword;
}
