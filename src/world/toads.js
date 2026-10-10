// Toads on the marsh. They live on its tussocks and lily pads: sit a long while, puff their throats and
// croak, hop to the next tussock now and then, turn; when the knight comes near they hop away from him or
// plop into the water (rings spread) and climb out somewhere else a little later. They exist only round
// the view: every marsh spot whose hash says so is a toad's home, found again as the camera moves, so
// the marsh fills itself with toads wherever it is painted. Drawn in the knight's fine glyphs.
// No Math.random here: each toad draws from its own seeded sequence, so the rest of the world is unmoved.

const toads = new Map(), toadRipples = [], toadDrops = [];   // home cell → toad; small rings on the water; splash drops (px)
let toadScan = 0;
const toadSpot = i => wet && wet[i] && (kind[i] === 1 || (kind[i] === 8 && segs[i] > 0));   // a tussock or a lily pad
const toadWater = i => wet && wet[i] && kind[i] === 8 && !segs[i];
const toadFree = i => toadSpot(i) || (!wet[i] && !bmask[i] && !tmask[i] && kind[i] > 0 && kind[i] !== 7);   // a placed toad also sits on dry ground
// Toads the map places (MEADOW_MAP.toads, [x, z]): they live where they were put, anywhere; keyed 'm' + index.
function toadsFromMap() {
  const L = MEADOW_MAP.toads; if (!L) return;
  L.forEach(([gx, gz], mi) => {
    const key = 'm' + mi; if (toads.has(key)) return;
    const [x, y] = mapToCell(gx, gz);
    if (x < VX0 - 80 || x > VX1 + 80 || y < VY0 - 40 || y > VY1 + 40) return;
    toads.set(key, { home: key, mi, free: true, x: Math.round(x), y: Math.round(y), st: 'sit', t: 0, wait: 1 + hash(mi, 3) * 4, dir: hash(mi, 7) > 0.5 ? 1 : -1, s: (mi * 2654435761 + 7) >>> 0, h: 0 });
  });
}
function resetMapToads() { for (const k of [...toads.keys()]) if (typeof k === 'string') toads.delete(k); toadScan = 0; }
// A splash where it went in: a crown of drops thrown up and out, falling back, and two rings spreading.
function toadSplash(td, n, up) {
  const x = td.x * CW + CW * 0.5, y = td.y * CH + CH * 0.8;
  for (let k = 0; k < n; k++) { const a = Math.PI * (0.15 + 0.7 * toadRnd(td)), sp = up * (0.55 + toadRnd(td) * 0.6); toadDrops.push({ x, y, y0: y, vx: Math.cos(a) * sp * (toadRnd(td) < 0.5 ? -1 : 1) * 0.8, vy: -Math.sin(a) * sp, life: 1 }); }
  toadRipples.push({ x: td.x, y: td.y, r: 0, life: 1 });
  if (n > 4) toadDrops.push({ crown: true, x, y, y0: y, vx: 0, vy: 0, life: 0.25 });
  if (n > 4) toadRipples.push({ x: td.x, y: td.y, r: -4, life: 1.2 });
}
function toadRnd(td) { td.s = (td.s * 1103515245 + 12345) >>> 0; return (td.s >>> 8) / 16777216; }

// ---------- pictures: sitting, puffed, mid-hop; facing right (mirrored when it faces left) ----------
let TOADF = null, toadK = 0;
function toadFrames() {
  const K = knightPx();
  if (TOADF && toadK === K && TOADF.kn === KN0) return TOADF;
  const fd = charDims(player), fw = fd.fcw, fh = fd.fch, rx = K * 0.11, ry = rx * 0.62;
  const frame = (stretch, puff) => {
    const out = [], ax = rx * (1 + stretch * 0.25), ay = ry * (1 - stretch * 0.2);
    for (let cy = Math.floor(-ay * 2.4 / fh); cy <= 1; cy++) for (let cx = Math.floor(-ax * 1.9 / fw); cx <= Math.ceil(ax * 1.6 / fw); cx++) {
      const u = cx * fw / ax, w = (cy * fh + ay) / ay;
      const body = u * u + w * w, head = ((u - 0.72) / 0.5) ** 2 + ((w + 0.15) / 0.55) ** 2;
      let c = null, v = 0, a = 0.9;
      if (body < 1 || head < 1) {
        const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, body))), lam = Math.max(0, -0.45 * u - 0.7 * w + 0.55 * nz);
        v = 0.3 + lam * 0.55 + (hash(cx * 5 + 2, cy * 9 + 1) > 0.78 ? 0.14 : 0) - (w > 0.55 ? 0.1 : 0);   // a warty back, its belly in shadow
        if (head < 0.32 && w < -0.25 && Math.abs(u - 0.82) < 0.22) { c = '@'; v = 0.8; a = 1; }      // the eye, wet and bright
      } else if (puff && ((u - 0.95) / 0.36) ** 2 + ((w - 0.55) / 0.42) ** 2 < 1) { c = '%'; v = 0.5 + puff * 0.15; }   // the throat sac
      else if (stretch && w > 0.2 && w < 0.95 && u < -0.9 && u > -1.9) { c = '-'; v = 0.22; }            // hind legs flung out
      else if (!stretch && Math.abs(w - 0.75) < 0.3 && Math.abs(Math.abs(u) - 0.95) < 0.2) { c = u < 0 ? '\\' : '/'; v = 0.2; }   // legs folded at its sides
      else continue;
      v = Math.max(0, Math.min(0.9, v + BAYER[(cy & 3) * 4 + (cx & 3)] * 0.12));
      // the skin is solid, dense glyphs in the warm graphite the knight's armour takes by the fire; the eye stays cold
      const warm = c !== '@' || v < 0.7 ? 2 * KNS : 0;
      if (!c) c = v > 0.42 ? '#' : v > 0.26 ? '%' : '=';
      out.push(cx * fw, cy * fh, fid(c, Math.floor(v * 8)) + warm, a);
    }
    return out;
  };
  TOADF = { sit: frame(0, 0), puff: frame(0, 1), hop: frame(1, 0), kn: KN0 }; toadK = K;
  return TOADF;
}

// ---------- life ----------
function toadNear(td, r0, r1, test, away) {   // a cell r0..r1 cells off that passes test, if any (away: from the knight)
  for (let k = 0; k < 14; k++) {
    const a = toadRnd(td) * 6.2832, r = r0 + toadRnd(td) * (r1 - r0), x = Math.round(td.x + Math.cos(a) * r * 2), y = Math.round(td.y + Math.sin(a) * r);
    if (x < 1 || y < 1 || x >= COLS - 1 || y >= ROWS - 1 || !test(y * COLS + x)) continue;
    if (away && Math.hypot(x - player.x, (y - player.y) * 2) < Math.hypot(td.x - player.x, (td.y - player.y) * 2) + 2) continue;
    return [x, y];
  }
  return null;
}
function toadHop(td, to, dive) {
  td.st = 'hop'; td.t = 0; td.dur = 0.28 + Math.hypot(to[0] - td.x, (to[1] - td.y) * 2) * 0.012;
  td.fx = td.x; td.fy = td.y; td.tx = to[0]; td.ty = to[1]; td.dive = dive; td.dir = to[0] >= td.x ? 1 : -1;
}
function updateToads(dt) {
  if ((toadScan -= dt) <= 0) {   // homes round the view; toads far away are let go
    toadScan = 0.7;
    const x0 = Math.max(1, VX0 - 20), x1 = Math.min(COLS - 2, VX1 + 20), y0 = Math.max(1, VY0 - 10), y1 = Math.min(ROWS - 2, VY1 + 10);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * COLS + x;
      if (!wet[i] || hash(x * 7 + 3, y * 13 + 1) > 0.014 || toads.has(i) || !toadSpot(i)) continue;
      toads.set(i, { home: i, x, y, st: 'sit', t: 0, wait: 1 + hash(x, y) * 5, dir: hash(y, x) > 0.5 ? 1 : -1, s: (x * 73856093 ^ y * 19349663) >>> 0, h: 0 });
    }
    toadsFromMap();
    for (const [i, td] of toads) {
      const far = td.x < VX0 - 80 || td.x > VX1 + 80 || td.y < VY0 - 40 || td.y > VY1 + 40;
      if (far || (!td.free && td.st === 'sit' && !toadSpot(Math.round(td.y) * COLS + Math.round(td.x)))) toads.delete(i);   // gone, or the marsh painted over
    }
  }
  for (const td of toads.values()) {
    td.t += dt;
    const dk = Math.hypot(td.x - player.x, (td.y - player.y - 0.7) * 2), near = (dk < 26 && player.moving) || dk < 12 || (dk < 40 && (player.run || 0) > 0.5);
    if (td.st === 'sit' || td.st === 'croak') {
      if (near) {   // startled: away from him, or into the water
        const w = toadRnd(td) < 0.7 && toadNear(td, 2, 7, toadWater, true);   // mostly: into the water, away from him
        if (w) toadHop(td, w, true);
        else { const to = toadNear(td, 6, 14, td.free ? toadFree : toadSpot, true) || toadNear(td, 3, 10, td.free ? toadFree : toadSpot, true); if (to) toadHop(td, to, false); }
        continue;
      }
      if (td.st === 'croak') { if (td.t > td.dur) { td.st = 'sit'; td.t = 0; td.wait = 2 + toadRnd(td) * 6; } continue; }
      if (td.t < td.wait) continue;
      const r = toadRnd(td);
      if (r < 0.45) { td.st = 'croak'; td.t = 0; td.dur = 0.9 + toadRnd(td) * 1.2; }
      else if (r < 0.75) { const to = toadNear(td, 2, 5, td.free ? toadFree : toadSpot, false); if (to) toadHop(td, to, false); else { td.t = 0; td.wait = 3; } }
      else if (r < 0.85) { const w = toadNear(td, 1, 4, toadWater, false); if (w) toadHop(td, w, true); else { td.t = 0; td.wait = 2; } }   // a swim, now and then
      else { td.dir = -td.dir; td.t = 0; td.wait = 2 + toadRnd(td) * 4; }
    } else if (td.st === 'hop') {
      const s = Math.min(1, td.t / td.dur), e = s * s * (3 - 2 * s);
      td.x = td.fx + (td.tx - td.fx) * e; td.y = td.fy + (td.ty - td.fy) * e;
      td.h = Math.sin(s * Math.PI) * (6 + Math.hypot(td.tx - td.fx, td.ty - td.fy) * 0.9);   // the arc, px
      if (s >= 1) {
        td.h = 0;
        if (td.dive) { td.st = 'under'; td.t = 0; td.wait = 3 + toadRnd(td) * 4; toadSplash(td, 12, 130 + td.dur * 60); }
        else { td.st = 'sit'; td.t = 0; td.wait = 2 + toadRnd(td) * 5; }
      }
    } else if (td.st === 'under' && td.t > td.wait && dk > 30) {   // climbs out on a tussock nearby
      const to = toadNear(td, 1, 6, td.free ? toadFree : toadSpot, false);
      if (to) { toadSplash(td, 3, 60); td.x = to[0]; td.y = to[1]; td.st = 'sit'; td.t = 0; td.wait = 2 + toadRnd(td) * 4; toadRipples.push({ x: td.x, y: td.y, r: 0, life: 0.6 }); }
      else td.t = 0;
    }
  }
  for (let k = toadDrops.length - 1; k >= 0; k--) {   // drops fly, fall, and are gone when they meet the water again
    const d = toadDrops[k];
    if (d.crown) { d.life -= dt; if (d.life <= 0) toadDrops.splice(k, 1); continue; }
    d.vy += 300 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt * 1.4;
    if (d.life <= 0 || (d.vy > 0 && d.y > d.y0)) toadDrops.splice(k, 1);
  }
  for (let k = toadRipples.length - 1; k >= 0; k--) { const r = toadRipples[k]; r.r += dt * 9; r.life -= dt * 0.8; if (r.life <= 0) toadRipples.splice(k, 1); }
}

// ---------- drawing: in the render order with everyone else ----------
function visibleToads(out) {
  for (const td of toads.values()) if (td.st !== 'under' && td.x > VX0 - 2 && td.x < VX1 + 2 && td.y > VY0 - 2 && td.y < VY1 + 3) out.push({ isToad: true, td, y: td.y + 0.31 });   // after its own row's ground and pads, so a pad never covers it
  return out;
}
function drawToad(e) {
  const td = e.td, F = toadFrames(), i = Math.round(td.y) * COLS + Math.round(td.x);
  const fr = td.st === 'hop' ? F.hop : td.st === 'croak' && Math.sin(td.t * 11) > 0 ? F.puff : F.sit;
  const lit = Math.max(0.6, (1 - shadow[i]) * (1 - (cloudBuf ? cloudBuf[i] : 0) * 0.6) * (1 - bshade[i] * 0.8));
  const bx = td.x * CW + CW * 0.5, by = td.y * CH + CH * 0.8 - td.h;
  const ox = td.dir < 0 ? -CW * 0.35 : 0;
  for (let k = 0; k < fr.length; k += 4) gput(SOLID_K, bx + fr[k] * td.dir + ox, by + fr[k + 1], 0.55);   // a dark body under the glyphs: it sits out from the water
  for (let k = 0; k < fr.length; k += 4) gput(fr[k + 2], bx + fr[k] * td.dir + ox, by + fr[k + 1], fr[k + 3] * lit);
}
function drawToadRipples() {
  for (const d of toadDrops) {
    if (d.crown) { const a = d.life * 3.2; blit(CI['\\'], C_DEW, d.x - CW * 0.9, d.y - CH * 1.1, a); blit(CI['|'], C_DEW, d.x - CW * 0.1, d.y - CH * 1.4, a); blit(CI['/'], C_DEW, d.x + CW * 0.7, d.y - CH * 1.1, a); continue; }   // the water thrown up where it went in
    blit(CI[d.vy < 0 ? "'" : d.vy < 120 ? '.' : ','], C_DEW, d.x - CW * 0.5, d.y - CH * 0.6, Math.min(0.85, d.life * 1.2));
  }
  for (const r of toadRipples) {
    if (r.r <= 0) continue;
    ctx.strokeStyle = `rgba(200,200,200,${0.16 * r.life})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(r.x * CW + CW * 0.5, r.y * CH + CH * 0.8, Math.max(0.1, r.r), Math.max(0.1, r.r * 0.4), 0, 0, Math.PI * 2); ctx.stroke();
  }
}
