// Shared state: the canvases, the grid sizes and the per-cell grass arrays every system reads, and the
// clock. Rebuilt by build() (world/terrain.js) whenever the window size changes.

const cv = document.getElementById('c');
const ctx = cv.getContext('2d');  // overlay: names, prompts, fog, vignette. The world itself is drawn by the glyph batch.
const statsEl = document.getElementById('stats');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FONT = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';

let DPR, W, H, FS, CW, CH, COLS, ROWS, N, HZ = 0, VC, VR, bshade, bmask, segs, FR, TA;
let ang, vel, flat, push, shadow, height, seed, kind;

let t = 0;
