const fs=require('node:fs');
const [original,optimized]=process.argv.slice(2);
if(!original||!optimized)throw Error('Original and optimized GLB required');
function load(p){
 const b=fs.readFileSync(p);
 if(b.toString('ascii',0,4)!=='glTF')throw Error('GLB expected: '+p);
 const l=b.readUInt32LE(12);
 return {j:JSON.parse(b.toString('utf8',20,20+l)),bytes:b.length};
}
const a=load(original),b=load(optimized);
function meta(x){
 const skins=x.j.skins||[],nodes=x.j.nodes||[],animations=x.j.animations||[];
 const jm=skins.map(s=>s.joints.length);
 const prims=(x.j.meshes||[]).flatMap(m=>m.primitives||[]);
 return {bytes:x.bytes,skins:skins.length,joints:jm,
   animations:animations.length,skinnedPrims:prims.filter(p=>p.attributes?.JOINTS_0!==undefined&&p.attributes?.WEIGHTS_0!==undefined).length,
   nodes:nodes.length};
}
const before=meta(a),after=meta(b);
console.log('REAL TRIPO SKIN LOD',JSON.stringify({before,after}));
if(after.skins<1||after.joints[0]<40||after.skinnedPrims<1)
 throw Error('Optimization LOST Tripo skeleton, joints or skin weights');
if(after.bytes>27000000)
 throw Error('Even free mobile LOD is bigger than 27MB; revise pipeline before publishing');
console.log('PASS: authentic Tripo 40-bone skin survived free mobile optimization');
