// The glyph batch: every glyph of a frame is written straight into one vertex buffer (gput) and drawn in a
// single call by renderer/webgl.js, or glyph by glyph by renderer/canvas2d.js.

// ---------- glyph batch: every glyph of a frame goes into one buffer, drawn in a single WebGL call ----------
// Sprites are rectangles in one atlas texture. Instances are drawn in order, so the painter's order of
// the old 2D code (grass behind, knight, grass in front of his legs) is kept. Falls back to 2D drawImage.
const GB = { n: 0, buf: new Float32Array(20 * 65536), spr: [], tex: null, atlasCv: null };
let SOLID_CELL = 0, SOLID_FRONT = 0, SOLID_K = 0, KN0 = 0, KLV = 8, CAST = -1;
function sprite(u0, v0, uw, vh, w, h, ox, oy) { GB.spr.push([u0, v0, uw, vh, w, h, ox, oy]); return GB.spr.length - 1; }
// each glyph writes its four corners straight into the vertex buffer: x, y, u, v, alpha
// sprite table flattened for the hot path: dx, dy, w, h, u0, v0, u1, v1 per sprite
let SPF = new Float32Array(8);
function gput(sid, x, y, a) {
  if (GB.n * 20 + 20 > GB.buf.length) { const nb = new Float32Array(GB.buf.length * 2); nb.set(GB.buf); GB.buf = nb; }
  const S = SPF, q = sid * 8, b = GB.buf, o = GB.n++ * 20;
  const x0 = x + S[q], y0 = y + S[q + 1], x1 = x0 + S[q + 2], y1 = y0 + S[q + 3], u0 = S[q + 4], v0 = S[q + 5], u1 = S[q + 6], v1 = S[q + 7];
  b[o] = x0; b[o + 1] = y0; b[o + 2] = u0; b[o + 3] = v0; b[o + 4] = a;
  b[o + 5] = x1; b[o + 6] = y0; b[o + 7] = u1; b[o + 8] = v0; b[o + 9] = a;
  b[o + 10] = x0; b[o + 11] = y1; b[o + 12] = u0; b[o + 13] = v1; b[o + 14] = a;
  b[o + 15] = x1; b[o + 16] = y1; b[o + 17] = u1; b[o + 18] = v1; b[o + 19] = a;
}
// normalised uvs for the GPU, kept beside the pixel rects the 2D fallback uses
function normSprites(tw, th, from) {
  for (let i = from || 0; i < GB.spr.length; i++) { const s = GB.spr[i]; s[8] = s[0] / tw; s[9] = s[1] / th; s[10] = s[2] / tw; s[11] = s[3] / th; }
  syncSPF();
}
function syncSPF() {
  if (SPF.length < GB.spr.length * 8) SPF = new Float32Array(GB.spr.length * 8 + 64);
  GB.spr.forEach((s, i) => { const q = i * 8; SPF[q] = s[6]; SPF[q + 1] = s[7]; SPF[q + 2] = s[4]; SPF[q + 3] = s[5]; SPF[q + 4] = s[8]; SPF[q + 5] = s[9]; SPF[q + 6] = s[8] + s[10]; SPF[q + 7] = s[9] + s[11]; });
}
const gid = (ci, b) => ci * NB + b;
function grect(x, y, w, h, a) { // a dark block of any size, from the solid texel
  const s = GB.spr[SOLID_K];
  gput(SOLID_K, x, y, a);
  const b = GB.buf, o = (GB.n - 1) * 20;
  b[o + 5] = b[o + 15] = x + w; b[o + 11] = b[o + 16] = y + h; b[o] = b[o + 10] = x; b[o + 1] = b[o + 6] = y;
}
