// Small life of the meadow: butterflies, drifting ash and dew glints.

// butterflies & pollen
const flies = [], motes = [], dew = [];
function seedLife() {
  flies.length = 0; motes.length = 0;
  const nf = Math.round(COLS * ROWS / 4000) + 3;
  for (let k = 0; k < nf; k++) flies.push({ x: Math.random() * COLS, y: HZ + 2 + Math.random() * (ROWS - HZ - 4), vx: 0, vy: 0, ph: Math.random() * 6, c: C_WHITE, hx: Math.random() * COLS, hy: HZ + 2 + Math.random() * (ROWS - HZ - 4) });
  const nm = Math.round(W * H / 9000);
  for (let k = 0; k < nm; k++) motes.push({ x: Math.random() * W, y: Math.random() * H, z: 0.4 + Math.random() * 0.6, ph: Math.random() * 6 });
}

// Butterflies, ash and dew.
function updateLife(dt) {
  const amp = reduced ? 0.35 : 1;
  // butterflies: drift toward a wandering home, scatter from anyone walking close
  for (const f of flies) {
    f.ph += dt * 14;
    if (Math.random() < dt * 0.25) { f.hx = Math.random() * COLS; f.hy = HZ + 2 + Math.random() * (ROWS - HZ - 4); }
    let ax = (f.hx - f.x) * 0.25, ay = (f.hy - f.y) * 0.25;
    for (const e of ents) {
      const dx = f.x - e.x, dy = (f.y - e.y + 2) * (CH / CW), d = Math.hypot(dx, dy);
      if (d < 9) { ax += dx / (d + 0.5) * 40; ay += dy / (d + 0.5) * 25; }
    }
    f.vx = (f.vx + ax * dt) * Math.exp(-1.8 * dt); f.vy = (f.vy + ay * dt) * Math.exp(-1.8 * dt);
    f.x += (f.vx + Math.sin(f.ph * 0.31) * 3) * dt; f.y += (f.vy + Math.cos(f.ph * 0.23) * 2) * dt;
  }
  // pollen motes ride the wind
  for (const m of motes) {
    m.ph += dt;
    m.kx = (m.kx || 0) * Math.exp(-2 * dt); m.ky = (m.ky || 0) * Math.exp(-2 * dt);
    m.x += (14 + Math.sin(m.ph * 0.7) * 10) * m.z * dt * amp + m.kx * dt;
    m.y += (-4 + Math.cos(m.ph * 0.9) * 6) * m.z * dt * amp + m.ky * dt;
    if (m.x > W + 10) m.x = -10; if (m.x < -10) m.x = W + 10;
    if (m.y < -10) m.y = H + 10; if (m.y > H + 10) m.y = -10;
  }
  // dew glints
  if (!reduced && Math.random() < dt * 9) { const i = ((VY0 + Math.random() * (VY1 - VY0)) | 0) * COLS + ((VX0 + Math.random() * (VX1 - VX0)) | 0); if (kind[i] === 1 && height[i] > 0.5) dew.push({ i, life: 1 }); }
  for (let j = dew.length - 1; j >= 0; j--) if ((dew[j].life -= dt * 2.2) <= 0) dew.splice(j, 1);
}
