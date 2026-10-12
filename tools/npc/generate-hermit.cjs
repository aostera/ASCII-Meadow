// Reproducible grayscale dwarf-hermit prototype, 8 angles x 3 cycles x 12 frames.
// Regenerate: node tools/npc/generate-hermit.cjs
const fs = require('node:fs');
const path = require('node:path');
function buildHermitPng() {
 const FW=40,FH=56,FRAMES=12,WIDTH=FW*FRAMES,HEIGHT=FH*24,TWO=Math.PI*2;
 const palette=[0,20,36,52,68,85,102,120,142,164,187,215,245];
 const pixels=new Uint8Array(WIDTH*HEIGHT);let row=0,frame=0;
 function point(x,y,shade){x=Math.round(x);y=Math.round(y);if(x>=0&&x<FW&&y>=0&&y<FH&&shade>0)pixels[(row*FH+y)*WIDTH+frame*FW+x]=shade;}
 function rect(x,y,w,h,c){for(let j=Math.ceil(y);j<y+h;j++)for(let i=Math.ceil(x);i<x+w;i++)point(i,j,c);}
 function ellipse(x,y,rx,ry,c){for(let j=Math.floor(y-ry);j<=Math.ceil(y+ry);j++)for(let i=Math.floor(x-rx);i<=Math.ceil(x+rx);i++)if(((i-x)/rx)**2+((j-y)/ry)**2<=1)point(i,j,c);}
 function polygon(points,c){const lo=Math.floor(Math.min(...points.map(p=>p[1]))),hi=Math.ceil(Math.max(...points.map(p=>p[1])));for(let y=lo;y<=hi;y++){let cuts=[];for(let k=0;k<points.length;k++){const a=points[k],b=points[(k+1)%points.length];if((a[1]<=y&&y<b[1])||(b[1]<=y&&y<a[1]))cuts.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}cuts.sort((a,b)=>a-b);for(let k=0;k+1<cuts.length;k+=2)for(let x=Math.ceil(cuts[k]);x<=Math.floor(cuts[k+1]);x++)point(x,y,c);}}
 function line(x,y,x2,y2,w,c){const steps=Math.max(1,Math.ceil(Math.hypot(x2-x,y2-y)*2));for(let i=0;i<=steps;i++){const t=i/steps;ellipse(x+(x2-x)*t,y+(y2-y)*t,w/2,w/2,c);}}
 for(let state=0;state<3;state++)for(let dir=0;dir<8;dir++){
  row=state*8+dir;const theta=dir*TWO/8,s=Math.sin(theta),f=Math.cos(theta),face=f>=0,view=Math.abs(s);
  for(frame=0;frame<FRAMES;frame++){
   const ph=frame*TWO/FRAMES,walking=state===1,talking=state===2,walk=walking?Math.sin(ph):0,talk=talking?Math.sin(ph):0;
   const bob=walking?Math.round(Math.abs(Math.sin(ph))*1.6):Math.round(Math.sin(ph)*.35);
   const cx=20+s*1.3,bodyX=cx+s*1.2,headX=cx+s*2.1,foot=51-bob,robeShift=Math.sin(ph+(s+.2))*(walking?1.25:.35),narrow=8.3-view*2;
   // Short, heavy boots and cloak are separate from the taller villager silhouette.
   const left=cx-4+walk*2.4,right=cx+4-walk*2.4;
   line(cx-4,42-bob,left,foot,5,2);line(cx+4,42-bob,right,foot,5,3);
   ellipse(left-(s<0?2:0),foot,4.5,2.5,1);ellipse(right+(s>0?2:0),foot,4.5,2.5,2);
   // Outer wool mantle with animated hem, broad silhouette.
   polygon([[bodyX-10,23-bob],[bodyX+9,22-bob],
      [bodyX+13+robeShift,45-bob],[bodyX+7+robeShift,47-bob],
      [bodyX-8+robeShift,47-bob],[bodyX-13+robeShift,45-bob]],2);
   polygon([[bodyX-9,24-bob],[bodyX+7,24-bob],
      [bodyX+11+robeShift,43-bob],[bodyX+5+robeShift,46-bob],
      [bodyX-8+robeShift,44-bob]],5);
   polygon([[bodyX-5,25-bob],[bodyX+5,25-bob],
      [bodyX+8+robeShift,42-bob],[bodyX+1,43-bob],[bodyX-8,42-bob]],6);
   // Shoulder collar and characteristic broad sleeves, contrasting light hands.
   ellipse(bodyX,26-bob,11,5,3);ellipse(bodyX,24-bob,8,3,7);
   const armWave=walking?walk*2.6:talk*2;
   line(bodyX-8,27-bob,bodyX-11+armWave,39-bob,6,3);
   line(bodyX+8,27-bob,bodyX+12-armWave,39-bob,6,4);
   ellipse(bodyX-11+armWave,40-bob,2.2,2.5,9);
   ellipse(bodyX+12-armWave,40-bob,2.2,2.5,9);
   // Belt, satchel and directional stitching distinguish each rotated silhouette.
   line(bodyX-8,39-bob,bodyX+8,39-bob,2,2);
   rect(bodyX+s*2-1,38-bob,3,3,11);
   if(f<-.2){
     rect(bodyX-5,29-bob,10,9,3);rect(bodyX-4,30-bob,8,6,7);rect(bodyX-1,30-bob,2,7,10);
     line(bodyX+s*3,42-bob,bodyX+s*5,45-bob,1,9);
   } else {
     const bagX=bodyX+(s>=0?8:-8);
     ellipse(bagX,37-bob,3.5,5,2);
     rect(bagX-2,36-bob,4,2,10);
     line(bodyX-4,27-bob,bagX,35-bob,1.5,8);
   }
   // Massive beard: silhouette dominant, unmistakably different from the villager.
   ellipse(headX,18-bob,9.2-view*1.3,10,2);
   ellipse(headX-1,19-bob,7,8,7);
   const beardShift=walking?Math.sin(ph-.8)*.8:talk*1.7;
   if(face){
     polygon([[headX-7,19-bob],[headX+6,19-bob],[headX+6,27-bob],
       [headX+3+beardShift,35-bob],[headX-3+beardShift,36-bob],
       [headX-7,29-bob]],10);
     polygon([[headX-4,24-bob],[headX+5,24-bob],[headX+3+beardShift,34-bob],
       [headX-2+beardShift,33-bob]],12);
     line(headX-4,26-bob,headX-3+beardShift,33-bob,1,7);
     line(headX+2,26-bob,headX+3+beardShift,33-bob,1,8);
     rect(headX-4+s*2,19-bob,2,2,1);rect(headX+2+s*2,19-bob,2,2,1);
     if(talking)rect(headX-1,24-bob,2,Math.abs(talk)>.6?3:1,2);
   }else{
     polygon([[headX-5,20-bob],[headX+5,20-bob],
       [headX+4,28-bob],[headX+1,30-bob],[headX-5,28-bob]],4);
     line(headX+s*3,20-bob,headX+s*4,29-bob,2,9);
   }
   // Broad brim and distinct tapering hermit hat, with crooked tip bending by movement.
   const hatTip=headX+s*4+Math.sin(ph+dir*.3)*.5;
   polygon([[headX-11,17-bob],[headX-8,13-bob],[headX-5,11-bob],
       [hatTip-3,4-bob],[hatTip,5-bob],[headX+6,12-bob],
       [headX+10,17-bob]],3);
   polygon([[headX-8,16-bob],[headX-5,12-bob],[hatTip-1,6-bob],
       [headX+6,15-bob]],7);
   line(headX-11,17-bob,headX+10,17-bob,3.5,2);
   line(headX-8,15-bob,headX+8,15-bob,1.5,11);
   // Staff carried on the dominant outer side; tip/lamp points rotate with angle.
   const staffX=cx+(s>=0?15:-15)+(walking?walk*.7:0);
   line(staffX,22-bob,staffX+s*.7,50,2.2,2);
   line(staffX,21-bob,staffX+s*.7,48,1,9);
   ellipse(staffX,21-bob,2.2,2.2,11);
   rect(staffX-1,26-bob,2,3,8);
   if(talking) {
     // A lantern ring pulses (rather than teleporting the body) during speech.
     line(staffX,29-bob,staffX+s*1.4,34-bob,1,9);
     ellipse(staffX+s*1.4,35-bob,2.2,3,Math.abs(talk)>.5?11:8);
   }
   // A tiny asymmetric embroidered hem tab makes 8 directions visually verifiable.
   point(bodyX+s*4+dir%3-2,42-bob,12);
  }
 }
 const raw=new Uint8Array((WIDTH+1)*HEIGHT);
 for(let y=0;y<HEIGHT;y++)raw.set(pixels.subarray(y*WIDTH,(y+1)*WIDTH),y*(WIDTH+1)+1);
 const compressed=[0x78,0x01];let off=0;
 while(off<raw.length){const n=Math.min(65535,raw.length-off),last=off+n===raw.length;
  compressed.push(last?1:0,n&255,(n>>>8)&255,(~n)&255,((~n)>>>8)&255);
  for(let k=0;k<n;k++)compressed.push(raw[off+k]);off+=n;}
 let aa=1,bb=0;for(const n of raw){aa=(aa+n)%65521;bb=(bb+aa)%65521;}
 compressed.push((bb>>>8)&255,bb&255,(aa>>>8)&255,aa&255);
 const u32=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255];
 const out=[137,80,78,71,13,10,26,10],crcTable=new Uint32Array(256);
 for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c>>>0;}
 function chunk(tag,values){const bytes=[...tag].map(c=>c.charCodeAt(0));out.push(...u32(values.length),...bytes);
  let crc=0xffffffff;for(const c of bytes){crc=crcTable[(crc^c)&255]^(crc>>>8);}
  for(const c of values){out.push(c);crc=crcTable[(crc^c)&255]^(crc>>>8);}
  out.push(...u32((crc^0xffffffff)>>>0));}
 chunk('IHDR',[...u32(WIDTH),...u32(HEIGHT),8,3,0,0,0]);
 const plte=[];for(const v of palette)plte.push(v,v,v);chunk('PLTE',plte);
 chunk('tRNS',palette.map((_,i)=>i?255:0));
 chunk('IDAT',compressed);chunk('IEND',[]);
 return new Uint8Array(out);
}
const png = buildHermitPng();
const out = path.resolve(__dirname, '../../assets/npc/hermit-starter.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log('Generated', out, png.length, 'bytes, 480x1344 indexed PNG');
