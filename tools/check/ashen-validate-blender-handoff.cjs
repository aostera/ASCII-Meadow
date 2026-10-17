// Validate a real GLB transport for Claude/Blender without trusting a
// green screenshot. All four clips are explicitly UNAPPROVED v22 references.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.resolve(process.cwd(),'artifacts','ashen-blender-handoff');
const model=fs.readFileSync(path.join(dir,'ashen_tripo_v22_REVIEW_ONLY_motion_bake.glb'));
assert.equal(model.toString('ascii',0,4),'glTF','Not a GLB');
assert.equal(model.readUInt32LE(4),2,'Not GLB v2');
assert.equal(model.readUInt32LE(8),model.length,'GLB length mismatch');
const len=model.readUInt32LE(12);
assert.equal(model.toString('ascii',16,20),'JSON','Missing GLB JSON chunk');
const gltf=JSON.parse(model.toString('utf8',20,20+len));
const names=['REVIEW_ONLY__Idle','REVIEW_ONLY__Walk','REVIEW_ONLY__Run','REVIEW_ONLY__Jump'];
assert.deepEqual((gltf.animations||[]).map(a=>a.name),names,
  'Missing handoff action or unordered clips');
assert.ok(gltf.skins?.length>=1,'No skinned Tripo GLB');
assert.ok(gltf.skins.some(s=>s.joints.length===40),
  'The original Tripo 40-bone skin was lost or merged');
assert.ok(gltf.meshes?.length>=1,'No original skinned mesh');
assert.ok(gltf.animations.every(a=>a.channels.length>=80),
  'Quaternion or translation tracks were not baked');
assert.ok(gltf.nodes?.some(n=>/wrist|Limb|bone_19/i.test(n.name||'')),
  'Rig node names lost entirely');
const json=JSON.parse(fs.readFileSync(path.join(dir,'bake_manifest.json'),'utf8'));
assert.equal(json.boneCount,40);
assert.equal(json.animationCount,4);
assert.equal(json.approval,'REVIEW_ONLY_DO_NOT_SHIP');
const summary={bytes:model.length,meshPrimitives:gltf.meshes.reduce((n,m)=>n+m.primitives.length,0),
 joints:gltf.skins.map(s=>s.joints.length),
 tracks:gltf.animations.map(a=>[a.name,a.channels.length]),
 manifest:json.approval};
console.log('PASS CLAUDE/BLENDER GLB handoff validation:',JSON.stringify(summary));
