// Real Three.js backend for the authored ASCII Meadow glyph batch.
// No resynthesized geometry: the original simulation, art, map, renderer/render.js,
// knight, cows, fog, trees, grass, lighting, collision and editor stay authoritative.
import * as THREE from 'three';
import {packVisibleGlyphs,countVisibleGlyphs,glyphClipWindow} from './glyph-visibility.mjs';

const VERT = [
  'precision highp float; precision highp int;',
  'in vec3 position; in vec4 aRect; in vec2 aIdAlpha; in vec2 aActorInfo;',
  'uniform vec2 uCam,uView; uniform highp sampler2D uSprites;',
  'uniform int uSpriteWidth; uniform int uDebugVertex;',
  'uniform float uActorDepthSlope;',
  'out vec2 vUv; out float vAlpha; out float vActorDepth;',
  'void main(){',
  'int id=int(aIdAlpha.x+.5);',
  'vec4 uv=texelFetch(uSprites,ivec2(id%uSpriteWidth,id/uSpriteWidth),0);',
  'vec2 q=(mix(aRect.xy,aRect.zw,position.xy)-uCam)/uView*2.-1.;',
  'if(uDebugVertex==1){q=position.xy*2.-1.;gl_Position=vec4(q,0.,1.);}',
  'else{gl_Position=vec4(q.x,-q.y,0.,1.);}',
  'vUv=mix(uv.xy,uv.zw,position.xy);vAlpha=aIdAlpha.y;',
  'vActorDepth=aActorInfo.x<0.? -1.:aActorInfo.x+(mix(aRect.y,aRect.w,position.y)-aActorInfo.y)*uActorDepthSlope;',
  '}'
].join('\n');
const FRAG = [
  'precision highp float;',
  'uniform sampler2D uTexture; uniform int uDebugMode;',
  'uniform sampler2D uArchitectureDepth; uniform int uDepthEnabled;',
  'uniform vec2 uDepthViewport;',
  'in vec2 vUv; in float vAlpha; in float vActorDepth;',
  'out vec4 outColor;',
  'void main(){',
  'if(uDebugMode==1){outColor=vec4(1.,1.,1.,1.);return;}',
  'if(uDebugMode==2){outColor=vec4(vUv.xy,0.,1.);return;}',
  'if(uDepthEnabled==1 && vActorDepth>=0.){',
  'float stone=texture(uArchitectureDepth,gl_FragCoord.xy/uDepthViewport).r;',
  'if(stone+.00015 < vActorDepth)discard;',
  '}',
  'vec4 col=texture(uTexture,vUv);',
  'if(uDebugMode==3){outColor=vec4(col.rgb,1.);return;}',
  'if(uDebugMode==4){outColor=vec4(col.aaa,1.);return;}',
  'outColor=col*vAlpha;',
  '}'
].join('\n');

function allocate(capacity) {
  const geo=new THREE.InstancedBufferGeometry();
  // Three's bounding-sphere calculation requires XYZ, even for screen quads.
  // A vec2 position attribute makes z undefined and NaNs culling metadata.
  geo.setAttribute('position',new THREE.Float32BufferAttribute([
    0,0,0, 1,0,0, 0,1,0, 1,0,0, 1,1,0, 0,1,0
  ],3));
  const rect=new Float32Array(capacity*4),idAlpha=new Float32Array(capacity*2),actorInfo=new Float32Array(capacity*2);
  const rectAttr=new THREE.InstancedBufferAttribute(rect,4);
  const idAttr=new THREE.InstancedBufferAttribute(idAlpha,2);
  const actorAttr=new THREE.InstancedBufferAttribute(actorInfo,2);
  rectAttr.setUsage(THREE.DynamicDrawUsage);idAttr.setUsage(THREE.DynamicDrawUsage);
  actorAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aRect',rectAttr);geo.setAttribute('aIdAlpha',idAttr);
  geo.setAttribute('aActorInfo',actorAttr);
  geo.instanceCount=0;
  return {geo,rect,idAlpha,actorInfo,rectAttr,idAttr,actorAttr,capacity};
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
    // The original GL clear is *linear* 12/255 in the framebuffer.
    // Three.Color(hex) converts sRGB to linear (~1/255 for #0c0c0c),
    // producing a darkened background and changing all semiopaque sprites.
    this.renderer.setClearColor(
      new THREE.Color().setRGB(12/255,12/255,12/255,THREE.LinearSRGBColorSpace),1
    );
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
    this.castle=this.makeLayer(1,0);
    // The real legacy castle lightning pass uses additive blending after
    // the ordinary stone image, BEFORE drawing world glyphs. Without a
    // separate mesh the flash changes brightness and breaks visual parity.
    this.castleFlash=this.makeLayer(1,0.5,true);
    this.scene.add(this.castle.mesh,this.castleFlash.mesh,this.glyphs.mesh);
    this.stats={glyphs:0,drawCalls:0,triangles:0,frame:0};
    this.lost=false;
    this.cullingEnabled=true;
    // Opt-in source-geometry depth is supplied only by the native runtime.
    // The pixel-parity lab continues to submit the original untouched art.
    this.actorDepthTexture=null;
    this.actorDepthPitch=0;
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;});
    this.renderer.domElement.addEventListener('webglcontextrestored',()=>{
      this.lost=false;this.sv=-1;this.width=0;this.height=0;
      for(const tex of [this.atlas,this.castleTexture,this.uvTexture])
        if(tex)tex.needsUpdate=true;
    });
  }
  makeLayer(capacity,order,additive=false) {
    const layer=allocate(capacity);
    const uniforms={
      uCam:{value:new THREE.Vector2()},uView:{value:new THREE.Vector2(1,1)},
      uSprites:{value:null},uSpriteWidth:{value:1},uTexture:{value:null},uDebugMode:{value:0},uDebugVertex:{value:0},
      uArchitectureDepth:{value:null},uDepthEnabled:{value:0},
      uDepthViewport:{value:new THREE.Vector2(1,1)},uActorDepthSlope:{value:0}
    };
    const mat=new THREE.RawShaderMaterial({
      vertexShader:VERT,fragmentShader:FRAG,glslVersion:THREE.GLSL3,
      // Screen coordinates flip Y from the game's downward pixel axis.
      // That reverses glyph triangle winding: without DoubleSide Three.js
      // culls ALL original sprite quads as backfaces (the blank screen bug).
      uniforms,side:THREE.DoubleSide,transparent:true,depthTest:false,depthWrite:false,
      blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,
      blendSrc:THREE.OneFactor,
      blendDst:additive?THREE.OneFactor:THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha:THREE.OneFactor,
      blendDstAlpha:additive?THREE.OneFactor:THREE.OneMinusSrcAlphaFactor,
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
    for(const b of [this.glyphs,this.castle,this.castleFlash]){
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
  upload(layer,buf,start,count,clip=null,actorRanges=null) {
    // Large authored source scenes can exceed 65,536 glyphs while the
    // visible crop remains under it. A source-count grow() doubled the entire
    // GPU instance stream to 131,072 for invisible stone. Do one cheap count
    // pass ONLY when growth might be required; then pack survivor glyphs
    // exactly once in the existing stable depth/alpha/source order.
    const needed=clip&&count>layer.capacity?
      countVisibleGlyphs(buf,start,count,clip):count;
    this.grow(layer,Math.max(1,needed));
    const visible=packVisibleGlyphs(buf,start,count,layer.rect,layer.idAlpha,clip,
      this.actorDepthTexture?layer.actorInfo:null,actorRanges);
    layer.geo.instanceCount=visible;
    if(visible){
      layer.rectAttr.clearUpdateRanges();layer.idAttr.clearUpdateRanges();
      layer.rectAttr.addUpdateRange(0,visible*4);
      layer.idAttr.addUpdateRange(0,visible*2);
      layer.rectAttr.needsUpdate=true;layer.idAttr.needsUpdate=true;
      if(this.actorDepthTexture){
        layer.actorAttr.clearUpdateRanges();
        layer.actorAttr.addUpdateRange(0,visible*2);
        layer.actorAttr.needsUpdate=true;
      }
    }
    return visible;
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
      this.castleFlash.uniforms.uTexture.value=this.castleTexture;
    }
    const count=GB.n-extra;
    const uploadStart=performance.now();
    const clip=this.cullingEnabled?glyphClipWindow(camx,camy,W,H,VZ,4):null;
    const ranges=this.actorDepthTexture?GB.nativeActorRanges||[]:null;
    const visibleGlyphs=this.upload(this.glyphs,GB.buf,0,count,clip,ranges);
    this.upload(this.castle,GB.buf,count,extra?1:0);
    this.upload(this.castleFlash,GB.buf,count+1,extra===2?1:0);
    const uploadCpuMs=performance.now()-uploadStart;
    for(const layer of [this.glyphs,this.castle,this.castleFlash]){
      layer.uniforms.uCam.value.set(camx,camy);
      layer.uniforms.uView.value.set(W/VZ,H/VZ);
      layer.uniforms.uArchitectureDepth.value=this.actorDepthTexture;
      layer.uniforms.uDepthEnabled.value=layer===this.glyphs&&this.actorDepthTexture?1:0;
      layer.uniforms.uDepthViewport.value.set(W*DPR,H*DPR);
      layer.uniforms.uActorDepthSlope.value=Math.tan(this.actorDepthPitch)/39999.99;
    }
    // The source castle flash is a separate additive GPU layer.
    this.renderer.info.reset();
    const renderStart=performance.now();
    this.renderer.render(this.scene,this.camera);
    const renderCpuMs=performance.now()-renderStart;
    this.stats={
      glyphs:count,visibleGlyphs,culledGlyphs:count-visibleGlyphs,
      uploadCpuMs,renderCpuMs,
      depthActorRanges:ranges?.length||0,
      depthEnabled:!!this.actorDepthTexture,
      drawCalls:this.renderer.info.render.calls,
      triangles:this.renderer.info.render.triangles,frame:this.stats.frame+1,
      glyphCapacity:this.glyphs.capacity,
      glyphInstanceAttributeBytes:this.glyphs.rect.byteLength+
        this.glyphs.idAlpha.byteLength+this.glyphs.actorInfo.byteLength
    };
    GB.n=originalCount;
  }
  debug(mode) {
    const n=Math.max(0,Math.min(5,mode|0));
    this.glyphs.uniforms.uDebugMode.value=n===5?1:n;
    this.castle.uniforms.uDebugMode.value=n===5?1:n;
    this.castleFlash.uniforms.uDebugMode.value=n===5?1:n;
    this.glyphs.uniforms.uDebugVertex.value=n===5?1:0;
    this.castle.uniforms.uDebugVertex.value=n===5?1:0;
    this.castleFlash.uniforms.uDebugVertex.value=n===5?1:0;
  }
  show(visible){this.renderer.domElement.style.display=visible?'block':'none';}
  dispose(){
    this.renderer.dispose();this.renderer.domElement.remove();
    for(const layer of [this.castle,this.castleFlash,this.glyphs]){
      layer.geo.dispose();layer.mat.dispose();
    }
    for(const tex of [this.uvTexture,this.atlas,this.castleTexture])if(tex)tex.dispose();
  }
}
