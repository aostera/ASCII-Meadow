// Put the exported skin's joints back in the Tripo source order (names and indices stable for
// the game adapter). Blender's glTF exporter lists joints in its own hierarchy order; this rewrites
// skin.joints, the inverse bind matrices and every JOINTS_n vertex attribute in place.
// Usage: node blender/ashen/fix_joint_order.cjs <source.glb> <exported.glb>
const fs = require('node:fs');

function parse(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('latin1', 0, 4) !== 'glTF') throw Error(file + ' is not a GLB');
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
  const binHeader = 20 + jsonLen;
  const binLen = buf.readUInt32LE(binHeader);
  const bin = buf.subarray(binHeader + 8, binHeader + 8 + binLen);
  return {buf, json, bin};
}

const norm = s => s.replace(/[^A-Za-z0-9_]/g, '');
const [srcFile, outFile] = process.argv.slice(2);
if (!srcFile || !outFile) throw Error('usage: fix_joint_order.cjs <source.glb> <exported.glb>');
const src = parse(srcFile);
const out = parse(outFile);
const want = src.json.skins[0].joints.map(j => norm(src.json.nodes[j].name));
const skin = out.json.skins[0];
const have = skin.joints.map(j => norm(out.json.nodes[j].name));
if (want.length !== have.length || [...want].sort().join() !== [...have].sort().join())
  throw Error('joint sets differ; cannot reorder');

const oldIndexOf = new Map(have.map((n, i) => [n, i]));
const perm = want.map(n => oldIndexOf.get(n));            // new k <- old perm[k]
const inv = new Array(perm.length);
perm.forEach((old, k) => { inv[old] = k; });              // old -> new
if (perm.every((old, k) => old === k)) {
  console.log('joint order already matches the source');
  process.exit(0);
}

function view(accIndex) {
  const acc = out.json.accessors[accIndex];
  const bv = out.json.bufferViews[acc.bufferView];
  return {acc, bv, base: (bv.byteOffset || 0) + (acc.byteOffset || 0)};
}

// inverse bind matrices: 16 floats per joint
const ibm = view(skin.inverseBindMatrices);
const stride = ibm.bv.byteStride || 64;
const old = Buffer.from(out.bin.subarray(ibm.base, ibm.base + stride * perm.length));
perm.forEach((o, k) => old.copy(out.bin, ibm.base + k * stride, o * stride, o * stride + 64));
skin.joints = perm.map(o => skin.joints[o]);

// JOINTS_n: remap every index (all four lanes, weights untouched)
let remapped = 0;
for (const mesh of out.json.meshes) for (const prim of mesh.primitives) {
  for (const [name, accIndex] of Object.entries(prim.attributes)) {
    if (!name.startsWith('JOINTS_')) continue;
    const {acc, bv, base} = view(accIndex);
    const size = acc.componentType === 5121 ? 1 : acc.componentType === 5123 ? 2 : 0;
    if (!size) throw Error('unexpected JOINTS component type ' + acc.componentType);
    const step = bv.byteStride || size * 4;
    for (let v = 0; v < acc.count; v++) for (let lane = 0; lane < 4; lane++) {
      const at = base + v * step + lane * size;
      const j = size === 1 ? out.bin[at] : out.bin.readUInt16LE(at);
      const n = inv[j];
      if (size === 1) out.bin[at] = n; else out.bin.writeUInt16LE(n, at);
    }
    remapped += acc.count;
  }
}

// write back: JSON chunk (padded with spaces to 4 bytes) + the edited BIN chunk
let jsonBuf = Buffer.from(JSON.stringify(out.json), 'utf8');
const pad = (4 - (jsonBuf.length % 4)) % 4;
jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(pad, 0x20)]);
const binPad = (4 - (out.bin.length % 4)) % 4;
const binBuf = Buffer.concat([out.bin, Buffer.alloc(binPad)]);
const header = Buffer.alloc(12);
header.write('glTF', 0, 'latin1');
header.writeUInt32LE(2, 4);
const total = 12 + 8 + jsonBuf.length + 8 + binBuf.length;
header.writeUInt32LE(total, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(jsonBuf.length, 0); jh.writeUInt32LE(0x4E4F534A, 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(binBuf.length, 0); bh.writeUInt32LE(0x004E4942, 4);
fs.writeFileSync(outFile, Buffer.concat([header, jh, jsonBuf, bh, binBuf]));
console.log(`joints reordered to the source order (${perm.length}), ${remapped} vertices remapped`);
