// THE ASHEN VOW, REAL IN-GAME ASSET. Geometry: reviewed v12 GLB.
// This is deliberately NOT the Masked Knight GLB and not a rendered concept picture.
//
// Game-facing animation rig: real GPU skinning of the existing dense 3D mesh.
// Weights are derived from anatomy and rear-cloth regions because the current
// GLB is unrigged. This is a provisional deformation pass: accurate mocap,
// retopology and hand-painted weights remain an art-approval milestone.
// All source map, collision, input, editor and native renderer code stay intact.
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

export const ASHEN_GLB_URL=new URL('./assets/ashen-vow/ashen_vow_v12.glb',import.meta.url).href;
export const ASHEN_HEIGHT=2.04;
const HEIGHT_IN_SOURCE_UNITS=8.9;
const LIMB={thigh:.47,shin:.47};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=x=>{const t=clamp(x,0,1);return t*t*(3-2*t)};

function facialMetalness(name){return /cloth|cape|mask|rear/i.test(name)?.08:.47}
export function createAshenSkeleton(THREE,source){
 const root=new THREE.Group();
 root.name='The Ashen Vow / original approved-character sculpture / rigged';
 const holder=new THREE.Group();
 root.add(holder);
 const model=new THREE.Group();
 model.name='Ashen_Vow_Skin_Armature';
 model.scale.setScalar(HEIGHT_IN_SOURCE_UNITS/ASHEN_HEIGHT);
 holder.add(model);

 const bones=[];
 function bone(name,parent,xyz){
   const b=new THREE.Bone();b.name=name;b.position.set(...xyz);
   parent.add(b);bones.push(b);return b;
 }
 const origin=bone('Character_Root',model,[0,0,0]);
 const hips=bone('Hips',origin,[0,1.13,0]);
 const spine=bone('Spine',hips,[0,.25,0]);
 const neck=bone('Neck',spine,[0,.29,0]);
 const head=bone('Head',neck,[0,.13,0]);
 const sets={};
 for(const [side,s] of [['L',-1],['R',1]]){
   const thigh=bone('Thigh.'+side,hips,[s*.17,-.075,0]);
   const knee=bone('Shin.'+side,thigh,[0,-LIMB.thigh,0]);
   const foot=bone('Foot.'+side,knee,[0,-LIMB.shin,0]);
   const shoulder=bone('Shoulder.'+side,spine,[s*.32,.18,0]);
   const elbow=bone('Forearm.'+side,shoulder,[s*.025,-.27,0]);
   const hand=bone('Hand.'+side,elbow,[s*.015,-.25,0]);
   sets[side]={thigh,knee,foot,shoulder,elbow,hand,s};
 }
 const capes=Array.from({length:7},(_,i)=>{
   const x=(i-3)/3;
   return bone('Cloak_'+i,spine,[x*.36,.10,-.225]);
 });
 model.updateMatrixWorld(true);
 const skel=new THREE.Skeleton(bones);
 const id=new Map(bones.map((b,i)=>[b.name,i]));
 function weights(x,y,z,name){
   const clean=name.toLowerCase();
   if(/sword|grip|pommel|guard|blade|quillon|hilt|fuller/.test(clean))
     return [[id.get('Hand.L'),1]]; // sword hangs from the left of image (-X)
   if(/crown|thorn|briar|mask|hood/.test(clean)&&y>1.65)
     return [[id.get('Head'),1]];
   // Separate back cloth has seven independently animated panels.
   const rear=z<(-.28-.11*smooth((1.56-y)/1.4));
   if(rear&&y<1.59){
     const pick=clamp((x/.55+1)*3,0,6);
     const left=Math.floor(pick),right=Math.min(left+1,6);
     const w=pick-left;
     const flutter=.90*smooth((1.63-y)/.32);
     const bodyName=y>1.20?'Spine':'Hips';
     const pairs=[[id.get('Cloak_'+left),flutter*(1-w)]];
     if(right!==left)pairs.push([id.get('Cloak_'+right),flutter*w]);
     pairs.push([id.get(bodyName),1-flutter]);
     return pairs;
   }
   if(y>1.665){
     const n=smooth((y-1.63)/.11);
     return [[id.get('Head'),n],[id.get('Neck'),1-n]];
   }
   // Shoulder / forearm / glove regions, not puffy primitive limb shells.
   if(Math.abs(x)>.255&&y>.91&&y<1.66&&z>-.3){
     const S=x<0?'L':'R';
     if(y>1.48)return [[id.get('Shoulder.'+S),.92],[id.get('Spine'),.08]];
     if(y>1.28){
       const t=smooth((1.48-y)/.16);
       return [[id.get('Shoulder.'+S),1-t],[id.get('Forearm.'+S),t]];
     }
     if(y>1.07){
       const t=smooth((1.28-y)/.21);
       return [[id.get('Forearm.'+S),1-t],[id.get('Hand.'+S),t]];
     }
     return [[id.get('Hand.'+S),1]];
   }
   // Legs / boots. Keep hanging center tabard with torso rather than knee.
   if(y<1.12&&Math.abs(x)>.09&&!(Math.abs(x)<.18&&z>.17&&y>.74)){
     const S=x<0?'L':'R';
     if(y>.65){
       const t=smooth((.83-y)/.20);
       return [[id.get('Thigh.'+S),1-t],[id.get('Shin.'+S),t]];
     }
     if(y>.25){
       const t=smooth((.38-y)/.14);
       return [[id.get('Shin.'+S),1-t],[id.get('Foot.'+S),t]];
     }
     return [[id.get('Foot.'+S),1]];
   }
   if(y>1.30)return [[id.get('Spine'),1]];
   if(y>1.09){
     const t=smooth((y-1.08)/.25);
     return [[id.get('Hips'),1-t],[id.get('Spine'),t]];
   }
   return [[id.get('Hips'),1]];
 }
 // Geometry exported from concept sculpt already uses world-metre coordinates.
 // Bake GLTF node transforms before calculating per-vertex skin weights.
 source.updateMatrixWorld(true);
 let skinned=0,vertexCount=0;
 const sourceMeshes=[];
 source.traverse(o=>{if(o.isMesh)sourceMeshes.push(o)});
 if(!sourceMeshes.length)throw Error('Ashen Vow GLB contains no meshes');
 for(const old of sourceMeshes){
   const geom=old.geometry.clone();
   geom.applyMatrix4(old.matrixWorld); // source is a self-contained sculpt
   const N=geom.attributes.position.count;
   const si=new Uint16Array(N*4),sw=new Float32Array(N*4);
   const vertexColor=new Float32Array(N*3);
   const p=geom.attributes.position;
   const isWeapon=/sword|blade|grip|pommel|guard|quillon|fuller/i.test(old.name);
   const isCrown=/crown|thorn|briar/i.test(old.name);
   for(let j=0;j<N;j++){
     const x=p.getX(j),y=p.getY(j),z=p.getZ(j);
     const ws=weights(x,y,z,old.name);
     // Per-vertex MATERIAL REGIONS, not a photograph stamped onto the sprite.
     // Especially the narrow ivory mask: it has its own light value in ASCII.
     const ax=Math.abs(x),facial=y>1.675&&y<1.952&&ax<.096&&z>-.102;
     const eye=facial&&y>1.782&&y<1.835&&ax>.029&&ax<.082;
     const tabard=y>.47&&y<1.23&&ax<.155&&z>.032;
     const cloth=z<(-.28-.11*smooth((1.56-y)/1.4))&&y<1.59;
     let value=isWeapon?.92:isCrown?.55:eye?.055:facial?.93:
       tabard?.71:cloth?.29:.40;
     // Subtle forged-metal breakups using actual model coordinates:
     // the exact pixels are rederived from the lit 3D mesh each frame.
     if(!isWeapon&&!facial&&!tabard&&!cloth){
       value+=.06*Math.sin(y*64+x*22)*Math.sin(z*49);
     }
     vertexColor[j*3]=clamp(value,0,1);
     vertexColor[j*3+1]=clamp(value*(cloth?.90:1),0,1);
     vertexColor[j*3+2]=clamp(value*(cloth?.92:1),0,1);
     let sum=0;
     for(let k=0;k<4;k++){
       const q=ws[k];
       si[j*4+k]=q?q[0]:0;
       sw[j*4+k]=q?q[1]:0;
       sum+=sw[j*4+k];
     }
     if(sum<.001)throw Error('Unweighted Ashen Vow vertex');
     for(let k=0;k<4;k++)sw[j*4+k]/=sum;
   }
   geom.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(si,4));
   geom.setAttribute('skinWeight',new THREE.Float32BufferAttribute(sw,4));
   geom.setAttribute('color',new THREE.Float32BufferAttribute(vertexColor,3));
   // Keep the model geometry; the game's own shader turns the render into glyphs.
   // Neutral surface values deliberately downplay unreliable photo-projected texture.
   const material=new THREE.MeshStandardMaterial({
     color:0xffffff,vertexColors:true,
     metalness:isWeapon?.74:facialMetalness(old.name),
     roughness:isWeapon?.42:.77,
     side:THREE.DoubleSide
   });
   const mesh=new THREE.SkinnedMesh(geom,material);
   mesh.name=old.name;
   mesh.frustumCulled=false;
   mesh.castShadow=true;
   // Both model and rest bones are in the same coordinate frame.
   mesh.bind(skel,new THREE.Matrix4());
   model.add(mesh);
   skinned++;vertexCount+=N;
 }
 model.updateMatrixWorld(true);
 const stats={skinnedMeshes:skinned,vertices:vertexCount,bones:bones.length};
 const pose={
   phase:0,lastMotion:'idle',lastJump:0,air:0,
   capeVel:0,capeWind:0,clock:0,clip:'Idle'
 };
 function ikLeg(side,cycle,moving,run,jumpArc){
   const {thigh,knee,foot}=sets[side], s=side==='L'?-1:1;
   let gz=0,fy=.135;
   if(moving){
     const p=((cycle+(side==='L'?0:.5))%1+1)%1;
     const stance=run?.48:.61;
     const stride=run?.30:.20,lift=run?.17:.105;
     if(p<stance)gz=stride*(.5-p/stance);
     else{
       const t=(p-stance)/(1-stance);
       gz=stride*(smooth(t)-.5);
       fy+=lift*Math.sin(Math.PI*t);
     }
   }
   fy+=.14*jumpArc;
   gz+=(side==='L'?-.035:.035)*jumpArc;
   const hipHeight=1.055+hips.position.y-1.13;
   const dy=fy-hipHeight,dz=gz,dist=Math.max(.001,Math.hypot(dy,dz));
   const l1=LIMB.thigh,l2=LIMB.shin;
   const reach=Math.min(l1+l2-.003,dist);
   const theta=Math.atan2(dz,-dy);
   const alpha=Math.acos(clamp((l1*l1+reach*reach-l2*l2)/(2*l1*reach),-1,1));
   thigh.rotation.x=-(theta+alpha);
   knee.rotation.x=2*alpha;
   foot.rotation.x=-(thigh.rotation.x+knee.rotation.x);
 }
 function animate(dt,movement,now){
   const t=Math.max(0,Math.min(.05,dt));
   pose.clock+=t;
   const speed=Number(movement?.speed)||0;
   const moving=speed>.05;
   const run=moving&&Boolean(movement.run);
   const jumpTime=movement?.jumpClipTime;
   const airborne=typeof jumpTime==='number';
   let jump=0;
   if(airborne) {
     const p=clamp(jumpTime/(36/24),0,1);
     jump=Math.max(0,Math.sin(Math.PI*p));
   }
   const f=run?11:moving?7.5:1;
   if(moving)pose.phase+=t*f;
   const cycle=(pose.phase/Math.PI/2)%1;
   const amp=moving?(run?.40:.22):0;
   const velocity=movement?.heading??root.rotation.y;
   const delta=Math.atan2(Math.sin(velocity-root.rotation.y),Math.cos(velocity-root.rotation.y));
   root.rotation.y+=delta*Math.min(1,t*10);
   hips.position.y=1.13+(moving?.022*Math.cos(pose.phase*2):.007*Math.sin(pose.clock*2));
   spine.rotation.set(run?.10:moving?.035:0,0,.013*Math.sin(pose.phase));
   head.rotation.z=Math.sin(pose.clock*1.6)*.016;
   neck.rotation.x=jump*.04;
   for(const side of ['L','R']){
     const p=(side==='L'?0:Math.PI);
     sets[side].shoulder.rotation.x=-Math.sin(pose.phase+p)*amp*.75-.035;
     sets[side].elbow.rotation.x=-.12-Math.max(0,-Math.sin(pose.phase+p))*.25*amp;
     sets[side].hand.rotation.x=.08*Math.sin(pose.clock);
     ikLeg(side,cycle,moving,run,jump);
   }
   const target=(moving?(run?.19:.075):0)+.03*Math.sin(pose.clock*1.6);
   pose.capeVel+=(target-pose.capeWind)*19*t;
   pose.capeVel*=Math.exp(-6*t);
   pose.capeWind+=pose.capeVel*t;
   for(let j=0;j<capes.length;j++){
     const c=capes[j],x=(j-3)/3;
     c.rotation.x=.06+pose.capeWind*(.85+Math.abs(x)*.4)+
       .038*Math.sin(pose.clock*1.4+j*.43)+jump*.12;
     c.rotation.z=x*(.04+.035*Math.sin(pose.clock*1.7+j*.33));
   }
   pose.clip=airborne?'Jump':run?'Run':moving?'Walk':'Idle';
   pose.lastMotion=pose.clip.toLowerCase();
   return pose.lastMotion;
 }
 root.userData.animate=animate;
 root.userData.footprint={radius:.29,height:ASHEN_HEIGHT};
 root.userData.gltf={actions:{Idle:1,Walk:1,Run:1,Jump:1},get clip(){return pose.clip;},...stats};
 root.userData.dispose=()=>{
   root.userData.disposed=true;
   for(const child of model.children){
     if(child.isSkinnedMesh){
       child.geometry.dispose();
       if(Array.isArray(child.material))child.material.forEach(m=>m.dispose());
       else child.material.dispose();
     }
   }
   skel.dispose();
 };
 return root;
}

export function createGltfKnight(THREE,{url=ASHEN_GLB_URL,onLoad,onError}={}){
 const root=new THREE.Group();
 root.name='Ashen Vow gameplay / asynchronous GLB';
 root.userData.gltf={loaded:false,actions:{},clip:null};
 const loader=new GLTFLoader();
 loader.setCrossOrigin('anonymous');
 loader.load(url,gltf=>{
   if(root.userData.disposed)return;
   try{
     const source=gltf.scene;
     const character=createAshenSkeleton(THREE,source);
     root.add(character);
     root.userData.skinned=character;
     root.userData.gltf=character.userData.gltf;
     root.userData.animate=(dt,movement,now)=>{
       const pose=character.userData.animate(dt,movement,now);
       root.rotation.y=0;
       return pose;
     };
     root.userData.dispose=()=>{
       root.userData.disposed=true;
       character.userData.dispose();
       root.remove(character);
       source.traverse(o=>{
         o.geometry?.dispose?.();
         const mats=Array.isArray(o.material)?o.material:o.material?[o.material]:[];
         for(const m of mats){
           for(const val of Object.values(m))if(val?.isTexture)val.dispose();
           m.dispose();
         }
       });
     };
     // Prepare custom cloak/normal luminance shader BEFORE native rasterization.
     root.userData.prepareModel?.(character);
     onLoad?.(root);
   }catch(err){onError?.(err)}
 },undefined,err=>onError?.(err));
 return root;
}
