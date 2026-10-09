// Finds the sword blade in every knight frame of index.html and prints the KSW table for the page.
// A blade is the longest straight run of glyphs with (almost) nothing beside it; the page keeps those
// cells rigid while the cloak and legs move.   usage: node tools/find_blades.cjs index.html
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const a = src.indexOf('const KNIGHT_ART = ['), b = src.indexOf('\n  ];', a);
const KA = eval(src.slice(a + 'const KNIGHT_ART = '.length, b + 4));
const AX = 0.6, AY = 0.9;   // a cell is 0.6 wide, 0.9 tall
function cells(f) { const L = f.split('\n'), top = +L[0], g = []; for (let k = 1; k < L.length; k++) for (let x = 0; x < L[k].length; x++) if (L[k][x] !== ' ') g.push([x, top + k - 1]); return g; }
function rng(s) { return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }
function detect(f, seed) {
  const g = cells(f), cand = g.filter(c => Math.abs(c[0] - 52) > 5 && c[1] > 24), r = rng(seed + 7);
  let best = null;
  for (let it = 0; it < 6000; it++) {
    const p = cand[(r() * cand.length) | 0], q = cand[(r() * cand.length) | 0];
    const ux = (q[0] - p[0]) * AX, uy = (q[1] - p[1]) * AY, len = Math.hypot(ux, uy);
    if (len < 6) continue;
    const nx = ux / len, ny = uy / len;
    if (Math.abs(ny) < 0.25) continue;   // blades are not horizontal
    // bin along the line: a bin is blade when it holds a glyph on the line and almost nothing beside it
    const NB = Math.ceil(80 / 0.6), off = 40, inB = new Int16Array(NB), clB = new Int16Array(NB);
    for (const c of g) {
      const px = (c[0] - p[0]) * AX, py = (c[1] - p[1]) * AY, t = px * nx + py * ny, d = Math.abs(px * ny - py * nx), k = Math.floor((t + off) / 0.6);
      if (k < 0 || k >= NB) continue;
      if (d < 1.05) inB[k]++; else if (d < 2.9) clB[k]++;
    }
    let bs = -1, be = -1, s0 = -1, gap = 0;
    for (let k = 0; k <= NB; k++) {
      const ok = k < NB && inB[k] > 0 && clB[k] <= 1;
      if (ok) { if (s0 < 0) s0 = k; gap = 0; }
      else if (s0 >= 0 && k < NB && inB[k] > 0 && clB[k] <= 3 && gap < 1) gap++;
      else { if (s0 >= 0 && (k - gap) - s0 > be - bs) { bs = s0; be = k - gap; } s0 = -1; gap = 0; }
    }
    if (bs < 0 || (be - bs) * 0.6 < 5) continue;
    const t0 = bs * 0.6 - off, t1 = be * 0.6 - off, L = (be - bs) * 0.6;
    if (!best || L > best.L) best = { L, v: [p[0] + nx * t0 / AX, p[1] + ny * t0 / AY, p[0] + nx * t1 / AX, p[1] + ny * t1 / AY] };
  }
  return best ? best.v.map(x => Math.round(x * 10)) : [-1, -1, -1, -1];
}
console.log('  const KSW = [' + KA.map((f, i) => detect(f, i)).flat().join(',') + '];');
