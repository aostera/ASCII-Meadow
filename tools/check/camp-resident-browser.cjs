// Production contract: exactly one persistent stationary villager in the tent camp.
// Unlike migration/creation tests this uses the real shipped map and real game start.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launch, openGame, realErrors } = require('./common.cjs');

(async () => {
  const mapText = fs.readFileSync(path.resolve(__dirname, '../../src/data/map.js'), 'utf8');
  const campFire = JSON.parse(mapText.slice(mapText.indexOf('const MEADOW_MAP =') +
    'const MEADOW_MAP ='.length).trim().replace(/;$/, '')).fires.find(f => f[3] === 'cook' &&
      f[0] < -300 && f[1] < -1800);
  assert(campFire, 'the established campfire should exist in the authored map');
  const [cx, cz] = [-356.4, -1916];
  assert(Math.hypot(cx - campFire[0], cz - campFire[1]) < 45,
    'the resident must be beside the established campfire');
  const browser = await launch();
  try {
    for (const mode of ['gl', '2d']) {
      const { page, ctx, step, errs } = await openGame(browser,
        'file://' + path.resolve(__dirname, '../../index.html'),
        { mode, viewport: { width: 960, height: 600 } });
      try {
        await step(4);
        const resident = await page.evaluate(() => {
          const villager = npcs.find(n => n.actorId === 'camp-villager');
          return { count: npcs.length, id: villager?.actorId, type: villager?.actorType,
            behavior: villager?.behavior, world: villager ? toModelXZ(villager.x, villager.y) : null,
            originalMapVersion: MEADOW_MAP.v, mappedNPCs: MEADOW_MAP.actors ?? null };
        });
        assert.equal(resident.count, 1, 'one NPC in production, no hermit on the map');
        assert.equal(resident.id, 'camp-villager');
        assert.equal(resident.type, 'villager');
        assert.equal(resident.behavior, 'idle');
        assert.equal(resident.originalMapVersion, 1);
        assert.equal(resident.mappedNPCs, null);
        assert(Math.abs(resident.world[0] - cx) < 0.15 &&
          Math.abs(resident.world[1] - cz) < 0.15, 'camp NPC must spawn at authored location');
        await step(180);
        const rested = await page.evaluate(() => {
          const villager = npcs[0];
          return { count: npcs.length, world: toModelXZ(villager.x, villager.y),
            moving: villager.moving, type: villager.actorType };
        });
        assert.equal(rested.count, 1);
        assert(!rested.moving && rested.type === 'villager');
        for (let i = 0; i < 2; i++)
          assert(Math.abs(rested.world[i] - resident.world[i]) < 0.15,
            'camp resident must not wander away');
        await page.setViewportSize({ width: 800, height: 520 });
        await step(5);
        const resized = await page.evaluate(() => ({
          count: npcs.length,
          id: npcs[0].actorId,
          world: toModelXZ(npcs[0].x, npcs[0].y)
        }));
        assert.equal(resized.count, 1, 'resize must not duplicate the resident');
        assert.equal(resized.id, 'camp-villager');
        for (let i = 0; i < 2; i++)
          assert(Math.abs(resized.world[i] - resident.world[i]) < 0.15);
        await page.evaluate(() => {
          const villager = npcs[0];
          player.x = villager.x; player.y = villager.y;
          player.hT = 0;
          updateWorld(0);
        });
        await page.keyboard.press('KeyE');
        const interaction = await page.evaluate(() => ({
          count: npcs.length, line: npcs[0].say, state: npcs[0].aiState,
          mapActors: MEADOW_MAP.actors || null
        }));
        assert.equal(interaction.count, 1);
        assert.equal(interaction.line, 'Доброй дороги.');
        assert.equal(interaction.state, 'talk');
        assert.equal(interaction.mapActors, null);
        assert.deepEqual(realErrors(errs), []);
        console.log('PASS '+mode+': one persistent camp villager, idle, no duplicates on resize, E dialogue');
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
