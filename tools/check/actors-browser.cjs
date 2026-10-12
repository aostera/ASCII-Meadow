// End-to-end actor catalog smoke test in the actual running browser engine.
// Covers existing rig, render queue, NPC update, viewport rebuild and Canvas2D fallback.
const assert = require('node:assert/strict');
const path = require('node:path');
const { launch, openGame, realErrors } = require('./common.cjs');

(async () => {
  const browser = await launch();
  try {
    for (const mode of ['gl', '2d']) {
      const { page, ctx, step, errs } = await openGame(browser,
        'file://' + path.resolve(__dirname, '../../index.html') + '?edit', { mode, viewport: { width: 960, height: 600 } });
      try {
        await step(3);
        const created = await page.evaluate(() => {
          if (npcs.length) throw new Error('catalog spawned an NPC by default');
          const [wx, wz] = toModelXZ(player.x + 13, player.y);
          const a = spawnActor('villager', { id: 'qa-actor-a', world: [wx, wz], behavior: 'idle' });
          const b = spawnActor('hermit', { id: 'qa-actor-b', world: [wx + 15, wz + 15], behavior: 'idle', lines: ['Проверка NPC'] });
          if (b.rigMotion.walk.stride !== 0.8 || b.rigMotion.idle.breath !== 0.65) throw new Error('NPC motion profile lost');
          return { count: npcs.length, entCount: ents.length, types: [a.actorType, b.actorType], model: toModelXZ(a.x, a.y) };
        });
        assert.equal(created.count, 2);
        assert.equal(created.entCount, 6); // player + 3 cows + 2 NPCs
        assert.deepEqual(created.types, ['villager', 'hermit']);
        await step(12); // NPCs are really simulated and rendered in the same depth queue as the knight
        const before = await page.evaluate(() => {
          const world = snapshotActorWorld();
          return { world, states: npcs.map(n => n.aiState), indices: npcs.map(n => ents.includes(n)), frame: worldGen };
        });
        assert.deepEqual(before.indices, [true, true]);
        assert(before.states.every(s => s === 'idle' || s === 'talk'));
        await page.setViewportSize({ width: 800, height: 520 });
        await step(3); // build() reprojects the entity grid
        const resized = await page.evaluate(() => ({ world: snapshotActorWorld(), frame: worldGen }));
        assert(resized.frame > before.frame);
        for (let i = 0; i < before.world.length; i++) {
          assert.equal(resized.world[i][0], before.world[i][0]);
          for (let j = 1; j <= 2; j++) for (let k = 0; k < 2; k++)
            assert(Math.abs(resized.world[i][j][k] - before.world[i][j][k]) < 0.05, 'NPC moved in world units during resize');
        }
        const cleanup = await page.evaluate(() => ({
          first: despawnActor('qa-actor-a'), second: despawnActor('qa-actor-b'),
          npcs: npcs.length, onlyPlayerAndCows: ents.length === 4
        }));
        assert.equal(cleanup.first, true);
        assert.equal(cleanup.second, true);
        assert.equal(cleanup.npcs, 0);
        assert.equal(cleanup.onlyPlayerAndCows, true);
        const preview = await page.evaluate(() => {
          const original = JSON.stringify(MEADOW_MAP);
          openEditor();
          ED.tool = 'npc';
          edSyncUI();
          const visible = !ED.ui.npcCanvas.hidden;
          const canvas = ED.ui.npcCanvas.getContext('2d');
          const pixels = canvas.getImageData(0, 0, 180, 180).data;
          const painted = pixels.some((value, index) => index % 4 === 3 && value > 0);
          const fingerprint = () => {
            const bytes = canvas.getImageData(0, 0, 180, 180).data;
            let h = 2166136261;
            for (const n of bytes) { h ^= n; h = Math.imul(h, 16777619); }
            return h >>> 0;
          };
          const mainRig = [rig.width, rig.height];
          const baseline = fingerprint();
          edPreviewNpc();
          const repeatable = baseline === fingerprint();
          const variants = [baseline];
          ED.previewState = 'walk'; edSyncUI();
          ED.ui.npcPhase.value = '157';
          ED.ui.npcPhase.dispatchEvent(new Event('input', { bubbles: true }));
          variants.push(fingerprint());
          ED.ui.npcPhase.value = '314';
          ED.ui.npcPhase.dispatchEvent(new Event('input', { bubbles: true }));
          variants.push(fingerprint());
          ED.previewState = 'idle'; ED.variant.npc = 1; edSyncUI();
          variants.push(fingerprint());
          ED.variant.npc = 0; edSyncUI();
          const distinctFrames = new Set(variants).size >= 3;
          const isolatedRig = rig.width === mainRig[0] && rig.height === mainRig[1];
          const accessibleLabel = ED.ui.npcCanvas.getAttribute('aria-label') === 'ASCII-предпросмотр NPC';
          const states = [];
          for (const state of ['idle', 'walk', 'talk']) {
            ED.previewState = state;
            edSyncUI();
            states.push(ED.previewState);
          }
          ED.previewState = 'walk'; edSyncUI();
          const sliderVisible = !ED.ui.npcPhase.hidden;
          ED.ui.npcPhase.value = '314';
          ED.ui.npcPhase.dispatchEvent(new Event('input', { bubbles: true }));
          const phaseApplied = Math.abs(ED.previewPhase - 3.14) < 0.001;
          ED.previewState = 'idle'; edSyncUI();
          const sliderHidden = ED.ui.npcPhase.hidden;
          const selectedButton = ED.ui.npcStates.querySelector('[data-preview="idle"]');
          const accessible = selectedButton.getAttribute('aria-pressed') === 'true';
          const unchanged = original === JSON.stringify(MEADOW_MAP) && npcs.length === 0;
          closeEditor();
          return { visible, painted, states, unchanged, sliderVisible, sliderHidden, phaseApplied, accessible, repeatable, distinctFrames, isolatedRig, accessibleLabel };
        });
        assert(preview.visible && preview.painted && preview.unchanged);
        assert(preview.repeatable && preview.distinctFrames && preview.isolatedRig && preview.accessibleLabel, 'NPC ASCII preview should be distinct, reproducible and isolated');
        assert(preview.sliderVisible && preview.sliderHidden && preview.phaseApplied && preview.accessible);
        assert.deepEqual(preview.states, ['idle', 'walk', 'talk']);
        await step(3);
        assert.deepEqual(realErrors(errs), [], 'browser console: ' + realErrors(errs).slice(0,3).join('; '));
        console.log('PASS actor catalog ' + mode + ': create, simulate, render, resize and remove');
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
