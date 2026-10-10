// Gusts: rings of wind that sweep the grass outward (Space landing, a tap on the field, G).

const rings = [];
function gust(x, y) {
  rings.push({ x, y, r: 0, life: 1 });
  for (const m of motes) { const dx = m.x / CW + camX - x, dy = m.y / CH + camY - y, d = Math.hypot(dx, dy) + 1; m.kx = dx / d * 260; m.ky = dy / d * 160; }
}

// Gust rings grow and fade, pushing the grass on their edge outward.
function updateGusts(dt) {
  for (let k = rings.length - 1; k >= 0; k--) {
    const g = rings[k];
    g.r += dt * 60; g.life -= dt * 0.85;
    if (g.life <= 0) { rings.splice(k, 1); continue; }
    const band = 5, ry = (g.r + band) * (CW / CH);
    const x0 = Math.max(0, Math.floor(g.x - g.r - band)), x1 = Math.min(COLS - 1, Math.ceil(g.x + g.r + band));
    const y0 = Math.max(0, Math.floor(g.y - ry)), y1 = Math.min(ROWS - 1, Math.ceil(g.y + ry));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - g.x, dy = (y + 0.5 - g.y) * (CH / CW);
      const d = Math.hypot(dx, dy), off = Math.abs(d - g.r);
      if (off > band) continue;
      push[y * COLS + x] += Math.sign(dx || 0.01) * (1 - off / band) * 3.2 * g.life * (Math.abs(dx) / (d + 0.001) * 0.7 + 0.3);
    }
  }
}
