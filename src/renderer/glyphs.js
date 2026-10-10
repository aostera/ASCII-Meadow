// Glyph atlases: the grass palette and characters, the fine glyph layer of the castle and flora, and the
// mega atlas (grass glyphs x colours, the knight's fine glyphs x firelight tones, a solid block) that the
// GPU batch samples. Everything is drawn once per size, then only blitted.

// ---------- palette ----------
const SH = 18; // grass shades, dark → sunlit
const COLORS = [];
for (let i = 0; i < SH; i++) {
  const t = i / (SH - 1);
  COLORS.push(`hsl(0 0% ${3 + Math.pow(t, 1.6) * 40}%)`);
}
const C_WHITE = COLORS.push('#bdbdbd') - 1;
const C_YEL = COLORS.push('#8a8a8a') - 1;
const C_LAV = COLORS.push('#6b6b6b') - 1;
const C_DIRT = COLORS.push('#1e1e1e') - 1;
const C_DIRT2 = COLORS.push('#151515') - 1;
const C_STONE = COLORS.push('#3a3a3a') - 1;
const C_STONE2 = COLORS.push('#6b6b6b') - 1;
const C_DEW = COLORS.push('#eaeaea') - 1;
const BL0 = COLORS.length, BLN = 14; // stone greys for buildings
for (let k = 0; k < BLN; k++) { const l = 5 + Math.pow(k / (BLN - 1), 1.1) * 83; COLORS.push(`hsl(0 0% ${l}%)`); }
const PT0 = COLORS.length, PTN = 8; // pale trail
for (let k = 0; k < PTN; k++) COLORS.push(`hsl(0 0% ${16 + k * 6.5}%)`);
const NB = COLORS.length;

const CHARS = " |li!:/\\_-~.,'`*o@°+\"^;=adbqQ08$%&#";
const CI = {}; [...CHARS].forEach((c, i) => CI[c] = i);

// ---------- glyph atlas: every (char, colour) pre-rendered once, then blitted ----------
let atlas, AW, AH;
function buildAtlas() {
  AW = Math.ceil(CW * DPR) + 2; AH = Math.ceil(CH * DPR) + 2;
  atlas = document.createElement('canvas');
  atlas.width = AW * CHARS.length; atlas.height = AH * NB;
  const a = atlas.getContext('2d');
  a.font = `${FS * DPR}px ${FONT}`;
  a.textBaseline = 'top';
  for (let b = 0; b < NB; b++) {
    a.fillStyle = COLORS[b];
    for (let c = 1; c < CHARS.length; c++) a.fillText(CHARS[c], c * AW + 1, b * AH + 1);
  }
}
function blit(ci, b, x, y, a = 1) { gput(ci * NB + b, x, y, a); }
// ---------- the fine glyphs: knight, cows and flora share one dither ramp ----------
const RAMP = " .:-=+*#%@";   // brightness, dark to light
const rampCode = ci => ci * 8 + Math.min(7, Math.floor((ci - 0.5) / 9 * 8));   // ramp index -> fine glyph code (8 tones)
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => v / 16 - 0.5);   // 4x4 ordered dither

// ---------- dithered glyph rendering ----------
// one atlas: grass glyphs × colours, the knight's small glyphs × tones, and a solid dark block
const KCH = RAMP + "/\\|'";   // fine glyphs: the dither ramp plus strokes for branches
const FCI = {}; [...KCH].forEach((c, i) => FCI[c] = i);
function buildMegaAtlas() {
  const k = charDims(player), kfs = k.ffs * DPR;
  const KAW = Math.ceil(k.fcw * DPR) + 2, KAH = Math.ceil(k.fch * DPR) + 2;
  const KX = 0, KY = atlas.height + 2, kw = KAW * KCH.length;
  const mw = Math.max(atlas.width, kw + 16), mh = KY + KAH * KLV * KBLK + 2;
  const m = document.createElement('canvas'); m.width = mw; m.height = mh;
  const g = m.getContext('2d');
  g.drawImage(atlas, 0, 0);
  g.font = `600 ${kfs}px ${FONT}`; g.textBaseline = 'top';
  const [tr, tg, tb] = player.tint;
  // The knight's glyphs in firelight: block 0 is the cold grey; blocks 1-4 are the armour darkening to warm
  // graphite with copper edges, 5-8 the cloth (cloak, mantle, tabard) turning crimson, as in the reference.
  for (let bk = 0; bk < KBLK; bk++) for (let l = 0; l < KLV; l++) {
    const f = 0.3 + 0.85 * (l / (KLV - 1)), u = l / (KLV - 1), cloth = bk > KWH - 1, h = cloth ? bk - KWH + 1 : bk;
    const mix = (cloth ? KCMIX : KMMIX)[h];
    const tone = ramp3(cloth ? KFIRE_CLOTH : KFIRE_ARMOUR, u);
    const r = Math.min(255, tr * f) * (1 - mix) + tone[0] * mix, gg = Math.min(255, tg * f) * (1 - mix) + tone[1] * mix, bb = Math.min(255, tb * f) * (1 - mix) + tone[2] * mix;
    g.fillStyle = `rgb(${r | 0},${gg | 0},${bb | 0})`;
    for (let c = 1; c < KCH.length; c++) g.fillText(KCH[c], KX + c * KAW + 1, KY + (bk * KLV + l) * KAH + 1);
  }
  g.fillStyle = '#0c0c0c'; g.fillRect(kw + 4, KY, 8, 8);
  GB.spr.length = 0;
  for (let c = 0; c < CHARS.length; c++) for (let b = 0; b < NB; b++) sprite(c * AW, b * AH, AW, AH, AW / DPR, AH / DPR, -1 / DPR, -1 / DPR);
  KN0 = GB.spr.length;
  for (let bk = 0; bk < KBLK; bk++) for (let c = 0; c < KCH.length; c++) for (let l = 0; l < KLV; l++) sprite(KX + c * KAW, KY + (bk * KLV + l) * KAH, KAW, KAH, KAW / DPR, KAH / DPR, -1 / DPR, -1 / DPR);
  const sb = (w, h, ox, oy) => sprite(kw + 6, KY + 2, 2, 2, w, h, ox, oy);
  SOLID_CELL = sb(CW + 0.8, CH + 0.8, -0.4, -0.4);
  SOLID_FRONT = sb(CW + 0.6, CH - 1, -0.3, 1);
  SOLID_K = sb(k.fcw + 0.8, k.fch + 0.8, -0.4, -0.4);
  CAST = sprite(0, 0, 1, 1, 1, 1, 0, 0); // patched once the castle is baked
  GB.atlasCv = m;
  normSprites(mw, mh);
  GL.ok && GL.upload();
}
