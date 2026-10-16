// Art-direction prototype of a hierarchy-driven 3D gothic knight.
// Designed for future glTF/skinned-mesh replacement. This is a mechanical
// demonstration, not a port of the existing 192 authored ASCII keyframes.
export function createAnimatedKnight(THREE, M) {
  const root = new THREE.Group();
  root.name = 'Experimental animated crimson knight';
  const model=new THREE.Group();
  root.add(model);
  const armor=M.iron,trim=M.trim,cloth=M.red,dark=M.wood;
  function mesh(parent,geo,mat,x=0,y=0,z=0) {
    const item=new THREE.Mesh(geo,mat);
    item.position.set(x,y,z);
    item.castShadow=true;item.receiveShadow=true;parent.add(item);
    return item;
  }
  const box=(parent,w,h,d,mat,x=0,y=0,z=0)=>
    mesh(parent,new THREE.BoxGeometry(w,h,d),mat,x,y,z);
  const joint=(parent,x,y,z)=>{
    const p=new THREE.Group();p.position.set(x,y,z);parent.add(p);return p;
  };
  // Character faces the local +Z direction; feet are at model y=0.
  const hip=joint(model,0,3.3,0);
  box(hip,2.0,1.5,1.1,armor,0,.1,0);
  const torso=joint(hip,0,1.25,0);
  box(torso,2.45,3,1.15,armor,0,1.15,0);
  box(torso,2.15,1.9,.22,cloth,0,.5,.69); // crimson tabard
  box(torso,2.4,.18,1.3,trim,0,.1,0);
  for(const x of [-.85,.85])box(torso,.18,2.3,.17,trim,x,1.1,.7);
  const head=joint(torso,0,3.15,.05);
  const helm=mesh(head,new THREE.CylinderGeometry(.82,.7,1.38,8),armor,0,.4,0);
  const helmTip=mesh(head,new THREE.ConeGeometry(.8,.85,8),trim,0,1.45,0);
  helmTip.rotation.y=Math.PI/8;
  box(head,1.05,.17,.15,dark,0,.48,.77); // visor slit
  box(head,.12,.85,.15,trim,0,.55,.83);
  const legs=[];
  for(const side of [-1,1]){
    const thigh=joint(hip,side*.62,-.5,0);
    box(thigh,.67,1.63,.79,armor,0,-.7,0);
    box(thigh,.76,.36,.85,trim,0,-1.46,.12);
    const shin=joint(thigh,0,-1.55,0);
    box(shin,.63,1.36,.7,armor,0,-.63,0);
    box(shin,.83,.38,1.13,dark,0,-1.37,.17);
    legs.push({thigh,shin,side});
  }
  const arms=[];
  for(const side of [-1,1]){
    const shoulder=joint(torso,side*1.39,2.25,0);
    mesh(shoulder,new THREE.IcosahedronGeometry(.8,0),trim,side*.12,-.05,0);
    box(shoulder,.65,1.53,.75,armor,side*.06,-.82,0);
    const elbow=joint(shoulder,0,-1.5,0);
    box(elbow,.6,1.45,.68,armor,0,-.69,0);
    box(elbow,.64,.3,.73,trim,0,-1.35,0);
    if(side===1){
      box(elbow,.16,3.2,.22,trim,0,-2.65,.16);
      box(elbow,1,.19,.27,trim,0,-1.35,.17);
    }else{
      const shield=mesh(elbow,new THREE.IcosahedronGeometry(1.25,0),armor,-.3,-1.0,.5);
      shield.scale.set(.62,1.15,.25);
      box(elbow,.12,1.4,.17,trim,-.32,-1,.85);
    }
    arms.push({shoulder,elbow,side});
  }
  // Cape: several rigid panels with spring-driven local pivots, not a
  // deformation of glyphs. Geometry gives stable continuous 3D silhouettes.
  const cape=[];
  const capeRoot=joint(torso,0,2.15,-.72);
  for(let i=0;i<4;i++){
    const pivot=joint(i?cape[i-1].pivot:capeRoot,0,i?-.8:0,i?-.04:0);
    const w=2.2+i*.17;
    const panel=box(pivot,w,.91,.13,cloth,0,-.42,-.08);
    panel.rotation.x=.04*i;
    if(i===3)for(let j=0;j<5;j++){
      const fringe=box(pivot,w/5-.055,.35+j%2*.18,.13,cloth,
        (j-2)*w/5,-1.03-(j%2*.09),-.11);
      fringe.rotation.z=(j-2)*.05;
    }
    cape.push({pivot,panel});
  }
  const state={phase:0,clock:0,capeVelocity:0,capeAngle:0,verticalVelocity:0,air:0,
    x:0,z:0,heading:0,speed:0,lastMotion:'idle'};
  root.userData.animate=(dt, movement, now)=>{
    dt=Math.min(.05,Math.max(0,dt));
    const speed=movement.speed||0;
    const moving=speed>.01;
    const run=moving&&movement.run;
    const frequency=run?11:moving?7:1;
    state.phase+=dt*frequency;
    state.clock+=dt;
    const gait=moving?Math.min(1,speed/10):0;
    const amplitude=gait*(run?.7:.44);
    const phase=state.phase;
    hip.rotation.x=moving?.045:0;
    hip.rotation.z=moving?Math.sin(phase)*.027:0;
    torso.rotation.z=Math.sin(phase*.5)*.022*(moving?1:.55);
    torso.rotation.x=run?.13:moving?.04:0;
    torso.position.y=1.25+Math.sin(phase*2)*(.065*gait)+Math.sin(state.clock*1.9)*.026;
    head.rotation.z=Math.sin(state.clock*.8)*.025;
    for(const limb of legs){
      const p=phase+(limb.side===1?0:Math.PI);
      limb.thigh.rotation.x=Math.sin(p)*amplitude;
      limb.shin.rotation.x=Math.max(0,Math.cos(p))*.64*gait;
      limb.thigh.rotation.z=limb.side*.02;
    }
    for(const arm of arms){
      const p=phase+(arm.side===1?Math.PI:0);
      arm.shoulder.rotation.x=Math.sin(p)*amplitude*.55+(arm.side===1?-.17:.1);
      arm.elbow.rotation.x=-.24-Math.max(0,-Math.sin(p))*.2*gait;
    }
    // Damped secondary cape simulation. Retains momentum after stopping.
    const target=(moving?speed*.025:0)+Math.sin(state.clock*1.3)*.09;
    state.capeVelocity+=(target-state.capeAngle)*38*dt;
    state.capeVelocity*=Math.exp(-7*dt);
    state.capeAngle+=state.capeVelocity*dt;
    cape.forEach((part,i)=>{
      part.pivot.rotation.x=.12+state.capeAngle*(.7+i*.17)+Math.sin(state.clock*1.6-i*.63)*(.045+i*.026);
      part.pivot.rotation.z=Math.sin(state.clock*1.3-i*.4)*(.04+i*.019);
    });
    if(movement.jump && state.air<=.001){
      state.verticalVelocity=8.8;
    }
    if(state.air>0||state.verticalVelocity>0){
      state.air+=state.verticalVelocity*dt;
      state.verticalVelocity-=23*dt;
      if(state.air<=0){state.air=0;state.verticalVelocity=0;}
    }
    model.position.y=state.air;
    const targetYaw=movement.heading===undefined?root.rotation.y:movement.heading;
    const delta=Math.atan2(Math.sin(targetYaw-root.rotation.y),Math.cos(targetYaw-root.rotation.y));
    root.rotation.y+=delta*Math.min(1,dt*11);
    state.lastMotion=state.air>.01?'jump':run?'run':moving?'walk':'idle';
    return state.lastMotion;
  };
  root.userData.animationState=state;
  root.userData.footprint={radius:.85,height:8.3};
  return root;
}
