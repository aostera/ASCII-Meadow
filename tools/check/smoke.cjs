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
      check('M does nothing without ?edit', await page.evaluate(() => !editing && !document.querySelector('.ed')));
      if (!quick) {
        // cows: the same herd for a while, then a running knight among them
        const seen = new Set(), phases = new Set();
        const rec = () => page.evaluate(() => cows.map(c => [c.state, c.gp || '', c.d8]));
        await page.evaluate(() => { window.__noGPU = true; });
        for (let k = 0; k < 60; k++) { await step(25); for (const [st, gp] of await rec()) { seen.add(st); if (st === 'graze') phases.add(gp); } }
        // run at the nearest calm cow until the herd has bolted (and, with luck, hopped)
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
    // ---- map editor (?edit): open, paint, place, undo, save; the saved file builds the same map, at any size
    {
      const { ctx, page, errs, step } = await openGame(b, url + (url.includes('?') ? '&' : '?') + 'edit', { mode: 'gl', viewport: { width: 1100, height: 700 } });
      const count = () => page.evaluate(() => { let n = 0; for (let i = 0; i < N; i++) if (kind[i] === 2) n++; return { earth: n, flora: flora.length, cows: cows.map(c => toModelXZ(c.home[0], c.home[1]).map(Math.round)) }; });
      await step(20); await page.keyboard.press('KeyM'); await step(2);
      check('editor: ?edit and M open the panel', await page.evaluate(() => editing && !document.querySelector('.ed').hidden));
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
      const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+KeyS')]);
      const saved = fs.readFileSync(await dl.path(), 'utf8'), c3 = await count();
      check('editor: «Сохранить» writes a map file', /const MEADOW_MAP = \{/.test(saved) && !/<\/script/i.test(saved), saved.length + ' bytes');
      await shot(page, 'editor');
      const re = realErrors(errs); check('no console errors (editor)', re.length === 0, re.slice(0, 3).join(' | '));
      await ctx.close();
      // the bundle inlines its map: the reload needs the page that loads src/data/map.js
      if (!/\.html?(\?|$)/.test(url) || /index\.html/.test(url)) for (const [w, h] of [[1100, 700], [800, 600]]) {
        const g = await openGame(b, url, { mode: 'gl', viewport: { width: w, height: h }, files: { 'src/data/map\\.js$': saved } });
        await g.step(5);
        const r = await g.page.evaluate(() => { let n = 0; for (let i = 0; i < N; i++) if (kind[i] === 2) n++; return { earth: n, flora: flora.length, cows: cows.map(c => toModelXZ(c.home[0], c.home[1]).map(Math.round)), editor: !!document.querySelector('.ed') }; });
        const sameCows = r.cows.length === 4 && r.cows.every((p, k) => Math.abs(p[0] - c3.cows[k][0]) <= 1 && Math.abs(p[1] - c3.cows[k][1]) <= 1);
        if (w === 1100) check('saved map loads back the same', r.earth === c3.earth && r.flora === c3.flora && sameCows && !r.editor, JSON.stringify({ earth: r.earth, flora: r.flora }));
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
