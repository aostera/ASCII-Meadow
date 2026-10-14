// Android Chrome/Samsung Internet/Firefox/WebView lifecycle support for the
// standalone native game. Original game source, authored pixels, gamma,
// translucency, motion and scene simulation remain unchanged.
//
// Device-pixel ratio changes can occur WITHOUT a CSS viewport resize when an
// Android browser changes display mode or its WebView density. The source
// game loop only notices innerWidth/innerHeight, so request a normal source
// rebuild (with snapshotActorWorld/restoreActorWorld) in that exact case.
export function nativeCappedDpr(value) {
  const d=Number(value);
  return Number.isFinite(d)&&d>0?Math.min(2,d):1;
}
export function nativeNeedsDensityRebuild(next,applied) {
  return Number.isFinite(applied)&&applied>0&&
    Math.abs(nativeCappedDpr(next)-applied)>.001;
}

export function installNativeMobileLifecycle({
  window:win,document:doc,
  readDpr,appliedDpr,invalidateSourceBuild,
  releaseControls
}) {
  if(!win||!doc||!readDpr||!appliedDpr||
    !invalidateSourceBuild||!releaseControls)
    throw Error('Native mobile lifecycle needs actual source game callbacks');
  const coarse=Boolean(win.matchMedia?.('(pointer: coarse)').matches);
  const android=/Android/i.test(win.navigator?.userAgent||'');
  const enabled=coarse||android;
  const v=win.visualViewport;
  const counters={densityInvalidations:0,viewportSignals:0,
    releasedControls:0,restores:0};
  let pending=false,disposed=false,frameHandle=null;

  const release=()=>{
    if(disposed||!enabled)return;
    releaseControls();counters.releasedControls++;
  };
  const check=()=>{
    pending=false;frameHandle=null;
    if(disposed||!enabled||doc.hidden)return;
    if(nativeNeedsDensityRebuild(readDpr(),appliedDpr())){
      // Do not blindly rebuild on Android address-bar collapse. A changed
      // innerWidth/innerHeight is handled by source main.js itself. Only a
      // density-only transition forces the source's safe actor snapshot.
      invalidateSourceBuild();
      counters.densityInvalidations++;
    }
  };
  const signal=()=>{
    if(disposed||!enabled)return;
    counters.viewportSignals++;
    if(pending||doc.hidden)return;
    pending=true;
    frameHandle=win.requestAnimationFrame(check);
  };
  const onHide=()=>release();
  const onResume=()=>{
    if(disposed||!enabled)return;
    counters.restores++;
    // Source main.js already owns GPU texture restoration; do not take
    // another WebGL context or rewrite its source canvas.
    signal();
  };
  const onVisibility=()=>{
    if(doc.hidden)onHide();else onResume();
  };
  const onOrientation=()=>{release();signal()};
  // Capture must run BEFORE original input.js pointercancel->up handler,
  // otherwise Android's navigation-gesture cancellation may cause an
  // accidental game strike and keep a stale held drag.
  const onCancel=()=>release();
  const listeners=[];
  const listen=(target,type,fn,options)=>{
    if(!target?.addEventListener)return;
    target.addEventListener(type,fn,options);
    listeners.push([target,type,fn,options]);
  };
  if(enabled){
    listen(doc,'visibilitychange',onVisibility);
    listen(win,'pagehide',onHide);
    listen(win,'pageshow',onResume);
    listen(win,'blur',onHide);
    listen(win,'resize',signal);
    listen(win,'orientationchange',onOrientation);
    listen(win.screen?.orientation,'change',onOrientation);
    listen(doc,'freeze',onHide);
    listen(doc,'resume',onResume);
    listen(v,'resize',signal);
    listen(v,'scroll',signal);
    const canvas=doc.getElementById('c');
    listen(canvas,'pointercancel',onCancel,true);
    listen(canvas,'lostpointercapture',onCancel,true);
  }
  return {
    get enabled(){return enabled},
    get android(){return android},
    get coarse(){return coarse},
    get stats(){return {...counters,pending}},
    inspect:()=>({dpr:nativeCappedDpr(readDpr()),
      appliedDpr:appliedDpr(),viewportWidth:win.innerWidth,
      viewportHeight:win.innerHeight,visualScale:v?.scale||1}),
    sync:signal,
    dispose(){
      if(disposed)return;
      disposed=true;
      for(const [t,type,fn,options] of listeners)
        t.removeEventListener(type,fn,options);
      if(frameHandle!==null)win.cancelAnimationFrame(frameHandle);
      frameHandle=null;pending=false;
    }
  };
}
