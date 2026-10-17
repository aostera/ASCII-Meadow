// A jumping knight inside the ruins keeps the occlusion of his ground foot
// point: stone in FRONT of him covers the whole raised sprite (no straight
// slice where the standing-sized scan window used to end) and stone BEHIND
// him never covers him. Checked on the real native page, desktop + phone,
// at the batch level and in real WebGL2 pixels; the authored map is unchanged.
//   node tools/check/three-jump-occlusion.cjs http://127.0.0.1:8181 [extraQuery]
// THREE_LOCAL=<three package build dir> serves three from disk (offline runs).
const {chromium}=require('playwright');
const path=require('node:path'),fs=require('node:fs');
const base=(process.argv[2]||'http://127.0.0.1:8181').replace(/\/$/,'');
const extra=process.argv[3]===undefined?'&ashenVow=0':process.argv[3];
const dir=path.join(process.cwd(),'shots','three-jump-occlusion');
fs.mkdirSync(dir,{recursive:true});
const fail=m=>{throw Error(m)};

(async()=>{
 const unit=await import(path.join(process.cwd(),'experiments/three/native-jump-occlusion.mjs'));
 // Pure band arithmetic: no extra rows on the ground, exactly the raised rows in the air.
 if(unit.jumpOcclusionRows(100,0,120,0,7.36)!==null)fail('ground knight gained jump rows');
 const band=unit.jumpOcclusionRows(100,0,120,57.5,7.36);
 if(!band||band.y1!==Math.floor(100-120/7.36-2)-1||band.y0!==Math.floor(100-(120+57.5)/7.36-2))
   fail('jump rows wrong '+JSON.stringify(band));
 const grid={x0:0,x1:1,y0:0,y1:0,w:2,lum:[1,1],dep:[50,10],glyph:[3,-1],lev:[1,1]},hit=[];
 unit.coverBand(grid,{y0:0,y1:0},0,1,20,(x,y)=>hit.push(x));
 if(hit.join()!=='0')fail('band covered stone behind the foot point '+hit.join());

 const browser=await chromium.launch({headless:true,args:[
   '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  for(const mobile of [false,true]){
   const label=mobile?'phone':'desktop';
   const context=await browser.newContext({
     viewport:mobile?{width:390,height:844}:{width:1100,height:740},
     deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile});
   if(process.env.THREE_LOCAL){
     await context.route(/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)$/,r=>{
       const rest=r.request().url().match(/three@[^/]+\/([^?]*)/)[1];
       return r.fulfill({body:fs.readFileSync(path.join(process.env.THREE_LOCAL,'..',rest)),
         contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
     });
     await context.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
   }
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   const res=await page.goto(base+'/experiments/three/native.html?edit=0'+extra,
     {waitUntil:'commit',timeout:120000});
   if(!res?.ok())fail(label+' native HTTP failed');
   await page.waitForFunction(()=>window.__ASCII_NATIVE__?.ready&&window.__ASCII_NATIVE__.mode==='three',
     undefined,{timeout:240000});
   if(!/ashenVow=0/.test(extra))
     await page.waitForFunction(()=>window.__ASCII_NATIVE__.ashenVow?.ready,undefined,{timeout:240000});
   const result=await page.evaluate(()=>{
     const native=window.__ASCII_NATIVE__,gl=native.renderer.getContext(),canvas=native.renderer.domElement;
     const mapBefore=JSON.stringify(MEADOW_MAP);
     if(!native.jumpOcclusion)throw Error('jump occlusion not installed');
     const saved={x:player.x,y:player.y,tx:player.tx,ty:player.ty,jump:player.jump,walk:player.walk,run:player.run};
     const sim=simulate,random=Math.random,knight=drawKnight;
     const peak=1-((AIR0+AIR1)/2)/JUMP_T;
     const stoneAt=(x,y)=>{   // nearest (largest) stone ground depth at a cell, or null
       let best=null;
       for(const r of ruins){
         if(x<r.x0||x>r.x1||y<r.y0||y>r.y1)continue;
         const k=(y-r.y0)*r.gridW+(x-r.x0);
         if(r.lum[k]>=0&&(best===null||r.dep[k]>best))best=r.dep[k];
       }
       const C=cathedral;
       if(C.cv&&x>=C.cx0&&x<C.cx0+C.BW&&y>=C.cy0&&y<C.cy0+C.BH){
         const k=(y-C.cy0)*C.BW+(x-C.cx0);
         if(C.lum[k]>=0&&(best===null||C.dep[k]>best))best=C.dep[k];
       }
       return best;
     };
     const place=(x,y,jump)=>{
       player.x=player.tx=x;player.y=player.ty=y;player.jump=jump;player.walk=0;player.run=0;
     };
     // Cells of the drawn (raised) sprite, split by the stone relation at the ground foot point.
     const cellsOf=()=>{
       const G=geomOf(player),feet=(player.y+.7)*CH,hw=knightPx()*.7/CW;
       const xa=Math.floor(player.x-hw),xb=Math.ceil(player.x+hw);
       const front=[],behind=[];
       for(let y=Math.floor(G.top/CH);y<=Math.floor(G.gy/CH);y++)for(let x=xa;x<=xb;x++){
         const d=stoneAt(x,y);
         if(d===null)continue;
         (d>feet+1.5?front:behind).push([x,y]);
       }
       const standingTop=Math.floor(player.y-(liftPx(player)+knightPx())/CH-2);
       // behind-stone cells on his body axis (where his glyphs certainly are)
       const core=behind.filter(([x,y])=>Math.abs(x-player.x)<=G.w*.12/CW&&y*CH>G.top+G.h*.1&&y*CH<G.gy-CH);
       return {front,behind,core,raised:front.filter(([,y])=>y<standingTop),feet,G};
     };
     // Pick the in-ruin spots where a jump lifts the most body over stone in front.
     simulate=function(){};
     const spots=[];
     for(const r of ruins)for(let y=r.y0+4;y<=r.y1-2;y+=4)for(let x=r.x0+4;x<=r.x1-4;x+=6){
       if(blocked(x,y,player))continue;
       place(x,y,peak);
       const c=cellsOf();
       // a raised body that is partly over stone in front and partly over stone behind
       const score=Math.min(c.raised.length,c.core.length*4);
       if(c.raised.length>=6&&c.core.length>=4)spots.push({x,y,ruin:r.id,score,raised:c.raised.length,core:c.core.length});
     }
     spots.sort((a,b)=>b.score-a.score);
     const chosen=[];
     for(const s of spots)if(!chosen.some(c=>c.ruin===s.ruin)&&chosen.length<2)chosen.push(s);
     if(!chosen.length)throw Error('no in-ruin jump spot with stone in front and behind');
     const seeded=()=>{let a=0x9e3779b9;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
       t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};};
     const frame=()=>{seeded();try{updateCamera(0,true);render();}finally{Math.random=random;}};
     const readCell=([x,y])=>{   // interior pixels of one glyph cell, in canvas space
       const s=VZ*DPR,px0=Math.ceil((x*CW-camX*CW)*s)+1,px1=Math.floor(((x+1)*CW-camX*CW)*s)-1;
       const top=Math.ceil((y*CH-camY*CH)*s)+1,bot=Math.floor(((y+1)*CH-camY*CH)*s)-1;
       if(px1<px0||bot<top||px0<0||top<0||px1>=canvas.width||bot>=canvas.height)return null;
       const w=px1-px0+1,h=bot-top+1,out=new Uint8Array(w*h*4);
       gl.readPixels(px0,canvas.height-1-bot,w,h,gl.RGBA,gl.UNSIGNED_BYTE,out);
       return out;
     };
     // Mean RGB change over a cell's interior: his glyphs (bright armour, dark
     // backing) move it by tens of levels; an opaque stone cell keeps it at 0.
     const delta=(a,b)=>{let d=0;for(let i=0;i<a.length;i+=4)
       d+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);return d/(a.length/4*3);};
     const SEEN=8;
     const report=[];
     try{
       for(const spot of chosen)for(const jump of [0,peak]){
         place(spot.x,spot.y,jump);
         const c=cellsOf();
         // 1) Batch: which stone cells the occluders redrew over the knight.
         const covered=new Set();
         const oO=occlude,oR=occludeRuins;
         const capture=fn=>function(e){const n0=GB.n;fn(e);if(e!==player)return;
           for(let i=n0;i<GB.n;i++){const o=i*6;if(GB.buf[o+4]!==SOLID_CELL)continue;
             covered.add(Math.round((GB.buf[o]+.4)/CW)+','+Math.round((GB.buf[o+1]+.4)/CH));}};
         occlude=capture(oO);occludeRuins=capture(oR);
         try{frame();}finally{occlude=oO;occludeRuins=oR;}
         const withKnight=new Map();
         for(const cell of [...c.front,...c.behind]){const p=readCell(cell);if(p)withKnight.set(cell.join(),p);}
         // 2) Same frame without the knight: what his own glyphs change.
         drawKnight=function(){};
         try{frame();}finally{drawKnight=knight;}
         let frontVisible=0,frontSampled=0,behindVisible=0,behindSampled=0,frontWorst=0;
         const raisedSet=new Set(c.raised.map(cell=>cell.join()));let raisedVisible=0;
         for(const cell of c.front){const a=withKnight.get(cell.join()),b=readCell(cell);
           if(!a||!b)continue;frontSampled++;const d=delta(a,b);frontWorst=Math.max(frontWorst,d);
           if(d>SEEN){frontVisible++;if(raisedSet.has(cell.join()))raisedVisible++;}}
         for(const cell of c.behind){const a=withKnight.get(cell.join()),b=readCell(cell);
           if(!a||!b)continue;behindSampled++;if(delta(a,b)>SEEN)behindVisible++;}
         const wrongBehind=[...covered].filter(k=>{const [x,y]=k.split(',').map(Number);
           const d=stoneAt(x,y);return d===null||d<=c.feet+1.5;});
         const missedFront=c.front.filter(cell=>!covered.has(cell.join()));
         report.push({ruin:spot.ruin,x:spot.x,y:spot.y,jumping:jump>0,jumpPx:+jumpPx(player).toFixed(1),
           front:c.front.length,raisedFront:c.raised.length,behind:c.behind.length,
           coveredCells:covered.size,missedFront:missedFront.length,wrongBehind:wrongBehind.length,
           frontVisible,raisedVisible,frontSampled,frontWorst:+frontWorst.toFixed(2),behindVisible,behindSampled});
       }
     }finally{
       simulate=sim;Math.random=random;drawKnight=knight;
       Object.assign(player,saved);updateCamera(0,true);
     }
     if(JSON.stringify(MEADOW_MAP)!==mapBefore)throw Error('authored map changed');
     return {report,stats:native.jumpOcclusion,contexts:document.querySelectorAll('canvas').length,
       peak,chosen};
   });
   for(const r of result.report){
     const tag=label+' '+r.ruin+' '+(r.jumping?'jump':'stand');
     if(r.wrongBehind)fail(tag+': stone behind the foot point drawn over the knight '+JSON.stringify(r));
     if(r.missedFront)fail(tag+': stone in front left uncovered (sliced knight) '+JSON.stringify(r));
     if(r.frontSampled<4)fail(tag+': too few front cells on screen '+JSON.stringify(r));
     // A single stone cell may shift a few levels from neighbouring glyph filtering.
     if(r.frontVisible>Math.max(1,r.frontSampled*.01))
       fail(tag+': knight pixels show through stone in front '+JSON.stringify(r));
     // The rows only a jump reaches: his head and shoulders must stay behind front stone.
     if(r.raisedVisible>0)fail(tag+': raised body drawn over stone in front '+JSON.stringify(r));
     if(r.jumping&&!(r.raisedFront>0))fail(tag+': no raised rows exercised '+JSON.stringify(r));
   }
   const behindSeen=result.report.filter(r=>r.jumping).reduce((n,r)=>n+r.behindVisible,0);
   if(!(behindSeen>0))fail(label+': jumping knight not visible over stone behind him '+JSON.stringify(result.report));
   if(!(result.stats.cells>0))fail(label+': raised rows never covered '+JSON.stringify(result.stats));
   // Full-size evidence: the strongest spot, frozen at the jump peak.
   const spot=result.chosen[0];
   const clip=await page.evaluate(({spot,peak})=>{
     simulate=function(){};
     player.x=player.tx=spot.x;player.y=player.ty=spot.y;player.jump=peak;player.walk=0;player.run=0;
     updateCamera(0,true);render();
     const G=geomOf(player);
     return {x:(G.left-camX*CW)*VZ-90,y:(G.top-camY*CH)*VZ-90,w:G.w*VZ+180,h:(G.gy-G.top)*VZ+180};
   },{spot,peak:result.peak});
   const f0=await page.evaluate(()=>window.__ASCII_NATIVE__.frameCount);
   await page.waitForFunction(f0=>window.__ASCII_NATIVE__.frameCount>f0+2,f0,{timeout:240000});
   const vp=page.viewportSize();
   await page.screenshot({path:path.join(dir,label+'-jump-peak.png'),timeout:120000});
   const cx=Math.max(0,Math.floor(clip.x)),cy=Math.max(0,Math.floor(clip.y));
   await page.screenshot({path:path.join(dir,label+'-jump-peak-knight.png'),timeout:120000,
     clip:{x:cx,y:cy,width:Math.min(vp.width-cx,Math.ceil(clip.w)),height:Math.min(vp.height-cy,Math.ceil(clip.h))}});
   if(errors.length)fail(label+' browser errors '+errors.join('; '));
   console.log('THREE JUMP OCCLUSION PASS '+label+' '+JSON.stringify({report:result.report,stats:result.stats}));
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
