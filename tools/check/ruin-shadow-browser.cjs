// Shadow regression for the actual author-uploaded Gothic ruin layout.
// Removes/restores the structures and verifies no ghost or duplicate shadows,
// including after edits, in WebGL2 and the Canvas2D mobile fallback.
const assert = require('node:assert/strict');
const path = require('node:path');
const {launch,openGame,realErrors} = require('./common.cjs');
const url = 'file://' + path.resolve(__dirname,'../../index.html');
(async () => {
  const browser = await launch();
  try {
    for (const [mode,viewport] of [['gl',{width:960,height:600}],['2d',{width:390,height:844}]]) {
      const {ctx,page,step,errs} = await openGame(browser,url,{mode,viewport});
      try {
        await step(3);
        const out = await page.evaluate(() => {
          const map = JSON.parse(JSON.stringify(MEADOW_MAP));
          const hash = a => {
            const v = new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
            let n=2166136261;
            for(const x of v)n=Math.imul(n^x,16777619);
            return n>>>0;
          };
          const original = Array.from(bshade), shadeHash = hash(bshade);
          const castleHash=hash(bshadeCastle);
          const world=ruins.map(r=>({id:r.id,x:r.x,z:r.z,yaw:r.yaw,
            shadows:r.meshPieces,arch:r.arch}));
          const snapshot = mapFileText();
          const countFlora=MEADOW_MAP.flora.length;
          applyWholeMap({...map,ruins:[]});
          const cleared = Array.from(bshade);
          const noRuins = ruins.length===0;
          // The difference is the precisely modelled ruin shadow plus terrain
          // changes from vegetation cleared underneath the ruin footprint.
          let positive=0,changed=0,negative=0,farWrong=0;
          for(let i=0;i<N;i++) {
            const d=original[i]-cleared[i];
            if(d>.06)positive++;
            if(d<-.06)negative++;
            if(Math.abs(d)>.06){
              changed++;
              const x=i%COLS,y=Math.floor(i/COLS);
              const [wx,wz]=toModelXZ(x,y);
              const near=world.some(r=>{
                const model=RUIN_SITES.find(s=>s.type===map.ruins.find(a=>a[0]===r.id)[1]);
                const radius=Math.max(model.width,model.depth)*.75 + model.height*1.3;
                return Math.hypot(wx-r.x,wz-r.z)<radius;
              });
              if(!near) farWrong++;
            }
          }
          applyWholeMap(map);
          const restored = hash(bshade)===shadeHash &&
            hash(bshadeCastle)===castleHash &&
            JSON.stringify(MEADOW_MAP.ruins)===JSON.stringify(map.ruins);
          rebuildFlora();
          const stable = hash(bshade)===shadeHash;
          // Move a ruin, then undo and ensure no new, stale shade is left behind.
          openEditor();
          ED.sel={kind:'ruins',mi:0};
          edMoveSelected(map.ruins[0][2]+340,map.ruins[0][3]-260);
          const displaced=hash(bshade)!==shadeHash &&
            ruins[0].x===map.ruins[0][2]+340;
          edUndo();
          const undone=hash(bshade)===shadeHash;
          edRedo();
          const redone=hash(bshade)!==shadeHash;
          edUndo();closeEditor();
          return {world,ruins:map.ruins,fires:map.fires.length,countFlora,
            noRuins,positive,negative,changed,farWrong,restored,stable,
            displaced,undone,redone,sourceSame:snapshot===mapFileText(),
            final:hash(bshade)===shadeHash};
        });
        assert.deepEqual(out.world.map(r=>[r.id,r.x,r.z,r.yaw]),[
          ['broken-gate',47.3,-772.6,2.998],
          ['abbey-front',-301.4,-946.9,2.5398],
          ['cloister-walk',-27.8,-1284.1,.43]]);
        assert.equal(out.fires,7);
        assert.equal(out.countFlora,960);
        assert(out.noRuins && out.positive>60 && out.changed>60,
          'placed ruins must cast meaningful ground shadows: '+JSON.stringify(out));
        assert.equal(out.farWrong,0,'no far-away ruins shadow ghosts');
        for(const name of ['restored','stable','displaced','undone','redone','sourceSame','final'])
          assert(out[name],name+' shadow/editor regression: '+JSON.stringify(out));
        assert.deepEqual(realErrors(errs),[]);
        console.log('PASS new layout real masonry shade '+mode+' '+viewport.width+
          ': '+out.positive+' shadow cells, exact undo/redo and no ghost shadows');
      } finally {await ctx.close();}
    }
  } finally {await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
