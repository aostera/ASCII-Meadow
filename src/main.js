// Entry: the frame loop and the start once the mono font has loaded.

// ---------- loop ----------
let last = performance.now(), acc = 0, frameCount = 0;
let builtW = 0, builtH = 0;

// iPadOS suspends Safari tabs and may purge GPU backing stores without
// changing innerWidth. Resume must refresh GPU textures AND the 2D overlay;
// do not rebuild or discard a draft map just to recover the picture.
function resumeRenderSurface() {
  last = performance.now();
  acc = 0; frameCount = 0;
  if (document.hidden || !W || !H || !DPR) return;
  if (GL.lost) {
    // WebKit normally sends webglcontextrestored automatically. Some versions
    // need an explicit restore request after the page becomes visible again.
    const gl = GL.gl, ext = gl && gl.getExtension('WEBGL_lose_context');
    if (ext && gl.isContextLost()) ext.restoreContext();
    return;
  }
  try {
    if (GL.ok && GL.refresh) GL.refresh();
    else if (GL.ctx2) {
      const g = document.getElementById('g');
      g.width = Math.round(W * DPR); g.height = Math.round(H * DPR);
    }
    // Canvas2D overlays can be discarded separately from the WebGL canvas.
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  } catch (err) { console.error('Could not refresh renderer after Safari resume', err); }
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) resumeRenderSurface();
});
window.addEventListener('pageshow', resumeRenderSurface);
window.addEventListener('focus', resumeRenderSurface);

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  // Rendering while hidden or with a lost WebGL context cannot produce a
  // useful frame. In particular, do not attempt the Canvas2D fallback on
  // the SAME canvas that was originally created as WebGL2.
  if (document.hidden || GL.lost) return;
  // panels can open at zero size and grow later; rebuild once they have room
  if (innerWidth < 2 || innerHeight < 2) return;
  if (innerWidth !== builtW || innerHeight !== builtH) {
    const actors = snapshotActorWorld(); // rebuild reallocates the glyph grid
    builtW = innerWidth; builtH = innerHeight;
    build(); placeEntities(); restoreActorWorld(actors); seedLife();
  }
  try { simulate(dt); render(); } catch (err) { console.error(err); }
  frameCount++; acc += dt;
  if (acc > 0.5) {
    statsEl.textContent = `${Math.round(frameCount / acc)} fps\n${build.blades.toLocaleString()} blades · ${build.flora} trees & bushes`;
    frameCount = 0; acc = 0;
  }
}

function start() {
  try {
    if (innerWidth >= 2 && innerHeight >= 2) {
      builtW = innerWidth; builtH = innerHeight;
      build(); placeEntities(); seedLife();
      for (let s = 0; s < 50; s++) simulate(1 / 60);
    }
  } catch (err) { console.error(err); builtW = 0; }
  requestAnimationFrame(frame);
}
// wait for the mono face so the atlas isn't baked with a fallback font
Promise.race([document.fonts.load(`${11}px "JetBrains Mono"`), new Promise(r => setTimeout(r, 1500))]).catch(() => {}).then(start);
