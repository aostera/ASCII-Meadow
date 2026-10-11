// Regression for map coordinates: the author's road and castle entrance fires must not
// drift on narrow screens. Runs in a real browser with the published map unchanged.
const { launch, openGame } = require('./common.cjs');
(async () => {
  const browser = await launch();
  try {
    for (const [w, h] of [[960, 600], [390, 844]]) {
      const { ctx, page, step } = await openGame(browser, 'file://' + require('path').resolve('index.html'), { mode: 'gl', viewport: { width: w, height: h } });
      await step(3);
      const p = await page.evaluate(() => {
        const C = cathedral, y = Math.round(mapToCell(0, -950)[1] + 0.7), xs = [];
        for (let x = 0; x < COLS; x++) if (kind[y * COLS + x] === 7) xs.push((x * CW - C.ox) / WS);
        const fires = MEADOW_MAP.fires.slice(3, 6).map((f, j) => {
          const b = braziers.find(b => b.mi === j + 3);
          return b ? [Math.abs((b.x * CW - C.kx) / MS - f[0]),
            Math.abs((C.ky - (b.y + 0.7) * CH) / (SINP * MS) - f[1])] : null;
        });
        return { guided: roadBridges.length, roadCells: xs.length, roadX: xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : null, fires, ratio: MS / WS };
      });
      console.log(w + 'x' + h + ': ' + JSON.stringify(p));
      if (p.guided !== 2 || p.roadCells < 3 || p.roadX < -125 || p.roadX > 65 ||
          p.fires.some(f => !f || f[0] > 1 || f[1] > 1)) throw Error('Map route/fire placement regression at ' + w + 'x' + h);
      await ctx.close();
    }
    console.log('PASS road joins and castle-front fires at both screen sizes');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
