// Dependency-free migration unit tests: real GPU-timing query lifecycle,
// nonblocking polling and rotated scene ground contacts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
function load(file, className) {
  const src=fs.readFileSync(file,'utf8').replace('export class','class');
  return new Function(src+'; return '+className+';')();
}
const GpuFrameTimer=load('experiments/three/gpu-timing.js','GpuFrameTimer');
const GroundContacts=load('experiments/three/ground-contacts.js','GroundContacts');
const contacts=new GroundContacts();
contacts.rect(0,0,3,4,Math.PI/4);
contacts.circle(10,0,.5);
assert.equal(contacts.sample(0,0).blocked,true);
assert.equal(contacts.sample(9,9).blocked,false);
assert.equal(contacts.sample(10,0).blocked,true);
assert.ok(contacts.sample(2.4,0).pushX>0.3);
contacts.clear();
assert.equal(contacts.sample(0,0).blocked,false);
const ext={TIME_ELAPSED_EXT:35007,GPU_DISJOINT_EXT:36795};
let done=false,queries=0,deleted=0;
const context={
  QUERY_RESULT_AVAILABLE:34919,QUERY_RESULT:34918,
  isContextLost:()=>false,
  getExtension:name=>name==='EXT_disjoint_timer_query_webgl2'?ext:null,
  getParameter:()=>false,
  createQuery:()=>({id:++queries}),
  beginQuery:()=>{},
  endQuery:()=>{},
  getQueryParameter:(q,param)=>param===34919?done:2500000,
  deleteQuery:()=>{deleted++}
};
const t=new GpuFrameTimer({getContext:()=>context});
assert.equal(t.snapshot().supported,true);
assert.equal(t.snapshot().samples,0);
t.start();t.stop();
assert.equal(t.snapshot().samples,0,'async timer must not block while GPU query unavailable');
done=true;
const result=t.snapshot();
assert.equal(result.samples,1);
assert.equal(result.medianMs,2.5);
assert.equal(deleted,1);
t.lost();
assert.equal(t.snapshot().supported,false);
t.restore();
assert.equal(t.snapshot().supported,true);
assert.equal(t.snapshot().samples,0);
const disabled=new GpuFrameTimer({getContext:()=>({...context,getExtension:()=>null})});
disabled.start();disabled.stop();
assert.equal(disabled.snapshot().supported,false);
assert.equal(disabled.snapshot().p95ms,null);
console.log('PASS Three.js ground contacts and non-blocking optional GPU timer');
