// The glyph batch: every glyph of a frame is written straight into one vertex buffer (gput) and drawn in a
// single call by renderer/webgl.js, or glyph by glyph by renderer/canvas2d.js.

// ---------- glyph batch: every glyph of a frame goes into one buffer, drawn in a single WebGL call ----------
// Sprites are rectangles in one atlas texture. Instances are drawn in order, so the painter's order of
// the old 2D code (grass behind, knight, grass in front of his legs) is kept. Falls back to 2D drawImage.
const GB = { n: 0, buf: new Float32Array(6 * 65536), spr: [], tex: null, atlasCv: null, sv: 0 };
let SOLID_CELL = 0, SOLID_FRONT = 0, SOLID_K = 0, KN0 = 0, KLV = 8, CAST = -1;
function sprite(u0, v0, uw, vh, w, h, ox, oy) { GB.spr.push([u0, v0, uw, vh, w, h, ox, oy]); return GB.spr.length - 1; }
// each glyph is six floats: its rectangle x0, y0, x1, y1, the sprite and the alpha. The GPU looks the
// sprite's uvs up in a table (renderer/webgl.js), so the CPU writes and uploads a third of what four
// corners would take. The buffer grows by doubling and always holds whole rows of the glyph texture.
// sprite table flattened for the hot path: dx, dy, w, h, u0, v0, u1, v1 per sprite
let SPF = new Float32Array(8);
function gput(sid, x, y, a) {
  if (GB.n * 6 + 6 > GB.buf.length) { const nb = new Float32Array(GB.buf.length * 2); nb.set(GB.buf); GB.buf = nb; }
  const S = SPF, q = sid * 8, b = GB.buf, o = GB.n++ * 6, x0 = x + S[q], y0 = y + S[q + 1];
  b[o] = x0; b[o + 1] = y0; b[o + 2] = x0 + S[q + 2]; b[o + 3] = y0 + S[q + 3]; b[o + 4] = sid; b[o + 5] = a;
}
// normalised uvs for the GPU, kept beside the pixel rects the 2D fallback uses
function normSprites(tw, th, from) {
  for (let i = from || 0; i < GB.spr.length; i++) { const s = GB.spr[i]; s[8] = s[0] / tw; s[9] = s[1] / th; s[10] = s[2] / tw; s[11] = s[3] / th; }
  syncSPF();
}
function syncSPF() {
  if (SPF.length < GB.spr.length * 8) SPF = new Float32Array(GB.spr.length * 8 + 64);
  GB.spr.forEach((s, i) => { const q = i * 8; SPF[q] = s[6]; SPF[q + 1] = s[7]; SPF[q + 2] = s[4]; SPF[q + 3] = s[5]; SPF[q + 4] = s[8]; SPF[q + 5] = s[9]; SPF[q + 6] = s[8] + s[10]; SPF[q + 7] = s[9] + s[11]; });
  GB.sv++;   // the GPU's copy of the uv table is stale
}
function grect(x, y, w, h, a) { // a dark block of any size, from the solid texel
  gput(SOLID_K, x, y, a);
  const b = GB.buf, o = (GB.n - 1) * 6;
  b[o] = x; b[o + 1] = y; b[o + 2] = x + w; b[o + 3] = y + h;
}
