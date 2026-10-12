// Check in production WebGL/Canvas2D that authored NPC sprites match the
// knight's effective visible height on both desktop and phone, and fire collision
// actually stops the engine's move() implementation, not just a standalone helper.
const assert = require('node:assert/strict');
const path = require('node:path');
const { launch, openGame, realErrors } = require('./common.cjs');
const url = 'file://' + path.resolve(__dirname, '../../index.html');
(async () => {
  const browser = await launch();
  try {
    for (const [mode, viewport] of [
      ['gl', { width: 960, height: 600 }],
      ['2d', { width: 960, height: 600 }],
      ['gl', { width: 390, height: 844 }]
    ]) {
      const { page, ctx, errs, step } = await openGame(browser, url, { mode, viewport });
      try {
        await step(4);
        const actual = await page.evaluate(() => {
          const resident = npcs.find(n => n.actorId === 'camp-villager');
          if (!resident) throw Error('missing authored resident');
          const knight = charDims(player), npc = charDims(resident);
          const visible = npc.u * BOX_H;
          const knightHeight = knightPx();
          const atlas = NPC_SHIPPED_ATLASES.find(a => a.type === resident.actorType);
          const frame = atlas.layout;
          const rect = npcAtlasRect({ width: frame.frameWidth, height: frame.frameHeight });
          const geometry = geomOf(resident);
          const sprite = { width: rect.w * npc.u, height: rect.h * npc.u,
            aspect: rect.w / rect.h, x: rect.x, y: rect.y,
            bottom: rect.y + rect.h,
            grounded: Math.abs(geometry.top + geometry.h - geometry.gy) < .001,
            hasOcclusionBounds: geometry.w > 0 && geometry.h > 0 && Number.isFinite(geometry.left) };
          const camp = braziers.find(b => b.ground && b.cook && b.mi === 2);
          if (!camp) throw Error('missing existing camp cooking fire');
          const tests = braziers.map(f => ({
            ground: !!f.ground,
            playerBlocked: fireBlocksMove(f.x, f.y + .7, f,
              { x: f.x + 10, y: f.y + .7, hT: 0, cls: 'knight' }),
            cowBlocked: fireBlocksMove(f.x, f.y + .7, f,
              { x: f.x + 10, y: f.y + .7, hT: 0, cls: 'cow' }),
            npcBlocked: fireBlocksMove(f.x, f.y + .7, f,
              { x: f.x + 10, y: f.y + .7, hT: 0, cls: 'human' })
          }));
          const actor = { x: camp.x + 11, y: camp.y + .7, hT: 0, h: 0,
            walk: 0, step: 0, wd: 0, moving: false, face: 1, dir: 'side', d8: 2 };
          const origin = [actor.x, actor.y];
          move(actor, -1, 0, .7, 24); // intentionally crosses the entire campfire
          const after = [actor.x, actor.y];
          return { npcCount: npcs.length, pitch: [npc.fcw, knight.fcw, npc.fch, knight.fch],
            visible, knightHeight, sprite, tests, origin, after,
            map: [MEADOW_MAP.v, MEADOW_MAP.actors || null] };
        });
        assert.equal(actual.npcCount, 1);
        assert.equal(actual.map[0], 1); assert.equal(actual.map[1], null);
        assert(Math.abs(actual.visible / actual.knightHeight - .72) < .001,
          'Even the FULL NPC frame must be 72% of knight silhouette height');
        assert(Math.abs(actual.sprite.aspect - 40 / 56) < .000001,
          'NPC sprites must preserve original portrait proportions, not stretch to 120x106');
        assert(actual.sprite.width < actual.sprite.height * .75 &&
          actual.sprite.width > actual.sprite.height * .7,
          'resident image should have a knight-proportioned width');
        assert(actual.sprite.grounded && actual.sprite.hasOcclusionBounds,
          'NPC geometry must match its actual feet and have non-empty depth bounds');
        assert(Math.abs(actual.sprite.bottom - 106) < .000001 &&
          Math.abs(actual.sprite.height - actual.knightHeight * .72) < .001,
          'full portrait frame remains below knight height even with tall hats');
        assert(Math.abs(actual.pitch[0] - actual.pitch[1]) < .00001 &&
          Math.abs(actual.pitch[2] - actual.pitch[3]) < .00001,
          'NPC and knight must have identical ASCII glyph pitch');
        assert(actual.tests.length >= 4 && actual.tests.some(t => !t.ground));
        assert(actual.tests.every(t => t.playerBlocked && t.cowBlocked && t.npcBlocked),
          'every flame and brazier must block all walkers');
        assert.deepEqual(actual.after, actual.origin,
          'real move() may not walk/slide across the campfire with a long simulation step');
        assert.deepEqual(realErrors(errs), [], 'console errors after NPC scale/fire update');
        console.log('PASS '+mode+' '+viewport.width+'x'+viewport.height+
          ': knight-sized resident, all fires solid, no tunneling');
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
