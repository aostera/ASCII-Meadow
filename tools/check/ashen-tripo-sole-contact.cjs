// Deterministic no-WebGL regression for the original 40-joint Tripo sole sampler.
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),path=require('node:path');
(async()=>{
 const {locateBootSoleVertices}=await import(
   pathToFileURL(path.resolve(__dirname,'../../experiments/three/ashen-sole-contact.mjs')).href);
 const bones=Array.from({length:40},(_,i)=>({id:i}));
 const points=[];
 // 90 weighted vertices on EACH genuine boot; 30 decoy body/cape points.
 for(const [joint,z] of [[33,-.15],[28,.15]]){
   for(let i=0;i<90;i++)
     points.push({joint,x:-.20+i/89*.40,y:.012+(i%5)*.003,z});
 }
 for(let i=0;i<30;i++)
   points.push({joint:1,x:.5,y:-.9,z:0});
 const attr=key=>({
   count:points.length,getX:i=>points[i].x,getY:i=>points[i].y,
   getZ:i=>points[i].z
 });
 const mesh={
   isSkinnedMesh:true,skeleton:{bones},geometry:{attributes:{
     position:attr('position'),
     skinIndex:{getComponent:(i,j)=>j===0?points[i].joint:0},
     skinWeight:{getComponent:(i,j)=>j===0?1:0}
   }}
 };
 const legs={
   leftLeg:[bones[31],bones[32],bones[33],bones[34]],
   rightLeg:[bones[26],bones[27],bones[28],bones[29]]
 };
 const [left,right]=locateBootSoleVertices([mesh],legs);
 for(const foot of [left,right]){
   assert.ok(foot,'Sole sampler must locate both weighted boots');
   assert.equal(foot.candidateCount,90,'Do not mix body/cape skin into sole');
   assert.ok(foot.indices.length>=8&&foot.indices.length<=12,
     'Select a bounded few true CPU-skinned mesh vertices');
   assert.ok(foot.heel.length>=3&&foot.toe.length>=3,
     'Both heel and toe regions must be represented');
   const heelX=foot.heel.map(i=>points[i].x);
   const toeX=foot.toe.map(i=>points[i].x);
   assert.ok(Math.max(...heelX)<Math.min(...toeX),
     'Heel and toe regions on source +X axis are confused');
 }
 assert.ok(left.indices.every(i=>points[i].joint===33));
 assert.ok(right.indices.every(i=>points[i].joint===28));
 const empty=locateBootSoleVertices([{isSkinnedMesh:false}],legs);
 assert.deepEqual(empty,[null,null],'No fake boot contact if no real skin exists');
 const bad=locateBootSoleVertices([mesh],{
   leftLeg:[bones[3],bones[4],bones[5],bones[6]],
   rightLeg:[bones[10],bones[11],bones[12],bones[13]]
 });
 assert.deepEqual(bad,[null,null],'Never invent skin weights for unknown joints');
 console.log('PASS real weighted boot selection: both feet, heel/toe, bound size, no GLB fallback');
})().catch(e=>{console.error(e);process.exitCode=1});
