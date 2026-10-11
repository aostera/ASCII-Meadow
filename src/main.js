// Entry: the frame loop and the start once the mono font has loaded.

// ---------- loop ----------
let last = performance.now(), acc = 0, frameCount = 0;
let builtW = 0, builtH = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
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
