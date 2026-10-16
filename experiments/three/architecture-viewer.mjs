// An OPTIONAL inspection view for 3D geometry reconstructed from the SAME
// convex raycasting solids as the original ASCII Gothic structures. It never
// overwrites the 1:1 glyph renderer, author map, brightness or transparency.
import * as THREE from 'three';
import {makeSourceArchitecture} from './source-masonry.mjs';
import {createNativeSourceWorld,configureNativeCamera,anchorForSource} from './source-world.mjs';

export function openSourceArchitecture({solids,ruinSites,ruinDetail,ruinRotateMesh,cathedral,WS,MS,PITCH,getCamera,initialWorld=false}){
  if(document.getElementById('source-architecture-lab'))return window.__ASCII_SOURCE_3D__;
  // Suspend hidden gameplay drawing, instead of keeping two expensive GPU
  // render loops running behind the model inspection view on an iPad.
  const savedSim=window.simulate,savedRender=window.render;
  window.simulate=()=>{};window.render=()=>{};
  const root=document.createElement('section');
  root.id='source-architecture-lab';
  root.style.cssText='position:fixed;inset:0;z-index:30;background:#0c0c0c;color:#e0e0e0;display:flex;flex-direction:column;font:12px/1.5 ui-monospace,monospace;touch-action:none';
  root.innerHTML='<div id="source-arch-toolbar" style="display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:12px;background:#101010;border-bottom:1px solid #3a3a3a;z-index:1"><strong>ASCII MEADOW · ИСХОДНАЯ 3D-ГЕОМЕТРИЯ</strong><select id="source-arch-site" aria-label="Объект" style="background:#242424;color:#eee;border:1px solid #777;padding:7px"></select><select id="source-arch-focus" aria-label="Центр камеры" style="display:none;background:#242424;color:#eee;border:1px solid #777;padding:7px"></select><button id="source-arch-sync" type="button" style="background:#242424;color:#eee;border:1px solid #777;padding:7px;display:none">Камера игры: выкл.</button><span id="source-arch-meta">Загрузка геометрии...</span><button id="source-arch-close" style="margin-left:auto;background:#2a2a2a;color:#fff;border:1px solid #777;padding:7px 11px">Вернуться к игре</button></div><div id="source-arch-stage" style="flex:1;min-height:100px;position:relative;overflow:hidden"></div><small style="padding:7px 12px;color:#8d8d8d">Экспериментальная 3D-геометрия оригинальных стен и проёмов. Перетаскивание — поворот, колёсико — масштаб. Исходная ASCII-графика не изменена.</small>';
  document.body.append(root);
  const stage=root.querySelector('#source-arch-stage');
  const select=root.querySelector('#source-arch-site');
  const focusSelect=root.querySelector('#source-arch-focus');
  const meta=root.querySelector('#source-arch-meta');
  const chooser=[{id:'world',title:'Весь мир · исходная карта',site:null},{id:'castle',title:'Главный замок',site:null}];
  for(const site of ruinSites())chooser.push({id:site.id,title:site.type+' — '+site.id,site});
  for(const item of chooser){
    const option=document.createElement('option');
    option.value=item.id;option.textContent=item.title;select.append(option);
    if(item.id!=='world')focusSelect.append(option.cloneNode(true));
  }
  const renderer=new THREE.WebGLRenderer({
    antialias:true,alpha:false,powerPreference:'low-power'
  });
  renderer.setClearColor(0x0c0c0c,1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  const canvas=renderer.domElement;
  canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab';
  stage.append(canvas);
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x0c0c0c);
  const camera=new THREE.PerspectiveCamera(44,1,0.5,25000);
  const orthographic=new THREE.OrthographicCamera(-1,1,1,-1,0.1,40000);
  const syncButton=root.querySelector('#source-arch-sync');
  let syncWithGame=false,worldProjection=null;
  scene.add(new THREE.HemisphereLight(0xe4e4e4,0x333333,2.0));
  const key=new THREE.DirectionalLight(0xe5e5e5,2.3);
  key.position.set(-450,1000,650);scene.add(key);
  const materials={
    wall:new THREE.MeshStandardMaterial({color:0x969696,roughness:0.92}),
    roof:new THREE.MeshStandardMaterial({color:0x737373,roughness:1}),
    spire:new THREE.MeshStandardMaterial({color:0x818181,roughness:.9}),
    rock:new THREE.MeshStandardMaterial({color:0x575757,roughness:1}),
    step:new THREE.MeshStandardMaterial({color:0xaaaaaa,roughness:1})
  };
  let mesh=null,scale=1,theta=.52,phi=.55,target=new THREE.Vector3(),disposed=false,worldMode=false;
  const stats={id:null,sourceSolids:0,skipped:0,triangles:0,drawCalls:0};
  function render(){
    if(disposed)return;
    const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);
    renderer.setSize(w,h,false);
    if(worldMode){
      const original=getCamera();
      // An orthographic world view with the EXACT authored camera pitch,
      // zoom, map scale and camera coordinates. Source plane vertices have
      // not been stylized, recolored or shifted relative to the original map.
      const zoom=syncWithGame?original.VZ:worldProjection.zoom;
      const focus=syncWithGame?{camX:original.camX,camY:original.camY}:{
        camX:(worldProjection.x-w/(2*zoom))/original.CW,
        camY:(worldProjection.y-h/(2*zoom))/original.CH
      };
      configureNativeCamera(THREE,orthographic,{
        ...original,W:w,H:h,VZ:zoom,camX:focus.camX,camY:focus.camY,pitch:PITCH
      });
      renderer.render(scene,orthographic);
    }else{
      camera.aspect=w/h;camera.updateProjectionMatrix();
      const radius=scale;
      camera.position.set(
        target.x+radius*Math.sin(theta)*Math.cos(phi),
        target.y+radius*Math.sin(phi),
        target.z+radius*Math.cos(theta)*Math.cos(phi)
      );
      camera.lookAt(target);
      renderer.render(scene,camera);
    }
  }
  function focusOn(siteId){
    if(!worldMode||!mesh)return false;
    const building=mesh.children.find(child=>child.name===siteId);
    if(!building)return false;
    const box=new THREE.Box3().setFromObject(building);
    if(box.isEmpty())return false;
    const bounds=box.getSize(new THREE.Vector3());
    const center=box.getCenter(new THREE.Vector3());
    const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);
    // Fit actual projected screen footprint, not its unconstrained depth.
    // Native map X is mirrored so the right-handed Three.js camera displays
    // the same screen X as the author's original raycaster.
    const apparentHeight=Math.abs(bounds.y*Math.cos(PITCH))+Math.abs(bounds.z*Math.sin(PITCH));
    const zoom=Math.max(.08,Math.min(1.1,
      w*.78/Math.max(1,bounds.x),h*.76/Math.max(1,apparentHeight)));
    worldProjection={x:-center.x,
      y:-(center.y*Math.cos(PITCH)+center.z*Math.sin(PITCH)),zoom};
    focusSelect.value=siteId;
    syncWithGame=false;
    syncButton.textContent='Камера игры: выкл.';
    render();
    return true;
  }
  function clearGeometry(){
    if(!mesh)return;
    mesh.traverse(part=>{if(part.geometry)part.geometry.dispose()});
    scene.remove(mesh);mesh=null;
  }
  function show(id){
    const item=chooser.find(entry=>entry.id===id);
    if(!item)throw new Error('Unknown original source geometry '+id);
    clearGeometry();
    let parts=solids,site=item.site;
    worldMode=id==='world';
    syncButton.style.display=worldMode?'inline-block':'none';
    focusSelect.style.display=worldMode?'inline-block':'none';
    if(worldMode){
      mesh=createNativeSourceWorld(THREE,{
        solids,ruinSites,ruinDetail,ruinRotateMesh,cathedral,
        WS,MS,pitch:PITCH,materials,makeSourceArchitecture
      });
      scene.add(mesh);
      const counts=mesh.userData.sourceCounts;
      Object.assign(stats,{
        id,sourceSolids:counts.reduce((v,x)=>v+x.solids,0),
        skipped:counts.reduce((v,x)=>v+x.skipped,0),
        triangles:counts.reduce((v,x)=>v+x.triangles,0),
        drawCalls:counts.reduce((v,x)=>v+x.drawCalls,0),
        authoredSites:counts.length
      });
      meta.textContent=stats.authoredSites+' исходных построек · '+
        stats.triangles+' треугольников · '+stats.drawCalls+' батчей';
      select.value=id;focusOn('castle');
      return {...stats};
    }
    if(site){
      // Rebuild the exact original ruin primitives without saving or altering
      // the author map. Restore the castle raycaster immediately afterwards.
      const n=solids.length;
      try {
        ruinDetail(site);
        parts=solids.slice(n);
      }finally{solids.length=n}
      ruinRotateMesh(parts,site);
    }
    mesh=makeSourceArchitecture(THREE,parts,materials);
    if(site)mesh.position.set(site.x,0,site.z);
    else if(cathedral.off)mesh.position.set(cathedral.off[0],0,cathedral.off[1]);
    scene.add(mesh);
    const box=new THREE.Box3().setFromObject(mesh);
    if(box.isEmpty())throw new Error('No source mesh faces generated');
    const size=box.getSize(new THREE.Vector3());
    target=box.getCenter(new THREE.Vector3());
    scale=Math.max(200,Math.max(size.x,size.y,size.z)*1.65);
    Object.assign(stats,{
      id,sourceSolids:mesh.userData.sourceStatistics.solids,
      skipped:mesh.userData.sourceStatistics.skipped,
      triangles:mesh.userData.sourceStatistics.triangles,
      drawCalls:mesh.userData.sourceStatistics.drawCalls
    });
    meta.textContent=stats.sourceSolids+' исходных объёмов · '+stats.triangles+
      ' треугольников · '+stats.drawCalls+' батчей';
    select.value=id;render();
    return {...stats};
  }
  let dragging=false,x0=0,y0=0;
  canvas.addEventListener('pointerdown',e=>{
    if(worldMode)return;
    dragging=true;x0=e.clientX;y0=e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    if(worldMode||!dragging)return;
    theta-=(e.clientX-x0)*.007;
    phi=Math.max(-1.3,Math.min(1.3,phi+(e.clientY-y0)*.006));
    x0=e.clientX;y0=e.clientY;render();
  });
  canvas.addEventListener('pointerup',()=>{dragging=false});
  canvas.addEventListener('pointercancel',()=>{dragging=false});
  canvas.addEventListener('wheel',e=>{
    if(worldMode)return;
    e.preventDefault();
    scale=Math.max(80,Math.min(14000,scale*Math.exp(e.deltaY*.0008)));
    render();
  },{passive:false});
  focusSelect.addEventListener('change',()=>focusOn(focusSelect.value));
  syncButton.addEventListener('click',()=>{
    syncWithGame=!syncWithGame;
    syncButton.textContent=syncWithGame?'Камера игры: вкл.':'Камера игры: выкл.';
    render();
  });
  const resize=()=>render();
  window.addEventListener('resize',resize);
  function close(){
    if(disposed)return;
    disposed=true;window.removeEventListener('resize',resize);
    clearGeometry();Object.values(materials).forEach(m=>m.dispose());
    renderer.dispose();renderer.forceContextLoss();
    root.remove();
    window.simulate=savedSim;window.render=savedRender;
    delete window.__ASCII_SOURCE_3D__;
  }
  select.addEventListener('change',()=>show(select.value));
  root.querySelector('#source-arch-close').addEventListener('click',close);
  const api={
    stats,show,close,
    get mode(){return worldMode?'world':'orbit'},
    get sourceSites(){return mesh?.userData.sourceSites||[]},
    setCameraSync(enabled){
      syncWithGame=Boolean(enabled);
      syncButton.textContent=syncWithGame?'Камера игры: вкл.':'Камера игры: выкл.';
      if(syncWithGame)meta.textContent='Камера игрока · здесь могут отсутствовать 3D-здания: трава пока в ASCII';
      else meta.textContent=stats.authoredSites+' исходных построек · '+stats.triangles+' треугольников';
      render();
    },
    focus:focusOn
  };
  window.__ASCII_SOURCE_3D__=api;
  try{show(initialWorld?'world':'castle')}catch(err){close();throw err}
  return api;
}
