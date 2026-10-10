// Firelight on the knight: how strongly the nearest fire lights him and from which side, and which colour
// block each of his glyphs takes (0 = cold grey, 1-4 armour warming, 5-8 cloth turning crimson).

const KWH = 5, KBLK = 2 * KWH - 1, KNS = KCH.length * 8;   // firelight steps (0 = none); colour blocks: grey, 4 armour, 4 cloak; sprites per block
const KMMIX = [0, 0.6, 0.76, 0.86, 0.93], KCMIX = [0, 0.85, 0.94, 1, 1];   // the cloth jumps straight to red: half-mixed with the light grey it reads pink
const lerp3 = (a, b, u) => [0, 1, 2].map(i => a[i] + (b[i] - a[i]) * u);
// Firelight palettes sampled from the crimson knight reference, by glyph level (0 = darkest, 1 = brightest):
// the armour is dark warm graphite whose brightest edges catch the fire as copper; the cloth is crimson.
const ramp3 = (st, u) => { let k = 0; while (k < st.length - 2 && u > st[k + 1][0]) k++; const [u0, a] = st[k], [u1, b] = st[k + 1]; return lerp3(a, b, Math.min(1, Math.max(0, (u - u0) / (u1 - u0)))); };
const KFIRE_ARMOUR = [[0, [24, 19, 18]], [0.5, [66, 55, 51]], [0.8, [104, 89, 82]], [0.92, [150, 92, 60]], [1, [206, 146, 100]]];
const KFIRE_CLOTH = [[0, [52, 12, 12]], [0.4, [117, 28, 24]], [0.78, [185, 54, 46]], [1, [226, 99, 82]]];
// After the knight's blocks: the marsh's creatures, in their own muted colours by level. A toad is
// grey-brown, its brightest glyphs the copper of its eye; a frog is olive, its brightest a wet yellowish sheen.
const KCREATURES = [
  [[0, [20, 17, 14]], [0.45, [60, 50, 40]], [0.75, [94, 80, 62]], [0.9, [126, 104, 78]], [1, [196, 128, 66]]],
  [[0, [13, 17, 11]], [0.45, [42, 54, 32]], [0.75, [70, 86, 50]], [0.9, [100, 114, 66]], [1, [150, 156, 96]]],
];
const KBLK_ALL = KBLK + KCREATURES.length;   // every block in the atlas

// Firelight: near a brazier the side facing it and the lower body catch the light, as in a painting lit
// by embers: the cloak turns red, the armour dark metal with warm edges. Steps are dithered per glyph.
// Returns [intensity 0..1, horizontal direction to the fire].
function fireLightAt(e) {
  let fI = 0, fdx = 0;
  for (const b of braziers) {
    const ddx = b.x * CW - e.x * CW, ddy = (((b.y + 0.7) * CH - b.lift) - ((e.y + 0.7) * CH - liftPx(e))) * 1.6, d = Math.hypot(ddx, ddy), r = 300 * Math.min(MS, 1.4);
    if (d < r) { const v = (1 - d / r) ** 1.6 * (0.82 + 0.18 * flick(b.seed * 3, 5)); if (v > fI) { fI = v; fdx = ddx / (d + 1); } }
  }
  return [fI, fdx];
}
// The colour block of glyph j of frame K (called per glyph: no closures here). The cloak goes red as a
// whole once the light is real (only its shade varies), the armour metallic.
function knightFireBlock(K, j, fI, fdx) {
  let h = 0;
  if (fI >= 0.01) {
    const cx = K.cx[j], cy = K.cy[j], face = Math.min(1.1, Math.max(0.15, 0.55 + 0.6 * fdx * (cx - KFX) / 16)), L = fI * face * (0.45 + 0.55 * cy / 54) * 1.7;
    h = Math.max(0, Math.min(KWH - 1, Math.floor(L * (KWH - 1) + 0.5 + BAYER[(cy & 3) * 4 + (cx & 3)] * 0.9)));
  }
  if (K.cl[j]) { if (fI > 0.12) h = Math.max(1, h); return h ? KWH - 1 + h : 0; }
  return h;
}
