// Performance of two versions of the page under the same seeded run, alternating, median of N runs:
//  - load: real ms from navigation until the game has started (first frame queued)
//  - cpu: real ms per frame to simulate and build the frame (GPU submits stubbed the same way in both pages,
//    so the software GPU of a headless machine does not drown the numbers), near the start and while
//    travelling north for 600 frames
//  - glyphs/draws: what one frame sends to the GPU
//  - heap: JS heap in use after the run (CDP)
// usage: node tools/check/perf.cjs <url A> <url B> [runs]
const { launch, openGame } = require('./common.cjs');
const [A, B, RUNS = '5'] = process.argv.slice(2);
if (!A || !B) { console.error('usage: node tools/check/perf.cjs <url A> <url B> [runs]'); process.exit(2); }
const med = v => [...v].sort((a, b) => a - b)[v.length >> 1];
(async () => {
  const b = await launch(), res = { [A]: [], [B]: [] };
  for (let r = 0; r < +RUNS; r++) for (const url of [A, B]) {
    const t0 = Date.now();
    const { ctx, page, step, key } = await openGame(b, url, { viewport: { width: 1280, height: 800 } });
    const load = Date.now() - t0;
    await page.evaluate(() => { window.__noGPU = true; });
    await step(60);
    const g0 = await page.evaluate(() => ({ ...window.__gpu }));
    const timed = async (keys, n) => { for (const k of keys) await page.keyboard.down(k); const ms = await page.evaluate(n => window.__step(n), n); for (const k of keys) await page.keyboard.up(k); return ms / n; };
    const near = ((await timed(['KeyW'], 120)) + (await timed(['KeyD', 'ShiftLeft'], 120))) / 2;
    const g1 = await page.evaluate(() => ({ ...window.__gpu }));
    const travel = await timed(['KeyW', 'ShiftLeft'], 600);
    const cdp = await ctx.newCDPSession(page); await cdp.send('Performance.enable');
    const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
    res[url].push({ load, near, travel, glyphs: (g1.glyphs - g0.glyphs) / 240, draws: (g1.draws - g0.draws) / 240, heapMB: m.JSHeapUsedSize / 1048576 });
    await ctx.close();
  }
  await b.close();
  const row = (name, k, f = 2) => { const a = med(res[A].map(x => x[k])), c = med(res[B].map(x => x[k])); console.log(name.padEnd(30), a.toFixed(f).padStart(10), c.toFixed(f).padStart(10), ((c / a - 1) * 100).toFixed(1).padStart(7) + '%'); };
  console.log('median of', RUNS, 'runs'.padEnd(18), 'A'.padStart(10), 'B'.padStart(10), 'B vs A'.padStart(8));
  row('load to start, ms', 'load', 0); row('CPU ms/frame near start', 'near'); row('CPU ms/frame travelling', 'travel');
  row('glyphs per frame', 'glyphs', 0); row('GPU draw calls per frame', 'draws'); row('JS heap after run, MB', 'heapMB', 1);
  console.log('A =', A, '\nB =', B);
  console.log(JSON.stringify(res));
})();
