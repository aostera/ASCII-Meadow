// Toads on the marsh. They live on its tussocks and lily pads: sit a long while, puff their throats and
// croak, hop to the next tussock now and then, turn; when the knight comes near they hop away from him or
// plop into the water (rings spread) and climb out somewhere else a little later. They exist only round
// the view: every marsh spot whose hash says so is a toad's home, found again as the camera moves, so
// the marsh fills itself with toads wherever it is painted. Drawn in the knight's fine glyphs.
// No Math.random here: each toad draws from its own seeded sequence, so the rest of the world is unmoved.

const toads = new Map(), toadRipples = [], toadDrops = [];   // home cell → toad; small rings on the water; splash drops (px)
let toadScan = 0, toadGen = -1;   // toads are keyed by cell: a rebuilt grid (any resize) starts them afresh
const toadSpot = i => wet && wet[i] && (kind[i] === 1 || (kind[i] === 8 && segs[i] > 0));   // a tussock or a lily pad
const toadWater = i => wet && wet[i] && kind[i] === 8 && !segs[i];
const toadFree = i => toadSpot(i) || (!wet[i] && !bmask[i] && !tmask[i] && kind[i] > 0 && kind[i] !== 7);   // a placed toad also sits on dry ground
// Toads the map places (MEADOW_MAP.toads, [x, z]): they live where they were put, anywhere; keyed 'm' + index.
function toadsFromMap() {
  const L = MEADOW_MAP.toads; if (!L) return;
  L.forEach(([gx, gz, kd], mi) => {
    const key = 'm' + mi; if (toads.has(key)) return;
    const [x, y] = mapToCell(gx, gz);
    if (x < VX0 - 80 || x > VX1 + 80 || y < VY0 - 40 || y > VY1 + 40) return;
    toads.set(key, { home: key, mi, free: true, kind: kd === 'frog' ? 'frog' : 'toad', x: Math.round(x), y: Math.round(y), st: 'sit', t: 0, wait: 1 + hash(mi, 3) * 4, dir: hash(mi, 7) > 0.5 ? 1 : -1, s: (mi * 2654435761 + 7) >>> 0, h: 0 });
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

// ---------- pictures: sitting, croaking, mid-leap; seen from the side, facing right (mirrored to the left) ----------
// Built from their parts as they are: a toad squat and heavy, broad round snout, short legs, a warty dry
// back, the two swollen glands behind its eyes, eyes on top with a bright iris and a level pupil, a pale
// belly, the throat puffing as it calls. A frog slim and smooth, a pointed snout, the eardrum behind the
// eye, pale ridges down its back, dark spots, its long hind leg folded in a zigzag, sacs at the mouth.
const CRF = {};   // kind → frames, rebuilt with the atlas
function creatureFrames(kind) {
  const K = knightPx(), key = K + ':' + KN0;
  if (CRF[kind] && CRF[kind].key === key) return CRF[kind];
  const fd = charDims(player), fw = fd.fcw, fh = fd.fch, frog = kind === 'frog', blk = (KBLK + (frog ? 1 : 0)) * KNS;
  const L = K * (frog ? 0.36 : 0.33), H = L * (frog ? 0.5 : 0.62);
  const ell = (X, Y, cx, cy, rx, ry, rot) => { let dx = X - cx, dy = Y - cy; if (rot) { const c = Math.cos(rot), s = Math.sin(rot); [dx, dy] = [dx * c + dy * s, -dx * s + dy * c]; } const u = dx / rx, w = dy / ry; return [u * u + w * w, u, w]; };
  const frame = (pose) => {   // 0 sitting, 1 calling, 2 leaping
    const out = [], leap = pose === 2;
    for (let cy = Math.floor(-H * 1.25 / fh) - 1; cy <= 1; cy++) for (let cx = Math.floor(-L * (leap ? 1.05 : 0.6) / fw); cx <= Math.ceil(L * 0.62 / fw); cx++) {
      const X = cx * fw, Y = -cy * fh;
      let part = null, u = 0, w = 0, q;
      const test = (name, r) => { if (!part && r[0] < 1) { part = name; u = r[1]; w = r[2]; } };
      if (frog) {
        const eye = ell(X, Y, 0.3 * L, 0.86 * H, 0.08 * L, 0.08 * L);
        if (eye[0] < 1) part = Math.abs(Y - 0.86 * H) < 0.022 * L && Math.abs(X - 0.3 * L) < 0.055 * L ? 'pupil' : 'eye';
        if (pose === 1) test('sac', ell(X, Y, 0.3 * L, 0.36 * H, 0.085 * L, 0.085 * L));
        test('drum', ell(X, Y, 0.15 * L, 0.62 * H, 0.045 * L, 0.045 * L));
        { const t = Math.max(0, (X - 0.28 * L) / (0.25 * L)); q = ell(X, Y, 0.28 * L, 0.56 * H, 0.25 * L, 0.24 * H * (1 - t * 0.55)); test('head', q); }   // tapering to a point
        if (leap) { test('leg', ell(X, Y, -0.62 * L, 0.3 * H, 0.38 * L, 0.06 * L, 0.2)); test('arm', ell(X, Y, 0.38 * L, 0.2 * H, 0.12 * L, 0.03 * L, -0.6)); }
        else { test('leg', ell(X, Y, -0.2 * L, 0.32 * H, 0.22 * L, 0.11 * H, -0.45)); test('leg', ell(X, Y, -0.12 * L, 0.11 * H, 0.25 * L, 0.075 * H, 0.12)); if (!part && Y >= 0 && Y < 0.06 * H && X > -0.05 * L && X < 0.3 * L) part = 'foot'; if (!part && X > 0.2 * L && X < 0.25 * L && Y >= 0 && Y < 0.34 * H) part = 'arm'; }
        test('body', ell(X, Y, -0.05 * L, 0.44 * H, 0.36 * L, 0.32 * H, leap ? 0.1 : 0.22));
      } else {
        const eye = ell(X, Y, 0.27 * L, 0.72 * H, 0.09 * L, 0.09 * L);   // bulging up out of the head
        if (eye[0] < 1) part = Math.abs(Y - 0.72 * H) < 0.025 * L && Math.abs(X - 0.27 * L) < 0.06 * L ? 'pupil' : 'eye';
        test('gland', ell(X, Y, 0.08 * L, 0.66 * H, 0.12 * L, 0.1 * H));
        if (pose === 1) test('sac', ell(X, Y, 0.34 * L, 0.14 * H, 0.13 * L, 0.13 * L));
        test('head', ell(X, Y, 0.26 * L, 0.35 * H, 0.22 * L, 0.3 * H));
        if (leap) { test('leg', ell(X, Y, -0.48 * L, 0.24 * H, 0.26 * L, 0.06 * L, 0.15)); test('arm', ell(X, Y, 0.34 * L, 0.12 * H, 0.1 * L, 0.035 * L, -0.5)); }
        else { if (X > 0.21 * L && X < 0.3 * L && Y >= 0 && Y < 0.3 * H) part = part || 'arm'; test('leg', ell(X, Y, -0.29 * L, 0.22 * H, 0.17 * L, 0.21 * H)); if (!part && Y >= 0 && Y < 0.07 * H && X > -0.44 * L && X < 0.02 * L) part = 'foot'; }
        test('body', ell(X, Y, -0.08 * L, 0.4 * H, 0.4 * L, 0.42 * H));
      }
      if (!part) continue;
      // light from the upper left and a little in front, as on everything else
      const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, u * u + w * w))), lam = Math.max(0, -0.35 * u + 0.75 * w + 0.55 * nz);
      let v = (frog ? 0.4 : 0.36) + lam * 0.45, c = null, b = blk, a = 1;
      if (part === 'eye') { v = u * u + w * w > 0.75 ? 0.3 : 0.95; c = '@'; }   // a dark rim round the bright iris, wet
      else if (part === 'pupil') { v = 0; c = '-'; b = 0; a = 1; }
      else if (part === 'sac') { v = 0.6 + 0.1 * nz; c = '@'; b = 0; }
      else if (part === 'drum') { v = 0.22; c = '%'; }
      else if (part === 'gland') v += 0.12;                                                  // the swollen glands catch the light
      else if (part === 'foot' || part === 'arm') v = 0.3 + lam * 0.2;
      else if (part === 'leg') v = u * u + w * w > 0.6 ? v * 0.55 : v + 0.04;   // the folded thigh, its fold drawn dark
      if (part === 'body' || part === 'head' || part === 'gland') {
        if (Y < (frog ? 0.22 : 0.2) * H && X > -0.25 * L) { v = 0.5; b = 0; }               // the pale belly
        else if (frog) {
          if (w > 0.55 && w < 0.78 && part === 'body') v += 0.16;                            // the ridge along its back
          if (vnoise(X * 0.35 + 3, Y * 0.35) > 0.64) v -= 0.12;                              // dark spots
          if (lam > 0.8) { c = '*'; v += 0.1; }                                              // a wet sheen
        } else if (hash(cx * 7 + 3, cy * 5 + 1) > 0.74 && w > -0.3) { c = '*'; v = Math.min(0.62, v + 0.12); }  // warts (never as bright as the eye)
        else if (vnoise(X * 0.4 + 7, Y * 0.4) > 0.66) v -= 0.08;                             // mottling
      }
      // the outline: a little darker where the shape turns away
      if (part !== 'eye' && part !== 'pupil' && part !== 'leg' && u * u + w * w > 0.8) v *= 0.7;
      if (part === 'arm' && (cx & 1)) v *= 0.8;
      v = Math.max(0, Math.min(0.95, v));
      if (!c) c = v > 0.52 ? '@' : v > 0.36 ? '#' : v > 0.22 ? '%' : '=';
      out.push(cx * fw, cy * fh, fid(c, Math.floor(v * 8)) + b, a);
    }
    return out;
  };
  CRF[kind] = { sit: frame(0), puff: frame(1), hop: frame(2), key };
  return CRF[kind];
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
    if (toadGen !== worldGen) { toads.clear(); toadRipples.length = toadDrops.length = 0; toadGen = worldGen; }
    const x0 = Math.max(1, VX0 - 20), x1 = Math.min(COLS - 2, VX1 + 20), y0 = Math.max(1, VY0 - 10), y1 = Math.min(ROWS - 2, VY1 + 10);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * COLS + x;
      // Use stable world-seeded positions, not the padded grid column. Adding a
      // safety border must not rearrange or delete the marsh's generated toads.
      const sx = x - terrainSeedOffset;
      if (!wet[i] || hash(sx * 7 + 3, y * 13 + 1) > 0.014 || toads.has(i) || !toadSpot(i)) continue;
      toads.set(i, { home: i, kind: kind[i] === 8 || hash(sx * 3, y * 11) > 0.55 ? 'frog' : 'toad', x, y, st: 'sit',   // frogs on the pads, toads mostly on the tussocks
        t: 0, wait: 1 + hash(sx, y) * 5, dir: hash(y, sx) > 0.5 ? 1 : -1, s: (sx * 73856093 ^ y * 19349663) >>> 0, h: 0 });
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
        const fr = td.kind === 'frog', w = toadRnd(td) < (fr ? 0.85 : 0.45) && toadNear(td, 2, fr ? 9 : 5, toadWater, true);   // a frog nearly always into the water, a toad half the time
        if (w) toadHop(td, w, true);
        else { const to = toadNear(td, fr ? 8 : 4, fr ? 16 : 9, td.free ? toadFree : toadSpot, true) || toadNear(td, 3, 10, td.free ? toadFree : toadSpot, true); if (to) toadHop(td, to, false); }
        continue;
      }
      if (td.st === 'croak') { if (td.t > td.dur) { td.st = 'sit'; td.t = 0; td.wait = 2 + toadRnd(td) * 6; } continue; }
      if (td.t < td.wait) continue;
      const r = toadRnd(td);
      if (r < 0.45) { td.st = 'croak'; td.t = 0; td.dur = 0.9 + toadRnd(td) * 1.2; }
      else if (r < 0.75) { const to = td.kind === 'frog' ? toadNear(td, 3, 8, td.free ? toadFree : toadSpot, false) : toadNear(td, 1, 3, td.free ? toadFree : toadSpot, false);   // a toad only shuffles a little
        if (to) toadHop(td, to, false); else { td.t = 0; td.wait = 3; } }
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
  const td = e.td, F = creatureFrames(td.kind), i = Math.round(td.y) * COLS + Math.round(td.x);
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
