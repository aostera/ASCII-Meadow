// JS time per frame (CDP Performance.ScriptDuration) over the same deterministic run, for two pages, alternating.
const { chromium } = require('playwright');
const pages = process.argv.slice(2, 4), RUNS = +(process.argv[4] || 3), N = 240;
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = { [pages[0]]: [], [pages[1]]: [] };
  for (let r = 0; r < RUNS; r++) for (const url of pages) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, x => x.abort());
    const p = await ctx.newPage();
    await p.addInitScript(() => {
      let s = 0x9e3779b9; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
      let T = 1000; const raf = [], timers = []; let tid = 1; const real = performance.now.bind(performance);
      performance.now = () => T; Date.now = () => 1.7e12 + T;
      window.requestAnimationFrame = cb => { raf.push(cb); return raf.length; };
      window.setTimeout = (cb, ms = 0) => { timers.push({ id: tid, at: T + ms, cb }); return tid++; };
      window.__ready = () => raf.length > 0;
      // CPU only: the GPU submits become no-ops (same proxy in both pages), everything that builds the frame stays
      const gc = HTMLCanvasElement.prototype.getContext, noop = new Set(['drawElements', 'bufferSubData', 'clear']);
      HTMLCanvasElement.prototype.getContext = function (k, o) { const c = gc.call(this, k, o); if (k !== 'webgl2' || !c) return c;
        return new Proxy(c, { get(t, p) { const v = t[p]; return typeof v === 'function' ? (noop.has(p) ? () => {} : v.bind(t)) : v; } }); };
      window.__step = n => { const t0 = real(); for (let i = 0; i < n; i++) { T += 1000 / 60; for (let k = timers.length - 1; k >= 0; k--) if (timers[k].at <= T) timers.splice(k, 1)[0].cb(); const q = raf.splice(0); for (const cb of q) cb(T); } return real() - t0; };
    });
    const t0 = Date.now(); await p.goto(url);
    for (let i = 0; i < 100 && !(await p.evaluate(() => window.__ready && window.__ready())); i++) await p.waitForTimeout(50);
    const load = Date.now() - t0;
    const cdp = await ctx.newCDPSession(p); await cdp.send('Performance.enable');
    await p.evaluate(() => window.__step(60));
    const m = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
    const a = await m();
    await p.keyboard.down('KeyW'); let wall = await p.evaluate(n => window.__step(n), N / 2); await p.keyboard.up('KeyW');
    await p.keyboard.down('KeyD'); await p.keyboard.down('ShiftLeft'); wall += await p.evaluate(n => window.__step(n), N / 2); await p.keyboard.up('KeyD'); await p.keyboard.up('ShiftLeft');
    const z = await m();
    res[url].push({ scriptMs: (z.ScriptDuration - a.ScriptDuration) * 1000 / N, wallMs: wall / N, load });
    await ctx.close();
  }
  for (const u of pages) { const v = res[u]; const med = k => v.map(x => x[k]).sort((a, b) => a - b)[v.length >> 1];
    console.log(u.split('/').slice(-2).join('/').padEnd(40), 'CPU ms/frame (median)', med('wallMs').toFixed(2), ' load→start ms', med('load'), JSON.stringify(v.map(x => +x.wallMs.toFixed(2)))); }
  await b.close();
})();
