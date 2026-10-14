// Android lifecycle pure tests without a browser or a GPU.
// Density transition is NOT allowed to rebuild the authored world for
// browser address-bar animation or orientation signals alone.
import assert from 'node:assert/strict';
import {nativeCappedDpr,nativeNeedsDensityRebuild,installNativeMobileLifecycle}
  from '../../experiments/three/native-mobile-lifecycle.mjs';

assert.equal(nativeCappedDpr(3.75),2);
assert.equal(nativeCappedDpr(1.25),1.25);
assert.equal(nativeCappedDpr(0),1);
assert.equal(nativeCappedDpr(NaN),1);
assert.equal(nativeNeedsDensityRebuild(3,2),false);
assert.equal(nativeNeedsDensityRebuild(1.25,2),true);
assert.equal(nativeNeedsDensityRebuild(1,1),false);

const doc=new EventTarget();
doc.hidden=false;
const canvas=new EventTarget();
doc.getElementById=id=>id==='c'?canvas:null;
const win=new EventTarget();
win.screen={orientation:new EventTarget()};
win.visualViewport=new EventTarget();
win.visualViewport.scale=1;
win.matchMedia=()=>({matches:true});
win.navigator={userAgent:'Android WebView'};
win.innerWidth=393;win.innerHeight=851;
let nextId=0;
const pending=new Map();
win.requestAnimationFrame=cb=>{const id=++nextId;pending.set(id,cb);return id};
win.cancelAnimationFrame=id=>pending.delete(id);
const flush=()=>{const jobs=[...pending.values()];pending.clear();for(const fn of jobs)fn(0)};
let density=2,applied=2,rebuilds=0,releases=0;
const runtime=installNativeMobileLifecycle({
 window:win,document:doc,
 readDpr:()=>density,appliedDpr:()=>applied,
 invalidateSourceBuild:()=>{rebuilds++},
 releaseControls:()=>{releases++}
});
assert.equal(runtime.enabled,true);
assert.equal(runtime.android,true);
// Address-bar animation and a normal rotation must NOT force a second
// rebuild on the same size/density; source main.js owns viewport resizing.
win.visualViewport.dispatchEvent(new Event('resize'));
win.dispatchEvent(new Event('resize'));
flush();assert.equal(rebuilds,0);
assert.equal(runtime.stats.viewportSignals,2);
win.screen.orientation.dispatchEvent(new Event('change'));
flush();assert.equal(rebuilds,0);assert.equal(releases,1);
// Android switches density while keeping CSS width/height unchanged.
density=1.25;
win.visualViewport.dispatchEvent(new Event('resize'));
flush();assert.equal(rebuilds,1);
applied=1.25;
win.dispatchEvent(new Event('resize'));
flush();assert.equal(rebuilds,1);
// System gesture cancelled mid-drag: no stuck movement intent.
canvas.dispatchEvent(new Event('pointercancel'));
assert.equal(releases,2);
doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));
assert.equal(releases,3);
density=1.5;win.dispatchEvent(new Event('resize'));flush();
assert.equal(rebuilds,1);
doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));
flush();assert.equal(rebuilds,2);
assert.equal(runtime.stats.restores,1);
win.dispatchEvent(new Event('pagehide'));assert.equal(releases,4);
runtime.dispose();
density=1.75;win.dispatchEvent(new Event('resize'));flush();
canvas.dispatchEvent(new Event('pointercancel'));
assert.equal(rebuilds,2);assert.equal(releases,4);
assert.equal(runtime.stats.pending,false);
console.log('PASS native Android lifecycle: touch cancel, visibility, orientation, DPR-only rebuild, cleanup');
