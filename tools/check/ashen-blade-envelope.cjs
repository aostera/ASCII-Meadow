// Standalone verification of the actual Gothic sword mesh cross-section.
// The same stations define the rendered blade and the foot penetration test.
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const {ASHEN_BLADE_STATIONS,pointBladeGap}=await import(
   pathToFileURL(path.resolve(__dirname,'../../experiments/three/ashen-blade-envelope.mjs')).href);
 assert.equal(ASHEN_BLADE_STATIONS.length,8);
 for(const [y,w,d] of ASHEN_BLADE_STATIONS){
   assert.ok(pointBladeGap(0,y,0)<0,'Blade centre must be interior');
   assert.ok(Math.abs(pointBladeGap(w,y,0))<1e-9,'Rendered blade edge must be on envelope');
   assert.ok(Math.abs(pointBladeGap(0,y,d))<1e-9,'Diamond ridge must be on envelope');
   assert.ok(pointBladeGap(w*1.5,y,0)>0,'Outside lateral edge must clear');
   assert.ok(pointBladeGap(0,y,d*1.5)>0,'Outside ridge must clear');
 }
 assert.ok(pointBladeGap(0,-.2,0)<0,'Interpolated span should have volume');
 assert.ok(pointBladeGap(.10,-.2,0)>0,'Remote armor vertex must not collide');
 assert.ok(pointBladeGap(0,.1,0)>0,'Above sword hilt is not inside blade');
 assert.ok(pointBladeGap(0,-.6,0)>0,'Below tip is not inside blade');
 assert.ok(Number.isNaN(pointBladeGap(NaN,-.2,0)),'Do not fake invalid geometry');
 console.log('PASS true diamond Gothic blade envelope: 8 stations, edges, depth, tip, distance');
})().catch(e=>{console.error(e);process.exitCode=1});
