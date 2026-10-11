// One-to-one map round-trip: ship the editor's actual export, re-open it, then assert
// every ground/wet cell and every saved object's world position is unchanged.
// Do not silently accept a structurally correct map that renders in different places.
const path = require('path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { launch, openGame, realErrors } = require('./common.cjs');
const URL = 'file://' + path.resolve(__dirname, '../../index.html');
const viewports = [{ width: 960, height: 600 }, { width: 390, height: 844 }, { width: 640, height: 400 }];

function hash(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
const snapshot = page => page.evaluate(() => {
  const hex = a => { // FNV1a over bytes, exact cell arrays (no sample/average)
    const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    let n = 2166136261;
    for (let i = 0; i < b.length; i++) { n ^= b[i]; n = Math.imul(n, 16777619); }
    return (n >>> 0).toString(16);
  };
  const round = n => Math.round(n * 1e6) / 1e6;
  const expected = MEADOW_MAP;
  return {
    grid: [COLS, ROWS], world: [round(WS), round(MS)],
    kind: hex(kind), wet: hex(wet), segs: hex(segs), height: hex(height),
    paint: savePaint(), fog: saveFog(),
    flora: flora.map(o => [o.mi, o.v.type, variantsOf(o.v.type).indexOf(o.v), round(o.x), round(o.y)]),
    cows: cows.map(o => [o.mi, round(o.home[0]), round(o.home[1])]),
    fires: braziers.map(o => [o.mi, round(o.x), round(o.y), round(o.lift), !!o.ground, !!o.cook]),
    start: expected.start, castle: expected.castle,
    toads: expected.toads, events: expected.events,
    // Some authored trees can be outside the current viewport's finite grid.
    missingFlora: expected.flora === null ? null : expected.flora.length - flora.length,
    firePos: (expected.fires || []).map((f, i) => {
      const b = braziers.find(b => b.mi === i); if (!b) return null;
      if (f[2] > 0) return cellToCastle(b.x, b.y).map(round);
      // The renderer deliberately anchors the three entrance fires to castle scale on mobile:
      // check their stored coordinate in the correct (castle or map) frame.
      return (castleFrontFire(f[0], f[1]) ? cellToCastle(b.x, b.y) : toModelXZ(b.x, b.y)).map(round);
    })
  };
});
(async () => {
  const browser = await launch();
  try {
    for (const viewport of viewports) {
      const original = await openGame(browser, URL, { viewport });
      await original.step(5);
      const source = await original.page.evaluate(() => mapFileText());
      const before = await snapshot(original.page);
      const authored = await original.page.evaluate(() => {
        const within = (a, b, epsilon) => Math.abs(a - b) <= epsilon;
        const misplacedFlora = [];
        for (const f of (MEADOW_MAP.flora === null ? [] : flora)) {
          const e = MEADOW_MAP.flora[f.mi];
          if (!e) { misplacedFlora.push({ mi: f.mi, reason: 'unexpected object' }); continue; }
          const [gx, gz] = toModelXZ(f.x, f.y);
          // The grass-grid y coordinate is rounded to the nearest cell when placing a tree.
          const zEpsilon = CH / (2 * SINP * WS) + 0.15;
          if (e[0] !== f.v.type || e[1] !== variantsOf(f.v.type).indexOf(f.v) ||
              !within(gx, e[2], 0.15) || !within(gz, e[3], zEpsilon))
            misplacedFlora.push({ mi: f.mi, want: e, got: [gx, gz] });
        }
        const misplacedCows = (MEADOW_MAP.cows === null ? [] : cows).filter(c => {
          const [gx, gz] = toModelXZ(c.home[0], c.home[1]), expected = MEADOW_MAP.cows[c.mi];
          return !expected || !within(gx, expected[0], 0.15) || !within(gz, expected[1], 0.15);
        }).map(c => c.mi);
        const badFireKinds = (MEADOW_MAP.fires === null ? [] : braziers).filter((fire, i) => !!fire.cook !== (MEADOW_MAP.fires[i][3] === 'cook')).map(fire => fire.mi);
        return { expectedFlora: MEADOW_MAP.flora?.length ?? null, actualFlora: flora.length,
          expectedCows: MEADOW_MAP.cows?.length ?? null, actualCows: cows.length,
          expectedFires: MEADOW_MAP.fires?.length ?? null, actualFires: braziers.length,
          misplacedFlora, misplacedCows, badFireKinds };
      });
      if (before.missingFlora !== null) assert.equal(before.missingFlora, 0, 'authored flora silently omitted near terrain edges');
      if (authored.expectedFlora !== null) assert.equal(authored.actualFlora, authored.expectedFlora, 'not all designer plants were rendered');
      if (authored.expectedCows !== null) assert.equal(authored.actualCows, authored.expectedCows, 'not all designer cows were rendered');
      if (authored.expectedFires !== null) assert.equal(authored.actualFires, authored.expectedFires, 'not all designer fires were rendered');
      assert.deepEqual(authored.misplacedFlora, [], 'some designer plants shifted or changed variant');
      assert.deepEqual(authored.misplacedCows, [], 'some cows shifted from the coordinates saved in the editor');
      assert.deepEqual(authored.badFireKinds, [], 'cooking fires changed type');
      const imgBefore = hash(await original.page.screenshot({ animations: 'disabled' }));
      assert.deepEqual(before.firePos.map((v, i) => v && v.map(n => Math.round(n * 10) / 10)), (await original.page.evaluate(() => MEADOW_MAP.fires || [])).map(f => f.slice(0, 2)),
        'all saved fire positions must match their displayed coordinates');
      const errs1 = realErrors(original.errs);
      assert.deepEqual(errs1, [], 'editor/source browser console');
      await original.ctx.close();

      // Open precisely the exported file in a brand-new browser context, not the original globals.
      const replay = await openGame(browser, URL, {
        viewport, files: { 'src/data/map\\.js$': source }
      });
      await replay.step(5);
      const after = await snapshot(replay.page);
      const imgAfter = hash(await replay.page.screenshot({ animations: 'disabled' }));
      assert.deepEqual(after, before, 'full map state changed after the export/import round-trip');
      assert.equal(imgAfter, imgBefore, 'same-size exported map renders different screenshot pixels');
      assert.deepEqual(realErrors(replay.errs), [], 'imported map browser console');

      // Also test the UI import operation on the running instance: it must not shift or drop items.
      await replay.page.evaluate(() => { applyWholeMap(parseMapText(mapFileText())); });
      const imported = await snapshot(replay.page);
      assert.deepEqual(imported, before, 'loading file inside editor changed the map');
      await replay.ctx.close();
      console.log('PASS 1:1 map round-trip ' + viewport.width + 'x' + viewport.height +
        ', ' + before.flora.length + ' flora, ' + before.fires.length + ' fires, ' +
        before.cows.length + ' cows; screenshot SHA-256 ' + imgBefore.slice(0, 12));
    }
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });