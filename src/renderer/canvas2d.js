// 2D canvas fallback of the glyph batch, used when WebGL2 is not available.

// 2D fallback: the same batch, one drawImage per glyph
function flush2D(camx, camy, castle) {
  const g = GL.ctx2; if (!g) return;
  const s = DPR * VZ;
  g.setTransform(s, 0, 0, s, -camx * s, -camy * s);
  g.fillStyle = '#0c0c0c'; g.fillRect(camx, camy, W / VZ, H / VZ);
  if (castle) {
    g.globalAlpha = castle.a; g.drawImage(cathedral.cv, castle.x, castle.y, cathedral.BW * CW, cathedral.BH * CH);
    if (castle.flash > 0.02) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = castle.flash; g.drawImage(cathedral.cv, castle.x, castle.y, cathedral.BW * CW, cathedral.BH * CH); g.globalCompositeOperation = 'source-over'; }
  }
  const A = GB.atlasCv, b = GB.buf, S = SPF, aw = A.width, ah = A.height;
  for (let i = 0; i < GB.n; i++) {
    const o = i * 6, q = b[o + 4] * 8;
    g.globalAlpha = b[o + 5];
    g.drawImage(A, S[q + 4] * aw, S[q + 5] * ah, (S[q + 6] - S[q + 4]) * aw, (S[q + 7] - S[q + 5]) * ah, b[o], b[o + 1], b[o + 2] - b[o], b[o + 3] - b[o + 1]);
  }
  g.globalAlpha = 1;
}
