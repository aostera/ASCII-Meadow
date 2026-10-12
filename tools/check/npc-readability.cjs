// Cheap legibility guard for both generated NPC sheets at a tiny 12×14 glyph preview.
// This catches invisible/overcropped/low-contrast sprites, not subjective art quality.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const FRAME_W=40, FRAME_H=56, COLS=12, ROWS=14;
function decode(name) {
  const file=fs.readFileSync(path.join(root,'assets/npc',name+'-starter.png'));
  const width=file.readUInt32BE(16),height=file.readUInt32BE(20);
  assert.equal(width,480);assert.equal(height,1344);
  let pos=8,palette=null,alpha=null,parts=[];
  while(pos<file.length){
    const n=file.readUInt32BE(pos),tag=file.toString('ascii',pos+4,pos+8);
    const chunk=file.subarray(pos+8,pos+8+n);
    if(tag==='PLTE')palette=chunk;
    if(tag==='tRNS')alpha=chunk;
    if(tag==='IDAT')parts.push(chunk);
    pos+=n+12;if(tag==='IEND')break;
  }
  assert(palette&&alpha);
  const raw=zlib.inflateSync(Buffer.concat(parts));
  assert.equal(raw.length, height*(width+1));
  return {width,raw,palette,alpha};
}
function glyphStats(png,direction,state,frame) {
  const row=state*8+direction,stats=[];
  for(let cy=0;cy<ROWS;cy++)for(let cx=0;cx<COLS;cx++){
    let opaque=0,min=255,max=0;
    const x0=Math.floor(cx*FRAME_W/COLS),x1=Math.floor((cx+1)*FRAME_W/COLS),
      y0=Math.floor(cy*FRAME_H/ROWS),y1=Math.floor((cy+1)*FRAME_H/ROWS);
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const idx=png.raw[(row*FRAME_H+y)*(png.width+1)+1+frame*FRAME_W+x];
      if(png.alpha[idx] >= 16) {
        const v=png.palette[idx*3]; min=Math.min(min,v);max=Math.max(max,v); opaque++;
      }
    }
    if(opaque>0)stats.push({min,max});
  }
  return { occupied:stats.length,
    span:stats.length?Math.max(...stats.map(c=>c.max))-Math.min(...stats.map(c=>c.min)):0 };
}
for(const name of ['villager','hermit']){
  const png=decode(name); let minOccupied=Infinity,maxOccupied=0,minSpan=Infinity;
  for(let state=0;state<3;state++)for(let direction=0;direction<8;direction++)
    for(let frame=0;frame<12;frame++){
      const {occupied,span}=glyphStats(png,direction,state,frame);
      assert(occupied>=12 && occupied<=160,
        name+': too little/large a silhouette at tiny glyph scale '+JSON.stringify({state,direction,frame,occupied}));
      assert(span>=30,
        name+': flat tonal shape may disappear in ASCII '+JSON.stringify({state,direction,frame,span}));
      minOccupied=Math.min(minOccupied,occupied);
      maxOccupied=Math.max(maxOccupied,occupied);
      minSpan=Math.min(minSpan,span);
    }
  console.log('PASS tiny 12x14 preview '+name+': 288 sprite frames; cell occupancy '+
    minOccupied+'–'+maxOccupied+' / 168, tonal span >= '+minSpan);
}
