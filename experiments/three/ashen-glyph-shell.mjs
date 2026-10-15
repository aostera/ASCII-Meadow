// The Ashen Vow: original volumetric 3D ASCII glyph shell.
// Glyph points attach to named real skeletal pivots; never a front-facing character image.
// The previous rejected primitive figure is NOT imported here.
export function makeGlyphShell(THREE,scene,bones){
 const chars="█▓▒░@#%&MW0oO$*+=-:;.,'/\\|()[]{}<>^~†";
 const countX=8,countY=Math.ceil(chars.length/8),px=48;
 const atlasCanvas=document.createElement('canvas');atlasCanvas.width=countX*px;atlasCanvas.height=countY*px;
 const c=atlasCanvas.getContext('2d');if(!c)throw new Error('No glyph canvas');
 c.textAlign='center';c.textBaseline='middle';c.font='bold 34px monospace';c.fillStyle='#fff';
 for(let i=0;i<chars.length;i++)c.fillText(chars[i],(i%countX+.5)*px,(Math.floor(i/countX)+.5)*px);
 const atlas=new THREE.CanvasTexture(atlasCanvas);atlas.colorSpace=THREE.SRGBColorSpace;
 atlas.minFilter=THREE.LinearFilter;atlas.magFilter=THREE.LinearFilter;atlas.generateMipmaps=false;
 const material=new THREE.ShaderMaterial({
  uniforms:{uAtlas:{value:atlas},uCols:{value:countX},uRows:{value:countY}},
  vertexShader:[
   'precision highp float;',
   'attribute vec3 aWorld; attribute vec3 aInk; attribute float aLetter; attribute float aSize;',
   'uniform float uCols,uRows; varying vec2 vUV;varying vec3 vInk;',
   'void main(){',
   'float col=mod(aLetter,uCols),row=floor(aLetter/uCols);',
   'vUV=(vec2(col,uRows-1.0-row)+uv)/vec2(uCols,uRows);vInk=aInk;',
   'vec4 eye=viewMatrix*vec4(aWorld,1.);eye.xy+=position.xy*aSize;',
   'gl_Position=projectionMatrix*eye;',
   '}'
  ].join('\n'),
  fragmentShader:[
   'precision highp float;uniform sampler2D uAtlas;varying vec2 vUV;varying vec3 vInk;',
   'void main(){float a=texture2D(uAtlas,vUV).a;if(a<.30)discard;',
   'gl_FragColor=vec4(vInk,a);',
   '#include <tonemapping_fragment>',
   '#include <colorspace_fragment>',
   '}'
  ].join('\n'),side:THREE.DoubleSide,transparent:false,depthTest:true,depthWrite:true
 });
 const hex={iron:0x6f7075,ink:0x3c3d45,light:0xa5a0a0,shadow:0x28242a,bronze:0xa58a65,
  red:0x8d3541,redDark:0x501e2a,cream:0xc5b4a1,ivory:0xe1dad0,blood:0x91404b,
  black:0x161219,blade:0xc4cad0};
 const palette={};for(const [n,color] of Object.entries(hex))palette[n]=new THREE.Color(color);
 let rng=0xa5361;function rand(){rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;}
 const pick=str=>str.charAt(Math.floor(rand()*str.length)%str.length);
 const samples=[],index=new Map(Array.from(chars).map((ch,i)=>[ch,i]));
 function add(part,x,y,z,mat,glyph='@',size=.02){
  const bone=bones[part];if(!bone)throw new Error('Missing skeletal bone '+part);
  samples.push({bone,v:new THREE.Vector3(x,y,z),rgb:palette[mat]||palette.iron,letter:index.get(glyph)||0,size});
 }
 function ell(part,center,r,ink,n=140,sym='#%@',size=.022){
  for(let j=0;j<n;j++){
   const y=1-2*(j+.5)/n,theta=j*2.399963,rr=Math.sqrt(1-y*y);
   const x=center[0]+Math.cos(theta)*rr*r[0],Y=center[1]+y*r[1],z=center[2]+Math.sin(theta)*rr*r[2];
   let tint=ink;
   if(ink==='iron'&&rand()<.1)tint='light';
   if(ink==='red'&&rand()<.17)tint='redDark';
   add(part,x,Y,z,tint,pick(sym),size*(.9+.22*rand()));
  }
 }
 function line(part,a,b,ink='bronze',glyph='+',n=18,size=.016){
  for(let i=0;i<=n;i++){
   const t=i/n;add(part,a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,
    ink,glyph,size);
  }
 }
 // Blackened torso, layered steel cuirass, bronze engraving.
 ell('spine',[0,.22,0],[.26,.31,.17],'ink',240,'#%MW',.023);
 ell('spine',[0,.29,.056],[.25,.26,.15],'iron',260,'▓#%@',.023);
 for(const sign of [-1,1]){
  ell('spine',[sign*.128,.31,.14],[.117,.16,.065],'iron',113,'▒#%@',.023);
  line('spine',[sign*.05,.44,.205],[sign*.14,.06,.202],'bronze','/',31,.013);
  line('spine',[sign*.13,.44,.18],[sign*.09,.09,.19],'light','|',28,.012);
  for(let k=0;k<4;k++)line('spine',[sign*(.08+.031*k),.38,.191],[sign*(.05+.027*k),.19,.20],'shadow','/',12,.010);
 }
 ell('spine',[0,.50,0],[.20,.07,.17],'bronze',90,'+=*',.015);
 ell('hips',[0,-.04,0],[.24,.17,.16],'ink',120,'#%@',.020);
 for(let k=0;k<4;k++)line('hips',[-.225,.08-k*.038,.172],[.225,.08-k*.038,.172],'bronze','=',32,.015);
 for(const sign of [-1,1]){
  for(let k=0;k<3;k++)ell('hips',[sign*(.10+.045*k),-.17-k*.068,.09],[.071,.11,.115],
     k===1?'iron':'ink',70,'#%M',.019);
  line('hips',[sign*.22,.03,.159],[sign*.20,-.33,.14],'bronze','*',24,.011);
 }
 // True 3D hood with pale, narrow convex mask and hollow black eye slits.
 ell('head',[0,.020,-.043],[.208,.236,.182],'redDark',280,'▓▒#MW',.024);
 ell('head',[0,.013,.080],[.165,.19,.12],'black',145,'#MW',.020);
 for(let row=0;row<19;row++){
  const y=.19-row*.0199,wide=.147*Math.sqrt(Math.max(.06,1-((y-.013)/.241)**2));
  for(let col=0;col<14;col++){
   const x=(col/13-.5)*wide*2,eye=Math.abs(y-.075)<.024&&Math.abs(x)>.035&&Math.abs(x)<.107;
   const z=.199+.015*Math.sqrt(Math.max(0,1-(x/.16)**2))-.028*Math.abs(y);
   add('head',x,y,z,eye?'black':'ivory',pick(eye?'#MW':'█▓▒@#'),.017+rand()*.006);
  }
 }
 for(const sign of [-1,1]){
  line('head',[sign*.083,.178,.21],[sign*.05,.090,.224],'shadow','/',15,.009);
  line('head',[sign*.05,.085,.224],[sign*.086,-.009,.214],'shadow','\\',15,.009);
  line('head',[sign*.086,-.009,.214],[sign*.02,-.121,.209],'shadow','/',15,.009);
  line('head',[sign*.15,.14,.043],[sign*.176,-.10,.055],'red','▓',20,.021);
 }
 line('head',[-.052,-.12,.21],[.052,-.12,.21],'shadow','-',12,.012);
 for(let k=0;k<17;k++){
  const a=k*Math.PI*2/17,x=Math.cos(a)*.16,z=Math.sin(a)*.15-.02;
  line('head',[x,.21,z],[x*1.19,.295+(k%4)*.018,z*1.1],'bronze',pick('|/*'),11,.013);
 }
 // Armor is segmented and follows actual upper-/lower-arm bones.
 for(const side of ['L','R']){
  ell('upper'+side,[0,-.075,0],[.17,.15,.17],'iron',175,'#MW%',.021);
  for(let j=0;j<4;j++)
   ell('upper'+side,[0,-.055-j*.05,0],[.18-j*.016,.058,.175-j*.013],j===1?'light':'iron',65,'▒#MW',.019);
  ell('upper'+side,[0,-.26,0],[.092,.12,.104],'ink',115,'#MW',.019);
  ell('fore'+side,[0,-.055,0],[.13,.11,.125],'iron',140,'▓#MW',.018);
  ell('fore'+side,[0,-.19,0],[.107,.16,.114],'iron',165,'▒#%',.020);
  for(let i=0;i<6;i++)line('fore'+side,[-.065+i*.026,-.08,.117],[-.045+i*.02,-.29,.118],'light','|',14,.010);
  ell('hand'+side,[0,-.02,0],[.105,.105,.1],'iron',125,'#%@',.018);
  for(let i=0;i<4;i++)ell('hand'+side,[-.06+i*.039,-.11,.04],[.022,.043,.031],'light',26,'[]=+',.012);
  ell('thigh'+side,[0,-.18,0],[.139,.22,.135],'ink',190,'#MW%',.021);
  ell('thigh'+side,[0,-.20,.025],[.126,.18,.126],'iron',155,'▒#%@',.020);
  for(let i=0;i<4;i++)line('thigh'+side,[-.11,-.08-i*.07,.134],[.11,-.08-i*.07,.134],'bronze','=',15,.011);
  ell('shin'+side,[0,-.046,.035],[.137,.10,.125],'light',115,'▓#%',.02);
  ell('shin'+side,[0,-.22,0],[.104,.21,.115],'iron',165,'▓#MW',.019);
  for(let i=0;i<5;i++)line('shin'+side,[-.075+i*.037,-.095,.117],[-.059+i*.03,-.37,.10],'light','|',15,.010);
  ell('foot'+side,[0,-.045,.110],[.139,.083,.207],'iron',178,'▓#MW',.02);
  for(let i=0;i<4;i++)line('foot'+side,[-.115,-.05,.11+i*.039],[.115,-.05,.11+i*.039],'bronze','=',13,.012);
 }
 // Dirty ivory tabard is a separate articulated cloth attachment.
 for(let r=0;r<38;r++){
  const t=r/37,w=.25+.08*t,y=-.81*t;
  for(let i=0;i<13;i++){
   const x=(i/12-.5)*w+.015*Math.sin(t*7);
   if(t>.83&&Math.sin(i*2.7+r*.8)>.55)continue;
   const red=Math.abs(x)<.026||(t>.29&&t<.38);
   add('tabard',x,y,.077+Math.sin(i*Math.PI/12)*.010,
     red?'blood':(rand()<.07?'ink':'cream'),red?'†':pick('█▓▒#%'),.017+rand()*.004);
  }
 }
 for(let i=0;i<24;i++)add('tabard',(rand()-.5)*.2,-rand()*.78,.085,'blood',pick(',:*'),.012);
 // 11 independent draped strips, each fixed to its own cape joint.
 for(let k=0;k<11;k++){
  const part='cape'+k,edge=Math.abs(k-5)/5,length=1.26+(.10*(1-edge))+(k%3)*.012;
  for(let r=0;r<36;r++){
   const t=r/35,y=-length*t;
   for(let c=0;c<6;c++){
    if(t>.32&&Math.sin(k*11.3+r*2.37+c*5.2)>.81)continue; // real openings, not painted holes
    const x=(c/5-.5)*(.069+.032*t)*1.8+t*t*(k-5)*.022+Math.sin(t*8+k)*.008;
    const z=.016+t*t*(.17+.10*edge)+.012*Math.sin(t*11+k*.9);
    add(part,x,y,z,rand()<.21?'redDark':'red',pick('█▓▒#%'),.021+rand()*.008);
   }
  }
  for(let r=0;r<6;r++)line(part,[(rand()-.5)*.06,-length*(.80+rand()*.15),0],
     [(rand()-.5)*.10,-length-.05-rand()*.12,.03],'redDark',pick('/\\|'),6,.014);
 }
 // Rear insignia: projected to the central flowing cape, not to screen space.
 for(let i=0;i<32;i++){const a=i*Math.PI/16;
  add('cape5',Math.cos(a)*.105,-.45+Math.sin(a)*.11,-.016,'cream',pick('+*†'),.020);}
 line('cape5',[0,-.28,-.02],[0,-1.03,.012],'cream','†',33,.017);
 line('cape5',[-.14,-.46,0],[.14,-.46,0],'cream','+',21,.014);
 // Sword follows moving weapon bone. Genuine 3D blade built of glyph points.
 line('weapon',[0,.18,0],[0,-.12,0],'bronze','|',25,.015);
 line('weapon',[-.22,-.15,.013],[.22,-.15,.013],'bronze','†',34,.025);
 for(let side of [-1,1])line('weapon',[side*.19,-.16,0],[side*.24,-.08,0],'bronze','*',13,.014);
 for(let r=0;r<49;r++){
  const t=r/48,y=-.18-t*.75,w=.095*(1-.8*t);
  for(let j=0;j<8;j++)for(let d of [-.025,.015]){
   if(t>.90&&j===0)continue;
   add('weapon',(j/7-.5)*w,y,d,rand()<.09?'bronze':'blade',pick('#▓|'),.018);
  }
 }
 const rect=new THREE.PlaneGeometry(1,1);
 const geo=new THREE.InstancedBufferGeometry();geo.index=rect.index;
 geo.setAttribute('position',rect.getAttribute('position'));geo.setAttribute('uv',rect.getAttribute('uv'));
 const pos=new Float32Array(samples.length*3),inks=new Float32Array(samples.length*3),
  indices=new Float32Array(samples.length),sizes=new Float32Array(samples.length);
 for(let i=0;i<samples.length;i++){
  const s=samples[i],j=i*3;inks[j]=s.rgb.r;inks[j+1]=s.rgb.g;inks[j+2]=s.rgb.b;
  indices[i]=s.letter;sizes[i]=s.size;
 }
 function inst(name,v,sz){const a=new THREE.InstancedBufferAttribute(v,sz);
  if(name==='aWorld')a.setUsage(THREE.DynamicDrawUsage);geo.setAttribute(name,a);return a;}
 const worldAttr=inst('aWorld',pos,3);inst('aInk',inks,3);inst('aLetter',indices,1);inst('aSize',sizes,1);
 geo.instanceCount=samples.length;
 const mesh=new THREE.Mesh(geo,material);mesh.name='Volumetric armored ASCII knight';
 mesh.frustumCulled=false;scene.add(mesh);
 const vector=new THREE.Vector3();
 function update(){
  for(let i=0;i<samples.length;i++){
   const s=samples[i],v=vector.copy(s.v).applyMatrix4(s.bone.matrixWorld),j=i*3;
   pos[j]=v.x;pos[j+1]=v.y;pos[j+2]=v.z;
  }
  worldAttr.needsUpdate=true;
 }
 return {mesh,update,glyphCount:samples.length,material,atlas,
  dispose(){geo.dispose();rect.dispose();material.dispose();atlas.dispose();}};
}
