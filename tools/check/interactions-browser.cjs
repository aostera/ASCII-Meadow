// Real browser QA for interaction E, distance/condition checks, NPC dialogue,
// stale targets and the existing gate response in both rendering paths.
const path = require('node:path');
const assert = require('node:assert/strict');
const { launch, openGame, realErrors } = require('./common.cjs');
const url = 'file://' + path.resolve(__dirname, '../../index.html');

(async () => {
  const browser = await launch();
  try {
    for (const mode of ['gl', '2d']) {
      const { ctx, page, step, errs } = await openGame(browser, url, { mode, viewport: { width: 960, height: 600 } });
      try {
        await step(3);
        const intro = await page.evaluate(() => {
          if (npcs.length !== 1 || npcs[0].actorId !== 'camp-villager')
            throw Error('expected the single stationary camp resident');
          const [x, z] = toModelXZ(player.x + 1, player.y);
          const npc = spawnActor('villager', { id: 'qa-dialogue', world: [x, z],
            behavior: 'idle', lines: ['Первая реплика', 'Вторая реплика'] });
          updateWorld(0);
          return { action: activeSpot?.action, id: activeSpot?.targetId, text: npc.say };
        });
        assert.equal(intro.action, 'talk');
        assert.equal(intro.id, 'qa-dialogue');
        // Verify the user's real physical E key, not only the internal dispatcher.
        await page.keyboard.press('KeyE');
        const first = await page.evaluate(() => {
          const npc = npcs.find(n => n.actorId === 'qa-dialogue');
          return { line: npc.say, index: npc.dialogIndex, state: npc.aiState, text: activeSpot?.label };
        });
        assert.equal(first.line, 'Первая реплика');
        assert.equal(first.index, 1);
        assert.equal(first.state, 'talk');
        assert(first.text.includes('Странник'));
        await page.keyboard.press('KeyE');
        const second = await page.evaluate(() => {
          const npc = npcs.find(n => n.actorId === 'qa-dialogue');
          return { line: npc.say, index: npc.dialogIndex };
        });
        assert.equal(second.line, 'Вторая реплика');
        assert.equal(second.index, 2);
        const far = await page.evaluate(() => {
          const old = activeSpot;
          npcs.find(n => n.actorId === 'qa-dialogue').x += 100;
          return performInteraction(old);
        });
        assert.equal(far, false, 'cannot talk to actor after it moves out of range');
        const removed = await page.evaluate(() => {
          const old = activeSpot;
          despawnActor('qa-dialogue');
          return { used: performInteraction(old), n: npcs.length, ents: ents.length };
        });
        assert.equal(removed.used, false);
        assert.equal(removed.n, 1);
        assert.equal(removed.ents, 5); // player, three cows and the camp resident
        const gate = await page.evaluate(() => {
          const spot = props[0].spots[0];
          player.x = spot.x; player.y = spot.y;
          player.hT = 0;
          const before = performInteraction(spot);
          player.hT = 120;
          updateWorld(0);
          const selected = activeSpot === spot;
          const used = useSpot();
          return { before, selected, used, label: spot.label, line: player.say };
        });
        assert.equal(gate.before, false);
        assert.equal(gate.selected, true);
        assert.equal(gate.used, true);
        assert.equal(gate.label, 'push the great gate');
        assert.equal(gate.line, 'the gate is sealed. something stirs within.');
        assert.deepEqual(realErrors(errs), []);
        console.log('PASS interaction system ' + mode + ': keyboard E, dialogue order, range, despawn and sealed gate');
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
