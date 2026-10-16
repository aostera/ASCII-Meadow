// Grey 3D building models INSIDE the authored map editor. Uses the native
// game's existing WebGL renderer and the real source castle / ruin meshes:
// no second canvas, no second GPU context, and no screenshot-only inset.
// Previewed ruin yaw is not written to MEADOW_MAP until the user releases the
// control. The original art remains pixel-for-pixel untouched outside editing.
import * as THREE from 'three';
import {createNativeSourceWorld,configureNativeCamera} from './source-world.mjs';
import {makeSourceArchitecture} from './source-masonry.mjs';

const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
const toDegrees=r=>Math.round(r*180/Math.PI);
const fromDegrees=d=>d*Math.PI/180;
const wrapped=d=>((d+180)%360+360)%360-180;

export class NativeGreyMapEditor {
  constructor(renderer,sourceProvider,controller){
    this.renderer=renderer;
    this.sourceProvider=sourceProvider;
    this.controller=controller;
    this.scene=new THREE.Scene();
    this.scene.background=null;
    this.camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,40000);
    this.world=null;this.signature=null;
    this.materials={
      wall:new THREE.MeshLambertMaterial({color:0xa2a2a2,side:THREE.DoubleSide}),
      roof:new THREE.MeshLambertMaterial({color:0x707070,side:THREE.DoubleSide}),
      spire:new THREE.MeshLambertMaterial({color:0xb3b3b3,side:THREE.DoubleSide}),
      rock:new THREE.MeshLambertMaterial({color:0x616161,side:THREE.DoubleSide}),
      step:new THREE.MeshLambertMaterial({color:0xc2c2c2,side:THREE.DoubleSide})
    };
    this.scene.add(new THREE.HemisphereLight(0xf5f5f5,0x282828,2));
    const sun=new THREE.DirectionalLight(0xffffff,1.65);
    sun.position.set(-440,850,580);this.scene.add(sun);
    this.active=true;
    this.preview=null;
    this.selection=null;
    this.selectionHelper=new THREE.BoxHelper(new THREE.Object3D(),0xe6e6e6);
    this.selectionHelper.visible=false;
    this.scene.add(this.selectionHelper);
    this.frame=0;this.drawCalls=0;this.disposed=false;
    this.buildUi();
    this.installMapDrag();
  }
  buildUi(){
    const panel=document.createElement('section');
    panel.className='native-grey-editor';
    panel.hidden=true;
    panel.setAttribute('aria-label','Серые 3D-модели в редакторе карты');
    panel.innerHTML=`
      <label class="native-grey-switch">
        <input type="checkbox" checked aria-label="Показывать серые 3D-модели на карте">
        <span>Серые 3D-модели</span>
      </label>
      <div class="native-grey-note">Редактор карты · выбрать руину (V), затем вращать модель</div>
      <div class="native-grey-rotation" hidden>
        <div class="native-grey-rotation-title"><span>Поворот здания</span><output>0°</output></div>
        <input type="range" min="-180" max="180" step="1" value="0"
          aria-label="Поворачивать серую 3D-модель здания">
        <div class="native-grey-buttons">
          <button type="button" data-rotate="-15">↶ −15°</button>
          <button type="button" data-rotate="15">↷ +15°</button>
          <button type="button" data-reset="1">0°</button>
        </div>
        <button type="button" class="native-grey-map-drag" aria-pressed="false">Вращать на карте касанием</button>
        <div class="native-grey-note">Ползунок и [ ] вращают выбранное здание. На телефоне включите поворот касанием и проведите по модели; изменения попадут в экспорт карты.</div>
      </div>`;
    document.body.append(panel);
    this.panel=panel;
    this.switch=panel.querySelector('input[type=checkbox]');
    this.rotation=panel.querySelector('.native-grey-rotation');
    this.slider=panel.querySelector('input[type=range]');
    this.angle=panel.querySelector('output');
    this.touchRotateEnabled=false;
    this.mapDragButton=panel.querySelector('.native-grey-map-drag');
    this.mapDragButton.addEventListener('click',()=>{
      this.touchRotateEnabled=!this.touchRotateEnabled;
      this.mapDragButton.setAttribute('aria-pressed',String(this.touchRotateEnabled));
      this.mapDragButton.textContent=this.touchRotateEnabled
        ?'Поворот касанием: включён':'Вращать на карте касанием';
    });
    this.switch.addEventListener('change',()=>{
      this.active=this.switch.checked;
      this.refreshUi();
    });
    this.slider.addEventListener('input',()=>{
      if(!this.selection)return;
      this.preview={index:this.selection.index,
        original:this.selection.yaw,
        angle:fromDegrees(Number(this.slider.value))};
      this.angle.textContent=this.slider.value+'°';
    });
    this.slider.addEventListener('change',()=>{
      const pending=this.preview;this.preview=null;
      if(pending&&this.selection?.index===pending.index)
        this.controller.commit(pending.index,pending.angle);
      this.refreshUi();
    });
    panel.querySelectorAll('[data-rotate]').forEach(b=>b.addEventListener('click',()=>{
      if(!this.selection)return;
      this.controller.commit(this.selection.index,
        fromDegrees(wrapped(toDegrees(this.selection.yaw)+Number(b.dataset.rotate))));
      this.refreshUi();
    }));
    panel.querySelector('[data-reset]').addEventListener('click',()=>{
      if(!this.selection)return;
      this.controller.commit(this.selection.index,0);
      this.refreshUi();
    });
    panel.addEventListener('pointerdown',e=>e.stopPropagation());
    panel.addEventListener('keydown',e=>{
      // Prevent editor's global key capture from treating arrow movement
      // over a slider as map-camera movement.
      if(e.target===this.slider&&e.code.startsWith('Arrow'))
        e.stopPropagation();
    });
  }
  // Restore direct model rotation *on the map* (Alt/Shift-drag on
  // desktop, opt-in one-finger drag on a selected ruin on touch devices).
  // Normal map touch gestures remain unchanged with the toggle off.
  // Install a native-only delegate after removing that same source handler
  // from the capture phase; ordinary painting, dragging, zooming, placement
  // and undo pass through untouched to edPointer.
  installMapDrag(){
    if(typeof edPointer!=='function'||typeof edPick!=='function')return;
    const types=['pointerdown','pointermove','pointerup','pointercancel'];
    this.modelDrag=null;
    this.editorPointer=(e)=>{
      const cv=document.getElementById('c');
      if(this.modelDrag&&e.pointerId===this.modelDrag.pointerId){
        const d=this.modelDrag;
        e.stopImmediatePropagation();e.preventDefault();
        if(e.type==='pointermove'){
          const angle=fromDegrees(wrapped(
            toDegrees(d.startAngle)+(e.clientX-d.startX)*.6));
          this.preview={index:d.index,original:d.startAngle,angle};
        }else if(e.type==='pointerup'||e.type==='pointercancel'){
          const pending=this.preview;
          this.modelDrag=null;this.preview=null;
          try{cv.releasePointerCapture(e.pointerId)}catch(_){}
          if(e.type==='pointerup'&&pending)
            this.controller.commit(d.index,pending.angle);
          this.refreshUi();
        }
        return;
      }
      if(e.type==='pointerdown'&&this.active&&
         this.controller.isEditing()&&e.target===cv&&e.button===0&&
         (e.altKey||e.shiftKey||
          (this.touchRotateEnabled&&e.pointerType==='touch'))){
        // Prioritize actual grey 3D buildings over grass/flowers at their
        // feet; the normal source picker remains authoritative for plain
        // clicks and dragging all other map objects.
        const hovered=edObjects().filter(o=>o.kind==='ruins'&&
          Math.abs(e.clientX-o.sx)<o.r&&
          e.clientY<o.sy+CH*1.5*VZ&&
          e.clientY>o.sy-o.top).sort((a,b)=>b.sy-a.sy)[0];
        // Touch requires a PRESELECTED ruin: an accidental swipe across
        // another building must not rotate it or hijack normal panning.
        const touchDrag=this.touchRotateEnabled&&e.pointerType==='touch'&&
          !e.altKey&&!e.shiftKey;
        if(hovered&&(!touchDrag||
          (ED.sel?.kind==='ruins'&&ED.sel.mi===hovered.mi))){
          ED.tool='select';ED.sel={kind:'ruins',mi:hovered.mi};
          edSyncUI();this.refreshUi();
          const r=this.controller.selectedRuin();
          this.modelDrag={pointerId:e.pointerId,index:hovered.mi,
            startX:e.clientX,startAngle:r?.yaw||0};
          try{cv.setPointerCapture(e.pointerId)}catch(_){}
          e.preventDefault();e.stopImmediatePropagation();
          return;
        }
      }
      edPointer(e);
    };
    for(const type of types){
      window.removeEventListener(type,edPointer,true);
      window.addEventListener(type,this.editorPointer,true);
    }
    this.replacedPointerTypes=types;
    // native-editor-touch.js replays a held-back first finger through this.
    window.__ASCII_NATIVE_EDITOR_POINTER__=this.editorPointer;
  }
  refreshUi(){
    if(this.disposed)return;
    const editing=this.controller.isEditing();
    this.panel.hidden=!editing;
    const selected=this.controller.selectedRuin();
    if(!selected||!this.active){
      this.rotation.hidden=true;
      this.selection=null;
      this.preview=null;
      return;
    }
    const yaw=Number(selected.yaw)||0;
    if(this.preview&&this.preview.index!==selected.index)this.preview=null;
    this.selection={index:selected.index,yaw,id:selected.id};
    this.rotation.hidden=false;
    const current=this.preview?.angle??yaw;
    const deg=wrapped(toDegrees(current));
    this.slider.value=String(deg);
    this.angle.textContent=deg+'°';
  }
  clearWorld(){
    if(!this.world)return;
    this.scene.remove(this.world);
    this.world.traverse(o=>{if(o.geometry)o.geometry.dispose()});
    this.world=null;
  }
  ensureWorld(source){
    const sites=source.ruinSites();
    const signature=source.worldGen+'|'+source.WS+'|'+source.MS+'|'+
      source.cathedral.kx+'|'+source.cathedral.ky+'|'+
      JSON.stringify(sites.map(r=>[r.id,r.x,r.z,r.yaw]));
    if(this.world&&signature===this.signature)return;
    this.clearWorld();
    this.world=createNativeSourceWorld(THREE,{...source,materials:this.materials,
      makeSourceArchitecture});
    this.scene.add(this.world);
    this.signature=signature;
  }
  render(data){
    if(this.disposed)return;
    this.refreshUi();
    if(!this.active||!this.controller.isEditing()||!this.renderer)return;
    this.ensureWorld(this.sourceProvider());
    // The source mesh is already yaw-transformed. Three reverses the X
    // coordinate, so its preview Y-axis rotation is NEGATIVE delta yaw.
    // This must match ruinRotateMesh() when the authored map is committed.
    const sel=this.selection;
    for(let i=0;i<this.world.children.length;i++){
      const child=this.world.children[i];
      const index=i-1;
      if(index>=0&&sel?.index===index&&this.preview){
        const sourceYaw=this.sourceProvider().ruinSites()[index]?.yaw||0;
        child.rotation.y=sourceYaw-this.preview.angle;
      }else child.rotation.y=0;
    }
    const target=sel?this.world.children[sel.index+1]:null;
    if(target){
      this.selectionHelper.setFromObject(target);
      this.selectionHelper.visible=true;
    }else this.selectionHelper.visible=false;
    configureNativeCamera(THREE,this.camera,data);
    const r=this.renderer,auto=r.autoClear;
    const targetBefore=r.getRenderTarget();
    const viewport=r.getViewport(new THREE.Vector4());
    const scissor=r.getScissor(new THREE.Vector4());
    const scissorTest=r.getScissorTest();
    try{
      r.setRenderTarget(null);
      // Three applies renderer.pixelRatio to screen-target viewport itself.
      // Passing DPR-scaled dimensions here crops/misaligns grey models on phones.
      r.setViewport(0,0,data.W,data.H);
      r.setScissorTest(false);
      r.autoClear=false;
      r.clearDepth();
      r.render(this.scene,this.camera);
      this.frame++;this.drawCalls=r.info.render.calls;
    }finally{
      r.autoClear=auto;
      r.setRenderTarget(targetBefore);
      r.setViewport(viewport);r.setScissor(scissor);r.setScissorTest(scissorTest);
    }
  }
  get stats(){return {enabled:this.active,frames:this.frame,
    drawCalls:this.drawCalls,sites:this.world?.userData?.sourceSites||[],
    yawPreview:this.preview?.angle??null,
    previewRotationY:this.selection&&this.world?
      this.world.children[this.selection.index+1]?.rotation.y??null:null,
    selected:this.selection?.id||null}}
  dispose(){
    if(this.disposed)return;
    this.disposed=true;this.panel.remove();this.clearWorld();
    if(this.replacedPointerTypes){
      for(const type of this.replacedPointerTypes){
        window.removeEventListener(type,this.editorPointer,true);
        window.addEventListener(type,edPointer,true);
      }
      if(window.__ASCII_NATIVE_EDITOR_POINTER__===this.editorPointer)
        window.__ASCII_NATIVE_EDITOR_POINTER__=null;
    }
    this.selectionHelper.geometry.dispose();this.selectionHelper.material.dispose();
    for(const m of Object.values(this.materials))m.dispose();
    this.scene.clear();
  }
}
