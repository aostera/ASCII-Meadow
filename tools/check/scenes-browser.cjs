// Browser isolation in both renderers; no scene switches or visual changes.
const assert = require('node:assert/strict');
const path = require('node:path');
const { launch, openGame, realErrors } = require('./common.cjs');
const url = 'file://' + path.resolve(__dirname, '../../index.html') + '?edit';
(async () => {
  const browser = await launch();
  try {
    for (const mode of ['gl', '2d']) {
      const { ctx, page, step, errs } = await openGame(browser, url, {
        mode, viewport: { width: 960, height: 600 }
      });
      try {
        await step(3);
        const before = await page.evaluate(() => ({
          map: mapFileText(), npcs: npcs.map(n => n.actorId),
          generation: worldGen, scenes: SCENE_REGISTRY.ids(),
          route: SCENE_REGISTRY.resolve('meadow', 'castle-gate')
        }));
        assert.deepEqual(before.scenes, ['meadow']);
        assert.equal(before.route, null);
        const registry = await page.evaluate(() => {
          SCENE_REGISTRY.register({ id: 'qa-interior', kind: 'interior', entries: { door: [1, 2] } });
          return {
            ids: SCENE_REGISTRY.ids(),
            frozen: Object.isFrozen(SCENE_REGISTRY.get('qa-interior').entries.door),
            unknown: SCENE_REGISTRY.resolve('meadow', 'door')
          };
        });
        assert.deepEqual(registry.ids, ['meadow', 'qa-interior']);
        assert(registry.frozen);
        assert.equal(registry.unknown, null);
        await page.setViewportSize({ width: 800, height: 520 });
        await step(3);
        const after = await page.evaluate(() => ({
          map: mapFileText(), npcs: npcs.map(n => n.actorId),
          generation: worldGen, scenes: SCENE_REGISTRY.ids()
        }));
        assert.equal(after.map, before.map);
        assert.deepEqual(after.npcs, before.npcs);
        assert(after.generation > before.generation);
        assert.deepEqual(after.scenes, ['meadow', 'qa-interior']);
        assert.deepEqual(realErrors(errs), []);
        console.log('PASS scene registry ' + mode + ': map/NPC isolation and resize');
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
