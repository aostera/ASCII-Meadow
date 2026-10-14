// Place the original castle and ruins into a common 3D world using the
// game's *actual* oblique projection and authoritative authored-map offsets.
// Rendering is opt-in / geometry-only; never substitutes for the 1:1 ASCII
// backend or alters user-selected brightness/alpha in the original scene.
//
// Original game: sx = anchorX + x*scale
//                sy = anchorY - (y*cosPitch + z*sinPitch)*scale
// Three world uses X mirroring solely because its right-handed lookAt basis
// would otherwise reverse the original raycaster's screen-X direction.

export function projectedPixel(point,anchor,scale,pitch){
  const [x,y,z]=point;
  return [anchor[0]+x*scale,anchor[1]-(y*Math.cos(pitch)+z*Math.sin(pitch))*scale];
}

export function anchorForSource(kind,site,cathedral,WS){
  if(kind==='castle')return [cathedral.kx,cathedral.ky];
  if(!site)throw Error('Author ruin site required');
  return [cathedral.ox+site.x*WS,
          cathedral.oy-site.z*Math.sin(0.87)*WS];
}

export function projectToNativeWorld(point,anchor,scale,pitch) {
  const s=Math.sin(pitch),c=Math.cos(pitch);
  return [-anchor[0]-point[0]*scale,
          -anchor[1]*c+point[1]*scale,
          -anchor[1]*s+point[2]*scale];
}

export function nativeCameraFrame(width,height,zoom,camLeft,camTop,pitch,rayDistance=12000){
  const c=Math.cos(pitch),s=Math.sin(pitch);
  const centerScreenX=camLeft+width/(2*zoom);
  const centerScreenY=camTop+height/(2*zoom);
  const target=[-centerScreenX,-centerScreenY*c,-centerScreenY*s];
  // Rays of the legacy castle renderer travel (0,-sinPitch,+cosPitch).
  const position=[target[0],
    target[1]+s*rayDistance,
    target[2]-c*rayDistance];
  return {
    target,position,up:[0,c,s],
    left:-width/(2*zoom),right:width/(2*zoom),
    top:height/(2*zoom),bottom:-height/(2*zoom)
  };
}

export function createNativeSourceWorld(THREE,{
  solids,ruinSites,ruinDetail,ruinRotateMesh,cathedral,WS,MS,pitch,materials,
  makeSourceArchitecture
}){
  const group=new THREE.Group();
  group.name='actual-authored-map-gothic-architecture';
  const ids=new Set();
  function add(name,parts,anchor,scale){
    const mesh=makeSourceArchitecture(THREE,parts,materials);
    mesh.name=name;
    const c=Math.cos(pitch),s=Math.sin(pitch);
    mesh.position.set(-anchor[0],-anchor[1]*c,-anchor[1]*s);
    mesh.scale.set(-scale,scale,scale);
    mesh.userData.anchor=anchor;
    mesh.userData.sourceId=name;
    group.add(mesh);
    ids.add(name);
  }
  add('castle',solids,anchorForSource('castle',null,cathedral,WS),MS);
  const keep=solids.length;
  for(const site of ruinSites()){
    if(ids.has(site.id))throw Error('Duplicate authored ruin ID: '+site.id);
    let newParts;
    try {
      ruinDetail(site);
      newParts=solids.slice(keep);
    }finally{solids.length=keep}
    ruinRotateMesh(newParts,site);
    add(site.id,newParts,anchorForSource('ruin',site,cathedral,WS),WS);
  }
  group.userData.sourceSites=[...ids];
  group.userData.sourceCounts=group.children.map(g=>({
    id:g.name,...g.userData.sourceStatistics
  }));
  return group;
}

export function configureNativeCamera(THREE,camera,{W,H,VZ,camX,camY,CW,CH,pitch}){
  if(!(W>0&&H>0&&VZ>0))throw Error('Invalid real game viewport');
  const view=nativeCameraFrame(W,H,VZ,camX*CW,camY*CH,pitch);
  camera.left=view.left;camera.right=view.right;
  camera.top=view.top;camera.bottom=view.bottom;
  camera.near=0.01;camera.far=40000;
  camera.position.set(...view.position);
  camera.up.set(...view.up);
  camera.lookAt(...view.target);
  camera.updateProjectionMatrix();
  return view;
}
