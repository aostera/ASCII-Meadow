// The Blender-repaired Ashen Vow knight GLB: structure and acceptance numbers (no browser).
// - the untouched Tripo source is still byte-identical (SHA256 from the handoff);
// - one skin with the source's 40 joints, same names in the same order;
// - animations Idle / Walk / Run / Jump, each at least 60 frames at 60 fps;
// - the sword is its own mesh node, a child of the right hand joint (bone_19);
// - vertex colours present; body triangles within the budget (desktop 90k, mobile 35k).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'experiments/three/assets/ashen-vow/ashen_tripo_v2_skeleton_lod.glb');
const TARGETS = [
  {file: path.join(ROOT, 'experiments/three/assets/ashen-vow/ashen_tripo_blender_repaired_v01.glb'), maxTris: 90000},
  {file: path.join(ROOT, 'experiments/three/assets/ashen-vow/ashen_tripo_blender_repaired_v01_mobile.glb'), maxTris: 35000},
  // the published copies: the same meshes, clips and joints with KHR_mesh_quantization (gltf-transform quantize)
  {file: path.join(ROOT, 'experiments/three/assets/ashen-vow/ashen_vow_v01q.glb'), maxTris: 90000},
  {file: path.join(ROOT, 'experiments/three/assets/ashen-vow/ashen_vow_v01q_mobile.glb'), maxTris: 35000},
];
const SRC_SHA = '5e1e2ff4686ba1503de61192a0537a85c6b9fdb51d2be8352b894fd91e2ac2b5';
const CLIPS = ['Idle', 'Walk', 'Run', 'Jump'];

function readGlb(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('latin1', 0, 4) !== 'glTF') throw Error(file + ' is not a GLB');
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
  const binStart = 20 + jsonLen + 8;
  return {json, buf, binStart};
}

function accessorMax(g, i) {
  const a = g.json.accessors[i];
  return a.max ? a.max[0] : null;
}

// The Tripo source's 40 joints, in its skin order (the source GLB itself lives on the Ashen
// branches; where it is present it is also hashed and compared).
const SOURCE_JOINTS = ['tripo::Root', 'tripo::Spine_0', 'tripo::Spine_1', 'tripo::0_Left_Limb_0', 'tripo::Head_0',
  'tripo::Head_1', 'tripo::0_Left_Limb_1', 'tripo::0_Left_Limb_2', 'tripo::0_Left_Limb_3', 'tripo::0_Left_Limb_4',
  'bone_10', 'bone_11', 'bone_12', 'tripo::0_Left_Limb_5', 'tripo::0_Left_Limb_6', 'tripo::0_Left_Limb_7',
  'bone_16', 'bone_17', 'bone_18', 'bone_19', 'bone_20', 'bone_21', 'bone_22', 'bone_23', 'bone_24', 'bone_25',
  'tripo::1_Right_Limb_0', 'tripo::1_Right_Limb_1', 'tripo::1_Right_Limb_2', 'tripo::1_Right_Limb_3',
  'tripo::1_Right_Limb_4', 'tripo::1_Left_Limb_0', 'tripo::1_Left_Limb_1', 'tripo::1_Left_Limb_2',
  'tripo::1_Left_Limb_3', 'tripo::1_Left_Limb_4', 'tripo::0_Right_Limb_0', 'tripo::0_Right_Limb_1',
  'tripo::0_Right_Limb_2', 'tripo::0_Right_Limb_3'];

const fail = [];
const names = g => g.json.skins[0].joints.map(j => g.json.nodes[j].name);
let sha = 'source GLB not in this checkout';
let srcJoints = SOURCE_JOINTS;
if (fs.existsSync(SRC)) {
  sha = crypto.createHash('sha256').update(fs.readFileSync(SRC)).digest('hex');
  if (sha !== SRC_SHA) fail.push('source GLB changed: ' + sha);
  srcJoints = names(readGlb(SRC));
  if (srcJoints.join() !== SOURCE_JOINTS.join()) fail.push('source joints differ from the recorded list');
}
const reports = [];
for (const {file: OUT, maxTris: MAX_TRIS} of TARGETS) {
const out = readGlb(OUT);
const outJoints = names(out);
const tag = path.basename(OUT) + ': ';
if (out.json.skins.length !== 1) fail.push(tag + 'expected one skin, got ' + out.json.skins.length);
if (outJoints.length !== 40) fail.push(tag + 'expected 40 joints, got ' + outJoints.length);
// Blender re-imports `tripo::X` as-is; compare by name, order included
const norm = s => s.replace(/[^A-Za-z0-9_]/g, '');
if (srcJoints.map(norm).join() !== outJoints.map(norm).join())
  fail.push(tag + 'joint names/order differ from the source:\n  ' + srcJoints.join(',') + '\n  ' + outJoints.join(','));

const anims = {};
for (const a of out.json.animations || []) {
  let t = 0;
  for (const s of a.samplers) t = Math.max(t, accessorMax(out, s.input) || 0);
  anims[a.name] = {seconds: +t.toFixed(3), frames: Math.round(t * 60) + 1, channels: a.channels.length};
}
for (const c of CLIPS) {
  if (!anims[c]) fail.push(tag + 'missing animation ' + c);
  else if (anims[c].frames < 60) fail.push(tag + `${c} has ${anims[c].frames} frames (< 60)`);
}

const hand = out.json.nodes.findIndex(n => n.name === 'bone_19');
const sword = out.json.nodes.findIndex(n => n.name === 'Ashen_Sword');
if (sword < 0) fail.push(tag + 'no Ashen_Sword node');
else if (hand < 0 || !(out.json.nodes[hand].children || []).includes(sword))
  fail.push(tag + 'Ashen_Sword is not a child of bone_19');

let bodyTris = 0, colours = false;
for (const n of out.json.nodes) {
  if (n.mesh === undefined || n.skin === undefined) continue;
  for (const p of out.json.meshes[n.mesh].primitives) {
    bodyTris += out.json.accessors[p.indices].count / 3;
    if (p.attributes.COLOR_0 !== undefined) colours = true;
  }
}
if (!colours) fail.push(tag + 'body has no COLOR_0');
if (bodyTris > MAX_TRIS) fail.push(tag + `body has ${bodyTris} triangles (> ${MAX_TRIS})`);

reports.push({
  file: path.basename(OUT), bytes: fs.statSync(OUT).size, joints: outJoints.length, bodyTris, colours,
  swordOnHand: sword >= 0,
  animations: anims,
});
}
if (fail.length) {
  console.error('ASHEN BLENDER GLB FAIL\n- ' + fail.join('\n- '));
  console.error(JSON.stringify(reports, null, 1));
  process.exit(1);
}
console.log('ASHEN BLENDER GLB PASS', JSON.stringify({source: sha.slice(0, 16) + '…', reports}));
