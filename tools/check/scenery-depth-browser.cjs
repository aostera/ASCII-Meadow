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
          // A tent/fence must deflect a blade as strongly as the knight's
          // brush, not just tint the terrain. Probe the actual spring input.
          const px = Math.min(COLS - 3, Math.max(3, VX0 + 8));
          const py = Math.min(ROWS - 3, Math.max(3, VY0 + 8));
          const i = py * COLS + px;
          const offsets = [i, i - 1, i + 1, i - COLS, i + COLS];
          const before = offsets.map(n => campGround[n]);
          const oldPush = push[i], oldFlat = flat[i], oldKind = kind[i];
          campGround[i] = .55; campGround[i - 1] = .92;
          campGround[i + 1] = .11; campGround[i - COLS] = .55;
          campGround[i + COLS] = .55;
          kind[i] = 1; push[i] = 0; flat[i] = 0;
          // Static forces are now baked when scenery changes. The test
          // mutates campGround directly, so explicitly rebake its fixture.
          bakeSceneryGrassForces();
          applySceneryGrassForces();
          const bend = push[i], flatten = flat[i];
          offsets.forEach((n, k) => { campGround[n] = before[k]; });
          push[i] = oldPush; flat[i] = oldFlat; kind[i] = oldKind;
          bakeSceneryGrassForces(); // restore the original map force cache
          return {
            back, front, grass, shadow, bend, flatten,
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
        assert(result.bend > 1 && result.flatten > .06 && result.flatten < .23,
          'fence/tent contact must bend living grass without flattening its visible tips');
        assert.deepEqual(realErrors(errs), [], 'runtime browser errors');
        console.log('PASS '+mode+': depth sorting, solid collision, grass and 3D shadows');
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
