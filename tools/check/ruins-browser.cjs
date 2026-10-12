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
    for (const site of ['broken-gate','abbey-front','cloister-walk']) {
      await page.evaluate(id=>{
        const r=ruins.find(item=>item.id===id);
        const [x,y]=mapToCell(r.x,r.z-r.depth/2-190);
        player.x=x; player.y=y;
      },site);
      await step(12);
      await page.screenshot({path:path.join(out, mode+'-'+viewport.width+'-'+site+'.png')});
    }
    assert.deepEqual(realErrors(errs),[]);
    console.log('PASS ruins '+mode+' '+viewport.width+': 3 raycast meshes, collision passages, clear courtyards');
   }finally{await ctx.close();}
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
