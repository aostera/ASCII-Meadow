// Deterministic run of the game with scripted input and screenshots at fixed frames (see common.cjs).
// Same inputs -> same pixels, so a version before a change and after it can be compared with diff.py.
// usage: node tools/check/det.cjs <url> <outprefix> [gl|2d] [w] [h] [mob] [main|dirs|castle|touch|cows]
const { launch, openGame, realErrors } = require('./common.cjs');
const [url, out, mode = 'gl', W = '1280', H = '800', mob, scen = 'main'] = process.argv.slice(2);
(async () => {
  const b = await launch();
  const { ctx, page: p, errs, step, key } = await openGame(b, url, { mode, viewport: { width: +W, height: +H }, mobile: !!mob });
  // only what the game draws is compared: the HUD and the fps line are browser text, whose rasterisation
  // jitters by ±1 between runs under mobile emulation (DPR 3)
  await p.addStyleTag({ content: '.hud, .stats, .ed-open { visibility: hidden !important; }' });
  const shot = async name => { await p.screenshot({ path: `${out}_${name}.png`, timeout: 300000 }); };
  if (scen === 'main') {
  await step(90); await shot('01_start');
  await key(['KeyW'], 70); await shot('02_walkN');
  await key(['KeyD', 'ShiftLeft'], 60); await shot('03_runE');
  await key(['KeyA'], 40); await p.keyboard.press('Space'); await step(12); await shot('04_jump');
  await step(40); await key(['KeyS', 'KeyA'], 60); await shot('05_walkSW');
  if (!mob) { await p.mouse.move(500, 400); await step(5); await p.mouse.move(700, 450); await step(10); await shot('06_mouse'); }
  await key(['KeyD', 'KeyS'], 50); await step(300); await shot('07_later');
  await p.setViewportSize ? (mob ? 0 : await p.setViewportSize({ width: 900, height: 700 })) : 0; await step(30); await shot('08_resized');
  } else if (scen === 'dirs') {
    await step(60); await shot('00_idle');
    const D = [['S', ['KeyS']], ['SW', ['KeyS', 'KeyA']], ['W', ['KeyA']], ['NW', ['KeyW', 'KeyA']], ['N', ['KeyW']], ['NE', ['KeyW', 'KeyD']], ['E', ['KeyD']], ['SE', ['KeyS', 'KeyD']]];
    let i = 1; for (const [n, k] of D) { await key(k, 24); await shot(String(i++).padStart(2, '0') + '_walk' + n); }
    for (const [n, k] of D.slice(0, 4)) { await key([...k, 'ShiftLeft'], 20); await shot(String(i++).padStart(2, '0') + '_run' + n); }
    await key(['KeyD', 'KeyW', 'ShiftLeft'], 30); await step(10); await shot('13_atCows');
    await step(400); await shot('14_cowsLater');
    await step(500); await shot('15_cowsMuchLater');
  } else if (scen === 'touch') {
    // real touch events (CDP): drag to walk, drag far to run, tap the field (gust), tap the knight (jump)
    const cdp = await ctx.newCDPSession(p), vp = p.viewportSize() || { width: 390, height: 844 };
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const cx = vp.width / 2, cy = vp.height * 0.72;
    await step(60); await shot('01_start');
    await touch('touchStart', cx, cy); await step(2); await touch('touchMove', cx + 20, cy - 60); await step(2);
    await touch('touchMove', cx + 30, cy - 80); await step(50); await shot('02_dragWalk');
    await touch('touchMove', cx + 40, cy - 260); await step(50); await shot('03_dragRun'); await touch('touchEnd'); await step(20);
    await touch('touchStart', 60, 200); await step(3); await touch('touchEnd'); await step(12); await shot('04_tapGust');
    await touch('touchStart', cx, cy - 40); await step(3); await touch('touchEnd'); await step(14); await shot('05_tapKnight');
    await step(40); await shot('06_after');
  } else if (scen === 'cows') {   // the herd at the start: standing, strolling, grazing; a running knight spooks them
    await step(120); await shot('01_herd');
    for (const n of [1, 2, 3, 4, 5, 6]) { await step(240); await shot('0' + (n + 1) + '_herdLater'); }
    await key(['KeyD', 'KeyW', 'ShiftLeft'], 18); await shot('08_spook');
    await step(8); await shot('09_hopOrBolt'); await step(16); await shot('10_bolting'); await step(90); await shot('11_settled');
    await key(['KeyA', 'KeyW'], 120); await shot('12_walkAmongCows'); await step(300); await shot('13_cowsAfter');
  } else if (scen === 'castle') {   // up the trail to the castle, against a wall, round the stair cheek, up the stair, E at the gate
    const fast = v => p.evaluate(v => { window.__noGPU = v; }, v);
    await fast(true);
    for (let k = 0; k < 24; k++) { await key(['KeyW', 'ShiftLeft'], 90); await key(['KeyD'], 4); await key(['KeyW', 'ShiftLeft'], 90); await key(['KeyA'], 4); }
    await fast(false); await step(2); await shot('01_nearCastle');
    await key(['KeyD'], 40); await shot('02_blockedByWall');
    await fast(true); await key(['KeyS', 'ShiftLeft'], 168); await key(['KeyD', 'ShiftLeft'], 212); await fast(false); await step(2); await shot('03_stairFoot');
    await key(['KeyW'], 150); await shot('04_climb1');
    await key(['KeyW'], 150); await shot('05_climb2');
    await key(['KeyW'], 150); await shot('06_terracePrompt');
    await p.keyboard.press('KeyE'); await step(20); await shot('07_pressE');
    await step(120); await shot('08_after');
  }
  const real = realErrors(errs);
  console.log(JSON.stringify({ errs: real }));
  await b.close();
  if (real.length) process.exit(1);
})();
