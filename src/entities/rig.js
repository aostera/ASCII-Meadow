// The 2D rig: shaded shapes drawn to an offscreen canvas and dithered into glyphs. Used for entities
// without baked frames (none at the moment: the knight and the cows have frames).

// ---------- rig ----------
const rig = document.createElement('canvas');
let rg = rig.getContext('2d', { willReadFrequently: true });
const EMIT = 'rgb(255,0,255)';           // marker colour for emissive parts (orb, lantern flame)
const grey = v => { const c = Math.max(0, Math.min(255, v * 255)) | 0; return `rgb(${c},${c},${c})`; };
const LX = -0.6, LY = -0.8;              // light from the upper left

function limb(ax, ay, bx, by, r1, r2, lum) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const sd = nx * LX + ny * LY > 0 ? 1 : -1, r = Math.max(r1, r2);
  const gr = rg.createLinearGradient(ax + nx * r * sd, ay + ny * r * sd, ax - nx * r * sd, ay - ny * r * sd);
  gr.addColorStop(0, grey(lum * 1.55)); gr.addColorStop(0.4, grey(lum)); gr.addColorStop(1, grey(lum * 0.22));
  rg.fillStyle = gr;
  rg.beginPath();
  rg.moveTo(ax + nx * r1, ay + ny * r1); rg.lineTo(bx + nx * r2, by + ny * r2);
  rg.lineTo(bx - nx * r2, by - ny * r2); rg.lineTo(ax - nx * r1, ay - ny * r1); rg.closePath();
  rg.moveTo(ax + r1, ay); rg.arc(ax, ay, r1, 0, Math.PI * 2);
  rg.moveTo(bx + r2, by); rg.arc(bx, by, r2, 0, Math.PI * 2);
  rg.fill();
}
function blob(x, y, rx, ry, lum) {
  const gr = rg.createRadialGradient(x + rx * LX * 0.5, y + ry * LY * 0.5, 0, x, y, Math.max(rx, ry) * 1.1);
  gr.addColorStop(0, grey(lum * 1.6)); gr.addColorStop(0.55, grey(lum)); gr.addColorStop(1, grey(lum * 0.25));
  rg.fillStyle = gr; rg.beginPath(); rg.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); rg.fill();
}
function poly(pts, lum) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const gr = rg.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, grey(lum * 1.5)); gr.addColorStop(0.45, grey(lum)); gr.addColorStop(1, grey(lum * 0.25));
  rg.fillStyle = gr; rg.beginPath(); rg.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) rg.lineTo(pts[k][0], pts[k][1]);
  rg.closePath(); rg.fill();
}
function line(ax, ay, bx, by, w, lum) { rg.strokeStyle = typeof lum === 'string' ? lum : grey(lum); rg.lineWidth = w; rg.lineCap = 'round'; rg.beginPath(); rg.moveTo(ax, ay); rg.lineTo(bx, by); rg.stroke(); }
const P = (o, a, len) => [o[0] + Math.sin(a) * len, o[1] + Math.cos(a) * len]; // angle from straight down, + is forward

// pose in model units: ground at y=100, body faces +x
function pose(e) {
  const motion = e.rigMotion;
  const state = e.aiState === 'talk' ? 'talk' : e.walk > 0 ? 'walk' : 'idle';
  const stride = motion && motion.walk ? motion.walk.stride : 1;
  const breath = motion && motion[state] && motion[state].breath !== undefined ? motion[state].breath : 1;
  const m = Math.max(0, Math.min(1, e.walk * stride)), ph = e.step, stout = e.cls === 'dwarf';
  const thigh = stout ? 20 : 24, shin = stout ? 19 : 23;
  const legs = [0, 1].map(k => {
    const p = ph + k * Math.PI;
    const stance = e.cls === 'knight' ? (k ? 0.42 : -0.34) : (k ? 0.16 : -0.12);
    const a = stance * (1 - m) + Math.sin(p) * 0.55 * m;
    const bend = (e.cls === 'knight' ? 0.35 : 0.12) * (1 - m) + (0.12 + Math.max(0, -Math.cos(p)) * 0.95) * m;
    const knee = P([0, 0], a, thigh), ankle = P(knee, a - bend, shin);
    return { knee, ankle, a };
  });
  const hipY = 97 - Math.max(legs[0].ankle[1], legs[1].ankle[1]);
  const breathe = Math.sin(t * 2.2 + e.x) * 0.7 * breath * (1 - m);
  const lean = 3 * m + (e.cls === 'knight' ? 2 * (1 - m) : 0);
  const torsoLen = stout ? 24 : 30;
  const hip = [0, hipY], neck = [lean, hipY - torsoLen + breathe];
  const head = [neck[0] + 1.5, neck[1] - (stout ? 6 : 8)];
  const sh = [neck[0], neck[1] + 3];
  const arms = [0, 1].map(k => {
    const a = (k ? 1 : -1) * Math.sin(ph) * 0.55 * m + (k ? 0.15 : -0.1);
    const elbow = P(sh, a, stout ? 13 : 15), hand = P(elbow, a + 0.45, stout ? 12 : 14);
    return { elbow, hand };
  });
  for (const l of legs) { l.knee = [l.knee[0], l.knee[1] + hipY]; l.ankle = [l.ankle[0], l.ankle[1] + hipY]; }
  return { legs, hip, neck, head, sh, arms, m, ph, breathe };
}

function drawRig(e, q) {
  const { legs, hip, neck, head, sh, arms } = q;
  const far = 0.62; // far-side limbs sit in shade
  const leg = (l, f) => { limb(hip[0], hip[1], l.knee[0], l.knee[1], 5, 4, 0.5 * f); limb(l.knee[0], l.knee[1], l.ankle[0], l.ankle[1], 4, 3.2, 0.45 * f); limb(l.ankle[0] - 1, l.ankle[1], l.ankle[0] + 6, l.ankle[1] + 1.5, 3.2, 2.4, 0.32 * f); };
  const arm = (a, f, lum) => { limb(sh[0], sh[1], a.elbow[0], a.elbow[1], 3.6, 3, lum * f); limb(a.elbow[0], a.elbow[1], a.hand[0], a.hand[1], 3, 2.6, lum * f); blob(a.hand[0], a.hand[1], 2.6, 2.6, 0.75 * f); };

  if (e.cls === 'knight') {
    // guard: blade raised forward, or a swing that sweeps from behind the head to low front
    const s = e.swing, sw = s > 0 ? Math.sin((1 - s) * Math.PI * 0.5) : 0;
    const armA = s > 0 ? -2.6 + sw * 4.0 : 2.0 + Math.sin(t * 2.2) * 0.04;
    const elbow = P(sh, armA - 0.5 * (s > 0 ? 0 : 1), 14), hand = P(elbow, armA, 12);
    const bladeA = s > 0 ? armA + 0.4 : 2.55 + q.m * 0.3;
    const tip = P(hand, bladeA, 40);
    leg(legs[0], far); arm(arms[0], far, 0.7);
    blob(arms[0].hand[0] - 2, arms[0].hand[1] - 4, 7, 10, 0.5); // shield edge
    poly([[neck[0] - 8, neck[1] + 2], [neck[0] + 8, neck[1] + 2], [hip[0] + 8, hip[1] + 2], [hip[0] - 8, hip[1] + 2]], 0.78); // breastplate
    for (let k = 1; k < 5; k++) { const yy = neck[1] + 2 + (hip[1] - neck[1]) * k / 5; line(neck[0] - 7 + (hip[0] - neck[0]) * k / 5, yy, neck[0] + 7 + (hip[0] - neck[0]) * k / 5, yy, 0.9, 0.25); } // lames
    blob(neck[0] + 2, neck[1] + 9, 4, 5, 1.05); // chest highlight
    line(hip[0] - 7, hip[1] - 4, hip[0] + 8, hip[1] - 4, 2.2, 0.3); // belt
    poly([[hip[0] - 9, hip[1] - 3], [hip[0] + 9, hip[1] - 3], [hip[0] + 12, hip[1] + 12], [hip[0] - 11, hip[1] + 12]], 0.5); // mail skirt
    leg(legs[1], 1);
    blob(legs[1].knee[0] + 1, legs[1].knee[1], 4.2, 3.6, 0.95); // knee cop
    blob(head[0], head[1], 8, 8.8, 0.88); // helm
    line(head[0] + 1, head[1] - 0.5, head[0] + 8, head[1] - 0.5, 1.8, 0.05); // visor slit
    line(head[0] + 4, head[1] - 7, head[0] + 4, head[1] + 7, 1, 0.35); // helm ridge
    line(head[0] - 2, head[1] - 8, head[0] - 9, head[1] - 12, 3, 0.6); // plume
    blob(sh[0] + 1, sh[1] + 1, 6.5, 5, 0.95); // pauldron
    limb(sh[0], sh[1], elbow[0], elbow[1], 3.8, 3.2, 0.8);
    limb(elbow[0], elbow[1], hand[0], hand[1], 3.2, 2.8, 0.8);
    limb(hand[0], hand[1], tip[0], tip[1], 1.6, 0.5, 1.0); // blade
    const g1 = P(hand, bladeA + Math.PI / 2, 5), g2 = P(hand, bladeA - Math.PI / 2, 5);
    line(g1[0], g1[1], g2[0], g2[1], 2.2, 0.85); // crossguard
    blob(hand[0], hand[1], 2.8, 2.8, 0.7);
  } else if (e.cls === 'mage') {
    leg(legs[0], far); leg(legs[1], 1);
    arm(arms[0], far, 0.5);
    const hem = Math.sin(q.ph) * 3 * q.m + Math.sin(t * 1.7) * 1.2;
    poly([[neck[0] - 7, neck[1] + 1], [neck[0] + 7, neck[1] + 1], [16 + hem, 95], [-15 + hem, 96]], 0.55); // robe
    for (let k = -2; k <= 2; k++) line(neck[0] + k * 2, neck[1] + 8, k * 6 + hem * 0.8, 94, 0.9, 0.28); // folds
    line(neck[0] - 1, neck[1] + 6, hem * 0.6, 94, 1.3, 0.95); // trim
    blob(head[0], head[1] + 1, 6, 6.5, 0.72);
    poly([[head[0] - 9, head[1] + 4], [head[0] + 9, head[1] + 2], [head[0] - 6, head[1] - 20]], 0.5); // pointed hat
    line(head[0] - 11, head[1] + 3, head[0] + 11, head[1] + 1.5, 2.4, 0.6); // brim
    poly([[head[0] - 2, head[1] + 4], [head[0] + 6, head[1] + 3], [head[0] + 2, head[1] + 16]], 0.95); // beard
    const hand = [arms[1].hand[0] + 8, arms[1].hand[1] - 4];
    limb(sh[0], sh[1], hand[0] - 5, hand[1] + 2, 3.6, 3, 0.6);
    line(hand[0] + 1, hand[1] - 34, hand[0] - 2, 98, 2.2, 0.55); // staff
    rg.fillStyle = EMIT; rg.beginPath(); rg.arc(hand[0] + 1, hand[1] - 37, 4, 0, Math.PI * 2); rg.fill();
    blob(hand[0], hand[1], 2.6, 2.6, 0.8);
    e.glowM = [hand[0] + 1, hand[1] - 37];
  } else if (e.cls === 'ranger') {
    const flap = Math.sin(t * 2.6 + e.x) * 3 + q.m * 6;
    poly([[neck[0] - 4, neck[1] + 1], [neck[0] + 3, neck[1] + 2], [-6, hip[1] + 18], [-20 - flap, hip[1] + 12 - flap * 0.4]], 0.32); // cloak
    line(neck[0] - 9, neck[1] + 4, neck[0] - 3, hip[1] - 2, 4, 0.45); // quiver
    for (let k = 0; k < 3; k++) line(neck[0] - 9 + k, neck[1] + 4, neck[0] - 12 + k * 1.5, neck[1] - 4, 1, 0.9);
    leg(legs[0], far); arm(arms[0], far, 0.55);
    poly([[neck[0] - 6, neck[1] + 1], [neck[0] + 6, neck[1] + 1], [hip[0] + 7, hip[1] + 6], [hip[0] - 7, hip[1] + 6]], 0.6); // jerkin
    line(hip[0] - 6, hip[1] - 3, hip[0] + 7, hip[1] - 3, 2, 0.85);
    leg(legs[1], 1);
    blob(head[0], head[1], 6, 6.8, 0.75);
    poly([[head[0] - 8, head[1] + 6], [head[0] + 3, head[1] - 9], [head[0] + 7, head[1] - 4], [head[0] + 3, head[1] + 2], [head[0] - 2, head[1] + 8]], 0.4); // hood
    const hand = [sh[0] + 13, sh[1] + 6];
    limb(sh[0], sh[1], hand[0], hand[1], 3.4, 2.8, 0.7);
    rg.strokeStyle = grey(0.7); rg.lineWidth = 2.2; rg.beginPath(); rg.arc(hand[0] - 10, hand[1], 22, -1.0, 1.0); rg.stroke(); // bow
    const b1 = [hand[0] - 10 + Math.cos(-1) * 22, hand[1] + Math.sin(-1) * 22], b2 = [hand[0] - 10 + Math.cos(1) * 22, hand[1] + Math.sin(1) * 22];
    line(b1[0], b1[1], b2[0], b2[1], 0.7, 0.9); // string
    blob(hand[0], hand[1], 2.5, 2.5, 0.8);
  } else { // dwarf
    leg(legs[0], far); arm(arms[0], far, 0.55);
    line(neck[0] - 8, neck[1] - 2, neck[0] - 4, hip[1] + 4, 2, 0.5); // axe haft on the back
    poly([[neck[0] - 12, neck[1] - 6], [neck[0] - 5, neck[1] - 8], [neck[0] - 8, neck[1] + 2]], 0.9); // axe head
    poly([[neck[0] - 10, neck[1] + 1], [neck[0] + 10, neck[1] + 1], [hip[0] + 12, hip[1] + 6], [hip[0] - 11, hip[1] + 6]], 0.55); // barrel chest
    line(hip[0] - 10, hip[1] - 2, hip[0] + 11, hip[1] - 2, 3, 0.3);
    leg(legs[1], 1);
    blob(head[0], head[1], 7, 6.5, 0.72);
    blob(head[0] - 0.5, head[1] - 3.5, 7.8, 4.6, 0.85); // helm
    line(head[0] - 7, head[1] - 4, head[0] - 12, head[1] - 10, 2.2, 0.9); // horn
    line(head[0] + 6, head[1] - 4, head[0] + 10, head[1] - 10, 2.2, 0.9);
    poly([[head[0] - 5, head[1] + 2], [head[0] + 8, head[1] + 1], [head[0] + 7, head[1] + 20], [head[0] - 1, head[1] + 24], [head[0] - 6, head[1] + 14]], 1.0); // beard
    const hand = [sh[0] + 12, sh[1] + 10];
    limb(sh[0], sh[1], hand[0], hand[1], 4, 3.2, 0.62);
    line(hand[0], hand[1], hand[0] + 2, hand[1] + 6, 1, 0.6);
    poly([[hand[0] - 2, hand[1] + 6], [hand[0] + 6, hand[1] + 6], [hand[0] + 5, hand[1] + 15], [hand[0] - 1, hand[1] + 15]], 0.45); // lantern cage
    rg.fillStyle = EMIT; rg.beginPath(); rg.arc(hand[0] + 2, hand[1] + 10.5, 2.6, 0, Math.PI * 2); rg.fill();
    e.glowM = [hand[0] + 2, hand[1] + 10.5];
  }
}
// Render the *same* production NPC rig on a private canvas for the editor.
// No game rig pixels/size, gameplay entities, camera, map or RNG are changed.
// The context swap is synchronous and restored even if drawing throws.
function npcRigPreviewImage(e) {
  const surface = document.createElement('canvas');
  surface.width = BOX_W; surface.height = BOX_H;
  const local = surface.getContext('2d', { willReadFrequently: true });
  const old = rg;
  try {
    rg = local;
    local.setTransform(1, 0, 0, 1, 0, 0);
    local.translate(-BOX_X0, 0);
    if (e.cls === 'dwarf') {
      local.translate(0, 100);
      local.scale(1.12, 0.8);
      local.translate(0, -100);
    }
    drawRig(e, pose(e));
    return local.getImageData(0, 0, surface.width, surface.height);
  } finally { rg = old; }
}
const BOX_X0 = -60, BOX_W = 120, BOX_H = 106; // model box: x -60..60, y 0..106
