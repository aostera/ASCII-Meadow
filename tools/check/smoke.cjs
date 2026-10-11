// Smoke test of the running game, for CI and before publishing. Opens the page in Chromium and asserts:
// the world is built (frames parsed, herd, flora, castle, fires), WebGL2 draws (and the 2D fallback draws
// when WebGL2 is missing), the knight walks, runs and jumps with the right animation ranges, gusts, mouse,
// the cows go through their states, touch drag and taps work, a resize rebuilds, a zero-size start recovers,
// and nothing errors in the console.   usage: node tools/check/smoke.cjs <url> [--out DIR] [--quick]
const fs = require('fs'), path = require('path');
const { launch, openGame, realErrors } = require('./common.cjs');
const args = process.argv.slice(2), url = args[0];
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : null, quick = args.includes('--quick');
if (!url) { console.error('usage: node tools/check/smoke.cjs <url> [--out DIR] [--quick]'); process.exit(2); }
if (out) fs.mkdirSync(out, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : '')); };
const shot = async (page, name) => { if (out) await page.screenshot({ path: path.join(out, name + '.png') }).catch(() => {}); };
// mean and spread of the glyph canvas right after a frame (same task, so the WebGL buffer is still there)
const canvasStats = page => page.evaluate(() => {
  window.__step(1);
  const g = document.getElementById('g'), c = document.createElement('canvas'); c.width = 320; c.height = 200;
  const x = c.getContext('2d'); x.drawImage(g, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height).data; let s = 0, s2 = 0; const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; s += v; s2 += v * v; }
  const m = s / n; return { mean: +m.toFixed(2), sd: +Math.sqrt(s2 / n - m * m).toFixed(2) };
});
const state = page => page.evaluate(() => ({ x: player.x, y: player.y, run: player.run || 0, jump: player.jump || 0, frame: knightFrame(player), rings: rings.length, mouse: mouse.on }));

(async () => {
  const b = await launch();
  try {
    // ---- WebGL2, desktop
    {
      const { ctx, page, errs, step, key } = await openGame(b, url, { mode: 'gl', viewport: { width: 960, height: 600 } });
      const w = await page.evaluate(() => ({ gl: GL.ok, blades: build.blades, flora: flora.length, knightFrames: KFR.length, cowFrames: CFR.length, cows: cows.length, castle: !!cathedral.cv, fires: braziers.length, sprites: GB.spr.length }));
      check('world built', w.blades > 1000 && w.flora > 10 && w.castle && w.fires > 0, JSON.stringify(w));
      check('knight and cow frames parsed', w.knightFrames === 192 && w.cowFrames === 642 && w.cows === 3);
      check('WebGL2 path active', w.gl === true);
      await step(30);
      const g0 = await page.evaluate(() => ({ ...window.__gpu })); await step(10); const g1 = await page.evaluate(() => ({ ...window.__gpu }));
      check('WebGL2 draws every frame', g1.draws - g0.draws >= 10 && (g1.glyphs - g0.glyphs) / 10 > 2000, `${(g1.draws - g0.draws) / 10} draws, ${Math.round((g1.glyphs - g0.glyphs) / 10)} glyphs per frame`);
      const cs = await canvasStats(page); check('WebGL2 canvas has a picture', cs.mean > 3 && cs.sd > 3, JSON.stringify(cs));
      await shot(page, 'gl_start');
      let s0 = await state(page);
      check('idle: standing frames', s0.frame < 8, 'frame ' + s0.frame);
      await page.keyboard.down('KeyW'); await step(30); const sw = await state(page); await step(10); await page.keyboard.up('KeyW');
      check('walk north: moves and walk frames', sw.y < s0.y - 2 && sw.frame >= 8 && sw.frame < 88, `dy ${(sw.y - s0.y).toFixed(1)}, frame ${sw.frame}`);
      await shot(page, 'gl_walk');
      s0 = await state(page);
      await page.keyboard.down('KeyD'); await page.keyboard.down('ShiftLeft'); await step(40); const sr = await state(page); await page.keyboard.up('KeyD'); await page.keyboard.up('ShiftLeft');
      check('run east: faster, run frames', sr.x > s0.x + 5 && sr.run > 0.5 && sr.frame >= 88 && sr.frame < 152, `dx ${(sr.x - s0.x).toFixed(1)}, run ${sr.run.toFixed(2)}, frame ${sr.frame}`);
      await shot(page, 'gl_run');
      await step(30); await page.keyboard.press('Space'); await step(10); const sj = await state(page);
      check('jump: jump frames', sj.jump > 0 && sj.frame >= 152, `jump ${sj.jump.toFixed(2)}, frame ${sj.frame}`);
      await shot(page, 'gl_jump');
      await step(60); const sl = await state(page);
      check('jump lands', sl.jump === 0, `jump ${sl.jump}`);
      await page.keyboard.press('KeyG'); await step(2); const sg = await state(page);
      check('G sends a gust ring', sg.rings > 0, `rings ${sg.rings}`);
      await page.mouse.move(300, 300); await step(2); await page.mouse.move(600, 320); await step(4);
      check('mouse brushes the grass', (await state(page)).mouse === true);
      await page.keyboard.press('KeyM'); await step(2);
      const mOpen = await page.evaluate(() => editing && !document.querySelector('.ed').hidden);
      await page.keyboard.press('KeyM'); await step(2);
      check('M opens the editor on the plain page and closes it again', mOpen && await page.evaluate(() => !editing));
      if (!quick) {
        // cows: the same herd for a while, then a running knight among them
        const seen = new Set(), phases = new Set();
        const rec = () => page.evaluate(() => cows.map(c => [c.state, c.gp || '', c.d8]));
        await page.evaluate(() => { window.__noGPU = true; });
        for (let k = 0; k < 200 && !(['idle', 'walk', 'graze'].every(s => seen.has(s)) && ['down', 'loop', 'up'].every(s => phases.has(s))); k++) { await step(25); for (const [st, gp] of await rec()) { seen.add(st); if (st === 'graze') phases.add(gp); } }   // until every calm state has shown (a cow may stand a long while before it strolls)
        // run at the nearest calm cow until the herd has bolted (and, with luck, hopped); from beside the
        // herd, so tents and fences on the way (the start is in the camp) don't stand in for the cows' reaction
        await page.evaluate(() => {
          const c = cows.reduce((a, k) => Math.hypot(k.x - player.x, k.y - player.y) < Math.hypot(a.x - player.x, a.y - player.y) ? k : a);
          const clear = (x, y) => { for (let t = 0; t <= 1; t += 0.02) if (blocked(x + (c.x - x) * t * 0.6, y + (c.y - y) * t * 0.6, null)) return false; return true; };   // a straight run up to it (the cows themselves aside)
          for (const d of [30, 25, 35, 20, 40, 45]) for (const sd of [-1, 1]) if (clear(c.x + sd * d, c.y)) { player.x = c.x + sd * d; player.y = c.y; updateCamera(0, true); return; }
        });
        const toward = () => page.evaluate(() => {
          let best = null, bd = 1e9; for (const c of cows) { if (c.state === 'run' || c.state === 'hop') continue; const d = Math.hypot(c.x - player.x, (c.y - player.y) * CH / CW); if (d < bd) { bd = d; best = c; } }
          if (!best) return [];
          const dx = best.x - player.x, dy = (best.y - player.y) * CH / CW, k = [];
          if (dx > 2) k.push('KeyD'); else if (dx < -2) k.push('KeyA'); if (dy > 2) k.push('KeyS'); else if (dy < -2) k.push('KeyW');
          return k.length ? k : ['KeyD'];
        });
        for (let k = 0; k < 80 && !(seen.has('run') && seen.has('hop')); k++) { const ks = await toward(); if (!ks.length) await step(20); else await key([...ks, 'ShiftLeft'], 5); for (const [st] of await rec()) seen.add(st); }
        for (let k = 0; k < 12; k++) { await step(5); for (const [st] of await rec()) seen.add(st); }
        await page.evaluate(() => { window.__noGPU = false; });
        check('cows: idle, walk, graze (down, loop, up), run', ['idle', 'walk', 'graze', 'run'].every(s => seen.has(s)) && ['down', 'loop', 'up'].every(s => phases.has(s)), [...seen].join(',') + ' / graze ' + [...phases].join(','));
        check('cows: spooked hop seen', seen.has('hop'), seen.has('hop') ? '' : '(not triggered in this run)');
        await shot(page, 'gl_cows');
      }
      await page.setViewportSize({ width: 800, height: 520 }); await step(3);
      const rz = await page.evaluate(() => ({ W, H, blades: build.blades, gl: GL.ok }));
      check('resize rebuilds the world', rz.W === 800 && rz.H === 520 && rz.blades > 1000 && rz.gl, JSON.stringify(rz));
      await shot(page, 'gl_resized');
      const re = realErrors(errs); check('no console errors (WebGL2)', re.length === 0, re.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---- 2D fallback
    {
      const { ctx, page, errs, step, key } = await openGame(b, url, { mode: '2d', viewport: { width: 640, height: 400 } });
      const w = await page.evaluate(() => ({ gl: GL.ok, ctx2: !!GL.ctx2, blades: build.blades }));
      check('2D fallback active without WebGL2', w.gl === false && w.ctx2 && w.blades > 100, JSON.stringify(w));
      await step(10);
      const cs = await page.evaluate(() => { const g = document.getElementById('g'), d = g.getContext('2d').getImageData(0, 0, g.width, g.height).data; let s = 0, s2 = 0, n = d.length / 4; for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; s += v; s2 += v * v; } const m = s / n; return { mean: +m.toFixed(2), sd: +Math.sqrt(s2 / n - m * m).toFixed(2) }; });
      check('2D canvas has a picture', cs.mean > 3 && cs.sd > 3, JSON.stringify(cs));
      const s0 = await state(page); await key(['KeyW'], 20); const s1 = await state(page);
      check('2D: knight walks', s1.y < s0.y - 1, `dy ${(s1.y - s0.y).toFixed(1)}`);
      await shot(page, '2d');
      const re = realErrors(errs); check('no console errors (2D)', re.length === 0, re.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---- mobile, touch
    {
      const { ctx, page, errs, step } = await openGame(b, url, { mode: 'gl', mobile: true });
      const cdp = await ctx.newCDPSession(page), vp = page.viewportSize();
      const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      await step(20);
      const kp = await page.evaluate(() => [(player.x - camX) * CW, (player.y - camY) * CH]);
      const s0 = await state(page);
      await touch('touchStart', kp[0], kp[1] + 40); await step(2); await touch('touchMove', kp[0] + 10, kp[1] - 60); await step(2); await touch('touchMove', kp[0] + 10, kp[1] - 80); await step(40);
      const s1 = await state(page);
      check('touch drag walks', s1.y < s0.y - 2, `dy ${(s1.y - s0.y).toFixed(1)}`);
      await touch('touchMove', kp[0] + 20, kp[1] - 300); await step(30); const s2 = await state(page); await touch('touchEnd'); await step(10);
      check('touch drag far runs', s2.run > 0.5, `run ${s2.run.toFixed(2)}`);
      await touch('touchStart', 40, vp.height * 0.3); await step(3); await touch('touchEnd'); await step(2);
      check('tap on the field sends a gust', (await state(page)).rings > 0);
      await step(60);
      const kq = await page.evaluate(() => [(player.x - camX) * CW, (player.y - camY) * CH - 20]);
      await touch('touchStart', kq[0], kq[1]); await step(3); await touch('touchEnd'); await step(3);
      check('tap on the knight jumps', (await state(page)).jump > 0);
      await shot(page, 'mobile');
      const re = realErrors(errs); check('no console errors (mobile)', re.length === 0, re.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---- map editor (button or M): open, paint, place, undo, save; the saved file builds the same map, at any size
    {
      const { ctx, page, errs, step } = await openGame(b, url + (url.includes('?') ? '&' : '?') + 'edit', { mode: 'gl', viewport: { width: 1100, height: 700 } });
      const count = () => page.evaluate(() => { let n = 0; for (let i = 0; i < N; i++) if (kind[i] === 2) n++; return { earth: n, flora: flora.length, cows: cows.map(c => toModelXZ(c.home[0], c.home[1]).map(Math.round)) }; });
      await step(20); await page.keyboard.press('KeyM'); await step(2);
      check('editor: M opens the panel', await page.evaluate(() => editing && !document.querySelector('.ed').hidden));
      // the checks below start from the generated world: the editor's own «Сбросить», whatever the shipped map holds
      await page.evaluate(() => { applyWholeMap({}); ED.undo.length = ED.redo.length = 0; ED.sel = null; edSyncUI(); camX = player.x - VC / VZ / 2; camY = player.y - VR / VZ * 0.72; updateCamera(0, true); }); await step(2);   // the camera along to the generated start: the map's own start (the camp) is elsewhere
      // selecting a generated tree changes nothing; stones and flowers paint what they say
      const fp = await page.evaluate(() => { const f = flora.find(f => f.br > VY0 + 12 && f.br < VY1 - 8 && f.x > VX0 + 12 && f.x < VX0 + VC * 0.6); return f ? [(f.x - camX) * CW, (f.br - camY) * CH - 4] : null; });
      if (fp) { await page.keyboard.press('KeyV'); await page.mouse.click(fp[0], fp[1]); await step(1); }
      check('editor: selecting changes nothing', fp && await page.evaluate(() => !!ED.sel && MEADOW_MAP.flora === null && !ED.undo.length));
      await page.keyboard.press('Escape');
      const inView = () => page.evaluate(() => { let st = 0, fl = 0; for (let y = VY0; y <= VY1; y++) for (let x = VX0; x <= VX1; x++) { const k = kind[y * COLS + x]; if (k === 5) st++; if (k === 3 || k === 4 || k === 6) fl++; } return { st, fl }; });
      const sf0 = await inView();
      await page.keyboard.press('Digit5'); await page.mouse.move(250, 200); await page.mouse.down(); await page.mouse.move(450, 200, { steps: 6 }); await page.mouse.up();
      await page.keyboard.press('Digit6'); await page.mouse.move(250, 260); await page.mouse.down(); await page.mouse.move(450, 260, { steps: 6 }); await page.mouse.up(); await step(2);
      const sf1 = await inView();
      check('editor: stones paint stones, flowers paint flowers', sf1.st > sf0.st + 50 && sf1.fl > sf0.fl + 10, JSON.stringify({ before: sf0, after: sf1 }));
      const c0 = await count();
      await page.keyboard.press('Digit4'); await page.mouse.move(300, 350); await page.mouse.down();
      for (let x = 300; x <= 600; x += 25) { await page.mouse.move(x, 350); await step(1); }
      await page.mouse.up(); await step(2);
      const c1 = await count();
      check('editor: an earth stroke paints the ground', c1.earth > c0.earth + 200, `${c0.earth} → ${c1.earth} earth cells`);
      await page.keyboard.press('KeyT'); await page.mouse.click(700, 300); await step(2);
      await page.keyboard.press('KeyC'); await page.mouse.click(650, 450); await step(2);
      const c2 = await count();
      check('editor: a tree and a cow placed', c2.flora === c0.flora + 1 && c2.cows.length === 4, `flora ${c0.flora} → ${c2.flora}, cows ${c2.cows.length}`);
      await page.keyboard.press('Control+KeyZ'); await step(1);
      const undone = await page.evaluate(() => cows.length);
      await page.keyboard.press('Control+Shift+KeyZ'); await step(1);
      check('editor: undo and redo', undone === 3 && (await page.evaluate(() => cows.length)) === 4);
      await page.keyboard.press('Control+KeyZ'); await page.keyboard.press('Control+KeyZ'); await step(1);
      // (regenerated over the strokes above: where earth covered the trail, trees may now grow)
      const back = await page.evaluate(() => MEADOW_MAP.flora === null && MEADOW_MAP.cows === null && MEADOW_MAP.fires === null && cows.length === 3);
      await page.keyboard.press('Control+Shift+KeyZ'); await page.keyboard.press('Control+Shift+KeyZ'); await step(1);
      check('editor: undoing the first placement brings back the generated world', back && (await page.evaluate(() => flora.length)) === c0.flora + 1);
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=save]')]);
      const saved = fs.readFileSync(await dl.path(), 'utf8'), c3 = await count();
      await page.evaluate(() => rebuildMap());
      const rebuilt = await count();
      console.log('EDITOR map ground vs canonical rebuild:', JSON.stringify({ before: c3, rebuilt, delta: rebuilt.earth - c3.earth }));
      check('editor: «Сохранить» downloads the map file', /const MEADOW_MAP = \{/.test(saved) && !/<\/script/i.test(saved), saved.length + ' bytes');
      await shot(page, 'editor');
      // fog: dense fog where it is brushed, none where it is cleared
      const fogMean = (x0, y0, x1, y1) => page.evaluate(([x0, y0, x1, y1]) => { let s = 0, n = 0; for (let j = 0; j < FG.h; j++) for (let i = 0; i < FG.w; i++) { const x = (i + 0.5) / FG.w * W, y = (j + 0.5) / FG.h * H; if (x >= x0 && x <= x1 && y >= y0 && y <= y1) { s += FG.d[j * FG.w + i]; n++; } } return n ? s / n : 0; }, [x0, y0, x1, y1]);
      const fg0 = await fogMean(150, 120, 330, 220);
      await page.keyboard.press('KeyJ'); await page.mouse.move(120, 170); await page.mouse.down(); await page.mouse.move(360, 170, { steps: 8 }); await page.mouse.up(); await step(4);
      const fg1 = await fogMean(150, 120, 330, 220);
      await page.keyboard.press('KeyN'); await page.mouse.move(120, 170); await page.mouse.down(); await page.mouse.move(360, 170, { steps: 8 }); await page.mouse.up(); await step(4);
      const fg2 = await fogMean(150, 120, 330, 220);
      check('editor: fog brushed in and cleared away', fg1 > Math.max(0.6, fg0 + 0.2) && fg2 < 0.08, `fog ${fg0.toFixed(2)} → dense ${fg1.toFixed(2)} → cleared ${fg2.toFixed(2)}`);
      // water: a band painted across the knight's way north stops him at its edge
      {
        const kp = await page.evaluate(() => [(player.x - camX) * CW, (player.y + 0.7 - camY) * CH]);
        await page.keyboard.press('Digit9'); await page.mouse.move(kp[0] - 300, kp[1] - 120); await page.mouse.down(); await page.mouse.move(kp[0] + 300, kp[1] - 120, { steps: 12 }); await page.mouse.up(); await step(2);
        await page.evaluate(() => { closeEditor(); keys.add('w'); }); await step(200); await page.evaluate(() => { keys.delete('w'); openEditor(); });
        const wr = await page.evaluate(() => { const cx = Math.round(player.x), cy = Math.round(player.y + 0.2); return { onWet: !!wet[cy * COLS + cx], ahead: !!wet[(cy - 1) * COLS + cx] || !!wet[(cy - 2) * COLS + cx], water: kind.reduce((n, k) => n + (k === 8), 0) }; });
        check('editor: water stops the knight at its edge', wr.water > 100 && !wr.onWet && wr.ahead, JSON.stringify(wr));
        // a start painted over with water: he spawns on the nearest dry ground, never inside it
        const kq = await page.evaluate(() => [(player.x - camX) * CW * VZ, (player.y + 0.7 - camY) * CH * VZ]);
        await page.keyboard.press('Digit9'); await page.mouse.move(kq[0] - 60, kq[1]); await page.mouse.down(); await page.mouse.move(kq[0] + 60, kq[1], { steps: 6 }); await page.mouse.up(); await step(2);
        const sp = await page.evaluate(() => {
          const wetAt = (x, y) => !!wet[Math.round(y + 0.2) * COLS + Math.round(x)], x0 = player.x, y0 = player.y, before = wetAt(x0, y0);
          MEADOW_MAP.start = toModelXZ(x0, y0); placeEntities();
          return { paintedOver: before, onWet: wetAt(player.x, player.y), moved: +Math.hypot(player.x - x0, (player.y - y0) * 2).toFixed(1) };
        });
        check('editor: a start under water moves to dry ground nearby', sp.paintedOver && !sp.onWet && sp.moved < 40, JSON.stringify(sp));
        // the marsh fills with toads: they sit on its tussocks and pads, and leap off as the knight walks up
        await page.keyboard.press('KeyP'); await page.mouse.move(kq[0] + 80, kq[1] - 60); await page.mouse.down(); await page.mouse.move(kq[0] + 320, kq[1] - 60, { steps: 10 }); await page.mouse.up();
        await page.evaluate(() => closeEditor()); await step(90);
        const td = await page.evaluate(() => { const L = [...toads.values()]; return { n: L.length, onSpots: L.every(t => t.st !== 'sit' || toadSpot(Math.round(t.y) * COLS + Math.round(t.x))) }; });
        await page.evaluate(() => openEditor());
        check('marsh: toads live on it', td.n > 0 && td.onSpots, JSON.stringify(td));
        // birds in the tall grass: placed only there, and up they go when the knight walks in
        {
          const kb = await page.evaluate(() => [(player.x - camX) * CW * VZ, (player.y + 0.7 - camY) * CH * VZ]);
          await page.keyboard.press('Digit2'); await page.mouse.move(kb[0] - 120, kb[1] - 60); await page.mouse.down(); await page.mouse.move(kb[0] + 120, kb[1] - 60, { steps: 8 }); await page.mouse.up();
          await page.mouse.move(kb[0] - 120, kb[1] - 20); await page.mouse.down(); await page.mouse.move(kb[0] + 120, kb[1] - 20, { steps: 8 }); await page.mouse.up(); await step(2);
          await page.keyboard.press('KeyO'); await page.mouse.click(kb[0], kb[1] - 50); await step(2);
          const placed = await page.evaluate(() => (MEADOW_MAP.events || []).length);
          await page.evaluate(() => { closeEditor(); keys.add('w'); }); await step(90); await page.evaluate(() => keys.delete('w'));
          const flew = await page.evaluate(() => birds.length);
          await page.evaluate(() => openEditor());
          check('editor: birds hidden in tall grass fly up when the knight walks in', placed === 1 && flew > 0, JSON.stringify({ placed, flew }));
        }
      }
      // zoom: out to see more, a tree lands under the cursor at any scale, and the game is back at 100% when the editor closes
      await page.keyboard.press('KeyQ'); await page.keyboard.press('KeyQ'); await step(2);
      await page.keyboard.press('KeyT'); await page.mouse.click(500, 300); await step(2);
      const zt = await page.evaluate(() => { const e = MEADOW_MAP.flora[MEADOW_MAP.flora.length - 1], [x, y] = mapToCell(e[2], e[3]); return { z: VZ, cols: VX1 - VX0, sx: (x - camX) * CW * VZ, sy: (y + 0.7 - camY) * CH * VZ }; });
      await page.evaluate(() => { closeEditor(); }); const z1 = await page.evaluate(() => VZ); await page.evaluate(() => { openEditor(); });
      check('editor: zoom out, place under the cursor, back to 100% on close', zt.z < 1 && Math.hypot(zt.sx - 500, zt.sy - 300) < 8 && z1 === 1, JSON.stringify({ zoom: zt.z, cellsAcross: zt.cols, foot: [Math.round(zt.sx), Math.round(zt.sy)] }));
      // the castle moves: its gate foot lands under the click, with its walls, stair and gate fires; undo puts it back
      {
        await page.keyboard.press('KeyL'); await page.mouse.click(420, 520); await step(2);
        const cm = await page.evaluate(() => { const C = cathedral, gate = surfAt(C.kx / CW, (C.ky - 74 * SINP * MS) / CH - 0.7); return { moved: C.kx !== C.ox || C.ky !== C.oy, map: MEADOW_MAP.castle, gate, fires: braziers.filter(b => !b.ground).every(b => Math.abs(b.x * CW - C.kx) < 200 * MS) }; });
        await page.keyboard.press('Control+KeyZ'); await step(2);
        const back = await page.evaluate(() => cathedral.kx === cathedral.ox && cathedral.ky === cathedral.oy && !MEADOW_MAP.castle);
        check('editor: the castle moves to the click, and back on undo', cm.moved && Array.isArray(cm.map) && cm.gate > 50 && cm.fires && back, JSON.stringify(cm));
        await page.keyboard.press('KeyV');
      }
      // a camp: a tent and a stretch of fence go down where clicked, and stand in the knight's way
      {
        await page.keyboard.press('KeyY'); await page.mouse.click(300, 380); await step(2);
        await page.keyboard.press('KeyI'); await page.mouse.click(520, 420); await step(2);
        const cp = await page.evaluate(() => {
          const tents = flora.filter(f => f.v.type === 'tent'), fences = flora.filter(f => f.v.type === 'fence');
          const t = tents[tents.length - 1], blocks = t ? blocked(t.x, t.br - 0.7, player) : false;
          return { tents: tents.length, fences: fences.length, blocks, saved: /"tent"/.test(mapFileText()) && /"fence"/.test(mapFileText()) };
        });
        check('editor: tents and fences are placed, saved and solid', cp.tents >= 1 && cp.fences >= 1 && cp.blocks && cp.saved, JSON.stringify(cp));
        await page.keyboard.press('KeyV');
      }
      // nothing on the map is fixed: the «Стереть» brush clears the ground, the trail switches off, every object deletes
      await page.keyboard.press('Digit8'); await page.mouse.move(300, 500); await page.mouse.down(); await page.mouse.move(420, 500, { steps: 6 }); await page.mouse.up(); await step(2);
      const empty = await page.evaluate(() => { let n = 0; for (let y = VY0; y <= VY1; y++) for (let x = VX0; x <= VX1; x++) if (!kind[y * COLS + x]) n++; return n; });
      await page.click('.ed-check input'); await step(2);
      const left = await page.evaluate(() => {
        for (const kind of ['flora', 'cows', 'fires']) while (MEADOW_MAP[kind].length) { ED.sel = { kind, mi: 0 }; edDeleteSelected(); }
        let trail = 0; for (let i = 0; i < N; i++) if (kind[i] === 7) trail++;
        return { flora: flora.length, cows: cows.length, fires: braziers.length, trail };
      });
      check('editor: erase the ground, the trail and every object', empty > 100 && !left.flora && !left.cows && !left.fires && left.trail === 0, `${empty} empty cells in view; left ${JSON.stringify(left)}`);
      const re = realErrors(errs); check('no console errors (editor)', re.length === 0, re.slice(0, 3).join(' | '));
      await ctx.close();
      // the bundle inlines its map: the reload needs the page that loads src/data/map.js
      if (!/\.html?(\?|$)/.test(url) || /index\.html/.test(url)) for (const [w, h] of [[1100, 700], [800, 600]]) {
        const g = await openGame(b, url, { mode: 'gl', viewport: { width: w, height: h }, files: { 'src/data/map\\.js$': saved } });
        await g.step(5);
        const r = await g.page.evaluate(() => { let n = 0; for (let i = 0; i < N; i++) if (kind[i] === 2) n++; return { earth: n, flora: flora.length, cows: cows.map(c => toModelXZ(c.home[0], c.home[1]).map(Math.round)), editor: editing }; });
        const sameCows = r.cows.length === 4 && r.cows.every((p, k) => Math.abs(p[0] - c3.cows[k][0]) <= 1 && Math.abs(p[1] - c3.cows[k][1]) <= 1);
        if (w === 1100) check('saved map loads back the same', r.earth === c3.earth && r.flora === c3.flora && sameCows && !r.editor, JSON.stringify({ before: c3, after: r, earthDelta: r.earth - c3.earth, floraDelta: r.flora - c3.flora, sameCows }));
        else check('saved map stays put on another screen size', sameCows && r.flora > c3.flora * 0.8, `cows ${JSON.stringify(r.cows)}, flora ${r.flora}`);
        const re2 = realErrors(g.errs); if (re2.length) check('no console errors (saved map)', false, re2.slice(0, 3).join(' | '));
        await g.ctx.close();
      }
    }
    // ---- zero-size start (panels open at 0x0 and grow): real timing, no deterministic clock
    {
      const ctx = await b.newContext({ viewport: { width: 1000, height: 700 } });
      await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
      const page = await ctx.newPage(), errs = [];
      page.on('pageerror', e => errs.push(e.message));
      const frameHtml = `<iframe id="f" src="${url}" style="width:0;height:0;border:0"></iframe>`;
      if (url.startsWith('file:')) {   // a file page may only frame files: put the wrapper beside the temp dir
        const w = path.join(require('os').tmpdir(), 'meadow-zero-' + process.pid + '.html'); fs.writeFileSync(w, frameHtml);
        await page.goto('file://' + w);
      } else await page.setContent(frameHtml);
      await page.waitForTimeout(2500);
      await page.evaluate(() => { const f = document.getElementById('f'); f.style.width = '900px'; f.style.height = '600px'; });
      let st = '';
      for (let i = 0; i < 120 && !st; i++) { await page.waitForTimeout(500); const fr = page.frames()[1]; st = fr ? await fr.evaluate(() => document.getElementById('stats').textContent).catch(() => '') : ''; }
      check('zero-size start comes up after it grows', /blades/.test(st) && !errs.length, JSON.stringify(st) + (errs.length ? ' ' + errs[0] : ''));
      await ctx.close();
    }
  } catch (e) { check('smoke run completed', false, e.stack.split('\n').slice(0, 3).join(' | ')); }
  await b.close();
  const failed = results.filter(r => !r.ok && !/hop seen/.test(r.name));
  if (out) fs.writeFileSync(path.join(out, 'smoke.json'), JSON.stringify(results, null, 1));
  console.log(`\n${results.length - failed.length}/${results.length} checks passed` + (failed.length ? `, FAILED: ${failed.map(f => f.name).join('; ')}` : ''));
  process.exit(failed.length ? 1 : 0);
})();
