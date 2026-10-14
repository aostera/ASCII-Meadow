// Mechanical native Three.js cow, for a SIDE diagnostic inset only.
// All states come from the actual game cows[]; artwork and alpha unchanged.
// Keep mesh count low and reuse shared material/geometry ownership per cow.
export function createAnimatedCow(THREE,materials){
 const root=new THREE.Group();
 root.name='original-source-driven-gothic-cow-diagnostic';
 const bodyRoot=new THREE.Group();root.add(bodyRoot);
 const geo={
  ball:new THREE.SphereGeometry(1,12,9),
  tube:new THREE.CylinderGeometry(1,1,1,8),
  cone:new THREE.ConeGeometry(1,1,8)
 };
 const solid=(parent,g,mat,pos,scale,rot)=>{
  const m=new THREE.Mesh(geo[g],materials[mat]);
  m.position.set(...pos);m.scale.set(...scale);
  if(rot)m.rotation.set(...rot);
  m.castShadow=false;m.receiveShadow=false;
  parent.add(m);return m;
 };
 const joint=(parent,pos)=>{
  const node=new THREE.Group();node.position.set(...pos);parent.add(node);
  return node;
 };
 solid(bodyRoot,'ball','hide',[0,4.4,0],[1.75,1.9,3.05]);
 solid(bodyRoot,'ball','armor',[0,5.5,-.55],[1.45,.58,2.1]);
 solid(bodyRoot,'ball','hide',[0,3.9,2.2],[1.50,1.6,1.10]);
 // Hollow dark stomach, subdued udder and four teats.
 solid(bodyRoot,'ball','shadow',[0,2.95,-.95],[.95,.32,.84]);
 const teats=[];
 for(const x of [-.45,.45])for(const z of [-1.25,-.6])
  teats.push(solid(bodyRoot,'tube','shadow',[x,2.6,z],[.11,.52,.11]));
 const legs=[];
 for(const z of [-2.1,1.85])for(const x of [-1.12,1.12]){
  const upper=joint(bodyRoot,[x,3.4,z]);
  solid(upper,'ball','hide',[0,-.7,0],[.48,1.15,.45]);
  const lower=joint(upper,[0,-1.48,0]);
  solid(lower,'tube','hide',[0,-.58,0],[.29,1.25,.29]);
  solid(lower,'ball','hoof',[0,-1.25,.25],[.48,.33,.73]);
  legs.push({upper,lower,x,z});
 }
 // Grazing pivots around the neck; the cow lowers its REAL head to eat.
 const neck=joint(bodyRoot,[0,5.15,2.0]);
 solid(neck,'ball','hide',[0,.25,.75],[.92,1.12,1.18],[-.12,0,0]);
 const head=joint(neck,[0,.38,1.45]);
 solid(head,'ball','hide',[0,.02,.46],[.89,.93,.9]);
 solid(head,'ball','muzzle',[0,-.35,1.1],[.68,.48,.65]);
 for(const side of [-1,1]){
  const ear=solid(head,'ball','hide',[side*1.04,.48,.05],[.68,.19,.42],
   [0,0,side*.23]);
  ear.rotation.z=side*.3;
  solid(head,'cone','horn',[side*.48,1.0,.12],[.19,.69,.2],
   [side*.18,0,side*-.25]);
  solid(head,'ball','shadow',[side*.39,.18,1.14],[.15,.12,.09]);
 }
 const tail=joint(bodyRoot,[0,5.25,-2.55]);
 solid(tail,'tube','hide',[0,-.75,-.25],[.1,1.55,.13],[-.3,0,0]);
 solid(tail,'ball','muzzle',[0,-1.6,-.5],[.25,.45,.25]);
 const state={phase:0,motion:'idle',cowState:'idle',headLowering:0,hop:0,clock:0};
 root.userData.animateFromSource=(dt,pose)=>{
  if(!(dt>=0&&dt<=.15))throw Error('Invalid original cow animation timestep');
  state.clock+=dt;
  const gait=pose.gait||0;
  state.phase+=dt*(gait>1?10:gait>0?5.5:0);
  for(const leg of legs){
   const alternating=(leg.x<0?-1:1)*(leg.z<0?-1:1);
   leg.upper.rotation.x=Math.sin(state.phase+(alternating<0?Math.PI:0))*gait*.36;
   leg.lower.rotation.x=Math.max(0,Math.sin(state.phase+(alternating<0?0:Math.PI)))*
     gait*.22;
  }
  // The four source grazing states are down, loop, up and idle. Avoid a
  // separate timer guessing a synthetic grazing duration.
  const down=pose.lowerHead||0;
  neck.rotation.x=down*.95;
  head.rotation.x=down*.22+ (pose.headSway||0);
  bodyRoot.position.y=(pose.hop||0)*1.0+Math.sin(state.phase*2)*(gait*.035);
  bodyRoot.rotation.z=Math.sin(state.phase)*(gait*.025);
  tail.rotation.z=Math.sin(state.clock*2.7+pose.d8*.3)*.21;
  tail.rotation.x=Math.sin(state.clock*1.9)*.13;
  root.rotation.y=pose.heading;
  state.motion=pose.state;
  state.cowState=pose.state;
  state.headLowering=down;
  state.hop=pose.hop||0;
  return state.motion;
 };
 root.userData.animationState=state;
 root.userData.sourceFootprint={length:6.1,width:3.5,height:7.1};
 root.userData.dispose=()=>{
  for(const g of Object.values(geo))g.dispose();
  // Material instances are owned by the scene controlling this cow.
 };
 return root;
}
