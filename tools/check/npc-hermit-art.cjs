// Review the checked-in starter sprite and verify it is reproducible from its source.
// No external artwork dependencies, and no modification to knight/cow assets.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const filename = path.join(root, 'assets/npc/hermit-starter.png');
const original = fs.readFileSync(filename);
const result = spawnSync(process.execPath, ['tools/npc/generate-hermit.cjs'],
  { cwd: root, encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr);
assert.deepEqual(fs.readFileSync(filename), original,
  'Generated sprites must exactly match the committed PNG; update both when editing source');
const signature = Buffer.from([137,80,78,71,13,10,26,10]);
assert(original.subarray(0, 8).equals(signature), 'Expected actual PNG data');
let offset = 8, width = 0, height = 0, depth = 0, colorType = -1;
const idat = []; let palette = null, alpha = null;
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n; for (let i = 0; i < 8; i++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
  return c >>> 0;
});
while (offset < original.length) {
  const length = original.readUInt32BE(offset), tag = original.toString('ascii', offset + 4, offset + 8);
  const data = original.subarray(offset + 8, offset + 8 + length);
  assert(offset + 12 + length <= original.length, 'Corrupt PNG chunk boundary');
  let crc = 0xffffffff;
  for (const b of original.subarray(offset + 4, offset + 8 + length))
    crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
  assert.equal((crc ^ 0xffffffff) >>> 0, original.readUInt32BE(offset + 8 + length),
    'Corrupt PNG chunk checksum');
  if (tag === 'IHDR') {
    width = data.readUInt32BE(0); height = data.readUInt32BE(4);
    depth = data[8]; colorType = data[9];
  } else if (tag === 'PLTE') palette = data;
  else if (tag === 'tRNS') alpha = data;
  else if (tag === 'IDAT') idat.push(data);
  offset += length + 12;
  if (tag === 'IEND') break;
}
assert.equal(width, 480); assert.equal(height, 1344);
assert.equal(depth, 8); assert.equal(colorType, 3, 'Indexed palette PNG');
assert.equal(alpha[0], 0); assert(alpha.subarray(1).every(a => a === 255));
const decoded = zlib.inflateSync(Buffer.concat(idat));
assert.equal(decoded.length, height * (width + 1), 'Unexpected PNG scanline count');
for (let y = 0; y < height; y++) assert.equal(decoded[y * (width + 1)], 0, 'Only raw PNG filter 0 is supported');
const sample = (row, frame) => {
  const data = new Uint8ClampedArray(40 * 56 * 4);
  for (let y = 0; y < 56; y++) for (let x = 0; x < 40; x++) {
    const index = decoded[(row * 56 + y) * (width + 1) + 1 + frame * 40 + x];
    assert(index * 3 + 2 < palette.length, 'Pixel index outside PNG palette');
    const dest = (y * 40 + x) * 4, value = palette[index * 3];
    data[dest] = data[dest + 1] = data[dest + 2] = value;
    data[dest + 3] = alpha[index] ?? 255;
  }
  return { width: 40, height: 56, data };
};
const script = fs.readFileSync(path.join(root, 'src/entities/npc-atlas-audit.js'), 'utf8');
const context = { Math, Object, Set };
vm.createContext(context);
vm.runInContext(script + '\nthis.audit = npcAuditFrames;', context);
const layout = { states: {
  idle: { frames: 12, fps: 6, rows: [0,1,2,3,4,5,6,7] },
  walk: { frames: 12, fps: 12, rows: [8,9,10,11,12,13,14,15] },
  talk: { frames: 12, fps: 8, rows: [16,17,18,19,20,21,22,23] }
} };
const report = context.audit(layout, ({ row, frame }) => sample(row, frame));
assert.equal(report.inspected, 288);
assert.equal(report.empty, 0, 'All 288 frames must contain visible pixels');
assert.equal(report.errors, 0, 'All authored rows must contain content');
assert(!report.findings.some(f => f.code === 'duplicate-direction'),
  'Eight authored directions must have distinguishable silhouettes');
assert(!report.findings.some(f => f.code === 'duplicate-frame' && f.state === 'talk'),
  'Hermit dialogue should not repeat adjacent frames; idle holds are still permitted');
const digest = crypto.createHash('sha256').update(original).digest('hex').slice(0, 12);
console.log('PASS NPC hermit starter art: 288 frames, 8 views, 3 states, indexed alpha, reproducible ' + digest +
  ' (' + report.warnings + ' non-blocking quality hints)');
