// Birds in the tall grass: the map's events of kind 'birds' (MEADOW_MAP.events: ['birds', x, z]). A few
// birds sit hidden in the tall grass round each such point; when the knight walks in among it they burst
// up, the grass thrashing where each one rose, beat away from him climbing, then glide out of view. The
// flock settles back unseen after half a minute. Each flock draws from its own seeded sequence (no
// Math.random), so a map without events is unchanged.

const birds = [], birdEvents = [], BIRD_R = 30;   // BIRD_R: how near (cells across; rows count double) walking into the grass sets them off   // birds in the air; per event: { mi, x, y, wait, s }
const birdTall = i => kind[i] === 1 && segs[i] >= 3 && !(wet && wet[i]);   // tall grass, where they can hide
function birdRnd(o) { o.s = (o.s * 1103515245 + 12345) >>> 0; return (o.s >>> 8) / 16777216; }
function resetBirds() {
  birdEvents.length = 0; birds.length = 0;
  (MEADOW_MAP.events || []).forEach(([kindOf, gx, gz], mi) => {
    if (kindOf !== 'birds') return;
    const [x, y] = mapToCell(gx, gz);
    birdEvents.push({ mi, x, y: y + 0.7, wait: 0, s: (mi * 2246822519 + 3) >>> 0 });
  });
}
function updateBirds(dt) {
  if (birdEvents.length !== (MEADOW_MAP.events || []).length) resetBirds();
  for (const ev of birdEvents) {
    if (ev.wait > 0) { ev.wait -= dt; continue; }
    const px = player.x, py = player.y + 0.7, d = Math.hypot(px - ev.x, (py - ev.y) * 2);
    const inGrass = birdTall(Math.round(py) * COLS + Math.round(px));
    if (editing || !(d < 8 || (d < BIRD_R && inGrass && player.moving))) continue;
    // up they go: from tall grass round the point, away from him
    const n = 6 + ((birdRnd(ev) * 5) | 0), away = Math.atan2(ev.y - py, ev.x - px);
    for (let k = 0, tries = 0; k < n && tries < 60; tries++) {
      const a = birdRnd(ev) * 6.2832, r = birdRnd(ev) * 9, x = Math.round(ev.x + Math.cos(a) * r * 2), y = Math.round(ev.y + Math.sin(a) * r);
      if (x < 1 || y < 1 || x >= COLS - 1 || y >= ROWS - 1 || !birdTall(y * COLS + x)) continue;
      const dir = away + (birdRnd(ev) - 0.5) * 1.4, sp = 15 + birdRnd(ev) * 9;
      birds.push({ x, y, h: 0, vx: Math.cos(dir) * sp, vy: Math.sin(dir) * sp * 0.5, vh: 70 + birdRnd(ev) * 40, age: -birdRnd(ev) * 0.35, ph: birdRnd(ev) * 6, fl: 9 + birdRnd(ev) * 3 });
      k++;
    }
    ev.wait = 30;
  }
  for (let k = birds.length - 1; k >= 0; k--) {
    const b = birds[k];
    b.age += dt;
    if (b.age < 0) continue;                                   // not all at once: one after another
    if (b.age < 0.35) brush(b.x, b.y, 2.4, dt);                // the grass thrashes where it bursts out
    const climb = b.age < 1.4;
    b.vh += (climb ? -30 : -55) * dt; if (b.vh < 6) b.vh = 6;
    b.h += b.vh * dt; b.x += b.vx * dt * Math.min(1, b.age * 2.5); b.y += b.vy * dt * Math.min(1, b.age * 2.5);
    b.ph += dt * (climb || Math.sin(b.age * 2) > 0.6 ? b.fl : 0);   // beating hard, then gliding with a few strokes
    if (b.age > 5 || b.x < VX0 - 30 || b.x > VX1 + 30 || b.y - b.h / CH < VY0 - 30 || b.y > VY1 + 30) birds.splice(k, 1);
  }
}
// After the ground and before the fog: a pale V that beats its wings, its dark spot on the grass below.
function drawBirds() {
  for (const b of birds) {
    if (b.age < 0) continue;
    const x = b.x * CW, y = b.y * CH, up = b.h * COSP, a = Math.min(1, b.age * 4) * Math.max(0, Math.min(1, (5 - b.age) / 1.2));
    if (b.h < 60) blit(CI['.'], 2, x, y - CH * 0.3, a * (1 - b.h / 60) * 0.8);   // its shadow, fading as it climbs
    const wing = Math.sin(b.ph), lv = C_WHITE;   // pale against the dark grass they leave
    if (wing > 0.3) { blit(CI['\\'], lv, x - CW * 0.75, y - up - CH * 0.25, a); blit(CI['/'], lv, x + CW * 0.75, y - up - CH * 0.25, a); }   // wings up: a V
    else if (wing < -0.3) { blit(CI['/'], lv, x - CW * 0.75, y - up + CH * 0.1, a); blit(CI['\\'], lv, x + CW * 0.75, y - up + CH * 0.1, a); }   // down: a roof
    else { blit(CI['-'], lv, x - CW * 0.8, y - up, a); blit(CI['-'], lv, x + CW * 0.8, y - up, a); }                                   // spread
    blit(CI['.'], lv, x, y - up - CH * 0.35, a);                                                                                       // the body
  }
}
