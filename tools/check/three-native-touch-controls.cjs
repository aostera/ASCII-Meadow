// T10 regression: touch controls of the native game on a phone and a tablet,
// with real CDP touch input. The floating stick steers from wherever the thumb
// lands, walks on a short push and runs on a long one, turns back at once; a
// second finger and the jump button jump without stopping the walk; a cancelled
// touch is no tap; taps still gust / jump; the editor keeps its own gestures;
// the authored map is untouched. Screenshots with the stick go to shots/.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const out=path.join(process.cwd(),'shots','three-native-touch-controls');
fs.mkdirSync(out,{recursive:true});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const fail=m=>{throw Error(m)};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM||undefined,args:[
  '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
  // TOUCH_ONLY=tablet / TOUCH_DPR=1: slow local software GL; CI runs both at DPR 2
  const sizes=[['phone',{width:390,height:844}],['tablet',{width:820,height:1180}]]
   .filter(([l])=>!process.env.TOUCH_ONLY||l===process.env.TOUCH_ONLY);
  for(const [label,viewport] of sizes){
   const ctx=await browser.newContext({viewport,deviceScaleFactor:+process.env.TOUCH_DPR||2,isMobile:true,hasTouch:true});
   // offline runs: THREE_LOCAL=<three/build dir> serves the pinned module instead of the CDN
   if(process.env.THREE_LOCAL)await ctx.route(/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/build\/([\w.]+)$/,r=>{
    const f=path.join(process.env.THREE_LOCAL,r.request().url().split('/').pop());
    return r.fulfill({body:fs.readFileSync(f),contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
   });
   if(process.env.THREE_LOCAL)await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   const response=await page.goto(base.replace(/\/$/,'')+'/experiments/three/native.html',{waitUntil:'commit',timeout:120000});
   if(!response?.ok())fail('native HTTP failed');
   await page.waitForFunction(()=>window.__ASCII_NATIVE__?.ready&&window.__ASCII_NATIVE_TOUCH__,undefined,{timeout:180000});
   await wait(1500);
   // software GL on CI renders a phone frame in ~1-2 s and touch events wait for frames, so a
   // 40 ms tap arrives as a long press; widen the tap window here only (real devices keep 300 ms)
   await page.evaluate(()=>{window.__ASCII_NATIVE_TOUCH__.config.tapMs=1e4});
   const mode=await page.evaluate(()=>window.__ASCII_NATIVE__.mode);
   const map0=await page.evaluate(()=>JSON.stringify(MEADOW_MAP));
   const cdp=await ctx.newCDPSession(page);
   const down={};
   const send=type=>cdp.send('Input.dispatchTouchEvent',{type,
    touchPoints:Object.entries(down).map(([id,[x,y]])=>({id:+id,x,y,radiusX:4,radiusY:4,force:1}))});
   const start=(id,x,y)=>{down[id]=[x,y];return send('touchStart')};
   const move=(id,x,y)=>{down[id]=[x,y];return send('touchMove')};
   // CDP lists the fingers that lift
   const end=id=>{const [x,y]=down[id];delete down[id];
    return cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[{id,x,y}]})};
   const st=()=>page.evaluate(()=>({x:player.x,y:player.y,run:player.run||0,jump:player.jump||0,
    rings:rings.length,dir:player.dir,touch:window.__ASCII_NATIVE_TOUCH__.stats,
    stick:window.__ASCII_NATIVE_TOUCH__.stick,fingers:window.__ASCII_NATIVE_TOUCH__.fingers}));
   const landed=()=>page.waitForFunction(()=>!(player.jump>0),undefined,{timeout:120000});
   // movement is checked in rendered frames, not milliseconds: software GL is slow
   const frames=n=>page.evaluate(n=>new Promise(r=>{let k=0;const f=()=>++k>=n?r():requestAnimationFrame(f);requestAnimationFrame(f)}),n);
   const result={label,mode};

   // 1. thumb low in the left corner, far from the knight, pushed up a little: walks up, no run
   const tx=70,ty=viewport.height-160;
   const s0=await st();
   await start(1,tx,ty);await wait(30);
   for(let k=1;k<=4;k++){await move(1,tx,ty-k*8);await wait(16)}
   await frames(12);
   const s1=await st();
   if(!(s1.y<s0.y-1&&Math.abs(s1.x-s0.x)<1))fail(label+' short push did not walk straight up '+JSON.stringify([s0,s1]));
   if(s1.run>0.2)fail(label+' short push ran '+s1.run);
   result.walk=+(s1.y-s0.y).toFixed(2);

   // 2. further the same way: runs; the ring is on screen where the thumb landed
   await move(1,tx,ty-70);
   // running eases in over a few frames; software GL is slow, so wait on the state, not the clock
   await page.waitForFunction(()=>player.run>0.6,undefined,{timeout:15000}).catch(()=>{});
   const s2=await st();
   if(!(s2.run>0.6))fail(label+' long push did not run '+s2.run);
   const ring=await page.evaluate(()=>{const r=window.__ASCII_NATIVE_TOUCH__.ui.ring;return{hidden:r.hidden,running:r.classList.contains('running')}});
   if(ring.hidden||!ring.running)fail(label+' stick not drawn '+JSON.stringify(ring));
   await page.screenshot({path:path.join(out,label+'-running.png')});
   result.run=+s2.run.toFixed(2);

   // 3. second finger tap: jumps, and the walk goes on after it lifts
   await start(2,viewport.width-90,viewport.height*.4);await wait(40);await end(2);await wait(60);
   const s3=await st();
   if(!(s3.jump>0||s3.touch.jumps>s2.touch.jumps))fail(label+' second-finger tap did not jump '+JSON.stringify(s3));
   await landed();await frames(2);
   const a=await st();await frames(8);const b=await st();
   if(!(b.y<a.y-0.5))fail(label+' walk stopped after the second finger '+JSON.stringify([a.y,b.y]));

   // 4. swing straight down past the rim: turns at once
   await move(1,tx,ty+40);await frames(4);
   const c0=await st();await frames(8);const c1=await st();
   if(!(c1.y>c0.y+0.3&&c1.dir==='down'))fail(label+' did not turn back '+JSON.stringify([c0,c1]));

   // 5. thumb back to the stick centre: stops; lifting it clears the stick
   const centre=(await st()).stick;
   await move(1,centre.ox,centre.oy);await frames(4);
   const d0=await st();await frames(6);const d1=await st();
   if(Math.hypot(d1.x-d0.x,d1.y-d0.y)>0.05)fail(label+' did not stop at the centre');
   await end(1);await wait(80);
   const e0=await st();
   if(e0.stick||e0.fingers)fail(label+' stick left behind');

   // 6. a cancelled touch is not a tap
   const r0=e0.rings,g0=e0.touch.gusts;
   await start(3,60,viewport.height*.3);await wait(40);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});delete down[3];await wait(60);
   const f0=await st();
   if(f0.touch.gusts!==g0||f0.fingers)fail(label+' cancelled touch acted '+JSON.stringify(f0.touch));

   // 7. a plain tap on the field gusts, a tap on the knight jumps
   await start(4,60,viewport.height*.3);await wait(40);await end(4);await wait(60);
   const f1=await st();
   if(!(f1.touch.gusts>g0&&f1.rings>=r0))fail(label+' tap did not gust');
   await landed();
   const kq=await page.evaluate(()=>[(player.x-camX)*CW,(player.y-camY)*CH-20]);
   await start(5,kq[0],kq[1]);await wait(40);await end(5);await wait(60);
   if(!((await st()).jump>0))fail(label+' tap on the knight did not jump');
   await landed();

   // 8. jump button: visible on touch, jumps on press
   const jb=await page.locator('.native-touch-jump').boundingBox();
   if(!jb)fail(label+' jump button missing');
   await start(6,jb.x+jb.width/2,jb.y+jb.height/2);await wait(40);await end(6);await wait(60);
   if(!((await st()).jump>0))fail(label+' jump button did not jump');
   await landed();

   // 9. editor: buttons hide, a one-finger stroke still reaches the editor (not the stick)
   await page.evaluate(()=>openEditor());await frames(3);
   const ed=await page.evaluate(()=>({pad:window.__ASCII_NATIVE_TOUCH__.ui.pad.hidden}));
   if(!ed.pad)fail(label+' touch buttons shown in the editor');
   await start(7,viewport.width/2,viewport.height*.25);await wait(30);
   await move(7,viewport.width/2+40,viewport.height*.25);await wait(30);
   const inEd=await st();await end(7);await wait(60);
   if(inEd.stick)fail(label+' stick took an editor touch');
   await page.evaluate(()=>{closeEditor?.()});

   const map1=await page.evaluate(()=>JSON.stringify(MEADOW_MAP));
   if(map1!==map0)fail(label+' authored map changed');
   if(errors.length)fail(label+' page errors: '+errors.join('; '));
   result.stats=(await st()).touch;
   console.log('NATIVE TOUCH CONTROLS PASS '+JSON.stringify(result));
   await ctx.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
