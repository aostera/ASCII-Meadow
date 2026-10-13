// CI-only 3D prototype smoke. Requires repo-root HTTP server and CDN access for Three.js.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const host = process.argv[2] || 'http://127.0.0.1:8181';
const out = path.join(process.cwd(), 'shots', 'three');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  try {
    for (const mobile of [false, true]) {
      const context = await browser.newContext({
        viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
        deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      const res = await page.goto(host.replace(/\/$/, '') + '/experiments/three/', { waitUntil: 'domcontentloaded' });
      if (!res || !res.ok()) throw new Error('Prototype HTTP error');
      await page.waitForFunction(() => window.__ASCII_THREE_DIAGNOSTICS__ !== undefined, { timeout: 60000 });
      const first = await page.evaluate(() => ({
        stats: window.__ASCII_THREE_DIAGNOSTICS__,
        source: JSON.stringify(window.ASCII_MEADOW_MAP)
      }));
      if (!(first.stats.authoredFlora > 0 && first.stats.authoredRuins === 1 &&
        first.stats.grassInstances > 1000)) throw new Error('Original cloister placement missing: ' + JSON.stringify(first.stats));
      await page.screenshot({ path: path.join(out, mobile ? 'phone.png' : 'desktop.png') });
      await page.locator('#ascii').uncheck();
      await page.locator('#location').selectOption('camp');
      await page.waitForFunction(() => window.__ASCII_THREE_DIAGNOSTICS__.location === 'camp');
      const camp = await page.evaluate(() => window.__ASCII_THREE_DIAGNOSTICS__);
      if (camp.authoredRuins !== 0 || camp.authoredFlora < 8) throw new Error('Authored camp missing: ' + JSON.stringify(camp));
      await page.locator('#ascii').check();
      await page.locator('#stress').check();
      await page.waitForFunction(() => window.__ASCII_THREE_DIAGNOSTICS__.stress);
      const end = await page.evaluate(() => JSON.stringify(window.ASCII_MEADOW_MAP));
      if (first.source !== end) throw new Error('Source map mutated');
      if (errors.length) throw new Error('Browser errors: ' + errors.join('\n'));
      console.log(mobile ? 'MOBILE PASS' : 'DESKTOP PASS', JSON.stringify(camp));
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exit(1); });
