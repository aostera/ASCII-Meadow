// Masonry occlusion for a jumping knight, without touching src/.
//
// The source occlude() (castle) and occludeRuins() (ruins) redraw every stone
// cell whose ground depth lies in front of the actor's GROUND foot point
// (dep > feet), but only inside a scan window sized for a STANDING body:
//   top = e.y - (liftPx + knightPx) / CH - 2
// A jump draws the sprite jumpPx higher (geomOf), so the raised head and
// shoulders leave that window. Stone in front of him then covers the lower
// body but stops at a straight row: the building visibly slices him in two.
//
// Fix: keep the source comparison (ground foot point, unchanged) and only
// extend the scan window upward by jumpPx, i.e. over the rows the jumping
// sprite actually occupies. Stone behind him (dep <= feet) is never drawn
// over him, standing or airborne; stone genuinely in front covers him the
// same way it does on the ground.

// Extra rows [y0, y1] (inclusive) a jump adds above the source scan window,
// or null when the actor is on the ground.
export function jumpOcclusionRows(y, liftPx, knightPx, jumpPx, CH) {
  if (!(jumpPx > 0) || !(CH > 0)) return null;
  const standingTop = Math.floor(y - (liftPx + knightPx) / CH - 2);
  const jumpingTop = Math.floor(y - (liftPx + knightPx + jumpPx) / CH - 2);
  return jumpingTop < standingTop ? {y0: jumpingTop, y1: standingTop - 1} : null;
}

// Same per-cell rule as the source occluders, over a band of rows only.
// grid: {x0, x1, y0, y1, w, lum, dep, glyph, lev}; returns covered cells.
export function coverBand(grid, band, xa, xb, feet, put) {
  const ya = Math.max(grid.y0, band.y0), yb = Math.min(grid.y1, band.y1);
  const left = Math.max(grid.x0, xa), right = Math.min(grid.x1, xb);
  let covered = 0;
  for (let y = ya; y <= yb; y++) for (let x = left; x <= right; x++) {
    const k = (y - grid.y0) * grid.w + (x - grid.x0);
    if (grid.lum[k] < 0 || grid.dep[k] <= feet + 1.5) continue;
    put(x, y, grid.glyph[k], grid.lev[k]);
    covered++;
  }
  return covered;
}

// Wrap the source occluders in place (they are global script functions).
export function installJumpOcclusion() {
  if (typeof occludeRuins !== 'function' || typeof occlude !== 'function' ||
      typeof jumpPx !== 'function') return null;
  const stats = {cells: 0, frames: 0};
  const sourceOcclude = occlude, sourceOccludeRuins = occludeRuins;
  const put = (x, y, glyph, lev) => {
    gput(SOLID_CELL, x * CW, y * CH, 1);
    if (glyph >= 0) blit(glyph, lev, x * CW, y * CH);
  };
  const band = e => {
    const air = jumpPx(e);
    if (!(air > 0)) return null;
    const rows = jumpOcclusionRows(e.y, liftPx(e), knightPx(), air, CH);
    if (!rows) return null;
    const hw = knightPx() * .7 / CW;
    return {rows, xa: Math.floor(e.x - hw), xb: Math.ceil(e.x + hw), feet: (e.y + .7) * CH};
  };
  occlude = function nativeJumpOcclude(e) {
    sourceOcclude(e);
    const C = cathedral, b = C.cv && band(e);
    if (!b) return;
    stats.cells += coverBand({x0: C.cx0, x1: C.cx0 + C.BW - 1, y0: C.cy0, y1: C.cy0 + C.BH - 1,
      w: C.BW, lum: C.lum, dep: C.dep, glyph: C.glyph, lev: C.lev}, b.rows, b.xa, b.xb, b.feet, put);
  };
  occludeRuins = function nativeJumpOccludeRuins(e) {
    sourceOccludeRuins(e);
    const b = ruins.length && band(e);
    if (!b) return;
    stats.frames++;
    for (const r of ruins)
      stats.cells += coverBand({x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y1, w: r.gridW,
        lum: r.lum, dep: r.dep, glyph: r.glyph, lev: r.lev}, b.rows, b.xa, b.xb, b.feet, put);
  };
  return {stats, sourceOcclude, sourceOccludeRuins};
}
