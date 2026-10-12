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
        const shipped = await page.evaluate(() => ({
          status: NPC_ATLASES.get('villager')?.status,
          src: NPC_ATLASES.get('villager')?.source,
          ready: NPC_ATLASES.get('villager')?.image.naturalWidth,
          rows: NPC_ATLASES.get('villager')?.layout.states.walk.rows.length,
          frames: NPC_ATLASES.get('villager')?.layout.states.walk.frames,
          loadedTypes: NPC_SHIPPED_ATLASES.map(a => a.type),
          map: mapFileText()
        }));
        assert.equal(shipped.status, 'error',
          'file:// cross-origin sprite pixels should be rejected safely and the rig should be used');
        assert.equal(shipped.ready, 480);
        assert.equal(shipped.src, 'assets/npc/villager-starter.png');
        assert.equal(shipped.rows, 8);
        assert.equal(shipped.frames, 12);
        assert.deepEqual(shipped.loadedTypes, ['villager']);
        assert.equal(shipped.map, original);
        await page.evaluate(() => {
          openEditor(); ED.tool = 'npc'; ED.previewAuto = false;
          ED.previewState = 'walk'; ED.previewPhase = Math.PI / 2;
          ED.variant.npc = 0; edSyncUI();
        });
        const catalog = await page.evaluate(() => {
          const source = mapFileText(), originalActors = npcs.length;
          const toggle = ED.ui.npcGalleryToggle;
          toggle.click();
          const sheet = ED.ui.npcGallery;
          const thumbnails = [...sheet.querySelectorAll('.ed-gallery-frame')];
          const cards = [...sheet.querySelectorAll('.ed-gallery-card')];
          const hasCaveat = sheet.textContent.includes('не подменяется поворотами');
          const initial = { open: ED.galleryOpen, expanded: toggle.getAttribute('aria-expanded'),
            cards: cards.length, thumbs: thumbnails.length,
            directions: sheet.querySelectorAll('.ed-gallery-direction').length,
            names: cards.map(c => c.querySelector('.ed-gallery-heading').textContent),
            hasCaveat };
          sheet.querySelector('[data-gallery-type="hermit"][data-gallery-state="talk"][data-gallery-frame="6"]').click();
          const selected = { type: ED.variant.npc, state: ED.previewState, paused: !ED.previewAuto,
            frame: npcAtlasFrameIndex(8, ED.previewPhase), tool: ED.tool,
            mapUnchanged: mapFileText() === source, actorsUnchanged: npcs.length === originalActors };
          toggle.click();
          return { initial, selected, closed: !ED.galleryOpen && sheet.hidden };
        });
        assert(catalog.initial.open && catalog.initial.expanded === 'true');
        assert.equal(catalog.initial.cards, 6);
        assert.equal(catalog.initial.thumbs, 24);
        assert.equal(catalog.initial.directions, 0, 'file:// safely uses a procedural fallback');
        assert(catalog.initial.hasCaveat && catalog.initial.names.some(n => n.includes('Отшельник')));
        assert.deepEqual(catalog.selected, { type: 1, state: 'talk', paused: true,
          frame: 6, tool: 'npc', mapUnchanged: true, actorsUnchanged: true });
        assert(catalog.closed, 'animation library should collapse without touching the map');
        const fallbackGallery = await page.evaluate(() => {
          ED.variant.npc = 1; ED.previewState = 'walk'; ED.previewDirection = 0; edSyncUI();
          ED.ui.npcGalleryToggle.click();
          const result = { dirs: ED.ui.npcGallery.querySelectorAll('.ed-gallery-direction').length,
            hasCaveat: ED.ui.npcGallery.textContent.includes('не подменяется поворотами'),
            procedurallyRendered: !NPC_ATLASES.has('hermit') };
          ED.ui.npcGalleryToggle.click();
          return result;
        });
        assert.deepEqual(fallbackGallery, { dirs: 0, hasCaveat: true, procedurallyRendered: true });
        await page.evaluate(() => { ED.variant.npc = 0; ED.previewState = 'walk'; edSyncUI(); });
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
        // The harness overrides rAF and setTimeout; advance fake time explicitly
        // rather than relying on waitForFunction's browser-side polling clock.
        let status = '';
        for (let i = 0; i < 60; i++) {
          status = await page.evaluate(() => {
            const entry = NPC_ATLASES.get('villager');
            return entry?.source.startsWith('blob:') ? entry.status : 'loading';
          });
          if (status !== 'loading') break;
          await step(1);
          await page.waitForTimeout(50);
        }
        assert.equal(status, 'ready', 'PNG atlas did not load: ' + status);
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
        const settings = await page.evaluate(() => {
          ED.previewState = 'walk'; edSyncUI();
          ED.ui.npcFrames.value = '2';
          ED.ui.npcFps.value = '15';
          ED.ui.npcFps.dispatchEvent(new Event('change', { bubbles: true }));
          const before = npcAtlasExportSettings('villager');
          const tuned = JSON.parse(before);
          const valid = tuned.layout.states.walk.frames === 2 && tuned.layout.states.walk.fps === 15;
          const frame = npcAtlasFrame({ actorType: 'villager', d8: 0, actorAnimTime: .1 }, 'walk');
          ED.ui.npcFrames.value = '99';
          ED.ui.npcFrames.dispatchEvent(new Event('change', { bubbles: true }));
          const rollback = npcAtlasExportSettings('villager') === before &&
            ED.ui.npcFrames.value === '2';
          ED.ui.npcFrames.value = '3';
          ED.ui.npcFrames.dispatchEvent(new Event('change', { bubbles: true }));
          const modified = npcAtlasExportSettings('villager') !== before;
          const file = new File([before], 'villager-animation.json', { type: 'application/json' });
          const dt = new DataTransfer(); dt.items.add(file);
          ED.ui.npcSettingsFile.files = dt.files;
          ED.ui.npcSettingsFile.dispatchEvent(new Event('change', { bubbles: true }));
          return { valid, rollback, modified, frame: frame.frame,
            before, map: mapFileText() };
        });
        assert(settings.valid && settings.rollback && settings.modified);
        assert.equal(settings.frame, 1);
        assert.equal(settings.map, original);
        // File.text() in the editor is asynchronous; yield to Chromium once.
        await page.waitForTimeout(80);
        const restored = await page.evaluate(() => ({
          json: npcAtlasExportSettings('villager'),
          fps: +ED.ui.npcFps.value, frames: +ED.ui.npcFrames.value,
          map: mapFileText(), status: ED.ui.status.textContent
        }));
        assert.equal(restored.json, settings.before);
        assert.equal(restored.fps, 15);
        assert.equal(restored.frames, 2);
        assert.equal(restored.map, original);
        assert(restored.status.includes('восстановлены'), 'JSON import should confirm restoration');
        await step(10); // the actual world renderer draws the new atlas-backed actor
        await page.screenshot({ path: path.join(gallery, mode + '-synthetic-png.png') });
        await page.evaluate(() => { ED.variant.npc = 1; ED.previewState = 'idle'; edSyncUI(); });
        await page.screenshot({ path: path.join(gallery, mode + '-hermit-fallback.png') });
        // Permanent-manifest geometry: verify each authored d8 direction is exposed in
        // the editor; this test PNG is in-memory only (never part of the shipped map).
        await page.evaluate(() => {
          const sheet = document.createElement('canvas');
          sheet.width = 4 * 32; sheet.height = 8 * 32;
          const draw = sheet.getContext('2d');
          for (let d = 0; d < 8; d++) for (let frame = 0; frame < 4; frame++) {
            const x = frame * 32, y = d * 32, tone = 38 + d * 25;
            draw.fillStyle = 'rgb(' + tone + ',' + tone + ',' + tone + ')';
            draw.fillRect(x + 4, y + 3, 24, 26);
            draw.clearRect(x + 6 + d % 6, y + 10, 4, 12);
          }
          // Exercise the real 8-direction upload control, not a direct loader shortcut.
          const data = sheet.toDataURL('image/png').split(',')[1];
          const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
          const asset = new File([bytes], 'eight-direction-fixture.png', { type: 'image/png' });
          ED.variant.npc = 0; ED.sel = null; ED.tool = 'npc'; edSyncUI();
          ED.ui.atlasW.value = '32'; ED.ui.atlasH.value = '32'; ED.ui.atlasEight.checked = true;
          const transfer = new DataTransfer(); transfer.items.add(asset);
          ED.ui.atlasFile.files = transfer.files;
          ED.ui.atlasFile.dispatchEvent(new Event('change', { bubbles: true }));
        });
        let directionalStatus = 'loading';
        for (let i = 0; i < 60; i++) {
          directionalStatus = await page.evaluate(() => {
            const entry = NPC_ATLASES.get('villager');
            // Do not mistake the previous three-row atlas for the replacement:
            // the editor first decodes the uploaded PNG, then attaches a new entry.
            return entry && entry.layout.states.idle.rows.length === 8
              ? entry.status : 'loading';
          });
          if (directionalStatus !== 'loading') break;
          await step(1);
          await page.waitForTimeout(40);
        }
        assert.equal(directionalStatus, 'ready', '8-view NPC fixture failed to load');
        const directions = await page.evaluate(() => {
          ED.variant.npc = 0; ED.sel = null; ED.tool = 'npc'; ED.previewState = 'walk';
          ED.previewPhase = Math.PI / 2; ED.previewAuto = false;
          edSyncUI();
          const source = mapFileText();
          const buttons = [...ED.ui.npcDirections.querySelectorAll('[data-npc-dir]')];
          const captures = [];
          const sample = { actorType: 'villager', actorAnimTime: 0, d8: 0 };
          for (const button of buttons) {
            button.click();
            sample.d8 = Number(button.dataset.npcDir);
            const frame = npcAtlasFrame(sample, 'walk', Math.PI / 2);
            edPreviewNpc(); // warm font-cache before computing visual fingerprint
            const pixels = ED.ui.npcCanvas.getContext('2d', { willReadFrequently: true })
              .getImageData(0, 0, 180, 180).data;
            let h = 2166136261;
            for (const value of pixels) { h ^= value; h = Math.imul(h, 16777619); }
            captures.push({ selected: ED.previewDirection, row: frame.y, hash: h >>> 0,
              pressed: button.getAttribute('aria-pressed') });
          }
          const eightVisible = !ED.ui.npcDirections.hidden;
          ED.variant.npc = 1; edSyncUI(); // hermit has no authored eight-direction PNG
          const proceduralHidden = ED.ui.npcDirections.hidden;
          return { count: buttons.length, captures, eightVisible, proceduralHidden,
            mapUnchanged: source === mapFileText() };
        });
        assert.equal(directions.count, 8);
        assert(directions.eightVisible && directions.proceduralHidden && directions.mapUnchanged);
        assert.deepEqual(directions.captures.map(v => v.row), [0,32,64,96,128,160,192,224]);
        assert.deepEqual(directions.captures.map(v => v.selected), [0,1,2,3,4,5,6,7]);
        assert(directions.captures.every(v => v.pressed === 'true'));
        assert(new Set(directions.captures.map(v => v.hash)).size >= 3,
          'authored directions must display visually distinct glyph previews');
        const multiView = await page.evaluate(() => {
          ED.variant.npc = 0; ED.tool = 'npc'; ED.sel = null;
          ED.previewState = 'walk'; ED.previewDirection = 0;
          ED.previewAuto = false; ED.previewPhase = 0; edSyncUI();
          const source = mapFileText(), actors = npcs.length;
          ED.ui.npcGalleryToggle.click();
          const sheet = ED.ui.npcGallery;
          const before = { groups: sheet.querySelectorAll('.ed-gallery-card').length,
            rows: sheet.querySelectorAll('.ed-gallery-direction').length,
            directionFrames: sheet.querySelectorAll('.ed-gallery-direction .ed-gallery-frame').length };
          const sample = sheet.querySelector('[data-gallery-type="villager"][data-gallery-state="walk"]' +
            '[data-gallery-dir="7"][data-gallery-frame="2"]');
          if (sample) sample.click();
          const selected = { direction: ED.previewDirection, frame: edNpcFrameDetails()?.frame,
            state: ED.previewState, paused: !ED.previewAuto, type: ED.variant.npc,
            mapUnchanged: source === mapFileText(), actorsUnchanged: actors === npcs.length };
          const active = !!sheet.querySelector('[data-gallery-type="villager"][data-gallery-state="walk"]' +
            '[data-gallery-dir="7"][data-gallery-frame="2"][aria-pressed="true"]');
          ED.ui.npcGalleryToggle.click();
          return { before, found: !!sample, selected, active,
            closed: !ED.galleryOpen && sheet.hidden };
        });
        assert.equal(multiView.before.groups, 6);
        assert.equal(multiView.before.rows, 8);
        assert.equal(multiView.before.directionFrames, 16);
        assert(multiView.found && multiView.active && multiView.closed);
        assert.deepEqual(multiView.selected, { direction: 7, frame: 2, state: 'walk',
          paused: true, type: 0, mapUnchanged: true, actorsUnchanged: true });
        await page.evaluate(() => ED.ui.npcGalleryToggle.click());
        await page.screenshot({ path: path.join(gallery, mode + '-animation-gallery-8way.png') });
        await page.evaluate(() => ED.ui.npcGalleryToggle.click());
        const quality = await page.evaluate(() => {
          ED.variant.npc = 0; ED.sel = null; ED.tool = 'npc'; edSyncUI();
          const before = mapFileText();
          ED.ui.root.querySelector('[data-act="npc-atlas-audit"]').click();
          const report = npcAtlasAudit('villager');
          const visible = !ED.ui.atlasAuditResult.hidden;
          const text = ED.ui.atlasAuditResult.textContent;
          ED.variant.npc = 1; edSyncUI();
          const hiddenForOtherType = ED.ui.atlasAuditResult.hidden;
          ED.variant.npc = 0; edSyncUI();
          return { before: before === mapFileText(), report, visible, text, hiddenForOtherType };
        });
        assert(quality.before && quality.visible && quality.hiddenForOtherType,
          'quality audit must be map-read-only and never show another archetype\'s report');
        assert.equal(quality.report.inspected, 32, 'audit should scan every frame in all 8 directions');
        assert.equal(quality.report.errors, 0, 'synthetic all-direction PNG must contain no transparent frames');
        assert(quality.text.includes('32 кадров') && quality.text.includes('0 ошибок'),
          'quality report must show scanned frames and error count');
        const timeline = await page.evaluate(() => {
          ED.variant.npc = 0; ED.sel = null; ED.tool = 'npc'; ED.previewState = 'idle';
          ED.previewPhase = 0; ED.previewAuto = false; edSyncUI();
          const source = mapFileText(), slider = ED.ui.npcFrameSlider;
          const start = { frame: edNpcFrameDetails().frame, label: ED.ui.npcFrameReadout.textContent,
            max: slider.max, state: ED.previewState };
          ED.ui.root.querySelector('[data-act="npc-frame-next"]').click();
          const next = { frame: edNpcFrameDetails().frame, paused: !ED.previewAuto,
            slide: slider.value, pressed: ED.ui.npcPlay.getAttribute('aria-pressed') };
          ED.ui.root.querySelector('[data-act="npc-frame-prev"]').click();
          const previous = edNpcFrameDetails().frame;
          ED.ui.root.querySelector('[data-act="npc-frame-prev"]').click();
          const wrapped = edNpcFrameDetails().frame;
          slider.value = '2'; slider.dispatchEvent(new Event('input', { bubbles: true }));
          const scrub = { frame: edNpcFrameDetails().frame, paused: !ED.previewAuto,
            counter: ED.ui.npcFrameReadout.textContent };
          return { start, next, previous, wrapped, scrub, map: source === mapFileText() };
        });
        assert.equal(timeline.start.frame, 0);
        assert.equal(timeline.start.max, '3');
        assert(timeline.start.label.includes('Кадр 1 из 4') && timeline.start.label.includes('6 FPS'));
        assert.deepEqual(timeline.next, { frame: 1, paused: true, slide: '1', pressed: 'false' });
        assert.equal(timeline.previous, 0);
        assert.equal(timeline.wrapped, 3);
        assert.equal(timeline.scrub.frame, 2);
        assert(timeline.scrub.paused && timeline.scrub.counter.includes('Кадр 3 из 4') && timeline.map);
        for (const state of ['idle', 'walk', 'talk']) {
          await page.evaluate(state => {
            ED.previewState = state; ED.previewPhase = 0; ED.previewClock = 0;
            ED.previewAuto = true; edSyncUI();
          }, state);
          await step(18); // 0.3s at 6 FPS = one frame (even for idle/talk).
          const played = await page.evaluate(() => ({
            frame: edNpcFrameDetails().frame, ui: +ED.ui.npcFrameSlider.value,
            fps: edNpcFrameDetails().row.fps, phase: ED.previewPhase,
            map: mapFileText()
          }));
          assert.equal(played.frame, 1, state + ' must advance at its configured FPS');
          assert.equal(played.ui, played.frame, state + ' must update the timeline');
          assert.equal(played.fps, 6);
          assert.equal(played.map, original);
        }
        await page.evaluate(() => {
          ED.previewAuto = false; ED.previewClock = 0; edSyncUI();
        });
        const pausedFrame = await page.evaluate(() => edNpcFrameDetails().frame);
        await step(25);
        assert.equal(await page.evaluate(() => edNpcFrameDetails().frame),
          pausedFrame, 'manual pause must freeze animated PNG on its chosen frame');
        // Create an intentionally defective 8-way atlas to exercise a genuine
        // report -> exact-frame navigation, not a mocked finding.
        await page.evaluate(() => {
          const sheet = document.createElement('canvas'); sheet.width = 128; sheet.height = 256;
          const ctx = sheet.getContext('2d');
          for (let d = 0; d < 8; d++) for (let f = 0; f < 4; f++) {
            if (d === 7 && f === 2) continue; // missing SE walk frame 3
            ctx.fillStyle = 'rgb(' + (70 + d * 18) + ',' + (70 + f * 18) + ',145)';
            ctx.fillRect(f * 32 + 5, d * 32 + 4, 20, 24);
          }
          npcAtlasAttach('villager', { frameWidth: 32, frameHeight: 32,
            states: { idle: { frames: 4, fps: 6, rows: [0,1,2,3,4,5,6,7] },
              walk: { frames: 4, fps: 6, rows: [0,1,2,3,4,5,6,7] } }
          }, sheet.toDataURL('image/png'));
        });
        let defectiveReady = false;
        for (let k = 0; k < 50; k++) {
          defectiveReady = await page.evaluate(() => NPC_ATLASES.get('villager')?.status === 'ready');
          if (defectiveReady) break;
          await step(1); await page.waitForTimeout(30);
        }
        assert(defectiveReady, 'defective test PNG should be loadable for report QA');
        const inspected = await page.evaluate(() => {
          ED.variant.npc = 0; ED.sel = null; ED.tool = 'npc'; ED.previewAuto = false;
          ED.previewState = 'idle'; ED.previewDirection = 0; edSyncUI();
          const original = mapFileText();
          ED.ui.root.querySelector('[data-act="npc-atlas-audit"]').click();
          const issues = ED.auditReport.findings;
          const target = issues.findIndex(f => f.code === 'blank-frame' &&
            f.state === 'walk' && f.direction === 'SE' && f.frame === 3);
          if (target < 0) throw new Error('Missing injected blank frame finding');
          const action = ED.ui.atlasAuditResult.querySelector('[data-audit-index="' + target + '"]');
          if (!action) throw new Error('Expected clickable QA finding');
          action.click();
          const selected = { state: ED.previewState, direction: ED.previewDirection,
            frame: edNpcFrameDetails()?.frame, paused: !ED.previewAuto };
          const report = JSON.parse(edNpcAuditJSON('villager', ED.auditReport));
          return { selected, report, exported: !!ED.ui.atlasAuditResult.querySelector(
            '[data-act="npc-audit-json-export"]'), unchanged: original === mapFileText() };
        });
        assert.deepEqual(inspected.selected, { state: 'walk', direction: 7, frame: 2, paused: true });
        assert(inspected.unchanged && inspected.exported);
        assert.equal(inspected.report.version, 1);
        assert.equal(inspected.report.type, 'villager');
        assert(inspected.report.errors >= 2);
        assert(inspected.report.findings.some(f => f.code === 'blank-frame' &&
          f.state === 'walk' && f.direction === 'SE' && f.frame === 3));
        assert(!JSON.stringify(inspected.report).includes('data:image/') &&
          !JSON.stringify(inspected.report).includes('blob:'));
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
    // The committed PNG must also work over HTTP. file:// is deliberately not
    // canvas-readable in Chromium and uses procedural fallback; HTTP is same-origin.
    const http = require('node:http');
    const root = path.resolve(__dirname, '../..');
    const server = http.createServer((request, response) => {
      let pathname;
      try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
      catch { response.writeHead(400); response.end(); return; }
      if (pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
      if (!pathname.startsWith('/ASCII-Meadow/')) { response.writeHead(404); response.end(); return; }
      const relative = pathname.slice('/ASCII-Meadow/'.length) || 'index.html';
      const target = path.resolve(root, relative);
      if (!target.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
      const ext = path.extname(target);
      const type = ext === '.png' ? 'image/png' : ext === '.html' ? 'text/html' :
        ext === '.css' ? 'text/css' : 'text/javascript';
      const stream = fs.createReadStream(target);
      stream.on('error', () => { if (!response.headersSent) response.writeHead(404); response.end(); });
      response.writeHead(200, { 'Content-Type': type });
      stream.pipe(response);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const url = 'http://127.0.0.1:' + server.address().port + '/ASCII-Meadow/index.html?edit';
      for (const mode of ['gl', '2d']) {
        const { page, ctx, errs, step } = await openGame(browser, url,
          { mode, viewport: { width: 960, height: 600 } });
        try {
          let status = 'loading';
          for (let attempt = 0; attempt < 80; attempt++) {
            status = await page.evaluate(() => NPC_ATLASES.get('villager')?.status || 'loading');
            if (status !== 'loading') break;
            await step(1);
            await page.waitForTimeout(30);
          }
          assert.equal(status, 'ready', 'real committed NPC PNG must be readable over HTTP');
          const actual = await page.evaluate(() => {
            const initial = mapFileText();
            const entry = NPC_ATLASES.get('villager');
            const actor = { actorType: 'villager', d8: 7, actorAnimTime: 0.25 };
            const frame = npcAtlasFrame(actor, 'walk');
            const image = npcAtlasPreviewImage(actor, 'walk', Math.PI);
            const pixels = image.data;
            let alpha = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) alpha++;
            const audit = npcAtlasAudit('villager');
            openEditor(); ED.tool = 'npc'; ED.variant.npc = 0; ED.previewDirection = 7;
            ED.previewState = 'walk'; ED.previewAuto = false; edSyncUI();
            ED.ui.npcGalleryToggle.click();
            const directions = ED.ui.npcGallery.querySelectorAll('.ed-gallery-direction').length;
            const [x, z] = toModelXZ(player.x + 12, player.y);
            const spawned = spawnActor('villager',
              { id: 'real-http-villager', world: [x, z], behavior: 'idle' });
            return { dimensions: [entry.image.naturalWidth, entry.image.naturalHeight],
              frame: frame.frame, y: frame.y, alpha, scanned: audit.inspected,
              errors: audit.errors, directions, spawned: ents.includes(spawned),
              mapUnchanged: initial === mapFileText() };
          });
          assert.deepEqual(actual.dimensions, [480, 1344]);
          assert.equal(actual.y, 15 * 56, 'walk SE frame must select row 15');
          assert(actual.alpha > 60, 'ASCII preview should contain opaque sprite pixels');
          assert.equal(actual.scanned, 288);
          assert.equal(actual.errors, 0);
          assert.equal(actual.directions, 8);
          assert(actual.spawned && actual.mapUnchanged, 'shipped NPC should be runtime-only');
          await step(8);
          await page.screenshot({ path: path.join(gallery, mode + '-shipped-villager-http.png') });
          const cleanup = await page.evaluate(() => {
            const was = despawnActor('real-http-villager');
            closeEditor();
            return { was, remaining: npcs.length };
          });
          assert(cleanup.was && cleanup.remaining === 0);
          assert.deepEqual(realErrors(errs), [], 'HTTP PNG errors: ' + realErrors(errs).join('; '));
          console.log('PASS real shipped villager PNG via HTTP ' + mode +
            ': atlas, 8 views, quality scan, ASCII and world draw');
        } finally { await ctx.close(); }
      }
    } finally { await new Promise(resolve => server.close(resolve)); }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
