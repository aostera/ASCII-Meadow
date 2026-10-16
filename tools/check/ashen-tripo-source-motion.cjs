// Zero-WebGL regression of native Tripo movement intent vs ACTUAL map travel.
// This test uses source-motion.mjs directly. No model, webgl or paid APIs needed.
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
 const {sourceKnightMotion,headingForSourceD8,sourceActorFoot}=
   await import(pathToFileURL(path.resolve(__dirname,'../../experiments/three/source-motion.mjs')).href);
 const dt=1/60,CW=1,CH=1;
 const e=(x,y,extra={})=>({x,y,walk:1,moving:1,run:1,d8:0,pxPerMetre:24,...extra});
 const read=(next,prev)=>sourceKnightMotion(next,prev,dt,CW,CH);
 const snapshot=actor=>({sx:actor.x*CW,sy:(actor.y+.7)*CH,jumping:!!actor.jump});
 const initial=e(100,40);
 assert.equal(read(initial,null).movement.speed,0,'No previous displacement on spawn');
 const run=e(101,41);
 assert.ok(read(run,snapshot(initial)).movement.speed>0,'Diagonal travel drives animation');
 assert.equal(read(run,snapshot(run)).movement.speed,0,'Holding Run at wall cannot moonwalk');
 const backwards=e(100,39);
 assert.ok(read(backwards,snapshot(run)).movement.speed>0,'Real reverse travel remains valid');
 assert.equal(read(e(600,600),snapshot(run)).movement.speed,0,'Teleport must not sprint');
 const leap=e(101,41,{jump:.7});
 assert.equal(read(leap,snapshot(initial)).movement.speed,0,'Airborne movement has no ground gait');
 const touchdown=e(103,43);
 assert.equal(read(touchdown,snapshot(leap)).movement.speed,0,
   'First landed frame must not turn jump displacement into a sprint');
 assert.ok(read(e(104,43),snapshot(touchdown)).movement.speed>0,
   'Grounded movement after touchdown must resume');
 const standing=e(101,41,{walk:0,moving:0,run:1});
 assert.equal(read(standing,snapshot(initial)).movement.speed,0,'Run without Walk/moving cannot stride');
 assert.deepEqual(sourceActorFoot(e(1,2),CW,CH),[1,2.7]);
 for(let d=0;d<8;d++){
   const q=headingForSourceD8(d);
   assert.ok(Number.isFinite(q),'Nonfinite 8-way source heading');
   assert.ok(Math.abs(q-headingForSourceD8(d+8))<1e-12,
     '8-way direction modulo did not wrap');
 }
 assert.equal(read(e(101,41),snapshot(initial)).movement.heading,
   headingForSourceD8(0),'Heading mismatch');
 console.log('Native movement intent / map displacement / jump / teleport / 8-way headings: PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
