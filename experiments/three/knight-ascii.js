// Read-only bridge for the game's 192 authored ASCII knight frames.
// One reused canvas/texture per actor: never allocate 192 GPU textures on mobile.
// This is a parity REFERENCE, not a replacement for the independently animated 3D rig.
export function createLegacyKnight(THREE,frames) {
  if(!Array.isArray(frames)||frames.length!==192)throw new Error('Expected 192 original ASCII knight frames');
  const COLS=104,ROWS=54,CW=6,CH=10;
  const canvas=document.createElement('canvas');
  canvas.width=COLS*CW;canvas.height=ROWS*CH;
  const ctx=canvas.getContext('2d',{alpha:true});
  if(!ctx)throw new Error('2D canvas required for legacy knight bridge');
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=THREE.NearestFilter;
  texture.minFilter=THREE.LinearFilter;
  texture.generateMipmaps=false;
  const material=new THREE.MeshBasicMaterial({
    map:texture,transparent:false,alphaTest:.08,depthTest:true,depthWrite:true,
    side:THREE.DoubleSide,color:0xd2d2d0,fog:true
  });
  const height=8.9,width=height*COLS*CW/(ROWS*CH);
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
  mesh.name='Original 192-frame ASCII knight (read-only bridge)';
  mesh.position.y=height/2;
  mesh.castShadow=false;
  mesh.receiveShadow=false;
  mesh.frustumCulled=false;
  const root=new THREE.Group();
  root.add(mesh);
  const playerState={frame:-1,clock:0,mode:'idle',direction:0,lastKey:''};
  const jumpMap=[0,0,0,1,2,3,3,0]; // source groups: S / NW / N / NE
  function paint(id) {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const all=frames[id].split('\n');
    const skipped=Math.max(0,Math.min(ROWS,Number.parseInt(all[0],10)||0));
    ctx.font='bold 10px monospace';
    ctx.textAlign='left';ctx.textBaseline='top';
    // Characters encode the original source atlas luminosity;
    // spaces are transparent, "'" means a dark armor plate.
    for(let row=1;row<all.length;row++){
      const y=skipped+(row-1);
      if(y>=ROWS)break;
      const text=all[row]||'';
      if(!text.trim())continue;
      ctx.fillStyle='#e8e8e5';
      // Preserve glyph column offsets, including leading indentation.
      ctx.fillText(text,0,y*CH);
    }
    texture.needsUpdate=true;
    playerState.frame=id;
  }
  function animate(dt,{mode='idle',heading=0,jumpProgress=0}={}) {
    dt=Math.max(0,Math.min(.05,dt));
    playerState.clock+=dt;
    const dir=((8-Math.round(heading/(Math.PI/4)))%8+8)%8;
    const dirMode=mode==='jump'?'jump':mode==='run'?'run':mode==='walk'?'walk':'idle';
    let frame;
    if(dirMode==='walk')frame=8+dir*10+(Math.floor(playerState.clock*12)%10);
    else if(dirMode==='run')frame=88+dir*8+(Math.floor(playerState.clock*16)%8);
    else if(dirMode==='jump')frame=152+jumpMap[dir]*10+
      Math.min(9,Math.floor(Math.max(0,jumpProgress)*10));
    else frame=dir;
    if(frame!==playerState.frame)paint(frame);
    playerState.mode=dirMode;
    playerState.direction=dir;
    return frame;
  }
  // Return an explicit disposer so multiple scene rebuilds don't leak textures.
  root.userData.legacyState=playerState;
  root.userData.animateLegacy=animate;
  root.userData.billboard=mesh;
  root.userData.disposeLegacy=()=>{
    mesh.geometry.dispose();
    material.dispose();
    texture.dispose();
  };
  paint(0);
  return root;
}
