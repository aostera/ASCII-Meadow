// Production-only browser check. File parity alone isn't sufficient: an old
// index.html in the browser may load old JS, or the scene may fail at runtime.
// Capture actual public map/camp/ruins in Chromium; do not substitute a mock map.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launch, openGame, realErrors } = require('./common.cjs');
const origin = process.env.MEADOW_PROD_URL || 'https://ascii-meadow.aloster36.workers.dev';
const rev = (process.env.GITHUB_SHA || '').slice(0, 12);
const out = path.resolve(__dirname, '../../shots/production');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await launch();
  try {
    for (const [mode, viewport] of [
      ['gl', { width: 960, height: 600 }],
      ['2d', { width: 390, height: 844 }]
    ]) {
      const { ctx, page, errs, step } = await openGame(browser, origin + '/', { mode, viewport });
      try {
        const state = await page.evaluate(() => {
          if (typeof MEADOW_MAP === 'undefined' || typeof flora === 'undefined')
            return { startupFailed: true };
          return {
            map: MEADOW_MAP.ruins?.map(r => [r[0], r[2], r[3], r[4]]),
            floraCount: MEADOW_MAP.flora?.length,
            fires: MEADOW_MAP.fires?.length,
            runtimeRuins: ruins.map(r => r.id),
            tentCount: flora.filter(f => f.v.type === 'tent').length,
            fenceCount: flora.filter(f => f.v.type === 'fence').length,
            grassContact: (() => {
              let live = 0, shaded = 0;
              for (let i = 0; i < campGround.length; i++) {
                if (campGround[i] > 0.1 && kind[i] === 1) live++;
                if (campGround[i] > 0.1 && bshade[i] > 0.07) shaded++;
              }
              return [live, shaded];
            })(),
            gl: GL.ok,
            player: [player.x, player.y]
          };
        });
        assert(!state.startupFailed, 'Production did not load the game globals');
        assert.equal(state.floraCount, 960, 'Production loaded an old authored map');
        assert.equal(state.fires, 7, 'Production must include the seventh authored fire');
        assert.deepEqual(state.map, [
          ['broken-gate', 47.3, -772.6, 2.998],
          ['abbey-front', -301.4, -946.9, 2.5398],
          ['cloister-walk', -27.8, -1284.1, .43]
        ], 'Production must contain the relocated/rotated ruins');
        assert.equal(state.runtimeRuins.length, 3, 'The scene must rebuild all three ruins');
        assert(state.tentCount > 0 && state.fenceCount > 0, 'Live camp is missing');
        assert(state.grassContact[0] > 5 && state.grassContact[1] > 5,
          'No living shaded grass around tent/fence contacts');
        assert.equal(state.gl, mode === 'gl', 'Wrong renderer on production');
        await step(6);

        // Center the camera on actual authored objects, not test-only fixtures.
        for (const [type, label] of [['tent', 'camp'], ['fence', 'fence']]) {
          const item = await page.evaluate(type => {
            const f = flora.find(o => o.v.type === type);
            if (!f) return null;
            // Do not move the authored map: only place the camera for a screenshot.
            player.x = f.x + 8; player.y = f.y + 8;
            updateCamera(0, true);
            render();
            return {x: f.x, y: f.y};
          }, type);
          assert(item, 'Missing '+type+' after starting production');
          await step(2);
          await page.screenshot({ path: path.join(out, mode + '-' + label + '.png') });
        }
        await page.evaluate(() => {
          const r = ruins[0];
          player.x = r.cx / CW + 6; player.y = r.cy / CH + 12;
          updateCamera(0, true);
          render();
        });
        await step(2);
        await page.screenshot({ path: path.join(out, mode + '-ruins.png') });

        const requests = await page.evaluate(() => performance.getEntriesByType('resource')
          .map(e => e.name).filter(s => /\/src\/(?:data\/map|world\/(?:camp|grass)|renderer\/render)\.js/.test(s)));
        for (const asset of ['data/map', 'world/grass', 'world/camp', 'renderer/render']) {
          assert(requests.some(s => s.includes('/src/' + asset + '.js?v=')),
            'Production page fetched stale/unversioned '+asset+'.js: '+JSON.stringify(requests));
          if (rev) assert(requests.some(s => s.includes('/src/' + asset + '.js?v=' + rev)),
            'Runtime bundle revision does not match Git SHA '+rev+': '+asset);
        }
        assert.deepEqual(realErrors(errs), [], 'Actual production browser errors');
        console.log('PASS production '+mode+' '+viewport.width+'x'+viewport.height+
          ': authored map, 3 moved ruins, 7 fires, live tents/fences, responsive grass; '+
          'saved screenshots, rev '+rev);
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
