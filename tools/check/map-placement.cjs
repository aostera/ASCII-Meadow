// Responsive map placement regression. Derives expectations from the current imported map;
// no hard-coded fire count, route shape or number of brush strokes, so new editor exports work.
const path = require('node:path');
const { launch, openGame, realErrors } = require('./common.cjs');
const url = 'file://' + path.resolve(__dirname, '../../index.html');
(async () => {
  const browser = await launch();
  let first = null;
  try {
    for (const [w, h] of [[960, 600], [390, 844], [640, 400]]) {
      const { ctx, page, step, errs } = await openGame(browser, url, { mode: 'gl', viewport: { width: w, height: h } });
      await step(3);
      const actual = await page.evaluate(() => {
        const digits = n => +n.toFixed(4), saved = MEADOW_MAP;
        const coordErrors = [];
        if (saved.fires) saved.fires.forEach((f, mi) => {
          const b = braziers.find(e => e.mi === mi);
          if (!b) { coordErrors.push({ mi, reason: 'missing fire' }); return; }
          const point = f[2] > 0 || castleFrontFire(f[0], f[1]) ?
            cellToCastle(b.x, b.y) : toModelXZ(b.x, b.y);
          if (Math.abs(point[0] - f[0]) > 0.15 || Math.abs(point[1] - f[1]) > 0.15)
            coordErrors.push({ mi, expected: f.slice(0, 2), actual: point });
        });
        const painted = []; let samples = 0, lost = 0;
        for (const [chunk, codes] of paintChunks) {
          const [bx, bz] = chunk.split(',').map(Number);
          for (let j = 0; j < codes.length; j++) if (codes[j] === 7) {
            painted.push(j);
            if ((samples++ % 23) !== 0) continue;
            const gx = (bx * PCH + (j & 31) + 0.5) * PAINT_RES;
            const gz = (bz * PCH + (j >> 5) + 0.5) * PAINT_RES;
            const [x, y] = mapToCell(gx, gz), ix = Math.round(x), iy = Math.round(y + 0.7);
            if (ix < 0 || ix >= COLS || iy < 0 || iy >= ROWS) { lost++; continue; }
            const idx = iy * COLS + ix;
            if (!bmask[idx] && kindBase[idx] !== 7) lost++;
          }
        }
        const endpoints = roadBridges.map(([a, b]) =>
          [a, b].map(p => [digits(p.x), digits(p.z), digits(p.width)]));
        return { fireErrors: coordErrors, authoredRoad, paintedCount: painted.length,
          bridges: endpoints, missingPaintSamples: lost, checkedPaintSamples: Math.ceil(samples / 23),
          msToWs: digits(MS / WS) };
      });
      console.log(w + 'x' + h + ': ' + JSON.stringify(actual));
      if (actual.fireErrors.length) throw Error('Map fire coordinates do not match the editor: ' + JSON.stringify(actual.fireErrors));
      if (actual.missingPaintSamples) throw Error('Editor-painted road is missing ' + actual.missingPaintSamples + ' sampled cells');
      if (actual.authoredRoad !== (actual.paintedCount > 0)) throw Error('Authored-road detection lost a painted section');
      if (first && JSON.stringify(first.bridges) !== JSON.stringify(actual.bridges))
        throw Error('Road connections move with viewport; expected stable world coordinates');
      if (!first) first = actual;
      if (realErrors(errs).length) throw Error('Browser console errors: ' + realErrors(errs).join('; '));
      await ctx.close();
    }
    console.log('PASS designer road cells and all fire positions at both aspect ratios');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
