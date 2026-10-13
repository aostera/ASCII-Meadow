// Regression: depth-composited masonry, rooted tent grass and deterministic
// cast shadows in WebGL2 and the Canvas2D fallback.
const assert = require('node:assert/strict');
const path = require('node:path');
const { launch, openGame, realErrors } = require('./common.cjs');
const url = 'file://' + path.resolve(__dirname, '../../index.html');

(async () => {
  const browser = await launch();
  try {
    for (const [mode, viewport] of [
      ['gl', { width: 960, height: 600 }],
      ['2d', { width: 390, height: 844 }]
    ]) {
      const { ctx, page, errs, step } = await openGame(browser, url, { mode, viewport });
      try {
        await step(3);
        const result = await page.evaluate(() => {
          const tree = VARS.find(v => v.type === 'tree');
          const tents = VARS.filter(v => v.type === 'tent');
          const fences = VARS.filter(v => v.type === 'fence');
          const origRuins = ruins.slice(), origCv = cathedral.cv;
          const old = [VX0, VX1, VY0, VY1, GB.n];
          const f = { isFlora: true, v: tree, x: 20, br: 40, y: 39.3 };
          let back = -1, front = -1;
          try {
            // One masonry cell in front of an overlapping tree canopy.
            // It must cover foliage ONLY when its projected depth is closer.
            VX0 = 0; VX1 = 70; VY0 = 0; VY1 = 70;
            cathedral.cv = null;
            const r = { x0: 20, x1: 20, y0: 38, y1: 38, gridW: 1,
              lum: new Float32Array([1]), dep: new Float32Array([40 * CH + 50]),
              glyph: new Int16Array([CI['#']]), lev: new Uint8Array([BL0]) };
            ruins.splice(0, ruins.length, r);
            const start = GB.n;
            coverFloraWithArchitecture(f);
            back = GB.n - start;
            GB.n = start;
            r.dep[0] = 40 * CH - 50;
            coverFloraWithArchitecture(f);
            front = GB.n - start;
          } finally {
            ruins.splice(0, ruins.length, ...origRuins);
            cathedral.cv = origCv;
            [VX0, VX1, VY0, VY1, GB.n] = old;
          }
          // Grass and shadows come from each object's rotated 3D contact,
          // while collision still uses its unchanged footprint.
          let grass = 0, shadow = 0;
          for (let i = 0; i < N; i++) {
            if (campGround[i] > .1 && kind[i] === 1) grass++;
            if (bshade[i] > .08 && campGround[i] > .1) shadow++;
          }
          return {
            back, front, grass, shadow,
            tents: tents.map(v => [v.hide.length, v.block.length, v.grounding.length, v.gshadow.length]),
            fences: fences.map(v => [v.hide.length, v.block.length, v.grounding.length, v.gshadow.length])
          };
        });
        assert(result.back >= 2, 'closer masonry must be restored above background foliage');
        assert.equal(result.front, 0, 'masonry behind foliage must not hide it');
        assert(result.tents.every(t => t[0] === 0 && t[1] > 0 && t[2] > 0 && t[3] > 0),
          'tent collision remains solid while grass is shortened, not erased');
        assert(result.fences.every(t => t[0] > 0 && t[0] < t[1] * 2 && t[2] > 0 && t[3] > 0),
          'fences hide only actual grounded posts');
        assert(result.grass > 5 && result.shadow > 5,
          'camp must leave living grass in partial, grounded shadows');
        assert.deepEqual(realErrors(errs), [], 'runtime browser errors');
        console.log('PASS '+mode+': depth sorting, solid collision, grass and 3D shadows');
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
