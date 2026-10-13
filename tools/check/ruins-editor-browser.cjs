// Gothic landmarks are first-class editor objects, not hard-coded background.
// Runs against the real editor and geometry, with export, undo and resize QA.
const assert = require('node:assert/strict');
const path = require('node:path');
const { launch, openGame, realErrors } = require('./common.cjs');
const url = 'file://' + path.resolve(__dirname, '../../index.html');

(async () => {
  const browser = await launch();
  try {
    for (const [mode, viewport] of [
      ['gl', {width: 960, height: 600}],
      ['2d', {width: 390, height: 844}]
    ]) {
      const {ctx, page, step, errs} = await openGame(browser, url, {mode, viewport});
      try {
        await step(3);
        const result = await page.evaluate(() => {
          const initial = mapFileText(), floraCount = MEADOW_MAP.flora.length;
          const tools = ['ruin-gate', 'ruin-abbey', 'ruin-cloister']
            .every(t => !!document.querySelector('[data-tool="' + t + '"]'));
          openEditor();
          // Existing ruins are far from the player's spawn. Move the editor
          // camera over the first landmark before testing actual pick targets.
          const [rx, ry] = mapToCell(ruins[0].x, ruins[0].z);
          camX = rx - VC / (VZ * 2); camY = ry - VR / (VZ * 2);
          const ui = edObjects().filter(x => x.kind === 'ruins');
          const firstMarker = ui.find(o => o.mi === 0);
          const picked = firstMarker &&
            edPick(firstMarker.sx, firstMarker.sy - Math.min(8, firstMarker.top * .3))?.kind === 'ruins';
          const original = MEADOW_MAP.ruins.map(x => x.slice());
          const initialProps = props.filter(x => x.ruinId).length;
          edPlace('ruin-gate', -420, -1550);
          const placed = MEADOW_MAP.ruins.map(x => x.slice());
          const point = ruins[3], prop = props.find(p => p.ruinId === point.id);
          const placedCorrectly = point.type === 'gate' && point.x === -420 &&
            point.z === -1550 && prop?.spots.length === 2;
          ED.sel = {kind: 'ruins', mi: 3};
          edMoveSelected(-380, -1490);
          const moved = MEADOW_MAP.ruins[3].slice();
          edStepVariant(1); // real 15-degree rotation + rebuilt collsions
          const rotated = MEADOW_MAP.ruins[3].slice();
          const movingEvidence = ruins[3].x === -380 && ruins[3].z === -1490 &&
            Math.abs(ruins[3].yaw - rotated[4]) < 1e-9;
          const target = ruins[3];
          const world = (x,z) => mapToCell(...ruinWorldXZ(target,x,z));
          const from = world(target.arch / 2 + 14,-target.depth / 2 - 25);
          const to = world(target.arch / 2 + 14,target.depth / 2 + 25);
          const blocked = ruinsBlockMove(to[0],to[1],
            {x:from[0],y:from[1],hT:0,jump:0,cls:'knight'});
          const centerFrom = world(0,-target.depth / 2 - 25),
            centerTo = world(0,target.depth / 2 + 25);
          const passable = !ruinsBlockMove(centerTo[0],centerTo[1],
            {x:centerFrom[0],y:centerFrom[1],hT:0,jump:0,cls:'knight'});
          const stored = mapFileText(), parsed = parseMapText(stored);
          const beforeImport = JSON.stringify(MEADOW_MAP.ruins);
          applyWholeMap(parsed);
          const importSame = JSON.stringify(MEADOW_MAP.ruins) === beforeImport;
          ED.sel = {kind:'ruins',mi:3};
          edDeleteSelected();
          const removed = ruins.length === 3 && props.filter(x => x.ruinId).length === 3;
          edUndo();
          const restored = MEADOW_MAP.ruins.length === 4 && ruins.length === 4;
          edRedo();
          const deletedAgain = ruins.length === 3 && MEADOW_MAP.ruins.length === 3;
          edUndo();
          const restoredAgain = ruins.length === 4;
          // A legacy map without a ruins field must still show all 3 defaults.
          const legacy = parseMapText(initial);
          delete legacy.ruins;
          applyWholeMap(legacy);
          const legacyDefaults = ruins.map(r => r.id).join('|') ===
            RUIN_SITES.map(r => r.id).join('|');
          // Explicit [] is intentional removal, not a fallback to defaults.
          applyWholeMap({...legacy, ruins: []});
          const empty = ruins.length === 0 && props.every(p => !p.ruinId);
          applyWholeMap(parsed);
          const final = JSON.stringify(MEADOW_MAP.ruins) === beforeImport &&
            ruins.length === 4 && props.filter(p => p.ruinId).length === 4;
          const vegetation = MEADOW_MAP.flora.length === floraCount;
          ED.sel = {kind:'ruins',mi:0};
          edSyncUI();
          const rotationUI = ED.ui.variantOut.textContent.includes('Поворот');
          closeEditor();
          return { tools,initialProps,ui:ui.length,picked,original,placed:placed.length,
            placedCorrectly,moved,rotated,movingEvidence,blocked,passable,
            importSame,removed,restored,deletedAgain,restoredAgain,legacyDefaults,
            empty,final,vegetation,rotationUI };
        });
        assert(result.tools && result.ui >= 1 && result.initialProps === 3 && result.picked,
          'ruins palette, viewport marker, selectable building and E spots: '+JSON.stringify(result));
        assert.equal(result.placed, 4);
        assert(result.placedCorrectly && result.movingEvidence && result.blocked && result.passable,
          'new model must place, move, rotate and carry true wall/arch collision and E spots');
        assert.equal(result.rotated[4] !== result.moved[4], true,
          'rotating the selected ruin must change saved yaw');
        for (const key of ['importSame','removed','restored','deletedAgain',
          'restoredAgain','legacyDefaults','empty','final','vegetation','rotationUI'])
          assert(result[key], key+' regression in '+mode+' '+viewport.width);
        assert.deepEqual(realErrors(errs), [], 'browser console errors');
        console.log('PASS Gothic editor '+mode+' '+viewport.width+
          ': palette, pick, place, rotate, drag, 3D rebuild, arch, E, undo/redo, export and legacy');
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
