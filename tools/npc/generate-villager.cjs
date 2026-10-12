// Deterministic starter artwork generator for the NPC villager, 8 views x 3 states x 12 frames.
// Monochrome hand-shaped pixel-art geometry, not a final externally illustrated production atlas.
// Regeneration: node tools/npc/generate-villager.cjs
const fs = require('node:fs');
const path = require('node:path');
function buildVillagerPng(){
  const FW=40,FH=56,FRAMES=12,HEIGHT=FH*24,WIDTH=FW*FRAMES;
  const palette=[0,22,43,61,78,94,110,129,150,174,201,229,248];
  const pixels=new Uint8Array(WIDTH*HEIGHT);
  const two=Math.PI*2;
  const put=(x,y,col)=>{x=Math.round(x);y=Math.round(y);if(x>=0&&x<FW&&y>=0&&y<FH&&col>0)pixels[(row*FH+y)*WIDTH+frame*FW+x]=col;};
  const rect=(x,y,w,h,col)=>{let x0=Math.ceil(x),y0=Math.ceil(y),x1=Math.floor(x+w),y1=Math.floor(y+h);for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++)put(xx,yy,col);};
  const ellipse=(cx,cy,rx,ry,col)=>{for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++)if(((x-cx)/rx)**2+((y-cy)/ry)**2<=1)put(x,y,col);};
  const polygon=(points,col)=>{const minY=Math.floor(Math.min(...points.map(p=>p[1]))),maxY=Math.ceil(Math.max(...points.map(p=>p[1])));for(let y=minY;y<=maxY;y++){const intersections=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))intersections.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}intersections.sort((a,b)=>a-b);for(let i=0;i+1<intersections.length;i+=2)for(let x=Math.ceil(intersections[i]);x<=Math.floor(intersections[i+1]);x++)put(x,y,col);}};
  const line=(x0,y0,x1,y1,w,col)=>{const steps=Math.ceil(Math.hypot(x1-x0,y1-y0)*2);for(let i=0;i<=steps;i++){const t=i/Math.max(steps,1);ellipse(x0+(x1-x0)*t,y0+(y1-y0)*t,w/2,w/2,col);}};
  let row=0,frame=0;
  for(let state=0;state<3;state++)for(let dir=0;dir<8;dir++){row=state*8+dir;const theta=dir*two/8,side=Math.sin(theta),front=Math.cos(theta),facing=front>=0,view=Math.abs(side);for(frame=0;frame<FRAMES;frame++){
    const phase=frame*two/FRAMES,wave=Math.sin(phase),sway=Math.sin(phase+0.4);
    const walking=state===1, talking=state===2;
    const bounce=walking?Math.round(Math.abs(wave)*2):Math.round(Math.sin(phase)*0.55);
    const breath=walking?0:(Math.sin(phase)*0.55);
    const talk=talking?Math.sin(phase*2):0;
    const cx=20+side*1.6,bodyW=11-4*view,shx=side*1.5,footY=51-bounce;
    const swing=walking?wave*3.6:0;
    // Grounded boots and trousers, rear limb first.
    const footA=cx-4+side*1.3+swing,footB=cx+4+side*1.3-swing;
    line(cx-4,39-bounce,footA,footY,4.6,2);
    line(cx+4,39-bounce,footB,footY,4.6,3);
    ellipse(footA+(side>0?2:-2),footY,4,2,1);
    ellipse(footB+(side>0?2:-2),footY,4,2,2);
    line(cx-4,42-bounce,footA-1,footY-2,2,5);
    line(cx+4,42-bounce,footB-1,footY-2,2,5);
    const capeSway=walking?Math.sin(phase-0.5)*2.2:Math.sin(phase)*0.5;
    const cloakTail=(front<-.25?3:0)+capeSway;
    polygon([[cx-9+shx,18-bounce],[cx+8+shx,18-bounce],
      [cx+bodyW+5+cloakTail,44-bounce],[cx+5+cloakTail,47-bounce],
      [cx-8+cloakTail,46-bounce],[cx-bodyW-4+cloakTail,43-bounce]],1);
    polygon([[cx-8+shx,19-bounce],[cx+6+shx,18-bounce],
      [cx+bodyW+3+cloakTail,43-bounce],[cx+4+cloakTail,45-bounce],
      [cx-bodyW-2+cloakTail,42-bounce]],3);
    polygon([[cx-6+shx,20-bounce],[cx+4+shx,20-bounce],
      [cx+bodyW+cloakTail,42-bounce],[cx+2+cloakTail,43-bounce],
      [cx-bodyW+cloakTail,41-bounce]],5);
    if(front<-.25){ // From behind, stitched bag and cloak seam.
      line(cx+shx,24-bounce,cx+cloakTail,42-bounce,1.4,7);
      rect(cx+shx-5,28-bounce,10,10,2);
      rect(cx+shx-4,29-bounce,8,7,6);
      rect(cx+shx-1,29-bounce,2,8,9);
    } else if(front>.2){
      // Narrow leather strap, tunic panel and brass clasp from the front.
      line(cx-5+shx,22-bounce,cx+3+shx,37-bounce,2.2,2);
      line(cx-5+shx,23-bounce,cx+3+shx,37-bounce,1,9);
      rect(cx-bodyW+3,35-bounce,bodyW*2-5,3,2);
      rect(cx+shx-1,34-bounce,3,3,11);
      line(cx+shx,27-bounce,cx+shx,33-bounce,1.1,8);
    } else {
      // Visible satchel on profile.
      ellipse(cx+side*9,34-bounce,3.4,5.5,2);
      rect(cx+side*9-2,32-bounce,4,4,7);
    }
    const armShift=walking?wave*4:talk*1.6;
    line(cx-bodyW+2,24-bounce,cx-bodyW-4+armShift,38-bounce,5,2);
    line(cx+bodyW-2,24-bounce,cx+bodyW+4-armShift,38-bounce,5,3);
    line(cx-bodyW+2,25-bounce,cx-bodyW-4+armShift,36-bounce,3,5);
    line(cx+bodyW-2,25-bounce,cx+bodyW+4-armShift,36-bounce,3,6);
    ellipse(cx-bodyW-4+armShift,38-bounce,2.2,2.5,7);
    ellipse(cx+bodyW+4-armShift,38-bounce,2.2,2.5,7);
    // Face, cheek & hood silhouette. Three-quarter angles get distinct projected aperture.
    const headX=cx+shx*0.8+(walking?sway*0.3:0);
    ellipse(headX,13-bounce+breath,9-view*1.1,10,1);
    ellipse(headX-1,12-bounce+breath,7-view,8,3);
    polygon([[headX-7,14-bounce],[headX-6,7-bounce],
      [headX-3,4-bounce],[headX+2,3-bounce],
      [headX+7,7-bounce],[headX+7,14-bounce],
      [headX+4,20-bounce],[headX-5,19-bounce]],4);
    polygon([[headX-6,10-bounce],[headX-3,5-bounce],[headX+2,5-bounce],
      [headX+5,9-bounce],[headX+4,15-bounce],[headX-5,15-bounce]],8);
    if(facing){
      ellipse(headX+side*1.6,14-bounce,4.8-view,5.3,9);
      // The face is dark at the brow; eyes subtly move with the 8 projections.
      line(headX-4,10-bounce,headX+4,10-bounce,2,2);
      const eyeX=headX+side*1.6;
      if(view<0.9){rect(eyeX-3,13-bounce,1.4,1.5,1);rect(eyeX+2,13-bounce,1.4,1.5,1);}
      else rect(eyeX+side*2.5,13-bounce,1.4,1.5,1);
      if(talking){rect(eyeX,17-bounce,2,Math.abs(talk)>0.48?2:1,2);}
    }else{
      polygon([[headX-4,11-bounce],[headX-2,7-bounce],[headX+3,7-bounce],
        [headX+5,11-bounce],[headX+4,18-bounce],[headX-3,17-bounce]],2);
      line(headX+side*2,9-bounce,headX+side*2,18-bounce,1.5,7);
    }
    // Hood border, pin and trailing fold tie cloak design across 8 directions.
    line(headX-6,13-bounce,headX-4,19-bounce,1.6,2);
    line(headX+6,13-bounce,headX+4,19-bounce,1.6,3);
    line(cx-3+shx,22-bounce,cx+2+shx,23-bounce,2,10);
    rect(cx-1+shx,22-bounce,2,2,11);
  }}
  // Indexed PNG: single transparent index, warm-ish monochrome luminosity stays within the ASCII palette.
  const raw=new Uint8Array((WIDTH+1)*HEIGHT);
  for(let y=0;y<HEIGHT;y++)raw.set(pixels.subarray(y*WIDTH,(y+1)*WIDTH),y*(WIDTH+1)+1);
  // Build zlib stored DEFLATE blocks. Guaranteed lossless and reproducible, zero extra dependencies.
  const compressed=[];
  compressed.push(0x78,0x01);
  let off=0;while(off<raw.length){const n=Math.min(65535,raw.length-off),last=off+n===raw.length;
    compressed.push(last?1:0,n&255,(n>>>8)&255,(~n)&255,((~n)>>>8)&255);
    for(let k=0;k<n;k++)compressed.push(raw[off+k]);off+=n;}
  let adA=1,adB=0;for(let k=0;k<raw.length;k++){adA=(adA+raw[k])%65521;adB=(adB+adA)%65521;}
  compressed.push((adB>>>8)&255,adB&255,(adA>>>8)&255,adA&255);
  const u32=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255];
  const result=[137,80,78,71,13,10,26,10];
  const crcTable=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);crcTable[n]=c>>>0;}
  function chunk(type,data){const bytes=[...type].map(c=>c.charCodeAt(0));const length=data.length; result.push(...u32(length),...bytes);
    let crc=0xffffffff;for(const c of bytes){crc=crcTable[(crc^c)&255]^(crc>>>8);}
    // Avoid adding enormous intermediate arrays via spread.
    for(const c of data){result.push(c);crc=crcTable[(crc^c)&255]^(crc>>>8);}
    result.push(...u32((crc^0xffffffff)>>>0));}
  chunk("IHDR",[...u32(WIDTH),...u32(HEIGHT),8,3,0,0,0]);
  const plte=[];for(const v of palette)plte.push(v,v,v);chunk("PLTE",plte);
  chunk("tRNS",palette.map((_,i)=>i?255:0));
  chunk("IDAT",compressed);
  chunk("IEND",[]);
  return new Uint8Array(result);
}
const png = buildVillagerPng();
const out = path.resolve(process.argv[2] || path.join(__dirname, '../../assets/npc/villager-starter.png')); // optional temporary output for lossless WebP validation
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log('Generated', out, png.length, 'bytes, 480x1344 indexed PNG');
