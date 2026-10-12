// End-to-end v1→v2 NPC map editing, undo, export/import and responsive placement.
// The committed designer map remains v1 and is never rewritten by this test.
const path = require('node:path');
const assert = require('node:assert/strict');
const { launch, openGame, realErrors } = require('./common.cjs');
const url = 'file://' + path.resolve(__dirname, '../../index.html');
const views = [{ width: 960, height: 600 }, { width: 390, height: 844 }];
const ok = (value, detail) => assert(value, detail);
(async () => {
  const browser = await launch();
  try {
    for (const viewport of views) {
      const original = await openGame(browser, url, { viewport });
      await original.step(5);
      const before = await original.page.evaluate(() => ({
        v: MEADOW_MAP.v, mapActors: MEADOW_MAP.actors || null, loaded: npcs.filter(a => a.fromMap).length,
        exported: mapFileText(), widget: !!document.querySelector('[data-tool="npc"]')
      }));
      assert.equal(before.v, 1, 'original map should stay version 1');
      assert.equal(before.mapActors, null);
      assert.equal(before.loaded, 0);
      ok(!before.exported.includes('"actors"'), 'v1 export must not be rewritten as v2');
      ok(before.widget, 'map editor must have NPC placement tool');

      // Preview is read-only, including across export/import and viewport sizes.
      const previewIsolation = await original.page.evaluate(() => {
        const before = mapFileText();
        openEditor();
        ED.tool = 'npc'; ED.variant.npc = 1;
        ED.previewState = 'walk'; ED.previewPhase = 3.14;
        edSyncUI();
        const previewed = !ED.ui.npcCanvas.hidden;
        const after = mapFileText();
        closeEditor();
        return { previewed, identical: before === after, actors: npcs.filter(n => n.fromMap).length };
      });
      ok(previewIsolation.previewed && previewIsolation.identical && previewIsolation.actors === 0,
        'preview must not alter v1 export or place actors');

      const editing = await original.page.evaluate(() => {
        openEditor();
        const [x, z] = toModelXZ(player.x + 5, player.y + 3);
        edPlace('npc', x, z);
        const a = MEADOW_MAP.actors[0];
        if (!a) throw Error('NPC placement did not create actor entry');
        const placed = { map: a.slice(), npcs: npcs.filter(n => n.fromMap).length, v: MEADOW_MAP.v };
        ED.sel = { kind: 'actors', mi: 0 };
        edMoveSelected(x + 12, z - 22);
        const moved = { map: MEADOW_MAP.actors[0].slice(), npcs: npcs.filter(n => n.fromMap).length };
        edUndo();
        const undo = MEADOW_MAP.actors[0].slice();
        edRedo();
        const redo = MEADOW_MAP.actors[0].slice();
        const source = mapFileText();
        const parsed = parseMapText(source);
        const positions = npcs.filter(n => n.fromMap).map(n => toModelXZ(n.x, n.y));
        return { placed, moved, undo, redo, source, parsed, positions, selectedUI: !!document.querySelector('[data-tool=npc]') };
      });
      assert.equal(editing.placed.v, 2);
      assert.equal(editing.placed.npcs, 1);
      assert.equal(editing.moved.npcs, 1);
      assert.deepEqual(editing.undo, editing.placed.map, 'undo restores original NPC position');
      assert.deepEqual(editing.redo, editing.moved.map, 'redo restores moved NPC position');
      // The editing overlay draws highlighted NPC markers and labels every frame.
      // World NPCs must not wander away from their authored positions while editing.
      // Undo/Redo intentionally clears the current selection. Select the NPC
      // again to exercise the actual selected-label render path.
      await original.page.evaluate(() => { ED.sel = { kind: 'actors', mi: 0 }; edSyncUI(); });
      await original.step(220);
      const stable = await original.page.evaluate(() => {
        const n = npcs.find(a => a.fromMap && a.mi === 0), m = MEADOW_MAP.actors[0];
        return { error: !n, world: n ? toModelXZ(n.x, n.y) : null, entry: m.slice(),
          editing, selected: ED.sel?.kind };
      });
      assert.equal(stable.error, false, 'editor NPC remains in runtime');
      assert.equal(stable.editing, true);
      assert.equal(stable.selected, 'actors');
      for (let k = 0; k < 2; k++)
        ok(Math.abs(stable.world[k] - stable.entry[k + 2]) < 0.05,
          'NPC drifted from edited position while editor stayed open');
      assert.equal(editing.parsed.v, 2);
      assert.deepEqual(editing.parsed.actors, [editing.moved.map]);
      ok(editing.source.includes('"actors"'), 'v2 export contains NPC array');
      ok(editing.selectedUI, 'NPC tool available');
      ok(Math.abs(editing.positions[0][0] - editing.moved.map[2]) < 0.05);
      ok(Math.abs(editing.positions[0][1] - editing.moved.map[3]) < 0.05);
      assert.deepEqual(realErrors(original.errs), []);

      const replay = await openGame(browser, url, { viewport, files: { 'src/data/map\\.js$': editing.source } });
      await replay.step(5);
      const restored = await replay.page.evaluate(() => ({
        version: MEADOW_MAP.v,
        maps: MEADOW_MAP.actors,
        runtime: npcs.filter(n => n.fromMap).map(a => ({
          id: a.actorId, type: a.actorType, map: toModelXZ(a.x, a.y), index: a.mi
        }))
      }));
      assert.equal(restored.version, 2);
      assert.deepEqual(restored.maps, [editing.moved.map]);
      assert.equal(restored.runtime.length, 1);
      assert.equal(restored.runtime[0].id, editing.moved.map[0]);
      assert.equal(restored.runtime[0].type, editing.moved.map[1]);
      assert.equal(restored.runtime[0].index, 0);
      for (let n = 0; n < 2; n++)
        ok(Math.abs(restored.runtime[0].map[n] - editing.moved.map[n + 2]) < 0.05, 'NPC drift after map re-import');

      // Remove NPC via editor and restore a v1 map. No invisible NPC may survive.
      const cleaned = await replay.page.evaluate(() => {
        openEditor();
        ED.sel = { kind: 'actors', mi: 0 };
        edDeleteSelected();
        const deleted = { n: npcs.filter(a => a.fromMap).length, saved: parseMapText(mapFileText()).actors.length };
        const prior = parseMapText(mapFileText());
        delete prior.actors; prior.v = 1;
        applyWholeMap(prior);
        return { deleted, v: MEADOW_MAP.v, npcs: npcs.filter(a => a.fromMap).length };
      });
      assert.deepEqual(cleaned.deleted, { n: 0, saved: 0 });
      assert.deepEqual({ v: cleaned.v, npcs: cleaned.npcs }, { v: 1, npcs: 0 });
      assert.deepEqual(realErrors(replay.errs), []);
      await original.ctx.close(); await replay.ctx.close();
      console.log('PASS v1/v2 NPC editor export, undo/redo, move, delete and reload ' + viewport.width + 'x' + viewport.height);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
