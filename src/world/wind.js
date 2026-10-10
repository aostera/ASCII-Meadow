// Gusts: rings of wind that sweep the grass outward (Space landing, a tap on the field, G).

const rings = [];
function gust(x, y) {
  rings.push({ x, y, r: 0, life: 1 });
  for (const m of motes) { const dx = m.x / CW + camX - x, dy = m.y / CH + camY - y, d = Math.hypot(dx, dy) + 1; m.kx = dx / d * 260; m.ky = dy / d * 160; }
}
