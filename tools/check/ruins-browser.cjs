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
        const visible=Array.from(r.lum).filter(v=>v>=0);
        const covered=visible.length, glyphs=r.glyph.filter(v=>v>=0).length;
        const depths=Array.from(r.dep).filter((_,i)=>r.lum[i]>=0);
        const tonalRange=Math.max(...visible)-Math.min(...visible);
        const depthRange=Math.max(...depths)-Math.min(...depths);
        const [swx,swz]=ruinWorldXZ(r,r.width/2-7,-r.depth*.32);
        const [sx,sy]=mapToCell(swx,swz);
        const footShade=bshade[Math.round(sy)*COLS+Math.round(sx)];
        const entrance=ruinWorldXZ(r,0,-r.depth/2-24);
        const exit=ruinWorldXZ(r,0,r.depth/2+24);
        const threshold=mapToCell(...entrance);
        const end=mapToCell(...exit);
        const from={x:threshold[0],y:threshold[1],hT:0,jump:.85,cls:'knight'};
        const doorway=ruinsBlockMove(end[0],end[1],from);
        const right=mapToCell(...ruinWorldXZ(r,r.arch/2+15,r.depth/2+24));
        const rightStart=mapToCell(...ruinWorldXZ(r,r.arch/2+15,-r.depth/2-24));
        const blockedPier=ruinsBlockMove(right[0],right[1],{
          ...from,x:rightStart[0],y:rightStart[1]});
        const rightSide=mapToCell(...ruinWorldXZ(r,r.width/2+30,0));
        const inner=mapToCell(...ruinWorldXZ(r,0,0));
        const blockedSide=ruinsBlockMove(inner[0],inner[1],{
          ...from,x:rightSide[0],y:rightSide[1],cls:'cow'});
        const cleared=flora.every(item=>{
          const [fx,fz]=toModelXZ(item.x,item.y);
          return !ruinClearing(fx,fz);
        });
        const {skyline, towerLancet} = r.architecture;
        const skylineRange = Math.max(...skyline) - Math.min(...skyline);
        const skylineTiers = new Set(skyline.map(v => Math.round(v / 12))).size;
        return {id:r.id,covered,glyphs,doorway,blockedPier,blockedSide,cleared,
          meshPieces:r.meshPieces,tonalRange,depthRange,footShade,
          skylineRange,skylineTiers,towerLancet,modelHeight:r.height,
          cells:r.width*r.height};
      });
      return {result,sourceSame:source===JSON.stringify(MEADOW_MAP),
        actorCount:npcs.length,castleOK:!!cathedral.cv};
    });
    assert(report.sourceSame&&report.castleOK&&report.actorCount===1);
    assert.equal(report.result.length,3);
    for(const r of report.result){
      assert(r.covered>250&&r.glyphs>150, r.id+' must have substantial ASCII geometry');
      assert(r.meshPieces>70 && r.depthRange>35 && r.tonalRange>.25,
        r.id+' must be multi-surface volume, not a depthless façade: '+JSON.stringify(r));
      assert(r.meshPieces<420, r.id+' must keep raycast geometry reasonably bounded on phones');
      assert(r.skylineRange>r.modelHeight*.20 && r.skylineTiers>=4,
        r.id+' requires real multilevel broken wall silhouette: '+JSON.stringify(r));
      if(r.id==='broken-gate') assert.equal(r.towerLancet,true,
        'gate tower must have a real open lancet bounded by physical stone piers');
      assert(r.footShade>.03,r.id+' must cast real contact shadows onto the ground');
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
          [player.x, player.y] = mapToCell(...ruinWorldXZ(site,0,
            side * (site.depth / 2 + 18)));
          player.hT = 0;
          updateWorld(0);
          const picked = activeSpot === spot;
          const used = useSpot();
          const message = player.say;
          [player.x, player.y] = mapToCell(...ruinWorldXZ(site,
            site.width / 2 + 35,0));
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
        const [x,y]=mapToCell(...ruinWorldXZ(r,0,-r.depth/2-45));
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
