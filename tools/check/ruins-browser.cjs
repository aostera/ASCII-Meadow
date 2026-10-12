// Three actual raycast 3D landmarks, symbol art and passage-only physics.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { launch, openGame, realErrors } = require('./common.cjs');
const url = 'file://' + path.resolve(__dirname, '../../index.html');
(async () => {
 const browser=await launch();
 const out=path.resolve(__dirname,'../../shots/ruins');
 fs.mkdirSync(out,{recursive:true});
 try {
  for (const [mode,viewport] of [
    ['gl',{width:960,height:600}],
    ['2d',{width:960,height:600}],
    ['gl',{width:390,height:844}]
  ]) {
   const {ctx,page,step,errs}=await openGame(browser,url,{mode,viewport});
   try {
    await step(3);
    const report=await page.evaluate(()=>{
      if(ruins.length!==3) throw Error('All three structures must be built');
      const source=JSON.stringify(MEADOW_MAP);
      const result=ruins.map(r=>{
        const covered=r.lum.filter(v=>v>=0).length;
        const glyphs=r.glyph.filter(v=>v>=0).length;
        const threshold=mapToCell(r.x,r.z-r.depth/2-24);
        const end=mapToCell(r.x,r.z+r.depth/2+24);
        const from={x:threshold[0],y:threshold[1],hT:0,jump:.85,cls:'knight'};
        const doorway=ruinsBlockMove(end[0],end[1],from);
        const right=mapToCell(r.x+r.arch/2+15,r.z+r.depth/2+24);
        const rightStart=mapToCell(r.x+r.arch/2+15,r.z-r.depth/2-24);
        const blockedPier=ruinsBlockMove(right[0],right[1],{
          ...from,x:rightStart[0],y:rightStart[1]});
        const rightSide=mapToCell(r.x+r.width/2+30,r.z);
        const inner=mapToCell(r.x,r.z);
        const blockedSide=ruinsBlockMove(inner[0],inner[1],{
          ...from,x:rightSide[0],y:rightSide[1],cls:'cow'});
        const cleared=flora.every(item=>{
          const [fx,fz]=toModelXZ(item.x,item.y);
          return !ruinClearing(fx,fz);
        });
        return {id:r.id,covered,glyphs,doorway,blockedPier,blockedSide,cleared,
          cells:r.width*r.height};
      });
      return {result,sourceSame:source===JSON.stringify(MEADOW_MAP),
        actorCount:npcs.length,castleOK:!!cathedral.cv};
    });
    assert(report.sourceSame&&report.castleOK&&report.actorCount===1);
    assert.equal(report.result.length,3);
    for(const r of report.result){
      assert(r.covered>250&&r.glyphs>150, r.id+' must have substantial ASCII geometry');
      assert(!r.doorway&&r.blockedPier&&r.blockedSide,r.id+' arches must be sole entrances: '+JSON.stringify(r));
      assert(r.cleared,r.id+' corridors must be clear of trees: '+JSON.stringify(r));
    }

    // Real E dispatch: both entrances to each ruin must be usable; nearby
    // targets become unavailable behind stone without editing the map.
    const inspections = await page.evaluate(() => {
      return ruins.map(site => {
        const prop = props.find(p => p.ruinId === site.id);
        if (!prop || prop.spots.length !== 2) throw Error('Missing inspect spots ' + site.id);
        const sides = prop.spots.map(spot => {
          const side = spot.id.endsWith('-south') ? -1 : 1;
          [player.x, player.y] = mapToCell(site.x,
            site.z + side * (site.depth / 2 + 18));
          player.hT = 0;
          updateWorld(0);
          const picked = activeSpot === spot;
          const used = useSpot();
          const message = player.say;
          [player.x, player.y] = mapToCell(site.x + site.width / 2 + 35, site.z);
          const throughWall = spot.need();
          return { picked, used, message, throughWall };
        });
        return { id: site.id, sides };
      });
    });
    for (const ruin of inspections) for (const s of ruin.sides) {
      assert(s.picked && s.used && s.message.length > 30 && !s.throughWall,
        ruin.id + ' E interaction must work from arch, never through a wall: ' + JSON.stringify(s));
    }
    for (const site of ['broken-gate','abbey-front','cloister-walk']) {
      await page.evaluate(id=>{
        const r=ruins.find(item=>item.id===id);
        const [x,y]=mapToCell(r.x,r.z-r.depth/2-45);
        player.x=x; player.y=y;
        // Centre the whole building in the screenshot. The normal gameplay
        // camera eases towards teleported test players and can crop the roof.
        const [gx,gy]=mapToCell(r.x,r.z);
        camX=Math.max(0,Math.min(COLS-VC,gx-VC/2));
        camY=Math.max(0,Math.min(ROWS-VR,
          gy-(r.height*COSP*WS/CH)/2-VR/2));
        player.say = ''; player.sayT = 0; // do not label unrelated screenshots with the last inspected ruin
        updateWorld(0); // recompute the E prompt after each test teleport
        setView(); render();
      },site);
      await page.screenshot({path:path.join(out, mode+'-'+viewport.width+'-'+site+'.png')});
    }
    assert.deepEqual(realErrors(errs),[]);
    console.log('PASS ruins '+mode+' '+viewport.width+': 3 raycast meshes, collision passages, clear courtyards');
   }finally{await ctx.close();}
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
