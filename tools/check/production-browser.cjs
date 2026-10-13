// Live production contract: the latest authored map and scene must actually
// START and render on Cloudflare, not merely exist as uploaded JS files.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launch, openGame, realErrors } = require('./common.cjs');
const url = process.env.MEADOW_PROD_URL || 'https://ascii-meadow.aloster36.workers.dev/';

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
        const data = await page.evaluate(async () => {
          const revision = await (await fetch('./build.json?ci=' + Date.now(), {
            cache: 'no-store'
          })).json();
          const loadedScript = [...document.scripts].find(s => s.src.includes('/src/data/map.js'));
          let grassCells = 0, rootedCells = 0;
          for (let i = 0; i < N; i++) {
            if (campGround[i] > .2 && kind[i] === 1) rootedCells++;
            if (campGround[i] > .1 && bshade[i] > .05) grassCells++;
          }
          return {
            version: revision.revision,
            mapSrc: loadedScript?.src || '',
            renderer: GL.ok ? 'gl' : '2d',
            map: MEADOW_MAP.ruins.map(r => r.slice(0, 5)),
            built: ruins.map(r => [r.id, r.x, r.z, r.yaw]),
            tents: flora.filter(f => f.v.type === 'tent').length,
            fences: flora.filter(f => f.v.type === 'fence').length,
            rootedCells, grassCells,
            ready: !!cathedral.cv && COLS > 100 && ROWS > 100,
            drawCount: GB.n
          };
        });
        const expected = [
          ['broken-gate', 'gate', 47.3, -772.6, 2.998],
          ['abbey-front', 'abbey', -301.4, -946.9, 2.5398],
          ['cloister-walk', 'cloister', -27.8, -1284.1, .43]
        ];
        assert.deepEqual(data.map, expected, 'production must load the NEW authored map');
        assert.deepEqual(data.built, expected.map(([id, , x, z, yaw]) => [id, x, z, yaw]),
          'the new map must be BUILT into the runtime scene');
        assert(data.version && data.version !== 'local' &&
          data.mapSrc.includes('?v=' + data.version),
          'the live map script must use the latest release revision URL');
        assert.equal(data.renderer, mode, 'production uses requested render backend');
        assert(data.ready && data.drawCount > 100,
          'production needs a running real world, not an old/broken empty page');
        assert(data.tents > 0 && data.fences > 0 && data.rootedCells > 5 && data.grassCells > 5,
          'production must contain live camp grass, fences and tents');
        assert.deepEqual(realErrors(errs), [], 'production runtime browser errors');
        fs.mkdirSync(path.resolve(__dirname, '../../shots/production'), { recursive: true });
        await page.screenshot({
          path: path.resolve(__dirname, '../../shots/production/' + mode + '.png')
        });
        console.log('PASS live production '+mode+' revision '+data.version+
          ': new map rendered, tents/fences rooted in shaded live grass');
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
