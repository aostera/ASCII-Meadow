// Preserve original source glyph order, alpha and output for all intersecting rects.
import assert from 'node:assert/strict';
import {glyphClipWindow,packVisibleGlyphs,countVisibleGlyphs} from '../../experiments/three/glyph-visibility.mjs';
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
// Depth metadata must follow the exact same surviving source glyph when
// viewport clipping removes earlier instances; no sort, alpha or ID changes.
const depths=new Float32Array(12);
const range=[
 {start:0,end:1,depth:.3,footY:90},
 {start:2,end:3,depth:.4,footY:100},
 {start:4,end:5,depth:.6,footY:150}
];
const dc=packVisibleGlyphs(orig,0,6,r,ids,clip,depths,range);
assert.equal(dc,4);
assert.deepEqual(Array.from(depths.slice(0,8)).map((v,i)=>
 i%2===0?Math.round(v*10)/10:v),[.3,90,.4,100,.6,150,-1,0]);
assert.deepEqual(Array.from(orig),Array.from(baseline));
assert.throws(()=>packVisibleGlyphs(orig,0,6,r,ids,clip,new Float32Array(4),range));
console.log('PASS safe authored glyph viewport clip: 4/6 visible, source order/alpha and actor-Z ranges retained');

// T08: > 65,536 authored glyphs but fewer than that survive viewport clip.
// Compare preflight+compact attributes byte-for-byte with the original full
// capacity pack, including artist alpha, exact source ordering and actor depth.
const largeCount=65549;
const bigSource=new Float32Array(largeCount*6);
for(let i=0;i<largeCount;i++){
 const p=i*6,inView=i%5!==0;
 bigSource[p]=inView?14:-200;
 bigSource[p+1]=inView?24:-200;
 bigSource[p+2]=inView?19:-195;
 bigSource[p+3]=inView?29:-195;
 bigSource[p+4]=i%1024;
 bigSource[p+5]=.5+(i%17)/40;
}
const before=bigSource.slice(),expectedCount=largeCount-Math.ceil(largeCount/5);
assert.equal(countVisibleGlyphs(bigSource,0,largeCount,clip),expectedCount);
assert.equal(countVisibleGlyphs(bigSource,0,largeCount,null),largeCount);
assert.throws(()=>countVisibleGlyphs(bigSource,1,largeCount,clip));
const globalRanges=[
 {start:0,end:10000,depth:.3,footY:88},
 {start:12000,end:41000,depth:.58,footY:96},
 {start:50000,end:largeCount,depth:.82,footY:104}
];
const fullRects=new Float32Array(largeCount*4);
const fullIds=new Float32Array(largeCount*2);
const fullDepth=new Float32Array(largeCount*2);
const nFull=packVisibleGlyphs(bigSource,0,largeCount,
 fullRects,fullIds,clip,fullDepth,globalRanges);
const rectsSmall=new Float32Array(expectedCount*4);
const idsSmall=new Float32Array(expectedCount*2);
const depthSmall=new Float32Array(expectedCount*2);
const nCompact=packVisibleGlyphs(bigSource,0,largeCount,
 rectsSmall,idsSmall,clip,depthSmall,globalRanges);
assert.equal(nFull,nCompact);
assert.equal(nCompact,expectedCount);
assert.deepEqual(
 Buffer.from(rectsSmall.buffer),
 Buffer.from(fullRects.buffer,0,nCompact*4*4));
assert.deepEqual(
 Buffer.from(idsSmall.buffer),
 Buffer.from(fullIds.buffer,0,nCompact*2*4));
assert.deepEqual(
 Buffer.from(depthSmall.buffer),
 Buffer.from(fullDepth.buffer,0,nCompact*2*4));
assert.deepEqual(bigSource,before,'authored source was mutated');
assert.throws(()=>packVisibleGlyphs(bigSource,0,largeCount,
 new Float32Array(expectedCount*4-4),idsSmall,clip,depthSmall,globalRanges),
 /Insufficient glyph instance capacity/);
assert.throws(()=>packVisibleGlyphs(bigSource,0,largeCount,
 rectsSmall,idsSmall,clip,new Float32Array(expectedCount*2-2),globalRanges),
 /Insufficient actor depth capacity/);
console.log('PASS T08 >65K preflight: '+largeCount+' source, '+
 expectedCount+' visible; compact rects/IDs/alpha/actor depth byte-identical');
