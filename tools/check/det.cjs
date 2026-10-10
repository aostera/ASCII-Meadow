// Deterministic run of the game: seeded Math.random, a fake clock driving requestAnimationFrame and
// timers, scripted input, screenshots at fixed frames. Same inputs -> same pixels, so before/after compare.
// usage: node tools/check/det.cjs <url> <outprefix> [gl|2d] [w] [h] [mob] [main|dirs|castle|touch]
const { chromium, devices } = require('playwright');
const [url, out, mode = 'gl', W = '1280', H = '800', mob, scen = 'main'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(mob ? { ...devices['iPhone 13'], hasTouch: true } : { viewport: { width: +W, height: +H } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  await p.addInitScript(mode => {
    let s = 0x9e3779b9; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    let T = 1000; const raf = [], timers = []; let tid = 1;
    performance.now = () => T; Date.now = () => 1.7e12 + T;
    window.requestAnimationFrame = cb => { raf.push(cb); return raf.length; };
    window.setTimeout = (cb, ms = 0) => { timers.push({ id: tid, at: T + ms, cb }); return tid++; };
    window.clearTimeout = id => { const k = timers.findIndex(t => t.id === id); if (k >= 0) timers.splice(k, 1); };
    window.__ready = () => raf.length > 0;
    window.__step = n => { for (let i = 0; i < n; i++) { T += 1000 / 60; for (let k = timers.length - 1; k >= 0; k--) if (timers[k].at <= T) { const t = timers.splice(k, 1)[0]; t.cb(); } const q = raf.splice(0); for (const cb of q) cb(T); } };
    // optional: GPU submits become no-ops while window.__noGPU is set (fast travel), the frame is still built
    { const gc = HTMLCanvasElement.prototype.getContext, noop = new Set(['drawElements', 'bufferSubData', 'clear']);
      HTMLCanvasElement.prototype.getContext = function (k, o) { const c = gc.call(this, k, o); if (k !== 'webgl2' || !c) return c;
        return new Proxy(c, { get(t, p) { const v = t[p]; return typeof v === 'function' ? (noop.has(p) ? (...a) => { if (!window.__noGPU) v.apply(t, a); } : v.bind(t)) : v; } }); }; }
    if (mode === '2d') { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, o) { return k === 'webgl2' ? null : g.call(this, k, o); }; }
  }, mode);
  await p.goto(url);
  // let the font race settle (fonts are blocked: load() resolves at once), then start is queued
  for (let i = 0; i < 100 && !(await p.evaluate(() => window.__ready && window.__ready())); i++) {
    await p.evaluate(() => window.__step && window.__step(0)); await p.waitForTimeout(50);
    if (i === 40) await p.evaluate(() => { for (let k = 0; k < 100; k++) window.__step(1); });   // the 1.5 s timeout path
  }
  const step = n => p.evaluate(n => window.__step(n), n);
  const shot = async name => { await p.screenshot({ path: `${out}_${name}.png`, timeout: 300000 }); };
  const key = async (keys, n) => { for (const k of keys) await p.keyboard.down(k); await step(n); for (const k of keys) await p.keyboard.up(k); };
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
  } else if (scen === 'castle') {
    await p.evaluate(() => { window.__noGPU = true; });
    for (let k = 0; k < 24; k++) { await key(['KeyW', 'ShiftLeft'], 90); await key(['KeyD'], 4); await key(['KeyW', 'ShiftLeft'], 90); await key(['KeyA'], 4); }
    await p.evaluate(() => { window.__noGPU = false; }); await step(2); await shot('01_nearCastle');
    for (let k = 0; k < 6; k++) { await p.evaluate(() => { window.__noGPU = true; }); await key(['KeyW'], 100); await p.evaluate(() => { window.__noGPU = false; }); await step(2); await shot('0' + (k + 2) + '_climb'); }
    await p.keyboard.press('KeyE'); await step(20); await shot('08_pressE');
  }
  console.log(JSON.stringify({ errs }));
  await b.close();
})();
