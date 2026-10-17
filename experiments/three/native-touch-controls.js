// T10, native-only touch controls for phones and tablets. Source input.js steers a
// touch by walking the knight toward the point under the finger: a thumb in a
// corner drags him into that corner and runs, the finger hides him, a second
// finger overwrites the first and lifting it stops the walk. This layer takes
// touch and pen pointers on the game canvas before input.js sees them (window
// capture, registered before the editor's capture listeners) and gives them:
// - a floating stick: born where the finger lands; the knight walks the way the
//   finger is pushed from there (dead zone NATIVE_STICK.dead), runs past
//   NATIVE_STICK.run, and past the rim the centre trails the finger so turning
//   back is instant;
// - taps as before (prompt -> use, knight -> jump, field -> gust), and any tap
//   of a second finger while the stick is held jumps without stopping the walk;
// - a jump button, and a use button while a prompt (other than the castle gate,
//   which has its own button) is in reach;
// - no long-press menu, pinch or double-tap zoom on the field.
// Mouse input, the map editor (its own two-finger gestures), the castle
// interior pad and the source scripts are unchanged; moveIntent() is wrapped,
// so the knight moves through the same source physics and animation.
const NATIVE_STICK={dead:10,run:46,rim:72,tapMs:300};
const nativeTouch={ptrs:new Map(),stick:null,stats:{sticks:0,taps:0,jumps:0,uses:0,gusts:0}};

function nativeTouchOwns(e){
  return e.pointerType!=='mouse'&&!editing&&!window.__ASCII_NATIVE__?.castleInterior?.active;
}
function nativeTouchRelease(id){
  const p=nativeTouch.ptrs.get(id);
  nativeTouch.ptrs.delete(id);
  if(p&&p===nativeTouch.stick)nativeTouch.stick=null;
  return p;
}
function nativeTouchReleaseAll(){nativeTouch.ptrs.clear();nativeTouch.stick=null}
function nativeTouchJump(){nativeTouch.stats.jumps++;jump()}
function nativeTouchTap(p){
  nativeTouch.stats.taps++;
  const bx=activeSpot&&activeSpot.box;
  if(bx&&p.x>=bx[0]&&p.x<=bx[0]+bx[2]&&p.y>=bx[1]&&p.y<=bx[1]+bx[3]){nativeTouch.stats.uses++;useSpot();return}
  // a second finger while walking: the knight is moving under the thumb, so any tap jumps
  if(nativeTouch.stick){nativeTouchJump();return}
  const gx=p.x/CW+camX,gy=p.y/CH+camY;
  if(Math.hypot(gx-player.x,(gy-player.y)*CH/CW)<10)nativeTouchJump();
  else{nativeTouch.stats.gusts++;gust(gx,gy)}
}

addEventListener('pointerdown',e=>{
  if(e.target!==cv||!nativeTouchOwns(e))return;
  // input.js never sees this finger, so its drag-to-point stays idle
  e.stopImmediatePropagation();e.preventDefault();
  try{cv.setPointerCapture(e.pointerId)}catch(_){}
  nativeTouch.ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,
    ox:e.clientX,oy:e.clientY,t:performance.now(),held:false});
},true);
addEventListener('pointermove',e=>{
  const p=nativeTouch.ptrs.get(e.pointerId);
  if(!p)return;
  p.x=e.clientX;p.y=e.clientY;
  if(!p.held&&Math.hypot(p.x-p.sx,p.y-p.sy)>NATIVE_STICK.dead){
    p.held=true;
    // the first finger that moves steers; the others stay taps
    if(!nativeTouch.stick){nativeTouch.stick=p;nativeTouch.stats.sticks++}
  }
  if(p===nativeTouch.stick){
    const dx=p.x-p.ox,dy=p.y-p.oy,d=Math.hypot(dx,dy);
    if(d>NATIVE_STICK.rim){p.ox=p.x-dx/d*NATIVE_STICK.rim;p.oy=p.y-dy/d*NATIVE_STICK.rim}
  }
},true);
addEventListener('pointerup',e=>{
  const p=nativeTouchRelease(e.pointerId);
  if(p&&!p.held&&performance.now()-p.t<NATIVE_STICK.tapMs&&nativeTouchOwns(e))nativeTouchTap(p);
},true);
// a cancelled touch belongs to the browser or the OS (back gesture, shade): never a tap
for(const t of ['pointercancel','lostpointercapture'])
  addEventListener(t,e=>{nativeTouchRelease(e.pointerId)},true);
for(const t of ['blur','pagehide'])addEventListener(t,nativeTouchReleaseAll);
document.addEventListener('visibilitychange',nativeTouchReleaseAll);
cv.addEventListener('contextmenu',e=>e.preventDefault());
for(const t of ['gesturestart','gesturechange'])
  document.addEventListener(t,e=>{if(!editing)e.preventDefault()});
document.addEventListener('touchmove',e=>{if(e.target===cv&&!editing)e.preventDefault()},{passive:false});

// The stick overrides keys only while a finger steers; otherwise source input stands.
const nativeSourceMoveIntent=moveIntent;
moveIntent=function(){
  const r=nativeSourceMoveIntent();
  const s=nativeTouch.stick;
  if(!s||editing)return r;
  const dx=s.x-s.ox,dy=s.y-s.oy,d=Math.hypot(dx,dy);
  return d>NATIVE_STICK.dead?[dx,dy,d>NATIVE_STICK.run]:[0,0,false];
};

// On-screen parts: the stick (ring where the finger landed, a dot under it)
// and the jump/use buttons. DOM over the canvases, so both the Three backend
// and the Canvas2D fallback show them without touching the render passes.
const nativeTouchUi=(()=>{
  const ring=document.createElement('div');ring.className='native-stick';ring.hidden=true;
  ring.setAttribute('aria-hidden','true');ring.innerHTML='<i class="native-stick-run"></i><b></b>';
  const knob=ring.querySelector('b');
  const pad=document.createElement('div');pad.className='native-touch-pad';
  pad.innerHTML='<button type="button" class="native-touch-use" hidden></button>'+
    '<button type="button" class="native-touch-jump" aria-label="Прыжок">⤒</button>';
  const use=pad.querySelector('.native-touch-use'),jumpBtn=pad.querySelector('.native-touch-jump');
  // buttons fire on press, not on click: a thumb that is also steering must not wait for release
  jumpBtn.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();nativeTouchJump()});
  use.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();
    if(activeSpot){nativeTouch.stats.uses++;useSpot()}});
  document.body.append(ring,pad);
  let lastLabel='';
  const frame=()=>{
    const s=nativeTouch.stick,inside=window.__ASCII_NATIVE__?.castleInterior?.active;
    ring.hidden=!s||editing;
    if(s&&!editing){
      const dx=s.x-s.ox,dy=s.y-s.oy;
      ring.style.transform=`translate(${s.ox}px,${s.oy}px)`;
      knob.style.transform=`translate(${dx}px,${dy}px)`;
      ring.classList.toggle('running',Math.hypot(dx,dy)>NATIVE_STICK.run);
    }
    pad.hidden=editing||!!inside;
    const spot=!editing&&!inside&&activeSpot&&!activeSpot._nativeInterior?activeSpot:null;
    use.hidden=!spot;
    const label=spot?'E · '+spot.label:'';
    if(label!==lastLabel){use.textContent=label;lastLabel=label}
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return {ring,pad,use,jump:jumpBtn};
})();
window.__ASCII_NATIVE_TOUCH__={
  get stick(){const s=nativeTouch.stick;return s?{ox:s.ox,oy:s.oy,x:s.x,y:s.y}:null},
  get fingers(){return nativeTouch.ptrs.size},
  stats:nativeTouch.stats,ui:nativeTouchUi,config:NATIVE_STICK
};
