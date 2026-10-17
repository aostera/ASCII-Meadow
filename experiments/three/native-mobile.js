// Connect the source game's input and world-build lifecycle to Android
// browsers without editing any production scripts. Safe under bfcache restore.
import {installNativeMobileLifecycle} from './native-mobile-lifecycle.mjs';

const nativeMobile=installNativeMobileLifecycle({
  window,document,
  readDpr:()=>window.devicePixelRatio,
  appliedDpr:()=>DPR,
  invalidateSourceBuild:()=>{
    // source main.js reconstructs the EXACT same glyph art, map and actor
    // world on its next animation frame via snapshotActorWorld().
    builtW=-1;builtH=-1;
  },
  releaseControls:()=>{
    // Source input.js top-level bindings, not global window properties.
    ptr=null;
    keys.clear();
    mouse.on=false;
  }
});
if(nativeMobile.enabled){
  const hint=document.querySelector('.hud p');
  if(hint)hint.textContent=
    'Тяните в любом месте — идти, дальше — бег · ⤒ или второй палец — прыжок · касание подсказки — действие';
}
window.__ASCII_MOBILE__=nativeMobile;
