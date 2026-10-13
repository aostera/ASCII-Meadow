// Repeatable per-frame CPU budget benchmark, not a display-refresh FPS meter.
// Desktop/tablet/phone WebGL2 and mobile 2D fallback, running the real world.
// Deterministic fake clock controls animation; __step() reports REAL wall time
// with SwiftShader. GPU draws can be suppressed to isolate JS/Canvas cost.
// Avoid hard performance assertions in CI: cloud runner speed is not a device.
const {launch, openGame, realErrors} = require('./common.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const url = 'file://' + path.resolve(__dirname, '../../index.html');
(async () => {
  const browser = await launch();
  try {
    const cases = [
      ['desktop','gl',{width:1280,height:800}],
      ['tablet','gl',{width:1024,height:768}],
      ['phone','gl',{width:390,height:844}],
      ['phone-2d','2d',{width:390,height:844}]
    ];
    for (const [device,mode,viewport] of cases) {
      const {ctx,page,errs,step} = await openGame(browser,url,{mode,viewport});
      try {
        await step(6);
        const result = await page.evaluate(() => {
          const ms = [];
          // On WebGL suppress GPU submits for a CPU workload estimate; the
          // 2D fallback still performs real canvas drawImage for each glyph.
          window.__noGPU = true;
          for (let i=0; i<18; i++) ms.push(window.__step(1));
          window.__noGPU = false;
          // Split CPU work into simulation and rendering without the
          // requestAnimationFrame / GPU clock, to identify next hot spots.
          const sim = [], renderMs = [];
          for (let i=0; i<12; i++) {
            const start = window.__realNow();
            simulate(1/60);
            const middle = window.__realNow();
            render();
            const end = window.__realNow();
            sim.push(middle-start); renderMs.push(end-middle);
          }
          sim.sort((a,b)=>a-b); renderMs.sort((a,b)=>a-b);
          ms.sort((a,b)=>a-b);
          return {
            simP50ms:+sim[Math.floor(sim.length*.5)].toFixed(2),
            renderP50ms:+renderMs[Math.floor(renderMs.length*.5)].toFixed(2),
            p50ms:+ms[Math.floor(ms.length/2)].toFixed(2),
            p95ms:+ms[Math.floor(ms.length*.95)].toFixed(2),
            totalGlyphs:GB.n, activeFlora:flora.length,
            sceneryCells:sceneGrassIndex.length,
            renderer:GL.ok?'webgl2':'canvas2d'
          };
        });
        assert(result.totalGlyphs > 500 && result.activeFlora > 100, 'World missing in '+device);
        assert.deepEqual(realErrors(errs),[],'Runtime errors in '+device);
        console.log('FRAME_BENCH '+device+' '+JSON.stringify(result));
      } finally { await ctx.close(); }
    }
    console.log('5ms/frame = 200fps equivalent compute budget, NOT 200 visible FPS on a 60/120Hz screen. Cloud-hosted SwiftShader timings cannot predict physical iPad/phone GPU limits.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
