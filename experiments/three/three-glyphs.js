// Real Three.js backend for the authored ASCII Meadow glyph batch.
// No resynthesized geometry: the original simulation, art, map, renderer/render.js,
// knight, cows, fog, trees, grass, lighting, collision and editor stay authoritative.
import * as THREE from 'three';

const VERT = [
  '#version 300 es',
  'precision highp float; precision highp int;',
  'in vec2 position; in vec4 aRect; in vec2 aIdAlpha;',
  'uniform vec2 uCam,uView; uniform highp sampler2D uSprites;',
  'uniform int uSpriteWidth;',
  'out vec2 vUv; out float vAlpha;',
  'void main(){',
  'int id=int(aIdAlpha.x+.5);',
  'vec4 uv=texelFetch(uSprites,ivec2(id%uSpriteWidth,id/uSpriteWidth),0);',
  'vec2 q=(mix(aRect.xy,aRect.zw,position)-uCam)/uView*2.-1.;',
  'gl_Position=vec4(q.x,-q.y,0.,1.);',
  'vUv=mix(uv.xy,uv.zw,position);vAlpha=aIdAlpha.y;',
  '}'
].join('\n');
const FRAG = [
  '#version 300 es',
  'precision mediump float;',
  'uniform sampler2D uTexture;',
  'in vec2 vUv; in float vAlpha;',
  'out vec4 outColor;',
  'void main(){outColor=texture(uTexture,vUv)*vAlpha;}'
].join('\n');

function allocate(capacity) {
  const geo=new THREE.InstancedBufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute([
    0,0, 1,0, 0,1, 1,0, 1,1, 0,1
  ],2));
  const rect=new Float32Array(capacity*4),idAlpha=new Float32Array(capacity*2);
  const rectAttr=new THREE.InstancedBufferAttribute(rect,4);
  const idAttr=new THREE.InstancedBufferAttribute(idAlpha,2);
  rectAttr.setUsage(THREE.DynamicDrawUsage);idAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aRect',rectAttr);geo.setAttribute('aIdAlpha',idAttr);
  geo.instanceCount=0;
  return {geo,rect,idAlpha,rectAttr,idAttr,capacity};
}

export class ThreeGlyphBackend {
  constructor(host) {
    this.renderer=new THREE.WebGLRenderer({
      antialias:false,alpha:false,premultipliedAlpha:true,powerPreference:'high-performance'
    });
    this.renderer.domElement.id='three-parity-canvas';
    this.renderer.domElement.style.display='none';
    this.renderer.domElement.setAttribute('aria-hidden','true');
    this.renderer.autoClear=true;
    this.renderer.setClearColor(0x0c0c0c,1);
    this.renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
    this.renderer.toneMapping=THREE.NoToneMapping;
    this.renderer.info.autoReset=false;
    host.insertAdjacentElement('afterend',this.renderer.domElement);
    this.scene=new THREE.Scene();
    this.camera=new THREE.Camera();
    this.width=0;this.height=0;this.dpr=0;
    this.atlas=null;this.castleTexture=null;this.uvTexture=null;
    this.atlasSource=null;this.castleSource=null;this.sv=-1;this.sprCount=0;
    this.glyphs=this.makeLayer(65536,1);
    this.castle=this.makeLayer(2,0);
    this.scene.add(this.castle.mesh,this.glyphs.mesh);
    this.stats={glyphs:0,drawCalls:0,triangles:0,frame:0};
    this.lost=false;
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;});
    this.renderer.domElement.addEventListener('webglcontextrestored',()=>{
      this.lost=false;this.sv=-1;this.width=0;this.height=0;
      for(const tex of [this.atlas,this.castleTexture,this.uvTexture])
        if(tex)tex.needsUpdate=true;
    });
  }
  makeLayer(capacity,order) {
    const layer=allocate(capacity);
    const uniforms={
      uCam:{value:new THREE.Vector2()},uView:{value:new THREE.Vector2(1,1)},
      uSprites:{value:null},uSpriteWidth:{value:1},uTexture:{value:null}
    };
    const mat=new THREE.RawShaderMaterial({
      vertexShader:VERT,fragmentShader:FRAG,glslVersion:THREE.GLSL3,
      uniforms,transparent:true,depthTest:false,depthWrite:false,
      blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,
      blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneMinusSrcAlphaFactor,
      toneMapped:false
    });
    const mesh=new THREE.Mesh(layer.geo,mat);
    mesh.frustumCulled=false;mesh.renderOrder=order;
    return {...layer,mesh,mat,uniforms};
  }
  grow(layer,size) {
    if(size<=layer.capacity)return;
    let cap=layer.capacity;
    while(cap<size)cap*=2;
    const data=allocate(cap);
    layer.geo.dispose();
    layer.mesh.geometry=data.geo;
    Object.assign(layer,data);
  }
  resize(w,h,dpr) {
    if(w===this.width&&h===this.height&&dpr===this.dpr)return;
    this.width=w;this.height=h;this.dpr=dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w,h,false);
  }
  sprites(GB,SPF) {
    if(this.sv===GB.sv&&this.sprCount===GB.spr.length)return;
    const n=GB.spr.length,w=Math.min(2048,Math.max(1,n)),h=Math.ceil(n/w);
    const d=new Float32Array(w*h*4);
    for(let i=0;i<n;i++){
      const q=i*8,p=i*4;
      d[p]=SPF[q+4];d[p+1]=SPF[q+5];
      d[p+2]=SPF[q+6];d[p+3]=SPF[q+7];
    }
    if(this.uvTexture)this.uvTexture.dispose();
    const tex=new THREE.DataTexture(d,w,h,THREE.RGBAFormat,THREE.FloatType);
    tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestFilter;
    tex.generateMipmaps=false;tex.flipY=false;tex.needsUpdate=true;
    this.uvTexture=tex;this.sv=GB.sv;this.sprCount=n;
    for(const b of [this.glyphs,this.castle]){
      b.uniforms.uSprites.value=tex;b.uniforms.uSpriteWidth.value=w;
    }
  }
  atlasTexture(layer,source,kind) {
    if(!source)return;
    const which=kind==='atlas'?'atlas':'castleTexture',key=kind==='atlas'?'atlasSource':'castleSource';
    if(source!==this[key]||!this[which]){
      if(this[which])this[which].dispose();
      const tex=new THREE.CanvasTexture(source);
      // Old backend uploads canvas texels as premultiplied bytes without SRGB decoding.
      tex.colorSpace=THREE.NoColorSpace;
      tex.premultiplyAlpha=true;
      tex.flipY=false;
      tex.minFilter=THREE.LinearFilter;tex.magFilter=THREE.LinearFilter;
      tex.generateMipmaps=false;tex.needsUpdate=true;
      this[which]=tex;this[key]=source;
    }
    layer.uniforms.uTexture.value=this[which];
  }
  upload(layer,buf,start,count) {
    this.grow(layer,Math.max(1,count));
    const a=layer.rect,b=layer.idAlpha;
    for(let i=0;i<count;i++){
      const s=(start+i)*6,j=i*4,k=i*2;
      a[j]=buf[s];a[j+1]=buf[s+1];a[j+2]=buf[s+2];a[j+3]=buf[s+3];
      b[k]=buf[s+4];b[k+1]=buf[s+5];
    }
    layer.geo.instanceCount=count;
    if(count){
      layer.rectAttr.clearUpdateRanges();layer.idAttr.clearUpdateRanges();
      layer.rectAttr.addUpdateRange(0,count*4);
      layer.idAttr.addUpdateRange(0,count*2);
      layer.rectAttr.needsUpdate=true;layer.idAttr.needsUpdate=true;
    }
  }
  flush(GB,SPF,gput,CAST,camx,camy,castle,W,H,DPR,VZ,castleCanvas) {
    if(this.lost||!GB.atlasCv)return;
    this.resize(W,H,DPR);
    this.sprites(GB,SPF);
    this.atlasTexture(this.glyphs,GB.atlasCv,'atlas');
    const extra=castle?(castle.flash>0.02?2:1):0;
    const originalCount=GB.n;
    if(castle){
      gput(CAST,castle.x,castle.y,castle.a);
      if(extra===2)gput(CAST,castle.x,castle.y,castle.flash);
      this.atlasTexture(this.castle,castleCanvas,'castle');
    }
    const count=GB.n-extra;
    this.upload(this.glyphs,GB.buf,0,count);
    this.upload(this.castle,GB.buf,count,extra);
    for(const layer of [this.glyphs,this.castle]){
      layer.uniforms.uCam.value.set(camx,camy);
      layer.uniforms.uView.value.set(W/VZ,H/VZ);
    }
    // Unlike the old shader's one glyph program, the castle image has its own
    // mesh. An additive second flash quad is a future parity task.
    this.renderer.info.reset();
    this.renderer.render(this.scene,this.camera);
    this.stats={
      glyphs:count,drawCalls:this.renderer.info.render.calls,
      triangles:this.renderer.info.render.triangles,frame:this.stats.frame+1
    };
    GB.n=originalCount;
  }
  show(visible){this.renderer.domElement.style.display=visible?'block':'none';}
  dispose(){
    this.renderer.dispose();this.renderer.domElement.remove();
    for(const layer of [this.castle,this.glyphs]){
      layer.geo.dispose();layer.mat.dispose();
    }
    for(const tex of [this.uvTexture,this.atlas,this.castleTexture])if(tex)tex.dispose();
  }
}
