// The simulation step, in the order every system updates.

function simulate(dt) {
  t += dt;
  let mx = 0, my = 0;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  if (keys.has('w') || keys.has('arrowup')) my -= 1;
  if (keys.has('s') || keys.has('arrowdown')) my += 1;
  let run = keys.has('shift');
  if (ptr && ptr.held) {
    const dx = ptr.x / CW + camX - player.x, dy = (ptr.y / CH + camY - player.y) * (CH / CW), dd = Math.hypot(dx, dy);
    if (dd > 1.5) { mx = dx; my = dy; }
    if (dd > 28) run = true;   // drag far from the knight to run
  }
  player.inp = [mx, my];
  // running eases in and out over a few strides' worth of time, never snapping
  player.run = (player.run || 0) + (((mx || my) && run && !(player.jump > 0) ? 1 : 0) - (player.run || 0)) * Math.min(1, dt * (player.jump > 0 ? 0 : 4));
  if (player.jump > 0) {
    // a jump carries him the way he was heading when he pushed off; with no direction held he jumps on the spot
    const tt = (1 - player.jump) * JUMP_T, [jx, jy] = player.jv || [0, 0];
    const air = tt > AIR0 - 0.07 && tt < AIR1 + 0.04;
    if (air && (jx || jy)) move(player, jx, jy, dt, (26 + 14 * (player.jr || 0)) * Math.sin(Math.PI * Math.min(1, Math.max(0, (tt - AIR0 + 0.07) / (AIR1 - AIR0 + 0.11)))) + 8);
    else move(player, 0, 0, dt, 0);
  } else move(player, mx, my, dt, 12.5 + 13 * player.run);
  for (const n of npcs) {
    const px = player.x - n.x, py = (player.y - n.y) * (CH / CW), pd = Math.hypot(px, py);
    n.sayCd -= dt; n.sayT -= dt;
    if (pd < 14 && n.sayCd <= 0) { n.say = n.lines[(Math.random() * n.lines.length) | 0]; n.sayT = 3; n.sayCd = 10; n.tx = n.x; n.ty = n.y; n.wait = 3; }
    const dx = n.tx - n.x, dy = (n.ty - n.y) * (CH / CW);
    if (Math.hypot(dx, dy) < 1) {
      move(n, 0, 0, dt, 0);
      if (pd < 18) n.face = Math.sign(px) || n.face;
      if ((n.wait -= dt) <= 0) { n.tx = 6 + Math.random() * (COLS - 12); n.ty = 12 + Math.random() * (ROWS - 16); n.wait = 1.5 + Math.random() * 4; }
    } else move(n, dx, dy, dt, 8);
  }
  for (const e of ents) { e.walk += ((e.moving ? 1 : 0) - e.walk) * Math.min(1, dt * 8); e.swing = Math.max(0, e.swing - dt * 2.6);
    if (e.jump > 0) { e.jump = Math.max(0, e.jump - dt / JUMP_T); if (!e.landed && (1 - e.jump) * JUMP_T >= AIR1) { e.landed = true; gust(e.x, e.y + 0.5); } }
  }

  updateCamera(dt);
  { // the grass only lives in view: clear just that band, not the whole field
    const x0 = Math.max(0, VX0 - 12), x1 = Math.min(COLS, VX1 + 13), y0 = Math.max(0, VY0 - 10), y1 = Math.min(ROWS, VY1 + 12);
    for (let y = y0; y < y1; y++) { const o = y * COLS; push.fill(0, o + x0, o + x1); shadow.fill(0, o + x0, o + x1); }
  }
  for (const e of ents) influence(e, dt);
  if (mouse.on) {
    const mx = mouse.x / CW + camX, my = mouse.y / CH + camY;
    const v = Math.hypot(mx - mouse.lx, (my - mouse.ly) * CH / CW) / Math.max(dt, 1e-3);
    mouse.sp += (Math.min(1, v / 120) - mouse.sp) * Math.min(1, dt * 10);
    mouse.lx = mx; mouse.ly = my;
    brush(mx, my, 0.75 + mouse.sp * 1.1, dt);
  }

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

  const amp = reduced ? 0.35 : 1;
  const k = 42, damp = Math.exp(-5.5 * dt);
  // the wind waves are sines of (x + y + t): split them with the angle-sum rule so each cell costs a few multiplies
  for (let x = VX0; x <= VX1; x++) {
    const a = x * 0.06 - t * 1.5, b = x * 0.17 - t * 2.3, c = x * 0.028 - t * 0.55, o = x * 6;
    TA[o] = Math.sin(a); TA[o + 1] = Math.cos(a); TA[o + 2] = Math.sin(b); TA[o + 3] = Math.cos(b); TA[o + 4] = Math.sin(c); TA[o + 5] = Math.cos(c);
  }
  for (let y = VY0; y <= Math.min(ROWS - 1, VY1 + 4); y++) {
    const ry = y * 0.035, rf = y * 0.012;
    const s1 = Math.sin(ry), c1 = Math.cos(ry), s2 = Math.sin(-2 * ry), c2 = Math.cos(-2 * ry), s3 = Math.sin(-rf), c3 = Math.cos(-rf);
    for (let x = VX0; x <= VX1; x++) {
      const i = y * COLS + x, kd = kind[i];
      if (kd === 0 || kd === 2 || kd === 5 || kd === 7) continue;
      const h = height[i], o = x * 6;
      const swell = (TA[o] * c1 + TA[o + 1] * s1) * 0.6 + (TA[o + 2] * c2 + TA[o + 3] * s2) * 0.25;
      const front = TA[o + 4] * c3 + TA[o + 5] * s3;
      FR[i] = front;
      const gb = front > 0.55 ? (front - 0.55) * 2.2 : 0;
      const wind = (0.16 + swell * 0.24 + gb * 0.95 + (seed[i] - 0.5) * 0.28) * amp;
      const target = wind * (0.45 + h) + push[i] * (0.55 + h * 0.65);
      vel[i] = (vel[i] + (target - ang[i]) * k * (0.8 + seed[i] * 0.4) * dt) * damp;
      ang[i] += vel[i] * dt;
      if (flat[i] > 0) flat[i] = Math.max(0, flat[i] - dt * 0.2);
    }
  }

  updateCows(dt);
  updateWorld(dt);
  for (const b of braziers) updateFire(b, dt);
  updateFlora(dt);

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
