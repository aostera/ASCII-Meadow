// Real browser atlas import: synthetic PNG only lives inside test, not in the repository.
// Exercises the editor file input, validation, two renderers, optional runtime sprite path,
// frame selection and the untouched original map export.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { launch, openGame, realErrors } = require('./common.cjs');

(async () => {
  const browser = await launch();
  const gallery = path.resolve(__dirname, '../../shots/npc-preview');
  fs.mkdirSync(gallery, { recursive: true });
  try {
    for (const mode of ['gl', '2d']) {
      const { ctx, page, step, errs } = await openGame(browser,
        'file://' + path.resolve(__dirname, '../../index.html') + '?edit',
        { mode, viewport: { width: 960, height: 600 } });
      try {
        await step(3);
        const original = await page.evaluate(() => mapFileText());
        await page.evaluate(() => {
          openEditor(); ED.tool = 'npc'; ED.previewAuto = false;
          ED.previewState = 'walk'; ED.previewPhase = Math.PI / 2;
          ED.variant.npc = 0; edSyncUI();
        });
        await page.screenshot({ path: path.join(gallery, mode + '-villager-procedural.png') });
        await page.evaluate(() => { ED.variant.npc = 1; edSyncUI(); });
        await page.screenshot({ path: path.join(gallery, mode + '-hermit-procedural.png') });
        await page.evaluate(() => { ED.variant.npc = 0; edSyncUI(); });
        await page.evaluate(() => {
          const atlas = document.createElement('canvas');
          atlas.width = 128; atlas.height = 96;
          const context = atlas.getContext('2d');
          for (let row = 0; row < 3; row++) for (let column = 0; column < 4; column++) {
            const x = column * 32, y = row * 32;
            context.fillStyle = 'rgb(' + (60 + column * 40 + row * 10) + ',' +
              (60 + column * 40 + row * 10) + ',' + (60 + column * 40 + row * 10) + ')';
            context.fillRect(x + 4, y + 4, 24, 24);
            context.clearRect(x + 4 + column, y + 7 + row, 3, 7);
          }
          const png = atlas.toDataURL('image/png').split(',')[1];
          const bytes = Uint8Array.from(atob(png), c => c.charCodeAt(0));
          const file = new File([bytes], 'test-villager.png', { type: 'image/png' });
          openEditor(); ED.tool = 'npc'; ED.variant.npc = 0; ED.previewAuto = false; edSyncUI();
          ED.ui.atlasW.value = '32'; ED.ui.atlasH.value = '32';
          const transfer = new DataTransfer(); transfer.items.add(file);
          ED.ui.atlasFile.files = transfer.files;
          ED.ui.atlasFile.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await page.waitForFunction(() => NPC_ATLASES.get('villager')?.status === 'ready');
        const result = await page.evaluate(() => {
          const item = NPC_ATLASES.get('villager');
          const f = npcAtlasFrame({ actorType: 'villager', actorAnimTime: .35, d8: 0 }, 'walk');
          const hashPreview = () => {
            const data = ED.ui.npcCanvas.getContext('2d', { willReadFrequently: true })
              .getImageData(0, 0, 180, 180).data;
            let h = 2166136261;
            for (const value of data) { h ^= value; h = Math.imul(h, 16777619); }
            return h >>> 0;
          };
          ED.previewState = 'idle'; ED.previewPhase = 0; edSyncUI();
          // Warm the glyph rasterizer: Chromium's first paint may differ.
          edPreviewNpc();
          const idle = hashPreview();
          ED.previewState = 'walk'; ED.previewPhase = Math.PI / 2; edSyncUI();
          edPreviewNpc();
          const walking = hashPreview();
          const [wx, wz] = toModelXZ(player.x + 8, player.y + 2);
          const n = spawnActor('villager', { id: 'test-atlas-npc', world: [wx, wz], behavior: 'idle' });
          return { status: item.status, frame: f.frame, x: f.x, y: f.y,
            imported: ED.ui.status.textContent.includes('загружен'),
            idle, walking, runtimeAttached: ents.includes(n) && n.actorType === 'villager',
            map: mapFileText(), marker: ED.ui.npcLibrary.textContent.includes('PNG: ready') };
        });
        assert.equal(result.status, 'ready');
        assert.equal(result.frame, 3);
        assert.equal(result.x, 96);
        assert.equal(result.y, 32);
        assert(result.imported && result.runtimeAttached && result.marker,
          'the uploaded atlas must enter both the editor and runtime NPC path');
        assert.notEqual(result.idle, result.walking, 'sprite state/frame changes ASCII preview');
        assert.equal(result.map, original, 'preview imports never rewrite map.js');
        await step(10); // the actual world renderer draws the new atlas-backed actor
        await page.screenshot({ path: path.join(gallery, mode + '-synthetic-png.png') });
        await page.evaluate(() => { ED.variant.npc = 1; ED.previewState = 'idle'; edSyncUI(); });
        await page.screenshot({ path: path.join(gallery, mode + '-hermit-fallback.png') });
        const cleanup = await page.evaluate(() => {
          const removed = despawnActor('test-atlas-npc');
          closeEditor();
          return { removed, map: mapFileText(), remaining: npcs.length };
        });
        assert(cleanup.removed && cleanup.remaining === 0);
        assert.equal(cleanup.map, original);
        assert.deepEqual(realErrors(errs), [], 'browser errors: ' + realErrors(errs).join('; '));
        console.log('PASS NPC atlas upload, preview, runtime render and map isolation: ' + mode);
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
