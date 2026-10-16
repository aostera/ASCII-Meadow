// Native-only two-finger pan and pinch-zoom for the map editor on touch.
// The source editor pans only with the middle/right mouse button or Space and
// zooms only with Ctrl+wheel, so on a phone or tablet the camera could not be
// moved at all. This listener is registered on window capture BEFORE
// src/editor/editor.js, so it sees touch pointers first:
// - a first finger is held back until it moves NATIVE_TOUCH_HOLD_PX or lifts;
//   if a second finger lands before that, the pair is a camera gesture and
//   nothing was painted or placed; otherwise the held-back down (and its
//   last move) are replayed to the editor's pointer handler, so a brush stroke or a tap acts
//   exactly as before. No timer: a busy frame on a slow phone must not turn
//   a two-finger gesture into a paint stroke;
// - a second finger that lands later ends whatever the first finger started
//   (stroke, object drag, grey-ruin rotation) through the editor's own
//   pointercancel path: a stroke stays one undo entry, a rotation preview is
//   dropped uncommitted;
// - while two fingers are down, camX/camY follow the centroid and edZoomTo()
//   follows the finger spread, about the centroid, inside ED_ZOOMS limits;
// - after the gesture, the remaining finger is ignored until it lifts.
// Mouse, pen, the game's own touch controls and the editor UI are unchanged.
const NATIVE_TOUCH_HOLD_PX=8;
const nativeEditorTouch={pts:new Map(),held:null,gesture:null,swallow:new Set(),live:null,
  stats:{gestures:0,pans:0,zooms:0,replayed:0,cancelledStrokes:0}};

function nativeTouchEvent(type,src){
  return {type,target:cv,pointerId:src.pointerId,pointerType:'touch',button:0,buttons:type==='pointerup'?0:1,
    clientX:src.clientX,clientY:src.clientY,stopImmediatePropagation(){},preventDefault(){}};
}
// native-editor-models.mjs swaps edPointer for a delegate (touch rotation of
// a selected grey ruin) and registers it here; replays go through it too.
function nativeTouchDeliver(e){
  (window.__ASCII_NATIVE_EDITOR_POINTER__||edPointer)(e);
}
function nativeTouchReplay(){
  const h=nativeEditorTouch.held;
  if(!h)return;
  nativeEditorTouch.held=null;
  nativeEditorTouch.stats.replayed++;
  nativeEditorTouch.live=h.down.pointerId;
  nativeTouchDeliver(nativeTouchEvent('pointerdown',h.down));
  if(h.last)nativeTouchDeliver(nativeTouchEvent('pointermove',h.last));
}
function nativeTouchGestureStart(){
  const T=nativeEditorTouch,[a,b]=[...T.pts.values()];
  if(T.held)T.held=null;
  else if(T.live!==null){
    // The first finger already reached the editor (a stroke, an object drag
    // or the grey-ruin rotation delegate): end it through the active handler.
    nativeTouchDeliver(nativeTouchEvent('pointercancel',T.pts.get(T.live)||a));
    T.live=null;
    T.stats.cancelledStrokes++;
  }
  ED.pan=null;ED.hover=null;
  const cx=(a.clientX+b.clientX)/2,cy=(a.clientY+b.clientY)/2;
  T.gesture={ids:[...T.pts.keys()],cx,cy,dist:Math.max(1,Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)),
    z:VZ,camX,camY,wx:cx/(CW*VZ)+camX,wy:cy/(CH*VZ)+camY};
  T.stats.gestures++;
}
function nativeTouchGestureMove(){
  const T=nativeEditorTouch,g=T.gesture,a=T.pts.get(g.ids[0]),b=T.pts.get(g.ids[1]);
  if(!a||!b)return;
  const cx=(a.clientX+b.clientX)/2,cy=(a.clientY+b.clientY)/2;
  const dist=Math.max(1,Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY));
  const z=g.z*dist/g.dist;
  // Keep the ground point that was under the starting centroid under the
  // current centroid: pan and zoom in one step, no drift between them.
  const before=VZ;
  edZoomTo(z,cx,cy);
  camX=g.wx-cx/(CW*VZ);camY=g.wy-cy/(CH*VZ);
  if(Math.abs(VZ-before)>1e-6)T.stats.zooms++;
  T.stats.pans++;
}
function nativeEditorTouchReset(){
  const T=nativeEditorTouch;
  T.pts.clear();T.swallow.clear();T.held=null;T.gesture=null;T.live=null;
}
function nativeEditorTouchPointer(e){
  if(e.pointerType!=='touch')return;
  const T=nativeEditorTouch,id=e.pointerId;
  if(typeof editing==='undefined'||!editing){
    // The editor closed under a finger: forget it, so a later session never
    // sees a stale second pointer or a swallowed finger.
    if(T.pts.size&&(e.type==='pointerup'||e.type==='pointercancel')){
      T.pts.delete(id);T.swallow.delete(id);
      if(T.held?.down.pointerId===id)T.held=null;
      if(T.live===id)T.live=null;
      if(!T.pts.size)nativeEditorTouchReset();
    }
    return;
  }
  if(e.type==='pointerdown'){
    if(e.target!==cv)return;
    T.pts.set(id,{pointerId:id,clientX:e.clientX,clientY:e.clientY});
    if(T.gesture||T.swallow.size){e.stopImmediatePropagation();e.preventDefault();T.swallow.add(id);return}
    if(T.pts.size>=2){
      e.stopImmediatePropagation();e.preventDefault();
      try{cv.setPointerCapture(id)}catch(_){}
      nativeTouchGestureStart();
      return;
    }
    // Hold the first finger back until it is clearly a one-finger action.
    e.stopImmediatePropagation();e.preventDefault();
    try{cv.setPointerCapture(id)}catch(_){}
    T.held={down:{pointerId:id,clientX:e.clientX,clientY:e.clientY},last:null};
    return;
  }
  if(!T.pts.has(id))return;
  if(e.type==='pointermove'){
    T.pts.set(id,{pointerId:id,clientX:e.clientX,clientY:e.clientY});
    if(T.gesture){e.stopImmediatePropagation();e.preventDefault();nativeTouchGestureMove();return}
    if(T.swallow.has(id)){e.stopImmediatePropagation();return}
    if(T.held&&T.held.down.pointerId===id){
      e.stopImmediatePropagation();
      T.held.last={pointerId:id,clientX:e.clientX,clientY:e.clientY};
      const d=T.held.down;
      if(Math.hypot(e.clientX-d.clientX,e.clientY-d.clientY)>NATIVE_TOUCH_HOLD_PX)nativeTouchReplay();
    }
    return;
  }
  // pointerup / pointercancel
  T.pts.delete(id);
  if(T.live===id)T.live=null;
  if(T.held&&T.held.down.pointerId===id){
    if(e.type==='pointerup')nativeTouchReplay();   // a tap still paints/places
    else{T.held=null;e.stopImmediatePropagation();return}
    return;   // the real pointerup now reaches edPointer
  }
  if(T.gesture||T.swallow.has(id)){
    e.stopImmediatePropagation();
    if(T.gesture){
      // The gesture ends with its first lifted finger; any finger still down
      // is ignored until it lifts, so it cannot start a paint stroke.
      for(const k of T.pts.keys())T.swallow.add(k);
      T.gesture=null;
    }
    T.swallow.delete(id);
  }
}
for(const t of ['pointerdown','pointermove','pointerup','pointercancel'])
  addEventListener(t,nativeEditorTouchPointer,true);
window.__ASCII_NATIVE_EDITOR_TOUCH__={
  get tracked(){return nativeEditorTouch.pts.size+nativeEditorTouch.swallow.size+(nativeEditorTouch.held?1:0)},
  get stats(){return {...nativeEditorTouch.stats,active:nativeEditorTouch.pts.size,
    gesture:!!nativeEditorTouch.gesture}},
  holdPx:NATIVE_TOUCH_HOLD_PX
};
