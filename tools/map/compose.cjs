// Composes src/data/map.js from the generated world plus the set pieces below, through the editor's own
// functions (the same file «Сохранить» writes). usage: node tools/map/compose.cjs [out]
// A one-off authoring script: rerun it only to rebuild the starting map from scratch.
const path = require('path'), fs = require('fs');
const { launch, openGame } = require('../check/common.cjs');
(async () => {
  const out = process.argv[2] || path.join(__dirname, '../../src/data/map.js');
  const b = await launch();
  // always from the generated world, whatever map.js holds now
  const empty = 'const MEADOW_MAP = { "v": 1, "res": 4, "castle": null, "start": null, "fires": null, "trail": null, "cows": null, "toads": null, "events": null, "flora": null, "paint": {}, "fog": {} };';
  const g = await openGame(b, 'file://' + path.resolve(__dirname, '../../index.html'), { viewport: { width: 1280, height: 800 }, files: { 'src/data/map\\.js$': empty } });
  await g.step(10);
  const text = await g.page.evaluate(() => {
    edBake();   // the generated trees, cows, fires and start become map objects
    const M = MEADOW_MAP, sx = player.x, sy = player.y;
    const at = (dx, dy) => toModelXZ(sx + dx, sy + dy).map(edR1);       // cells off the knight's start
    const near = (p, q, r) => Math.hypot(p[0] - q[0], p[1] - q[1]) < r;
    const clear = (c, r) => { M.flora = M.flora.filter(f => !near([f[2], f[3]], c, r)); M.cows = M.cows.filter(k => !near(k, c, r)); };
    const paint = (c, rx, rz, code) => { for (let gx = c[0] - rx; gx <= c[0] + rx; gx += 4) for (let gz = c[1] - rz; gz <= c[1] + rz; gz += 4) { const e = ((gx - c[0]) / rx) ** 2 + ((gz - c[1]) / rz) ** 2 + (vnoise(gx * 0.03, gz * 0.03) - 0.5) * 0.5; if (e < 1) edSetPaint(Math.floor(gx / 4), Math.floor(gz / 4), code); } };
    const fog = (c, rx, rz, code) => { for (let gx = c[0] - rx; gx <= c[0] + rx; gx += 16) for (let gz = c[1] - rz; gz <= c[1] + rz; gz += 16) if (((gx - c[0]) / rx) ** 2 + ((gz - c[1]) / rz) ** 2 < 1) edSetFog(Math.floor(gx / 16), Math.floor(gz / 16), code); };
    const off = (c, dx, dz) => [edR1(c[0] + dx), edR1(c[1] + dz)];
    const side = (dRow, cells) => at(pathX(sy + dRow) - sx + cells, dRow);   // so many cells off the trail, dRow rows ahead
    const grassUnder = c => { const [x, y] = mapToCell(c[0], c[1]); return [x, y]; };
    // ---- the camp: left of the trail, a little ahead; a cooking fire, two whole tents and two torn ones,
    // a palisade at its back, a rail fence half round it, a few stones, the ground trodden bare
    const camp = side(-34, -140);
    clear(camp, 210); paint(camp, 120, 85, 8); paint(camp, 160, 110, 3);
    M.fires.push([...camp, 0, 'cook']);
    M.flora.push(['tent', 0, ...off(camp, -95, 50)], ['tent', 1, ...off(camp, 90, 62)], ['tent', 2, ...off(camp, -120, -35)], ['tent', 3, ...off(camp, 110, -22)]);
    M.flora.push(['fence', 4, ...off(camp, -55, 135)], ['fence', 4, ...off(camp, 55, 135)], ['fence', 0, ...off(camp, -175, 100)], ['fence', 1, ...off(camp, -212, 15)], ['fence', 2, ...off(camp, 180, 95)]);
    M.flora.push(['stone', 2, ...off(camp, 40, -62)], ['stone', 1, ...off(camp, -36, -75)], ['stone', 0, ...off(camp, 28, 28)], ['stone', 4, ...off(camp, -160, -85)]);
    M.cows.push(off(camp, 240, -55));   // one has wandered up to the camp
    // ---- a fence along the field right of the trail, by the start
    const fld = side(4, 38);
    M.flora.push(['fence', 0, ...fld], ['fence', 0, ...off(fld, 220, 0)], ['fence', 3, ...off(fld, 410, 65)]);
    // ---- the marsh: right of the trail, further on; open water in its middle, fog lying on it, toads and frogs
    const marsh = side(-58, 105);
    clear(marsh, 280); paint(marsh, 260, 150, 2); paint(marsh, 220, 105, 10); paint(off(marsh, 30, -10), 110, 50, 9);
    fog(marsh, 280, 150, 2); fog(off(marsh, 30, -10), 90, 45, 3);
    M.toads = [[...off(marsh, -190, -20)], [...off(marsh, 140, -80)], [...off(marsh, -60, 40), 'frog'], [...off(marsh, 60, -40), 'frog'], [...off(marsh, 150, 45), 'frog']];
    M.flora.push(['stone', 5, ...off(marsh, -250, -70)], ['stone', 8, ...off(marsh, -225, -100)], ['dead', 1, ...off(marsh, 210, 110)], ['dead', 2, ...off(marsh, -215, 100)]);
    paint(off(marsh, -270, -120), 60, 35, 5);   // a stony bank
    // ---- tall grass ahead on the trail's left, birds hidden in it
    const grass = side(-74, -48);
    clear(grass, 110); paint(grass, 120, 70, 2);
    M.events = [['birds', ...grass]];
    // the rest: a lone boulder and a few stones by the trail
    M.flora.push(['stone', 8, ...side(-10, -16)], ['stone', 3, ...side(-36, 16)], ['stone', 6, ...side(10, -22)]);
    return mapFileText();
  });
  fs.writeFileSync(out, text);
  console.log('wrote', out, text.length, 'bytes');
  await b.close();
})();
