// Preserve original source glyph order, alpha and output for all intersecting rects.
import assert from 'node:assert/strict';
import {glyphClipWindow,packVisibleGlyphs} from '../../experiments/three/glyph-visibility.mjs';
const clip=glyphClipWindow(10,20,100,90,2,4);
assert.deepEqual(clip,{left:8,top:18,right:62,bottom:67});
const orig=new Float32Array([
  11,21,14,27,100,1,
  -120,-120,-110,-110,999,.5,
  60,65,63,70,200,.8,
  200,200,209,222,888,1,
  12,25,13,35,300,.3,
  62,40,65,44,400,1
]);
const baseline=orig.slice(),r=new Float32Array(24),ids=new Float32Array(12);
const n=packVisibleGlyphs(orig,0,6,r,ids,clip);
assert.equal(n,4);
const sorted=Array.from(ids.slice(0,n*2)).map((x,i)=>i%2===0?x:Math.round(x*10)/10);
assert.deepEqual(sorted,[100,1,200,.8,300,.3,400,1]);
assert.deepEqual(Array.from(r.slice(0,4)),[11,21,14,27]);
assert.deepEqual(Array.from(r.slice(4,8)),[60,65,63,70]);
assert.deepEqual(Array.from(orig),Array.from(baseline));
assert.equal(packVisibleGlyphs(orig,0,6,r,ids,null),6);
assert.equal(packVisibleGlyphs(orig,0,2,r,ids,clip),1);
assert.equal(packVisibleGlyphs(orig,1,4,r,ids,clip),2);
assert.throws(()=>glyphClipWindow(0,0,100,100,0));
assert.throws(()=>packVisibleGlyphs(orig,0,7,r,ids,clip));
console.log('PASS safe authored glyph viewport clip: 4/6 visible, order/alpha/source retained');
