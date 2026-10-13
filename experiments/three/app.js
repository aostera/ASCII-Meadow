// Isolated Three.js experiment. NEVER mutates MEADOW_MAP, editor drafts or the main renderer.
// All placements are read from ../../src/data/map.js. This is a geometry / depth / performance
// comparison, not a port of the knight's 192 ASCII frames or the map's 2D paint layers.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const map = window.ASCII_MEADOW_MAP;
if (!map || !Array.isArray(map.flora) || !Array.isArray(map.ruins)) {
  throw new Error('Author map missing. Serve the repository root, not this directory alone.');
}
const $ = id => document.getElementById(id);
const view = $('viewport'), ui = {
  location: $('location'), quality: $('quality'), ascii: $('ascii'),
  wind: $('wind'), shadows: $('shadows'), stress: $('stress'), stats: $('stats')
};
const SCALE = 0.12; // keep the authored world coordinate system; only display units change
const LOCATIONS = {
  camp: { origin: map.start, label: 'лагерь' },
  cloister: { origin: map.ruins.find(r => r[1] === 'cloister').slice(2, 4), label: 'галерея' },
  abbey: { origin: map.ruins.find(r => r[1] === 'abbey').slice(2, 4), label: 'аббатство' },
  gate: { origin: map.ruins.find(r => r[1] === 'gate').slice(2, 4), label: 'ворота' }
};
const SCENE_RADIUS = 310; // map units; same across screen sizes

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090909);
scene.fog = new THREE.FogExp2(0x111111, 0.011);
const camera = new THREE.OrthographicCamera(-70, 70, 50, -50, 0.1, 800);
camera.position.set(44, 55, 70);
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: false });
renderer.setClearColor(0x090909);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = false;
view.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.minDistance = 18;
controls.maxDistance = 190;
controls.maxPolarAngle = Math.PI * 0.475;
controls.target.set(0, 6, 0);
controls.update();

scene.add(new THREE.HemisphereLight(0x9c9da5, 0x111113, 1.25));
const moon = new THREE.DirectionalLight(0xe1e0df, 2.4);
moon.position.set(-38, 70, -44);
moon.castShadow = true;
moon.shadow.camera.left = -85;
moon.shadow.camera.right = 85;
moon.shadow.camera.top = 85;
moon.shadow.camera.bottom = -85;
moon.shadow.camera.near = 1;
moon.shadow.camera.far = 230;
moon.shadow.bias = -0.00035;
scene.add(moon, moon.target);

const material = {
  stone: new THREE.MeshStandardMaterial({ color: 0x85858a, roughness: 1, flatShading: true }),
  shade: new THREE.MeshStandardMaterial({ color: 0x54555a, roughness: 1, flatShading: true }),
  trim: new THREE.MeshStandardMaterial({ color: 0xb0aba2, roughness: 1, flatShading: true }),
  wood: new THREE.MeshStandardMaterial({ color: 0x525054, roughness: 1, flatShading: true }),
  canvas: new THREE.MeshStandardMaterial({ color: 0x86807c, roughness: 1, flatShading: true, side: THREE.DoubleSide }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x474c4a, roughness: 1, flatShading: true }),
  leaf2: new THREE.MeshStandardMaterial({ color: 0x666b67, roughness: 1, flatShading: true }),
  ground: new THREE.MeshStandardMaterial({ color: 0x222524, roughness: 1 }),
  iron: new THREE.MeshStandardMaterial({ color: 0x242628, metalness: 0.25, roughness: 0.8 }),
  red: new THREE.MeshStandardMaterial({ color: 0x723537, roughness: 0.9 })
};
const base = new THREE.Group();
scene.add(base);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), material.ground);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
ground.position.y = -0.06;
base.add(ground);

const world = new THREE.Group();
scene.add(world);
const addMesh = (parent, geo, mat, pos, rotation) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(pos[0], pos[1], pos[2]);
  if (rotation) m.rotation.set(rotation[0], rotation[1], rotation[2]);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
};
const box = (parent, w, h, d, mat, x, y, z, rotZ = 0) =>
  addMesh(parent, new THREE.BoxGeometry(w, h, d), mat, [x, y, z], rotZ ? [0, 0, rotZ] : null);
const hash = n => {
  const x = Math.sin(n * 127.1 + 98.9) * 43758.5453;
  return x - Math.floor(x);
};
function tree(parent, k, type) {
  const dead = type === 'dead', bush = type === 'bush';
  const h = bush ? 2.3 : 8 + hash(k + 5) * 5;
  const trunk = addMesh(parent, new THREE.CylinderGeometry(bush ? 0.1 : 0.22, bush ? 0.23 : 0.48, h, 5), material.wood, [0, h / 2, 0]);
  trunk.rotation.z = (hash(k * 9) - 0.5) * 0.12;
  if (!bush) for (let i = 0; i < 4; i++) {
    const a = i * 2.3 + hash(k + i);
    const b = addMesh(parent, new THREE.CylinderGeometry(0.07, 0.19, h * 0.48, 4), material.wood,
      [Math.cos(a) * 1.2, h * 0.76, Math.sin(a) * 1.2]);
    b.rotation.z = Math.cos(a) * 0.48;
    b.rotation.x = Math.sin(a) * 0.48;
  }
  if (!dead) for (let i = 0; i < (bush ? 4 : 7); i++) {
    const a = hash(k * 29 + i * 7) * Math.PI * 2, dist = bush ? 0.55 : 1.7;
    const r = bush ? 1.1 : 2 + hash(i + k * 3) * 0.9;
    addMesh(parent, new THREE.IcosahedronGeometry(r, 0), i % 3 === 0 ? material.leaf2 : material.leaf,
      [Math.cos(a) * dist, bush ? 1.25 : h * 0.8 + hash(i * 3 + k) * 2, Math.sin(a) * dist]);
  }
}
function tent(parent, kind) {
  const torn = kind >= 2, w = 5.5, d = 8.3, h = torn ? 3.2 : 4.6;
  // The actual triangular prism has two open gable triangles and two sloping roof planes.
  const p = [
    -w/2,0,-d/2, w/2,0,-d/2, 0,h,-d/2,
    -w/2,0,d/2, 0,h,d/2, w/2,0,d/2,
    -w/2,0,-d/2, 0,h,-d/2, 0,h,d/2,
    -w/2,0,-d/2, 0,h,d/2, -w/2,0,d/2,
    0,h,-d/2, w/2,0,-d/2, w/2,0,d/2,
    0,h,-d/2, w/2,0,d/2, 0,h,d/2,
    w/2,0,-d/2, -w/2,0,-d/2, -w/2,0,d/2,
    w/2,0,-d/2, -w/2,0,d/2, w/2,0,d/2
  ];
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geom.computeVertexNormals();
  addMesh(parent, geom, material.canvas, [0, 0, 0]);
  for (const z of [-d/2, d/2]) {
    addMesh(parent, new THREE.CylinderGeometry(.12,.12,h + .7,6), material.wood, [0,(h+.7)/2,z]);
  }
  for (let z = -d/2+1; z <= d/2-1; z += 1.5) {
    const seam = box(parent, .075, .075, w/2*1.5, material.trim, -w*.25, h*.5, z, -0.7);
    seam.castShadow = false;
  }
}
function fence(parent, variant) {
  const n = variant >= 4 ? 8 : 5, gap = 1.7;
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * gap, h = 2.5 + hash(i + variant) * 0.7;
    box(parent, 0.25, h, 0.25, material.wood, x, h / 2, 0);
    if (variant >= 4) addMesh(parent, new THREE.ConeGeometry(0.22, 0.6, 4), material.wood, [x, h + .23, 0]);
  }
  if (variant < 4) for (const y of [1, 2]) box(parent, n * gap, .18, .18, material.wood, 0, y, 0);
}
function ruin(parent, type) {
  const wall = (w, h, d, x, y, z, mat = material.stone) => box(parent, w, h, d, mat, x, y, z);
  const width = type === 'gate' ? 24 : type === 'abbey' ? 33 : 38;
  const depth = type === 'gate' ? 11 : 21;
  const archSpan = type === 'cloister' ? 6 : 10;
  const arches = type === 'cloister' ? 4 : 2;
  const baseY = 9;
  const split = width / arches;
  for (let j = 0; j <= arches; j++) {
    const x = -width/2 + j * split;
    const extra = j === 0 || j === arches ? 4 : 0;
    wall(2, baseY + 4 + extra, 2.5, x, (baseY + 4 + extra)/2, depth/2, j%2 ? material.shade : material.stone);
    wall(1.35, 1.2, 3, x, 10.2, depth/2, material.trim);
    if (j === 0 || j === arches) {
      wall(3, 17 + (j===0?4:0), 4, x, 8.5, -depth/2, material.stone);
      addMesh(parent, new THREE.ConeGeometry(2.5, 6, 4), material.trim, [x, 19.7 + (j===0?4:0), -depth/2], [0, Math.PI/4, 0]);
    }
  }
  for (let j = 0; j < arches; j++) {
    const center = -width/2 + (j+.5)*split;
    // True open pointed arch: diagonal stone beams and no filled central wall.
    const a = archSpan*.32;
    wall(1.3, 6.4, 2.6, center-a, 13.1, depth/2, material.stone).rotation.z = -0.56;
    wall(1.3, 6.4, 2.6, center+a, 13.1, depth/2, material.stone).rotation.z = 0.56;
    wall(split-1.5, 1.8, 3.1, center, 16.6, depth/2, material.trim);
    for (let k = 0; k < 3; k++) wall(0.55, 0.4, 3.3, center+(k-1)*split*.2, 17.7, depth/2, material.shade);
  }
  for (const side of [-1,1]) {
    for (let j = 0; j < 9; j++) {
      const z = -depth/2+j*depth/8;
      const broken = (hash(j*8+side*5+width) - .5) * 4;
      const h = Math.max(2,8+broken + (j%5===0 ? 7 : 0));
      wall(2.3, h, depth/9 + .55, side * width/2, h/2, z, j%3 ? material.stone : material.shade);
    }
  }
  for (let i = 0; i < 38; i++) {
    const x = (hash(i * 11) - .5) * (width+10), z = (hash(i * 19) - .5) * (depth+14);
    const h = .2 + hash(i*3)*.8;
    wall(.6 + hash(i+5)*1.9, h, .6 + hash(i+8)*1.6, x, h/2, z, i%4 ? material.shade : material.trim);
  }
}
function knight(parent) {
  const armor = new THREE.Group();
  parent.add(armor);
  box(armor, 2, 3.3, 1.2, material.iron, 0, 4.2, 0);
  box(armor, 2.2, 2.1, .25, material.red, 0, 3.4, .78);
  addMesh(armor, new THREE.CylinderGeometry(.8,.75,1.55,8), material.iron, [0,6.75,0]);
  addMesh(armor, new THREE.ConeGeometry(.8, .65, 8), material.iron, [0,7.85,0]);
  for (const x of [-.65,.65]) {
    box(armor, .58, 2.6, .63, material.iron, x, 1.5, 0);
    box(armor, .65, 2.5, .7, material.iron, x*2, 4.7, 0);
  }
  box(armor, .15, 5.2, .2, material.trim, 2, 4, .3);
  box(armor, .9, .15, .3, material.trim, 2, 5.2, .3);
  armor.userData.isKnight = true;
  return armor;
}
function cleanWorld() {
  const disposed = new Set();
  world.traverse(o => {
    if (o.geometry && !disposed.has(o.geometry)) {
      o.geometry.dispose();
      disposed.add(o.geometry);
    }
  });
  world.clear();
}

const grassMaterial = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uWind: { value: 1 } },
  vertexShader: [
    'attribute vec3 aOffset; attribute float aHeight; attribute float aPhase;',
    'uniform float uTime; uniform float uWind; varying float vLight;',
    'void main(){',
    'vec3 p=position; p.y=(p.y+0.5)*aHeight;',
    'p.x*=0.25*aHeight;',
    'float wave=sin(uTime*1.5+aPhase)*0.24+sin(uTime*.47+aPhase*.3)*.14;',
    'p.x+=wave*uWind*p.y*p.y*.55;',
    'p+=aOffset;',
    'vLight=.4+.3*max(0.,p.y/aHeight);',
    'gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);',
    '}'
  ].join('\n'),
  fragmentShader: [
    'precision mediump float; varying float vLight;',
    'void main(){gl_FragColor=vec4(vec3(vLight*.55),1.);}'
  ].join('\n'),
  side: THREE.DoubleSide
});
let grass = null, lastCount = { grass: 0, flora: 0, ruins: 0 };
function plantGrass() {
  if (grass) {
    world.remove(grass);
    grass.geometry.dispose();
    grass = null;
  }
  const mobile = window.matchMedia('(max-width: 650px)').matches;
  const counts = { low: mobile ? 1800 : 3500, medium: mobile ? 4500 : 8500, high: mobile ? 9000 : 18000 };
  const count = counts[ui.quality.value] * (ui.stress.checked ? 2 : 1);
  const plane = new THREE.PlaneGeometry(1, 1);
  const geom = new THREE.InstancedBufferGeometry();
  geom.index = plane.index;
  geom.setAttribute('position', plane.getAttribute('position'));
  geom.setAttribute('uv', plane.getAttribute('uv'));
  const offset = new Float32Array(count * 3), heights = new Float32Array(count), phases = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    offset[i*3] = (hash(i * 13 + 5) - .5) * 118;
    offset[i*3+1] = 0;
    offset[i*3+2] = (hash(i * 17 + 9) - .5) * 118;
    heights[i] = .35 + hash(i * 23 + 7) * 1.5;
    phases[i] = hash(i * 53 + 11) * 6.283;
  }
  geom.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offset, 3));
  geom.setAttribute('aHeight', new THREE.InstancedBufferAttribute(heights, 1));
  geom.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
  geom.instanceCount = count;
  plane.dispose();
  grass = new THREE.Mesh(geom, grassMaterial);
  grass.frustumCulled = false;
  grass.renderOrder = 0;
  world.add(grass);
  lastCount.grass = count;
}
function rebuild() {
  cleanWorld();
  const which = LOCATIONS[ui.location.value], [cx, cz] = which.origin;
  const toLocal = (x,z) => [(x-cx)*SCALE, (z-cz)*SCALE];
  let floraCount = 0, ruinCount = 0;
  for (const [type, k, x, z] of map.flora) {
    if (Math.hypot(x-cx,z-cz)>SCENE_RADIUS) continue;
    const group = new THREE.Group(), [xx,zz]=toLocal(x,z);
    group.position.set(xx,0,zz);
    group.rotation.y = hash(k*7+x*.31+z*.19)*.7-.35;
    if (type==='tree'||type==='dead'||type==='bush') tree(group,Math.round(x+z)+k,type);
    else if (type==='tent') tent(group,k);
    else if (type==='fence') fence(group,k);
    else if (type==='stone') box(group,2.2,.9,1.8,material.shade,0,.4,0);
    world.add(group);
    floraCount++;
  }
  for (const [id, type, x, z, yaw] of map.ruins) {
    if (Math.hypot(x-cx,z-cz)>SCENE_RADIUS) continue;
    const group = new THREE.Group(), [xx,zz]=toLocal(x,z);
    group.position.set(xx,0,zz);
    group.rotation.y = yaw; // exact authored yaw, no rotation correction or auto-regeneration
    ruin(group,type);
    group.userData.mapId=id;
    world.add(group);
    ruinCount++;
  }
  if (ui.stress.checked) {
    // Synthetic additions are NOT saved to map and must not be confused with map parity.
    for (let i = 0; i < 20; i++) {
      const group = new THREE.Group();
      const a=i*2.39996, r=17 + (i%5)*8;
      group.position.set(Math.cos(a)*r,0,Math.sin(a)*r);
      if (i%4===0) ruin(group,'gate'); else tree(group,i+800,'tree');
      world.add(group);
    }
  }
  const [px,pz]=toLocal(map.start[0],map.start[1]);
  if (Math.hypot(px,pz) < 55) {
    const person = new THREE.Group();
    person.position.set(px,0,pz);
    knight(person);
    world.add(person);
  }
  plantGrass();
  lastCount.flora=floraCount;
  lastCount.ruins=ruinCount;
  controls.target.set(0, 6, 0);
  camera.position.set(43, 57, 70);
  controls.update();
}

// GPU post-process: one full-screen draw call, no expensive per-frame readPixels or
// 2D getImageData. 3D depth testing happens BEFORE glyph conversion.
const CHARS = ' .:-=+*#%@';
function glyphAtlas() {
  const w=32,h=40;
  const c=document.createElement('canvas');
  c.width=w*CHARS.length;c.height=h;
  const g=c.getContext('2d');
  g.fillStyle='#000';g.fillRect(0,0,c.width,c.height);
  g.fillStyle='#fff';g.font='bold 34px monospace';g.textAlign='center';g.textBaseline='middle';
  for(let i=0;i<CHARS.length;i++)g.fillText(CHARS[i],(i+.5)*w,h*.49);
  const tex=new THREE.CanvasTexture(c);
  tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearFilter;
  tex.wrapS=THREE.ClampToEdgeWrapping;tex.wrapT=THREE.ClampToEdgeWrapping;
  return tex;
}
const rt=new THREE.WebGLRenderTarget(1,1,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true});
const post=new THREE.Scene(), postCamera=new THREE.Camera();
const postMaterial=new THREE.ShaderMaterial({
  uniforms: {
    uScene:{value:rt.texture},uGlyph:{value:glyphAtlas()},
    uResolution:{value:new THREE.Vector2(800,600)},uCell:{value:new THREE.Vector2(9,13)},
    uCount:{value:CHARS.length}
  },
  vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:[
    'precision highp float;',
    'uniform sampler2D uScene; uniform sampler2D uGlyph;',
    'uniform vec2 uResolution; uniform vec2 uCell; uniform float uCount;',
    'varying vec2 vUv;',
    'void main(){',
    'vec2 pixel=vUv*uResolution;',
    'vec2 grid=floor(pixel/uCell);',
    'vec2 uv=(grid+.5)*uCell/uResolution;',
    'vec3 col=texture2D(uScene,uv).rgb;',
    'float lum=dot(col,vec3(.2126,.7152,.0722));',
    'float d=fract(sin(dot(grid,vec2(12.9898,78.233)))*43758.5453)-.5;',
    'float level=clamp(lum*.96+d*.09,0.,1.);',
    'float idx=floor(level*(uCount-1.)+.5);',
    'vec2 local=fract(pixel/uCell);',
    'vec2 guv=vec2((idx+local.x)/uCount,local.y);',
    'float stroke=texture2D(uGlyph,guv).r;',
    'vec3 ink=mix(vec3(.46),vec3(.97),level);',
    'vec3 outCol=vec3(.018)+stroke*ink*max(.12,level);',
    'gl_FragColor=vec4(outCol,1.);',
    '}'
  ].join('\n'),
  depthTest:false,depthWrite:false
});
post.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),postMaterial));
let pixelRatio=1;
function resize() {
  const w=Math.max(1,view.clientWidth),h=Math.max(1,view.clientHeight);
  pixelRatio=Math.min(window.devicePixelRatio||1,ui.quality.value==='high'?1.75:ui.quality.value==='low'?1:1.35);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(w,h,false);
  rt.setSize(Math.round(w*pixelRatio),Math.round(h*pixelRatio));
  postMaterial.uniforms.uResolution.value.set(rt.width,rt.height);
  postMaterial.uniforms.uCell.value.set(ui.quality.value==='low'?11:8,ui.quality.value==='low'?15:12);
  const aspect=w/h,top=window.matchMedia('(max-width: 650px)').matches?44:47;
  camera.left=-top*aspect;camera.right=top*aspect;
  camera.top=top;camera.bottom=-top;
  camera.updateProjectionMatrix();
  moon.shadow.mapSize.set(ui.quality.value==='high'?1024:512,ui.quality.value==='high'?1024:512);
  moon.shadow.needsUpdate=true;
}
const samples=[],cpuSamples=[];
let previous=0,lastStats=0,frames=0,paused=false,contextLost=false;
function percentile(values,p) {
  if (!values.length) return 0;
  const a=values.slice().sort((x,y)=>x-y);
  return a[Math.min(a.length-1,Math.floor((a.length-1)*p))];
}
function frame(now) {
  requestAnimationFrame(frame);
  if (paused || contextLost) { previous=now; return; }
  const dt=previous ? Math.max(0,now-previous) : 16.67;
  previous=now;
  if (dt<500) {samples.push(dt);if(samples.length>120)samples.shift();}
  const started=performance.now();
  controls.update();
  grassMaterial.uniforms.uTime.value=now*.001;
  grassMaterial.uniforms.uWind.value=ui.wind.checked?1:0;
  renderer.shadowMap.enabled=ui.shadows.checked;
  renderer.info.reset();
  if (ui.ascii.checked) {
    renderer.setRenderTarget(rt);
    renderer.render(scene,camera);
    renderer.setRenderTarget(null);
    renderer.render(post,postCamera);
  } else renderer.render(scene,camera);
  cpuSamples.push(performance.now()-started);
  if(cpuSamples.length>120)cpuSamples.shift();
  frames++;
  if(now-lastStats>850) {
    const p50=percentile(samples,.5),p95=percentile(samples,.95),cpu95=percentile(cpuSamples,.95);
    ui.stats.textContent='FPS median: '+(p50?Math.round(1000/p50):0)+'  |  frame p95: '+p95.toFixed(1)+' ms\n'+
      'JS + GPU submit p95: '+cpu95.toFixed(1)+' ms  |  draws: '+renderer.info.render.calls+
      '\nTriangles: '+renderer.info.render.triangles.toLocaleString()+
      '  |  Grass: '+lastCount.grass.toLocaleString()+
      '\nMap objects nearby: '+lastCount.flora+'  |  ruins: '+lastCount.ruins+
      '  |  DPR: '+pixelRatio.toFixed(2);
    window.__ASCII_THREE_DIAGNOSTICS__={
      fpsMedian:p50?1000/p50:0,frameP95ms:p95,submitP95ms:cpu95,
      drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
      grassInstances:lastCount.grass,authoredFlora:lastCount.flora,
      authoredRuins:lastCount.ruins,location:ui.location.value,
      stress:ui.stress.checked,renderer:'Three.js WebGLRenderer'
    };
    lastStats=now;
  }
}
ui.location.addEventListener('change',rebuild);
ui.stress.addEventListener('change',rebuild);
ui.quality.addEventListener('change',()=>{plantGrass();resize();});
window.addEventListener('resize',resize);
document.addEventListener('visibilitychange',()=>{paused=document.hidden;previous=0;if(!paused)resize();});
window.addEventListener('pageshow',resize);
renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;});
renderer.domElement.addEventListener('webglcontextrestored',()=>{contextLost=false;previous=0;resize();});
window.addEventListener('error',event=>{
  const e=$('error');e.hidden=false;e.textContent='Three.js prototype error: '+(event.message||String(event.error));
});
resize();
rebuild();
requestAnimationFrame(frame);
