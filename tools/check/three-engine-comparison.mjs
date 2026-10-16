import assert from 'node:assert/strict';
import {ENGINE_SEQUENCE,summarizeEngineComparison} from '../../experiments/three/engine-comparison.mjs';
assert.deepEqual(ENGINE_SEQUENCE,['legacy','three','three','legacy']);
const mk=(mode,dt)=>({mode,samples:[
 {dt,originalGlyphs:mode==='three'?22000:undefined,
  visibleGlyphs:mode==='three'?20000:undefined,
  uploadCpuMs:mode==='three'?1.1:undefined,
  renderCpuMs:mode==='three'?2.2:undefined},
 {dt:dt+1,originalGlyphs:mode==='three'?22000:undefined,
  visibleGlyphs:mode==='three'?20000:undefined,
  renderCpuMs:mode==='three'?3.1:undefined}
]});
const report=summarizeEngineComparison([
 mk('legacy',15),mk('three',20),mk('three',22),mk('legacy',16)
],{device:'mock'});
assert.equal(report.original.frameCount,4);
assert.equal(report.nativeThree.frameCount,4);
assert.equal(report.original.frameMsP95,17);
assert.equal(report.nativeThree.frameMsP95,23);
assert.equal(report.threeMinusOriginalP95Ms,6);
assert.equal(report.nativeThree.originalGlyphMedian,22000);
assert.equal(report.original.visibleGlyphMedian,null);
assert.equal(report.device,'mock');
assert.equal(report.sequence.join('/'),'legacy/three/three/legacy');
assert.match(report.methodology,/ABBA/);
assert.throws(()=>summarizeEngineComparison([{mode:'invalid',samples:[]}]));
console.log('PASS: physical on-device ABBA report aggregates original and Three without fabricated GPU stats');
