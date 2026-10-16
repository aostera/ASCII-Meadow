// Real Tripo H3.1 V2 skin: 40 Tripo bones + authored game-time animation poses.
// NO procedural character mesh, NO fake glyph-ball, NO AI/Tripo paid animation calls.
// Uses existing, skinned, 399k triangle / 10.7 MB GLB.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

export const TRIPO_V2_GLB = new URL('./assets/ashen-vow/ashen_tripo_v2_skeleton_lod.glb',import.meta.url).href;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const damp=(x,target,lambda,dt)=>x+(target-x)*(1-Math.exp(-lambda*dt));
const UP=new THREE.Vector3(0,1,0);
const X=new THREE.Vector3(1,0,0);
const Y=new THREE.Vector3(0,1,0);
const Z=new THREE.Vector3(0,0,1);

function setupBones(model){
  const meshes=[];
  model.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o)});
  const skin=meshes[0]?.skeleton;
  if(!skin||skin.bones.length<40)throw Error('Tripo V2 is missing the genuine 40-joint skinned skeleton');
  const bones=new Map(skin.bones.map(b=>[b.name,b]));
  const find=n=>{const b=bones.get(n);if(!b)throw Error('Missing Tripo rig bone '+n);return b;};
  const sets={
    spine:find('tripo::Spine_0'),
    chest:find('tripo::Spine_1'),
    head:find('tripo::Head_0'),
    leftArm:[
      find('tripo::0_Left_Limb_1'), find('tripo::0_Left_Limb_2'),
      find('tripo::0_Left_Limb_3'),find('tripo::0_Left_Limb_4')
    ],
    rightArm:[
      find('bone_16'),find('bone_17'),find('bone_18'),find('bone_19')
    ],
    leftLeg:[
      find('tripo::1_Left_Limb_0'),find('tripo::1_Left_Limb_1'),
      find('tripo::1_Left_Limb_2'),find('tripo::1_Left_Limb_3')
    ],
    rightLeg:[
      find('tripo::1_Right_Limb_0'),find('tripo::1_Right_Limb_1'),
      find('tripo::1_Right_Limb_2'),find('tripo::1_Right_Limb_3')
    ],
    cape:[find('tripo::0_Right_Limb_0'),find('tripo::0_Right_Limb_1'),
          find('tripo::0_Right_Limb_2')]
  };
  model.updateMatrixWorld(true);
  // Record rest transforms once. World -> each bone's LOCAL space, so
  // Tripo's unusual initial quaternions never get overwritten by Euler zero.
  const rest=new Map();
  for(const b of skin.bones){
    const q=new THREE.Quaternion();
    b.getWorldQuaternion(q);
    rest.set(b,{q:b.quaternion.clone(),p:b.position.clone(),
      ix:X.clone().applyQuaternion(q.clone().invert()).normalize(),
      iy:Y.clone().applyQuaternion(q.clone().invert()).normalize(),
      iz:Z.clone().applyQuaternion(q.clone().invert()).normalize()});
  }
  return {meshes,skin,sets,rest};
}
function animateRig(model,source){
  const {sets,rest}=source;
  const axisQ=new THREE.Quaternion();
  function twist(b,axes){
    const r=rest.get(b);
    b.quaternion.copy(r.q);
    for(const [axis,angle] of axes){
      if(Math.abs(angle)<1e-6)continue;
      axisQ.setFromAxisAngle(r[axis],angle);
      b.quaternion.multiply(axisQ);
    }
  }
  let phase=0,stride=0,runMix=0,airMix=0,bodyClock=0,heading=0,clip='Idle';
  let lastFrameData={speed:0,heading:0,run:false};
  // Normalization: the source knight is delivered in ~1m, 3D game is ~2.04m.
  const pos=sets.spine.position.clone();
  function update(dt,motion,now){
    const d=clamp(Number(dt)||1/60,0,1/15);
    bodyClock+=d;
    const speed=clamp((Number(motion?.speed)||0)/8,0,4.5);
    const wantsMove=speed>.12;
    const desiredRun=wantsMove&&Boolean(motion?.run);
    stride=damp(stride,wantsMove?1:0,9,d);
    runMix=damp(runMix,desiredRun?1:0,6,d);
    const airborne=Number.isFinite(motion?.jumpClipTime);
    airMix=damp(airMix,airborne?1:0,14,d);
    const jumpTime=airborne?motion.jumpClipTime:0;
    const jumpArc=airborne?Math.max(0,Math.sin(Math.PI*clamp(jumpTime/1.5,0,1))):0;
    const cadence=1.1+(runMix*.48);
    // Run faster: original source passes walk speed ~8, run ~15.
    phase+=d*(5.8+4.0*runMix)*Math.max(.6,Math.min(1.6,speed/1.1))*Math.max(.05,stride);
    const wave=Math.sin(phase);
    const opp=-wave;
    const wave2=Math.sin(phase+Math.PI*.5);
    const swing=(.26+runMix*.33)*stride*(1-.65*airMix);
    const elbowBase=.09+runMix*.16;
    // Tripo rig has arms extending along +/-Z, legs along -Y and forward +X.
    // Shoulder setDown about model-space X makes real T-pose into loose A-pose.
    twist(sets.leftArm[0], [['ix',-.79],['iy',wave*swing]]);
    twist(sets.rightArm[0],[['ix',+.79],['iy',opp*swing]]);
    twist(sets.leftArm[1], [['iy',+.12+Math.max(0,-wave)*elbowBase]]);
    twist(sets.rightArm[1],[['iy',-.12-Math.max(0,-opp)*elbowBase]]);
    twist(sets.leftArm[2], [['iy',+.025*Math.sin(bodyClock*1.7)]]);
    twist(sets.rightArm[2],[['iy',-.025*Math.sin(bodyClock*1.7)]]);
    twist(sets.leftArm[3],[]);
    twist(sets.rightArm[3],[]);
    // Anatomical motion with knee flex and foot counterrotation.
    for(const [chain,s] of [[sets.leftLeg,1],[sets.rightLeg,-1]]){
      const w=wave*s;
      const hipAngle=w*swing*(1+runMix*.45)+jumpArc*(s*.11-.31);
      const kneeAngle=Math.max(0,-w)*(.40+runMix*.33)*stride+
        jumpArc*(.38+runMix*.12);
      twist(chain[0],[['iz',hipAngle]]);
      twist(chain[1],[['iz',-kneeAngle]]);
      twist(chain[2],[['iz',kneeAngle*.34-hipAngle*.35]]);
      twist(chain[3],[]);
    }
    twist(sets.spine,[['iz',.025*wave2*stride],['ix',.045*runMix+.06*jumpArc]]);
    twist(sets.chest,[['iz',.014*Math.sin(bodyClock*1.8)],['ix',-.02*runMix]]);
    twist(sets.head,[['iz',.013*Math.sin(bodyClock*1.4)],['iy',.012*Math.cos(bodyClock*.9)]]);
    sets.spine.position.copy(pos);
    sets.spine.position.y+=.004*Math.sin(bodyClock*2.1)*(1-stride)+
      Math.abs(Math.cos(phase))*stride*.010;
    // Only 3 Tripo lower garment bones exist, not a full cloth rig.
    // Keep sway extremely subtle: don't invent impossible 7-panel physics.
    const capeDrag=stride*(.035+.05*runMix);
    twist(sets.cape[0],[['iz',.019*Math.sin(bodyClock*1.2)-capeDrag]]);
    twist(sets.cape[1],[['iz',.025*Math.sin(bodyClock*1.7+.5)-capeDrag*.7]]);
    twist(sets.cape[2],[['iz',.028*Math.sin(bodyClock*1.55+.9)-capeDrag*.55]]);
    const h=Number.isFinite(motion?.heading)?motion.heading:heading;
    heading+=Math.atan2(Math.sin(h-heading),Math.cos(h-heading))*(1-Math.exp(-12*d));
    // Parent heading is applied by the character object, while mesh has its
    // own static orientation correction, preserving all glTF bind matrices.
    model.parent.rotation.y=heading;
    clip=airborne?'Jump':runMix>.5&&stride>.45?'Run':stride>.2?'Walk':'Idle';
    lastFrameData={speed,run:desiredRun,airborne,heading,phase};
    return clip.toLowerCase();
  }
  return {update,get clip(){return clip},get state(){return lastFrameData}};
}

export function createGltfKnight(_THREE=THREE,{url=TRIPO_V2_GLB,onLoad,onError}={}){
  const root=new THREE.Group();
  root.name='THE ASHEN VOW / Tripo 40-bone authentic game character';
  const oriented=new THREE.Group();oriented.name='Tripo anatomical forward +X to game +Z';
  // GLB forward is approximately +X. Keep this static correction separate
  // from all 40 deformable bone transforms and dynamic game compass heading.
  oriented.rotation.y=-Math.PI/2;
  root.add(oriented);
  root.userData.gltf={loaded:false,actions:{},clip:'Idle',model:'Tripo H3.1 V2'};
  let disposed=false;
  new GLTFLoader().load(url,gltf=>{
    if(disposed)return;
    try{
      const model=gltf.scene;
      const box=new THREE.Box3().setFromObject(model);
      const sz=box.getSize(new THREE.Vector3());
      if(sz.y<.05||!Number.isFinite(sz.y))throw Error('Bad Tripo GLB height');
      const sc=2.04/sz.y;
      model.scale.setScalar(sc);
      model.position.set(-box.getCenter(new THREE.Vector3()).x*sc,
                         -box.min.y*sc,
                         -box.getCenter(new THREE.Vector3()).z*sc);
      oriented.add(model);
      const source=setupBones(model);
      const anim=animateRig(model,source);
      root.userData.gltf={
        loaded:true,
        actions:{Idle:true,Walk:true,Run:true,Jump:true},
        bones:source.skin.bones.length,
        skinnedMeshes:source.meshes.length,
        type:'Tripo_V2_40_Bone_Native_Runtime',
        get clip(){return anim.clip}
      };
      root.userData.animate=(dt,motion,now)=>anim.update(dt,motion,now);
      root.userData.pose=()=>anim.state;
      root.userData.prepareModel?.(model);
      onLoad?.(root);
    }catch(error){
      root.userData.error=String(error);
      onError?.(error);
    }
  },undefined,error=>{
    root.userData.error=String(error);
    onError?.(error);
  });
  root.userData.dispose=()=>{
    disposed=true;
    root.traverse(o=>{if(o.isMesh){
      o.geometry?.dispose();
      for(const m of Array.isArray(o.material)?o.material:[o.material]){
        if(m)m.dispose();
      }
    }});
    root.clear();
  };
  return root;
}
