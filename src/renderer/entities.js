// Drawing entities: the knight from his baked frames (cloak spring, legs, breath, firelight) and rigged
// figures; cows are drawn by entities/cow.js.

// Preserve authored sprite aspect ratio, fit the old rig viewport and align
// feet with the knight. The image never fills BOX_W unless its aspect needs it.
function npcAtlasRect(frame) {
  const factor = Math.min(BOX_W / frame.width, BOX_H / frame.height);
  const w = frame.width * factor, h = frame.height * factor;
  return { x: BOX_X0 + (BOX_W - w) / 2, y: BOX_H - h, w, h };
}

function drawEntity(e) {
  if (e.cls === 'cow') { drawCow(e); return; }
  const { ffs, fcw, fch, u } = charDims(e);
  const G = geomOf(e), { gx, gy, top } = G;
  const kn = e.cls === 'knight';
  if (kn && !KS.ok) return;
  const BH = boxH(e);
  const cols = kn ? Math.round(G.w / fcw) : Math.round(BOX_W * u / fcw), rows = kn ? Math.round(G.h / fch) : Math.round(BH * u / fch);
  const SS = 2;
  if (rig.width !== cols * SS || rig.height !== rows * SS) { rig.width = cols * SS; rig.height = rows * SS; }
  rg.setTransform(1, 0, 0, 1, 0, 0);
  rg.clearRect(0, 0, rig.width, rig.height);
  if (kn) { drawKnight(e, G, fcw, fch); return; }   // entities/knight.js
  {
  const sx = cols * SS / BOX_W, sy = rows * SS / BH;
  const state = e.aiState === 'talk' ? 'talk' : e.walk > 0.15 ? 'walk' : 'idle';
  const frame = e.actorType ? npcAtlasFrame(e, state) : null;
  const atlas = frame && NPC_ATLASES.get(e.actorType);
  const frameState = atlas && (atlas.layout.states[state] || atlas.layout.states.idle);
  const authoredDirection = frameState && frameState.rows.length === 8;
  // Eight authored angles already encode orientation; mirroring them would show the wrong view.
  const facing = authoredDirection ? 1 : e.face;
  rg.setTransform(sx * facing, 0, 0, sy,
    (facing > 0 ? -BOX_X0 : BOX_W + BOX_X0) * sx, 0);
  if (e.cls === 'dwarf') { rg.translate(0, 100); rg.scale(1.12, 0.8); rg.translate(0, -100); }
  if (frame) {
    e.glowM = null;
    // The atlas frame is portrait (40x56). Previously drawing it into a 120x106
    // box stretched its width by ~59%, making a knight-height NPC seem huge.
    // Keep the existing knight-aligned height but preserve the original art
    // aspect ratio and center it inside the legacy procedural rig canvas.
    const rect = npcAtlasRect(frame);
    rg.drawImage(frame.image, frame.x, frame.y, frame.width, frame.height,
      rect.x, rect.y, rect.w, rect.h);
  } else drawRig(e, pose(e));
  if (e.cls === 'dwarf' && e.glowM) e.glowM = [e.glowM[0] * 1.12, 100 - (100 - e.glowM[1]) * 0.8];
  }

  const img = rg.getImageData(0, 0, rig.width, rig.height).data;
  const left = kn ? G.left : gx + BOX_X0 * u, W2 = rig.width;
  const [tr, tg, tb] = e.tint;
  const LV = 8;
  const lv = [];
  for (let k = 0; k < LV; k++) lv.push([]);
  const emit = [];
  // backing silhouette so the figure occludes the grass behind it
  if (!kn) { ctx.fillStyle = 'rgba(12,12,12,.94)'; ctx.beginPath(); }
  let runY = -1, runS = 0, runE = 0;
  const kg = [];  // knight glyphs wait until every backing block is down
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    let r = 0, g = 0, a = 0;
    for (let oy = 0; oy < SS; oy++) for (let ox = 0; ox < SS; ox++) {
      const o = ((cy * SS + oy) * W2 + cx * SS + ox) * 4;
      r += img[o]; g += img[o + 1]; a += img[o + 3];
    }
    const n = SS * SS; a /= n * 255;
    if (a < 0.3) continue;
    r /= n * 255 * a; g /= n * 255 * a;
    if (kn) { r = 0.16 + 0.84 * Math.pow(Math.min(1, r / 0.5), 0.75); g = r; } // dark plate keeps a sparse grain, highlights go dense
    const px = left + cx * fcw, py = top + cy * fch;
    if (kn) { if (runY === cy && runE === cx) runE = cx + 1; else { if (runY >= 0) grect(left + runS * fcw - 0.4, top + runY * fch - 0.4, (runE - runS) * fcw + 0.8, fch + 0.8, 0.94); runY = cy; runS = cx; runE = cx + 1; } }
    else ctx.rect(px - 0.4, py - 0.4, fcw + 0.8, fch + 0.8);
    if (r > 0.75 && g < 0.35) { emit.push(px, py); continue; }
    const grain = (hash(cx * 7 + (e.cls.length * 31), cy * 13) - 0.5) * 0.16;
    const lit = Math.pow(Math.max(0, r * 1.3 - 0.06), 0.8);
    let v = lit * Math.min(1, a * 1.2) + BAYER[(cy & 3) * 4 + (cx & 3)] * (e.cls === 'knight' ? 0.24 : 0.38) + grain;
    if (v < 0.16) continue;
    v = Math.min(0.999, v);
    const ci = 1 + ((v * (RAMP.length - 1)) | 0);
    if (kn) { kg.push(KN0 + Math.min(RAMP.length - 1, ci) * KLV + ((v * KLV) | 0), px, py); continue; }
    lv[(v * LV) | 0].push(px, py, ci);
  }
  if (kn) {
    if (runY >= 0) grect(left + runS * fcw - 0.4, top + runY * fch - 0.4, (runE - runS) * fcw + 0.8, fch + 0.8, 0.94);
    for (let j = 0; j < kg.length; j += 3) gput(kg[j], kg[j + 1], kg[j + 2], 1);
  } else ctx.fill();
  ctx.font = `600 ${ffs}px ${FONT}`;
  ctx.textBaseline = 'top';
  for (let k = 0; k < LV; k++) {
    const arr = lv[k]; if (!arr.length) continue;
    const f = 0.3 + 0.85 * (k / (LV - 1));
    ctx.fillStyle = `rgb(${Math.min(255, tr * f) | 0},${Math.min(255, tg * f) | 0},${Math.min(255, tb * f) | 0})`;
    for (let j = 0; j < arr.length; j += 3) ctx.fillText(RAMP[Math.min(RAMP.length - 1, arr[j + 2])], arr[j], arr[j + 1]);
  }
  if (emit.length) {
    ctx.fillStyle = e.glowCol || '#fff';
    ctx.shadowColor = e.glowCol || '#fff'; ctx.shadowBlur = 8 + Math.sin(t * 9) * 3;
    for (let j = 0; j < emit.length; j += 2) ctx.fillText('@', emit[j], emit[j + 1]);
    ctx.shadowBlur = 0;
  }

  drawTag(e, gx, gy);
}
