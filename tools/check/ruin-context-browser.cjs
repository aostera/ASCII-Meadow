// Regressions from iPad screenshots: ruins behind trees, and Safari leaving
// only the HTML HUD/overlay after a background/foreground GPU context loss.
const assert = require('node:assert/strict');
const path = require('node:path');
const { launch, openGame, realErrors } = require('./common.cjs');
const url = 'file://' + path.resolve(__dirname, '../../index.html');

(async () => {
  const browser = await launch();
  try {
    for (const [mode, viewport] of [
      ['gl', { width: 960, height: 600 }],
      ['2d', { width: 390, height: 844 }]
    ]) {
      const { ctx, page, step, errs } = await openGame(browser, url, { mode, viewport });
      try {
        await step(3);
        const indexed = await page.evaluate(() => {
          const original = ruins.slice();
          const oldCam = [VX0,VX1,VY0,VY1], oldN = GB.n;
          try {
            // x0 must be nonzero: previously three methods incorrectly used
            // global x rather than (x - r.x0), producing shifted/missing stone.
            const r = {
              x0: 32, x1: 33, y0: 44, y1: 44, gridW: 2, gridH: 1,
              lum: new Float32Array([.5,-1]),
              dep: new Float32Array([1e6,0]),
              glyph: new Int16Array([CI['#'],-1]),
              lev: new Uint8Array([BL0,BL0])
            };
            ruins.splice(0, ruins.length, r);
            VX0=30;VX1=35;VY0=42;VY1=46;
            const visibleStone = ruinCellCovered(32,44,0),
              emptyCell = ruinCellCovered(33,44,0);
            GB.n = 0;
            drawRuins();
            const drawCount = GB.n;
            const positions = [...GB.buf.slice(0,GB.n*6)]
              .filter((_,i)=>i%6===0);
            const atCorrectX = positions.some(x=>x>=32*CW-1 && x<=32*CW+1);
            return {visibleStone, emptyCell, drawCount, atCorrectX};
          } finally {
            ruins.splice(0, ruins.length, ...original);
            [VX0,VX1,VY0,VY1]=oldCam; GB.n=oldN;
          }
        });
        assert(indexed.visibleStone && !indexed.emptyCell &&
          indexed.drawCount>=2 && indexed.atCorrectX,
          'Ruins must draw/mask at their local grid origin, not world-column zero: '+
            JSON.stringify(indexed));

        await page.evaluate(() => {
          document.dispatchEvent(new Event('visibilitychange'));
          window.dispatchEvent(new Event('pageshow'));
          window.dispatchEvent(new Event('focus'));
        });
        await step(4);
        if (mode === 'gl') {
          const hasExt = await page.evaluate(() => {
            window.__ctxLossExt = GL.gl.getExtension('WEBGL_lose_context');
            if (window.__ctxLossExt) window.__ctxLossExt.loseContext();
            else document.getElementById('g').dispatchEvent(
              new Event('webglcontextlost',{cancelable:true}));
            return !!window.__ctxLossExt;
          });
          await page.waitForFunction(() => GL.lost && !GL.ok, {timeout:15000});
          await page.evaluate(() => {
            if (window.__ctxLossExt) window.__ctxLossExt.restoreContext();
            else document.getElementById('g').dispatchEvent(
              new Event('webglcontextrestored'));
          });
          await page.waitForFunction(() => GL.ok && !GL.lost, {timeout:15000});
          await step(5);
          assert(await page.evaluate(() => !!GL.gl && !GL.gl.isContextLost() && GB.n>1000),
            'WebGL renderer did not resume after '+(hasExt?'real':'simulated')+' loss');
        }
        // A raw pixel check catches the original failure: statistics continued
        // to update while the scene canvas itself was completely black.
        const image = await page.evaluate(() => {
          // WebGL defaults to preserveDrawingBuffer:false. Read pixels in the
          // SAME JS task as a freshly drawn frame, otherwise Chromium is
          // permitted to invalidate the backbuffer between evaluate() calls.
          window.__step(1);
          const g = document.getElementById('g');
          const scratch = document.createElement('canvas');
          scratch.width=128;scratch.height=96;
          const dc = scratch.getContext('2d');
          dc.drawImage(g,0,0,128,96);
          const pixels = dc.getImageData(0,0,128,96).data;
          let low=255,high=0;
          for(let i=0;i<pixels.length;i+=4){
            const v=pixels[i]+pixels[i+1]+pixels[i+2];
            low=Math.min(low,v);high=Math.max(high,v);
          }
          return {low,high,objects:flora.length,rendered:GB.n};
        });
        assert(image.high-image.low>20 && image.rendered>1000 && image.objects>10,
          'A live world must be visible after Safari resume: '+JSON.stringify(image));
        assert.deepEqual(realErrors(errs), [], 'Browser runtime errors');
        console.log('PASS '+mode+': ruin grid offset and Safari resume with visible world');
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
