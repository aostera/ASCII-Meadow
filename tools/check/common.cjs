// Shared by the checks: launching Chromium, and the deterministic environment injected before the game's
// scripts (seeded Math.random, a fake clock driving requestAnimationFrame and timers, GPU submit counters).
// Same code + same input -> same pixels, which is what makes before/after comparisons possible.
const fs = require('fs');
const { chromium, devices } = require('playwright');

const CHROMIUM = process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const launch = (extra = []) => chromium.launch({ executablePath: CHROMIUM, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...extra] });

// Runs in the page before any game script. mode: 'gl' or '2d' (WebGL2 hidden, the 2D fallback takes over).
function deterministic(mode) {
  let s = 0x9e3779b9; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  let T = 1000; const raf = [], timers = []; let tid = 1; const realNow = performance.now.bind(performance);
  performance.now = () => T; Date.now = () => 1.7e12 + T;
  // Only test pages get a reference to a real monotonic timer for CPU profiling.
  window.__realNow = realNow;
  window.requestAnimationFrame = cb => { raf.push(cb); return raf.length; };
  window.setTimeout = (cb, ms = 0) => { timers.push({ id: tid, at: T + ms, cb }); return tid++; };
  window.clearTimeout = id => { const k = timers.findIndex(t => t.id === id); if (k >= 0) timers.splice(k, 1); };
  window.__ready = () => raf.length > 0;
  // advance n frames of 1/60 s; returns the real milliseconds it took
  window.__step = n => { const t0 = realNow(); for (let i = 0; i < n; i++) { T += 1000 / 60; for (let k = timers.length - 1; k >= 0; k--) if (timers[k].at <= T) { const t = timers.splice(k, 1)[0]; t.cb(); } const q = raf.splice(0); for (const cb of q) cb(T); } return realNow() - t0; };
  // GPU submits are counted, and become no-ops while window.__noGPU is set (fast travel; the frame is still built)
  window.__gpu = { draws: 0, glyphs: 0 };
  { const gc = HTMLCanvasElement.prototype.getContext, noop = new Set(['drawElements', 'drawArrays', 'drawArraysInstanced', 'bufferSubData', 'texSubImage2D', 'clear']);
    HTMLCanvasElement.prototype.getContext = function (k, o) { const c = gc.call(this, k, o); if (k !== 'webgl2' || !c) return c;
      return new Proxy(c, { get(t, p) { const v = t[p]; if (typeof v !== 'function') return v;
        if (!noop.has(p)) return v.bind(t);
        return (...a) => { if (p === 'drawElements') window.__gpu.draws++; if (p === 'bufferSubData') window.__gpu.glyphs += (a[4] || 0) / 20; if (p === 'drawArrays') { window.__gpu.draws++; window.__gpu.glyphs += a[2] / 6; } if (p === 'drawArraysInstanced') { window.__gpu.draws++; window.__gpu.glyphs += a[3]; } if (!window.__noGPU) v.apply(t, a); }; } }); }; }
  if (mode === '2d') { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, o) { return k === 'webgl2' ? null : g.call(this, k, o); }; }
}

// Opens the game in a fresh context. Returns { ctx, page, errs, step, key, ready }.
// errs collects page errors and console errors/warnings (font loading failures are expected when blocked).
// files: { regexp source: body } served in place of the page's own (e.g. a saved map as src/data/map.js)
async function openGame(browser, url, { mode = 'gl', viewport = { width: 1280, height: 800 }, mobile = false, blockFonts = true, det = true, files = {} } = {}) {
  const ctx = await browser.newContext(mobile ? { ...devices['iPhone 13'], hasTouch: true } : { viewport });
  if (blockFonts) await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  for (const [re, body] of Object.entries(files)) await ctx.route(new RegExp(re), r => r.fulfill({ body, contentType: 'text/javascript' }));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  if (det) await page.addInitScript(deterministic, mode);
  await page.goto(url);
  const ready = async () => {
    // let the font race settle (blocked fonts: load() resolves at once), then start() has queued the first frame
    for (let i = 0; i < 100 && !(await page.evaluate(() => window.__ready && window.__ready())); i++) {
      await page.evaluate(() => window.__step && window.__step(0)); await page.waitForTimeout(50);
      if (i === 40) await page.evaluate(() => { for (let k = 0; k < 100; k++) window.__step(1); });   // the 1.5 s timeout path
    }
  };
  if (det) await ready();
  const step = n => page.evaluate(n => window.__step(n), n);
  const key = async (keys, n) => { for (const k of keys) await page.keyboard.down(k); await step(n); for (const k of keys) await page.keyboard.up(k); };
  return { ctx, page, errs, step, key, ready };
}
// errors that are not the game's: blocked web fonts
const realErrors = errs => errs.filter(e => !/Failed to load resource: net::ERR_FAILED/.test(e));

module.exports = { launch, deterministic, openGame, realErrors, CHROMIUM };
