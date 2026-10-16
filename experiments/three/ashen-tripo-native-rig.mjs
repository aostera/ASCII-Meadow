// Real Tripo H3.1 V2 skin: 40 Tripo bones + authored game-time animation poses.
// NO procedural character mesh, NO fake glyph-ball, NO AI/Tripo paid animation calls.
// Uses existing, skinned, 399k triangle / 10.7 MB GLB.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createAshenGothicLongsword} from './ashen-gothic-longsword.mjs';

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
  const find=(n,index)=>{const b=bones.get(n)||skin.bones[index];if(!b)throw Error('Missing Tripo rig joint '+n+' / '+index);return b;};
  // glTF-Transform's mesh optimizer can rename GLB bones while preserving
  // skin.joints INDEX order, weights and inverse-bind matrices. Use exact
  // original Tripo skin indices as stable animation bindings.
  const sets={
    spine:find('tripo::Spine_0',1),
    chest:find('tripo::Spine_1',2),
    head:find('tripo::Head_0',4),
    leftArm:[
      find('tripo::0_Left_Limb_1',6), find('tripo::0_Left_Limb_2',7),
      find('tripo::0_Left_Limb_3',8),find('tripo::0_Left_Limb_4',9)
    ],
    rightArm:[
      find('bone_16',16),find('bone_17',17),find('bone_18',18),find('bone_19',19)
    ],
    leftLeg:[
      find('tripo::1_Left_Limb_0',31),find('tripo::1_Left_Limb_1',32),
      find('tripo::1_Left_Limb_2',33),find('tripo::1_Left_Limb_3',34)
    ],
    rightLeg:[
      find('tripo::1_Right_Limb_0',26),find('tripo::1_Right_Limb_1',27),
      find('tripo::1_Right_Limb_2',28),find('tripo::1_Right_Limb_3',29)
    ],
    cape:[find('tripo::0_Right_Limb_0',36),find('tripo::0_Right_Limb_1',37),
          find('tripo::0_Right_Limb_2',38)]
  };
  model.updateMatrixWorld(true);
  // Record rest transforms once. Animate around ANATOMICAL model axes,
  // not fixed scene axes. The model is permanently reoriented +X -> +Z
  // by its parent; using uncorrected world Z to flex the knees twists
  // them sideways when the parent rotation is -90 degrees.
  // Convert source model axes -> world -> bone-local rest coordinates.
  const modelWorldQ=new THREE.Quaternion();
  model.getWorldQuaternion(modelWorldQ);
  const modelAxes=[X,Y,Z].map(axis=>axis.clone().applyQuaternion(modelWorldQ));
  const rest=new Map();
  for(const b of skin.bones){
    const q=new THREE.Quaternion();
    b.getWorldQuaternion(q);
    const inverseWorld=q.clone().invert();
    rest.set(b,{q:b.quaternion.clone(),p:b.position.clone(),
      ix:modelAxes[0].clone().applyQuaternion(inverseWorld).normalize(),
      iy:modelAxes[1].clone().applyQuaternion(inverseWorld).normalize(),
      iz:modelAxes[2].clone().applyQuaternion(inverseWorld).normalize()});
  }
  return {meshes,skin,sets,rest};
}
// Anatomical, phase-continuous walk/run with stance/swing foot targets.
// Every joint below deforms the authentic Tripo SKIN rather than a fake puppet.
function animateRig(model,source,root,weapon){
  const {sets,rest}=source,axisQ=new THREE.Quaternion();
  const wristWorldQ=new THREE.Quaternion(),rootWorldQ=new THREE.Quaternion();
  const swordCantQ=new THREE.Quaternion();
  function twist(b,axes){
    const r=rest.get(b);
    b.quaternion.copy(r.q);
    for(const [axis,angle] of axes){
      if(Math.abs(angle)<1e-6)continue;
      axisQ.setFromAxisAngle(r[axis],angle);
      b.quaternion.multiply(axisQ);
    }
  }
  const smooth=t=>{const a=clamp(t,0,1);return a*a*(3-2*a)};
  let phase=0,stride=0,runMix=0,airMix=0,bodyClock=0,heading=0,clip='Idle';
  const capeRoll=[0,0,0],capeYaw=[0,0,0];
  let lastFrameData={speed:0,heading:0,run:false,airborne:false,phase:0,
    leftFootLift:0,rightFootLift:0,leftFootX:0,rightFootX:0,
    weaponAttached:true,footContact:[true,true],kneeBend:[0,0]};
  const pos=sets.spine.position.clone();
  const L1=.209, L2=.169; // actual Tripo knee/ankle REST lengths in mesh units
  function legPose(bones,offset,weight,jumpWeight,run){
    const p=((phase/(2*Math.PI)+offset)%1+1)%1;
    const stance=run>.5?.50:.61;
    const inStance=p<stance;
    const u=inStance?p/stance:(p-stance)/(1-stance);
    const step=.115+run*.048,back=step*(inStance?1-2*u:2*smooth(u)-1);
    const lift=inStance?0:(.062+run*.055)*Math.sin(Math.PI*u);
    // Foot pose (X is natural model forward): foot planted during stance,
    // lifted and carried forward during swing. Jump tucks both legs.
    const x=weight*back*(1-.76*jumpWeight)+(offset?.028:-.028)*jumpWeight;
    const y=-.370+weight*lift*(1-.6*jumpWeight)+.098*jumpWeight;
    const rawLen=Math.hypot(x,y),len=clamp(rawLen,.10,L1+L2-.002);
    const theta=Math.atan2(x,-y);
    const alpha=Math.acos(clamp((L1*L1+len*len-L2*L2)/(2*L1*len),-1,1));
    const knee=Math.PI-Math.acos(clamp((L1*L1+L2*L2-len*len)/(2*L1*L2),-1,1));
    const hip=theta-alpha;
    // Both legs are vertical in source GLB. Rotating about model Z
    // produces sagittal (forward/backward) motion; rotating X would splay!
    twist(bones[0],[['iz',hip]]);
    twist(bones[1],[['iz',knee]]);
    twist(bones[2],[['iz',-hip-knee*.76]]);
    twist(bones[3],[]);
    // At rest both feet are planted. Without this guard the continuously
    // running phase incorrectly marked an idle foot as airborne.
    return {lift:weight*lift,x,knee,
      contact:jumpWeight<.15&&(weight<.08||inStance)};
  }
  function update(dt,motion,now){
    const d=clamp(Number(dt)||1/60,0,1/15);
    bodyClock+=d;
    const speed=clamp((Number(motion?.speed)||0)/8,0,4.5);
    const moving=speed>.12;
    const running=moving&&Boolean(motion?.run);
    stride=damp(stride,moving?1:0,9,d);
    runMix=damp(runMix,running?1:0,7,d);
    const airborne=Number.isFinite(motion?.jumpClipTime);
    airMix=damp(airMix,airborne?1:0,15,d);
    const jumpTime=airborne?motion.jumpClipTime:0;
    const arc=airborne?Math.max(0,Math.sin(Math.PI*clamp(jumpTime/1.49,0,1))):0;
    const jumpWeight=Math.max(arc*.94,airMix*.32);
    // phase must NEVER reset when moving between Idle/Walk/Run.
    const hz=(1.45+1.20*runMix)*Math.min(1.45,Math.max(.7,speed));
    phase+=d*2*Math.PI*hz*(stride>.03?1:.02);
    const swing=Math.sin(phase);
    const armAmplitude=(.19+runMix*.20)*stride*(1-.78*airMix);
    // The source Tripo shoulder bones rest in a near T-pose along +/-Z.
    // Old 0.69 rad X rotations left them spread ~45 degrees from the
    // torso; additionally, rolling around Z while the arm extends on Z
    // cannot produce a proper forward walking swing. Correct 3D hinges:
    //   shoulder: X lowers arm / Y swings it in the sagittal plane;
    //   elbow:    Y bends forearm forward after the shoulder is lowered.
    // The right (weapon) arm swings less, to avoid blade/torso clipping.
    // 1.28 folded both gloves onto the belt and moved the sword into the
    // groin. 0.98 keeps natural clearance between forearms and tassets.
    const shoulderDown=.98;
    twist(sets.leftArm[0],[['ix',-shoulderDown],['iy',-swing*armAmplitude]]);
    twist(sets.rightArm[0],[['ix',shoulderDown],['iy',-swing*armAmplitude*.38]]);
    const leftElbow=-.20-.11*stride*Math.max(0,-swing);
    const rightElbow=.24+.10*stride*Math.max(0,swing);
    twist(sets.leftArm[1],[['iy',leftElbow]]);
    twist(sets.rightArm[1],[['iy',rightElbow]]);
    twist(sets.leftArm[2],[['iy',-.018+Math.sin(bodyClock*1.4)*.015]]);
    twist(sets.rightArm[2],[['iy',.025]]);
    twist(sets.leftArm[3],[]);
    twist(sets.rightArm[3],[]);
    const left=legPose(sets.leftLeg,0,stride,jumpWeight,runMix);
    const right=legPose(sets.rightLeg,.5,stride,jumpWeight,runMix);
    twist(sets.spine,[['iz',.028*runMix+.022*arc],['ix',.012*Math.sin(phase)*stride]]);
    twist(sets.chest,[['iz',-.012*runMix],['ix',.012*Math.sin(bodyClock*1.75)]]);
    twist(sets.head,[['ix',.012*Math.sin(bodyClock*1.1)],['iy',.015*Math.cos(bodyClock*.7)]]);
    sets.spine.position.copy(pos);
    sets.spine.position.y+=.004*Math.sin(bodyClock*1.8)*(1-stride)+
      Math.abs(Math.cos(phase))*stride*.012;
    // Preserve turning inertia through the three REAL Tripo cape joints.
    // Small damped delays create secondary follow-through without faking
    // cloth physics or changing the character's torso/body dimensions.
    const targetHeading=Number.isFinite(motion?.heading)?motion.heading:heading;
    const turnDelta=Math.atan2(Math.sin(targetHeading-heading),Math.cos(targetHeading-heading));
    const headingStep=turnDelta*(1-Math.exp(-12*d));
    heading+=headingStep;
    root.rotation.y=heading;
    // The Gothic sword is parented to the Tripo RIGHT wrist for position.
    // Counter-rotate only the independent sword mesh so the blade still
    // points DOWN next to the boot as the wrist bends; previously the
    // inherited T-pose orientation sent it across the belt/left leg.
    root.getWorldQuaternion(rootWorldQ);
    sets.rightArm[3].getWorldQuaternion(wristWorldQ);
    swordCantQ.setFromAxisAngle(Z,-.12-.025*stride);
    weapon.quaternion.copy(wristWorldQ.invert()).multiply(rootWorldQ).multiply(swordCantQ);
    const turning=clamp(headingStep/d,-3.5,3.5);
    const drag=stride*(.016+.038*runMix);
    for(let i=0;i<sets.cape.length;i++){
      const lag=i/2,slow=8/(1+.7*i);
      const sway=(.011+.009*lag)*Math.sin(bodyClock*(1.2+.15*i)+i*.45);
      const dragTarget=-drag*(1-.24*lag)+sway;
      const turnTarget=clamp(-turning*(.006+.004*i),-.050,.050);
      capeRoll[i]=damp(capeRoll[i],dragTarget,slow,d);
      capeYaw[i]=damp(capeYaw[i],turnTarget,slow*.7,d);
      twist(sets.cape[i],[['iz',capeRoll[i]],['iy',capeYaw[i]]]);
    }
    clip=airborne?'Jump':runMix>.5&&stride>.4?'Run':stride>.2?'Walk':'Idle';
    lastFrameData={
      speed,run:running,airborne,heading,phase,
      footContact:[left.contact,right.contact],
      leftFootLift:left.lift,rightFootLift:right.lift,
      leftFootX:left.x,rightFootX:right.x,
      kneeBend:[left.knee,right.knee],
      capeDeflection:capeRoll.map((roll,i)=>[roll,capeYaw[i]]),
      weaponAttached:!!weapon?.parent,
      armPose:{shoulderDown,shoulderSwing:-swing*armAmplitude,
        leftElbow,rightElbow,swordCant:-.12-.025*stride},
      animationVersion:'Tripo-IK-v4-anatomical-arm-hinges'
    };
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
      // The sword is its OWN geometry and follows the true right wrist.
      // Orient in hand rest space so the point is down beside the body.
      const weapon=createAshenGothicLongsword();
      const wrist=source.sets.rightArm[3];
      model.updateMatrixWorld(true);
      const restWorld=new THREE.Quaternion();
      wrist.getWorldQuaternion(restWorld);
      wrist.add(weapon);
      weapon.position.set(0,0,0);
      weapon.quaternion.copy(restWorld.invert());
      weapon.userData.socketBoneIndex=source.skin.bones.indexOf(wrist);
      const anim=animateRig(model,source,root,weapon);
      root.userData.gltf={
        loaded:true,
        actions:{Idle:true,Walk:true,Run:true,Jump:true},
        bones:source.skin.bones.length,
        skinnedMeshes:source.meshes.length,
        weapon:'detached Gothic longsword',
        weaponSocketBone:weapon.userData.socketBoneIndex,
        type:'Tripo_V2_40_Bone_Native_Runtime',
        get clip(){return anim.clip}
      };
      root.userData.animate=(dt,motion,now)=>anim.update(dt,motion,now);
      root.userData.pose=()=>anim.state;
      root.userData.weapon=weapon;
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
