// Integration test: real 3D camp ground shadows, fence grass and editor rebuild.
const assert = require('node:assert/strict');
const path = require('node:path');
const { launch, openGame, realErrors } = require('./common.cjs');
const url = 'file://' + path.resolve(__dirname, '../../index.html');
(async () => {
  const browser = await launch();
  try {
    for (const [mode, viewport] of [
      ['gl', {width: 960, height: 600}],
      ['2d', {width: 640, height: 400}],
      ['gl', {width: 390, height: 844}]
    ]) {
      const {ctx, page, errs, step} = await openGame(browser, url, {mode, viewport});
      try {
        await step(3);
        const read = () => page.evaluate(() => {
          const sum = a => a.reduce((x, y) => x + y, 0);
          const checksum = a => {
            const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
            let h = 2166136261;
            for (const v of b) h = Math.imul(h ^ v, 16777619);
            return h >>> 0;
          };
          const fs = VARS.filter(v => v.type === 'fence');
          const tents = VARS.filter(v => v.type === 'tent');
          const valid = v => ({
            shade: v.gshadow.length / 3,
            ground: v.grounding.length / 3,
            hide: v.hide.length / 2,
            blocks: v.block.length / 2,
            sun: Array.from({length: v.gshadow.length / 3}, (_,i) => i * 3)
              .some(k => v.gshadow[k] > 0 && v.gshadow[k + 1] < 0)
          });
          const liveFences = flora.filter(f => f.v.type === 'fence');
          const liveTents = flora.filter(f => f.v.type === 'tent');
          let mixedGrass = 0, campShadeCells = 0;
          for (let i = 0; i < N; i++) {
            if (campGround[i] > .03 && kind[i] === 1) mixedGrass++;
            if (campGround[i] > .03 && bshade[i] > .05) campShadeCells++;
          }
          return {
            fences: fs.map(valid), tents: tents.map(valid),
            live: [liveFences.length, liveTents.length],
            mixedGrass, campShadeCells,
            shadowSum: +sum(bshade).toFixed(3),
            hashes: [checksum(kind), checksum(bshade), checksum(campGround),
              checksum(fmask), checksum(tmask)],
            world: [COLS, ROWS], map: mapFileText(),
            sun: LGT.slice()
          };
        });
        const a = await read();
        // The fast viewport culling path must return precisely the same
        // first sprite as the old linear scan, including empty viewports.
        const search = await page.evaluate(() => {
          const rows = [0, VY0 - 40, VY0 - 2, VY0, VY1, VY1 + FLMAXR + 40, ROWS + 1];
          return rows.map(row => {
            const fast = floraLowerBound(row);
            const slow = flora.findIndex(f => f.br >= row);
            return [row, fast, slow < 0 ? flora.length : slow];
          });
        });
        assert(search.every(([, fast, slow]) => fast === slow),
          'viewport flora binary search differs from the original linear scan');
        assert.equal(a.fences.length, 6);
        assert.equal(a.tents.length, 4);
        assert(a.live[0] > 0 && a.live[1] > 0, 'authored camp remains populated');
        assert(a.fences.every(v => v.shade > 15 && v.ground > 8 &&
          v.hide > 0 && v.hide <= v.blocks && v.sun),
          'fences need real directional cast shadows, exposed rail grass and rooted posts');
        assert(a.fences.slice(0, 4).some(v => v.hide < v.blocks),
          'rail fence hides only posts, never the entire under-rail strip');
        assert(a.tents.every(v => v.shade > 20 && v.ground > 15 && v.sun),
          'tent silhouettes cast 3D ground shadows with planted fabric hems');
        assert(a.mixedGrass > 5 && a.campShadeCells > 5,
          'live grass should still grow beside shaded fence and tent foundations');
        assert(a.sun[0] < 0 && a.sun[1] > 0 && a.sun[2] < 0);
        // A map edit / undo reconstructs this exact ground rather than accumulating
        // shadow layers, losing vegetation or changing map.js object positions.
        await page.evaluate(() => rebuildFlora());
        const b = await read();
        assert.deepEqual(b.hashes, a.hashes,
          'rebaking the same map must restore identical terrain, shadow, grass and collision masks');
        assert.equal(b.map, a.map, 'world polish must never edit designer map.js');
        assert.deepEqual(realErrors(errs), [], 'browser errors');
        console.log('PASS camp integration '+mode+' '+viewport.width+': 4 tents, 6 fences, rooted posts, directional shadows, deterministic rebuild');
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
