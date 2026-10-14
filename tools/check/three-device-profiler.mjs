import assert from 'node:assert/strict';
import {percentile,summarizeDeviceFrames} from '../../experiments/three/device-profiler.mjs';
assert.equal(percentile([], .95),null);
assert.equal(percentile([1,9,4,2,3],.5),3);
assert.equal(percentile([1,9,4,2,3],.95),9);
const data=[
 {dt:10,uploadCpuMs:.8,renderCpuMs:1,visibleGlyphs:24000,originalGlyphs:28000},
 {dt:20,uploadCpuMs:.7,renderCpuMs:2,visibleGlyphs:23000,originalGlyphs:28000},
 {dt:25,uploadCpuMs:.8,renderCpuMs:3,visibleGlyphs:23500,originalGlyphs:28000},
 {dt:60,uploadCpuMs:.6,renderCpuMs:4,visibleGlyphs:23000,originalGlyphs:28000}
];
const r=summarizeDeviceFrames(data,{device:'test'});
assert.equal(r.frameCount,4);
assert.equal(r.frameStallsOver50ms,1);
assert.equal(r.frameMsP95,60);
assert.equal(r.uploadCpuP95Ms,.8);
assert.equal(r.renderCpuP95Ms,4);
assert.equal(r.originalGlyphMedian,28000);
assert.equal(r.visibleGlyphMedian,23500);
assert.equal(r.device,'test');
assert.equal(summarizeDeviceFrames([]).observedFps,null);
console.log('PASS: real-device RAF p95, stalls, CPU submission, no bogus GPU FPS claims');
