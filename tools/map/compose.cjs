// REGENERATES an example map from the generated world. NOT a way to import a designer's map.
// To preserve editor exports exactly, use node tools/map/import.cjs <map.js> --apply.
// Default output goes into ignored dist/ instead of overwriting src/data/map.js.
// For an explicit destructive overwrite, pass --allow-overwrite-map.
const path = require('path'), fs = require('fs');
const { launch, openGame } = require('../check/common.cjs');
(async () => {
  const flags = process.argv.slice(2), allowOverwrite = flags.includes('--allow-overwrite-map');
  if (flags.some(a => a.startsWith('--') && a !== '--allow-overwrite-map')) throw new Error('Unknown flag');
  const positional = flags.filter(a => !a.startsWith('--'));
  if (positional.length > 1) throw new Error('Usage: node tools/map/compose.cjs [output] [--allow-overwrite-map]');
  const out = path.resolve(positional[0] || path.join(__dirname, '../../dist/generated-map.js'));
  const live = path.resolve(__dirname, '../../src/data/map.js');
  if (out === live && !allowOverwrite) {
    throw new Error('Refusing to regenerate src/data/map.js! To import a designer export without changes, use: node tools/map/import.cjs <file> --apply');
  }
  const b = await launch();
  // always from the generated world, whatever map.js holds now
  const empty = 'const MEADOW_MAP = { "v": 1, "res": 4, "castle": null, "start": null, "fires": null, "trail": null, "cows": null, "toads": null, "events": null, "flora": null, "paint": {}, "fog": {} };';
  const g = await openGame(b, 'file://' + path.resolve(__dirname, '../../index.html'), { viewport: { width: 1280, height: 800 }, files: { 'src/data/map\\.js$': empty } });
  await g.step(10);
  const text = await g.page.evaluate(() => {
    edBake();   // the generated trees, cows, fires and start become map objects
    const M = MEADOW_MAP, sx = player.x, sy = player.y;
    M.fires = M.fires.filter(f => f.length > 2);   // no campfire by the trail: the knight starts at the camp's fire
    const at = (dx, dy) => toModelXZ(sx + dx, sy + dy).map(edR1);       // cells off the knight's start
    const near = (p, q, r) => Math.hypot(p[0] - q[0], p[1] - q[1]) < r;
    const clear = (c, r) => { M.flora = M.flora.filter(f => !near([f[2], f[3]], c, r)); M.cows = M.cows.filter(k => !near(k, c, r)); };
    const paint = (c, rx, rz, code) => { for (let gx = c[0] - rx; gx <= c[0] + rx; gx += 4) for (let gz = c[1] - rz; gz <= c[1] + rz; gz += 4) { const e = ((gx - c[0]) / rx) ** 2 + ((gz - c[1]) / rz) ** 2 + (vnoise(gx * 0.03, gz * 0.03) - 0.5) * 0.5; if (e < 1) edSetPaint(Math.floor(gx / 4), Math.floor(gz / 4), code); } };
    const fog = (c, rx, rz, code) => { for (let gx = c[0] - rx; gx <= c[0] + rx; gx += 16) for (let gz = c[1] - rz; gz <= c[1] + rz; gz += 16) if (((gx - c[0]) / rx) ** 2 + ((gz - c[1]) / rz) ** 2 < 1) edSetFog(Math.floor(gx / 16), Math.floor(gz / 16), code); };
    const off = (c, dx, dz) => [edR1(c[0] + dx), edR1(c[1] + dz)];
    const side = (dRow, cells) => at(pathX(sy + dRow) - sx + cells, dRow);   // so many cells off the trail, dRow rows ahead
    // a trodden path along a curve a -> b bending at c: trail paint (code 7) r units wide, nothing growing on it
    const path = (a, c, b, r) => {
      const pts = [];
      for (let k = 0; k <= 80; k++) {
        const t = k / 80, u = 1 - t, x = u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], z = u * u * a[1] + 2 * u * t * c[1] + t * t * b[1];
        const w = (vnoise(t * 6, 3.7) - 0.5) * 26 * Math.sin(t * Math.PI);   // it wanders a little, not at its ends
        const tx = 2 * u * (c[0] - a[0]) + 2 * t * (b[0] - c[0]), tz = 2 * u * (c[1] - a[1]) + 2 * t * (b[1] - c[1]), l = Math.hypot(tx, tz) || 1;
        pts.push([x - tz / l * w, z + tx / l * w]);
      }
      M.flora = M.flora.filter(f => !/^(tree|bush|dead|stone)$/.test(f[0]) || !pts.some(p => near([f[2], f[3]], p, r + 30)));   // the camp's own things stay
      for (const p of pts) for (let gx = p[0] - r; gx <= p[0] + r; gx += 4) for (let gz = p[1] - r; gz <= p[1] + r; gz += 4) if ((gx - p[0]) ** 2 + (gz - p[1]) ** 2 < r * r) edSetPaint(Math.floor(gx / 4), Math.floor(gz / 4), 7);
    };
    // ---- the camp: left of the trail, a little ahead; a cooking fire, two whole tents and two torn ones,
    // a palisade at its back, a rail fence half round it, a few stones, the ground trodden bare
    const camp = side(-34, -140);
    clear(camp, 210); paint(camp, 120, 85, 8); paint(camp, 160, 110, 3);
    M.fires.push([...camp, 0, 'cook']);
    M.flora.push(['tent', 0, ...off(camp, -95, 50)], ['tent', 1, ...off(camp, 90, 62)], ['tent', 2, ...off(camp, -120, -35)], ['tent', 3, ...off(camp, 110, -22)]);
    M.flora.push(['fence', 4, ...off(camp, -55, 135)], ['fence', 4, ...off(camp, 55, 135)], ['fence', 0, ...off(camp, -175, 100)], ['fence', 1, ...off(camp, -212, 15)], ['fence', 2, ...off(camp, 180, 95)]);
    M.flora.push(['stone', 2, ...off(camp, -105, -115)], ['stone', 1, ...off(camp, -46, -82)], ['stone', 0, ...off(camp, 28, 28)], ['stone', 4, ...off(camp, -160, -85)]);
    M.start = off(camp, 18, -48);   // the knight wakes by the fire
    M.cows.push(off(camp, 240, -55));   // one has wandered up to the camp
    // ---- a fence along the field right of the trail, by the start
    const fld = side(4, 38);
    M.flora.push(['fence', 0, ...fld], ['fence', 0, ...off(fld, 220, 0)], ['fence', 3, ...off(fld, 410, 65)]);
    // ---- the marsh: beside the camp, west of it; open water in its middle, fog lying on it, toads and frogs.
    // Everything of it stays east of x = -1100: the world is only ±1160 wide on small screens
    const marsh = off(camp, -440, 40);
    clear(marsh, 215); paint(marsh, 215, 140, 2); paint(marsh, 180, 100, 10); paint(off(marsh, 20, -10), 95, 45, 9);   // clear only its own ground: the camp's west fence stands 228 off
    fog(marsh, 230, 140, 2); fog(off(marsh, 20, -10), 80, 40, 3);
    M.toads = [[...off(marsh, -150, -15)], [...off(marsh, 120, -70)], [...off(marsh, -50, 40), 'frog'], [...off(marsh, 50, -35), 'frog'], [...off(marsh, 125, 40), 'frog']];
    M.flora.push(['stone', 5, ...off(marsh, -200, -95)], ['stone', 8, ...off(marsh, -165, -125)], ['dead', 1, ...off(marsh, 165, 120)], ['dead', 2, ...off(marsh, -185, 95)]);
    paint(off(marsh, -175, -140), 55, 32, 5);   // a stony bank
    // ---- tall grass ahead on the trail's left, birds hidden in it
    const grass = side(-74, -48);
    clear(grass, 110); paint(grass, 120, 70, 2);
    M.events = [['birds', ...grass]];
    // the rest: a lone boulder and a few stones by the trail
    M.flora.push(['stone', 8, ...side(-10, -16)], ['stone', 3, ...side(-36, 16)], ['stone', 6, ...side(10, -22)]);
    // ---- last, so nothing placed above stands on it: the camp's own path, out of the camp eastwards,
    // bending north onto the road to the castle
    const join = side(-56, 0);
    path(off(camp, 60, -95), [join[0] - 60, camp[1] - 80], join, 13);
    return mapFileText();
  });
  fs.writeFileSync(out, text);
  console.log('wrote', out, text.length, 'bytes');
  await b.close();
})();
