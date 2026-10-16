// Validate live original knight/cow/grass animation in native Three GPU output.
// Capture the same prepared source buffer; do NOT take consecutive game frames.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8181';
const out=path.join(process.cwd(),'shots','three-motion');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
  for(const phone of [false,true]){
   const tag=phone?'phone':'desktop';
   const ctx=await browser.newContext({
    viewport:phone?{width:390,height:844}:{width:1100,height:740},
    deviceScaleFactor:phone?2:1,isMobile:phone,hasTouch:phone
   });
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.stack||e.message));
   const res=await page.goto(base.replace(/\/$/,'')+'/experiments/three/?parityTest=1',
    {waitUntil:'domcontentloaded'});
   if(!res?.ok())throw Error('Original animated game unavailable');
   await page.waitForFunction(()=>window.__ASCII_PARITY__?.ready,
    undefined,{timeout:90000});
   const sourceMap=await page.evaluate(()=>JSON.stringify(window.__ASCII_PARITY__.map));
   if(!await page.evaluate(()=>window.__ASCII_PARITY__.freezeForTest()))
    throw Error('Cannot lock normal RAF while preparing one frame');
   await page.addStyleTag({content:'.hud,.stats,#parity-toolbar,.ed,.ed-open{visibility:hidden!important}'});
   await page.keyboard.down('w');
   await page.keyboard.down('Shift');
   const signatures=[],jumps=[],counts=[];
   for(let i=0;i<5;i++){
    const act=i===0?'jump':i===2?'cow-graze':'';
    const src=await page.evaluate(a=>window.__ASCII_PARITY__.stepAnimatedReferenceForTest(.12,a),act);
    if(!src||src.glyphs<1000)throw Error('Original animated batch missing frame '+i);
    signatures.push(src.fingerprint);jumps.push(src.playerJump);counts.push(src.glyphs);
    await page.screenshot({path:path.join(out,tag+'-motion-'+i+'-original.png'),timeout:60000});
    const three=await page.evaluate(()=>window.__ASCII_PARITY__.captureThreeForTest());
    if(!three||three.glyphs!==src.glyphs)
     throw Error('Three.js changed animation glyph count at frame '+i);
    await page.screenshot({path:path.join(out,tag+'-motion-'+i+'-three.png'),timeout:60000});
    if(i===2&&(!src.cows.length||src.cows[0].state!=='graze'))
     throw Error('Original cow grazing animation not exercised');
    await page.evaluate(()=>window.__ASCII_PARITY__.select('legacy'));
   }
   await page.keyboard.up('w');await page.keyboard.up('Shift');
   if(new Set(signatures).size<3)throw Error('Static source animation: '+signatures.join(','));
   if(!jumps.some(n=>n>0))throw Error('Original knight jump never activated');
   if(await page.evaluate(()=>JSON.stringify(window.__ASCII_PARITY__.map))!==sourceMap)
    throw Error('Animation test changed authored map');
   if(errors.length)throw Error('Page errors: '+errors.join('\n'));
   console.log(tag.toUpperCase()+' MOTION PARITY CAPTURE PASS '+JSON.stringify({
    frames:5,uniqueGlyphFrames:new Set(signatures).size,
    knightJumpObserved:true,cowGrazingObserved:true,
    glyphCountRange:[Math.min(...counts),Math.max(...counts)],
    sourceMapUnchanged:true
   }));
   await ctx.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
