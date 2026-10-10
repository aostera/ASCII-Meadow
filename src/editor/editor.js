// The map editor: only with ?edit in the address; M opens and closes it. Brushes paint the ground, tools
// place trees, bushes, cows, fires and the knight's start; every change goes into MEADOW_MAP (world/map.js)
// and is seen at once, with the wind, shadows and fog. «Сохранить» downloads src/data/map.js for the repository.

const ED = {
  tool: 'g', size: 6, variant: { tree: 0, dead: 0, bush: 0 },
  sel: null, hover: null, drag: null, pan: null, stroke: null, space: false,
  undo: [], redo: [], keys: new Set(), mx: -1, my: -1, inView: false,
  ui: null, mini: null, miniKey: '', draftTimer: 0,
};
const ED_BRUSHES = [['g', 'Трава', '1'], ['t', 'Высокая трава', '2'], ['s', 'Низкая трава', '3'], ['e', 'Земля', '4'], ['r', 'Камни', '5'], ['f', 'Цветы', '6'], ['p', 'Тропа', '7'], ['.', 'Ластик', '0']];
const ED_OBJECTS = [['tree', 'Дерево', 'T'], ['dead', 'Сухое дерево', 'U'], ['bush', 'Куст', 'B'], ['cow', 'Корова', 'C'], ['fire', 'Костёр', 'F'], ['start', 'Старт рыцаря', 'K'], ['select', 'Выбрать и двигать', 'V']];
const ED_DRAFT = 'ascii-meadow-map-draft';
const edIsBrush = tool => tool.length === 1 && PCODES.includes(tool);
const edR1 = v => Math.round(v * 10) / 10;
const edXZ = (x, y) => toModelXZ(x, y).map(edR1);

// ---------- the map as a file ----------
function mapFileText() {
  const m = MEADOW_MAP, rows = a => a === null ? 'null' : a.length ? '[\n' + a.map(e => '    ' + JSON.stringify(e)).join(',\n') + '\n  ]' : '[]';
  const paint = savePaint(), keys = Object.keys(paint);
  const text = '// The meadow\'s map. Edit it in the game: open the page with ?edit and press M; «Сохранить» writes this file.\n' +
    '// Positions are castle ground units (px at MS = 1) from the foot of the castle mound: x to the right, z to the north.\n' +
    '// null: generated as before. paint: brush strokes over the generated ground, run-length coded per 32×32 chunk.\n' +
    'const MEADOW_MAP = {\n  "v": 1, "res": ' + PAINT_RES + ',\n  "start": ' + JSON.stringify(m.start) + ',\n  "fires": ' + rows(m.fires) +
    ',\n  "cows": ' + rows(m.cows) + ',\n  "flora": ' + rows(m.flora) + ',\n  "paint": ' +
    (keys.length ? '{\n' + keys.map(k => '    ' + JSON.stringify(k) + ': ' + JSON.stringify(paint[k])).join(',\n') + '\n  }' : '{}') + '\n};\n';
  return text.replace(/<\/script/gi, '<\\/script');   // the single-file bundle inlines it in a <script>
}
function parseMapText(text) {
  const a = text.indexOf('{', Math.max(0, text.indexOf('MEADOW_MAP'))), b = text.lastIndexOf('}');
  const m = JSON.parse(text.slice(a, b + 1));
  if (typeof m !== 'object' || !m || m.v !== 1) throw new Error('not a map file');
  return m;
}
const mapSnapshot = () => JSON.parse(JSON.stringify({ start: MEADOW_MAP.start, fires: MEADOW_MAP.fires, cows: MEADOW_MAP.cows, flora: MEADOW_MAP.flora, paint: savePaint() }));   // a copy: edits must not reach it

// ---------- applying changes ----------
// Generated objects become map objects the first time one is moved, added or deleted.
function edBake() {
  const M = MEADOW_MAP;
  if (!M.flora) { M.flora = flora.map(f => [f.v.type, variantsOf(f.v.type).indexOf(f.v), ...edXZ(f.x, f.br - 0.7)]); flora.forEach((f, k) => { f.mi = k; }); }
  if (!M.cows) { M.cows = cows.map(c => edXZ(c.home[0], c.home[1])); cows.forEach((c, k) => { c.mi = k; }); }
  if (!M.fires) { M.fires = braziers.filter(b => b.ground).map(b => edXZ(b.x, b.y)); braziers.filter(b => b.ground).forEach((b, k) => { b.mi = k; }); }
  if (!M.start) { const sy = ROWS - VR * 0.3; M.start = edXZ(pathX(sy) - 3, sy); }
}
function applyObjects(which) {
  if (which.flora) rebuildFlora();
  if (which.fires) placeGroundFires();
  if (which.start && MEADOW_MAP.start) { [player.x, player.y] = mapToCell(MEADOW_MAP.start[0], MEADOW_MAP.start[1]); const h = surfAt(player.x, player.y); player.hT = player.h = isFinite(h) ? h : 0; }
  if (which.cows) placeCows();
  edChanged();
}
function applyWholeMap(src) {
  const m = JSON.parse(JSON.stringify(src));   // undo entries and drafts stay as they were
  Object.assign(MEADOW_MAP, { start: m.start || null, fires: m.fires || null, cows: m.cows || null, flora: m.flora || null });
  loadPaint(m.paint); rebuildMap();
  if (!MEADOW_MAP.start) { const sy = ROWS - VR * 0.3; player.y = sy; player.x = pathX(sy) - 3; }   // the generated herd stands by the start
  applyObjects({ fires: 1, start: 1, cows: 1 });
}
function edChanged() {
  ED.miniKey = '';
  clearTimeout(ED.draftTimer);
  ED.draftTimer = setTimeout(() => { try { localStorage.setItem(ED_DRAFT, JSON.stringify({ t: Date.now(), map: mapSnapshot() })); } catch { /* private mode: no draft */ } }, 600);
}
function edRecord(entry) { ED.undo.push(entry); if (ED.undo.length > 200) ED.undo.shift(); ED.redo.length = 0; edSyncUI(); }
function edUndoRedo(from, to) {
  const e = from.pop(); if (!e) return;
  if (e.paint) {
    const back = new Map();
    for (const [k, a] of e.paint) { const cur = paintChunks.get(k); back.set(k, cur ? cur.slice() : null); if (a) paintChunks.set(k, a.slice()); else paintChunks.delete(k); }
    to.push({ paint: back });
    for (const k of e.paint.keys()) edRepaintChunk(k);
    edChanged();
  } else if (e.map) {
    to.push({ map: mapSnapshot() });
    applyWholeMap(e.map);
  }
  ED.sel = null; edSyncUI();
}
const edUndo = () => edUndoRedo(ED.undo, ED.redo), edRedo = () => edUndoRedo(ED.redo, ED.undo);

// ---------- painting ----------
function edSetPaint(px, pz, code) {
  const key = (px >> 5) + ',' + (pz >> 5);
  let a = paintChunks.get(key);
  if (ED.stroke && !ED.stroke.has(key)) ED.stroke.set(key, a ? a.slice() : null);
  if (!a) { if (!code) return; a = new Uint8Array(PCH * PCH); paintChunks.set(key, a); }
  a[(px & 31) + (pz & 31) * PCH] = code;
}
// Trees stand where they stood: re-cut the grass under the crowns of those in a cell box.
function edRehide(x0, y0, x1, y1) {
  for (const f of flora) {
    if (f.br < y0 - 12 || f.br > y1 + 30 || f.x < x0 - 40 || f.x > x1 + 40) continue;
    const v = f.v, bx = Math.round(f.x);
    for (let k = 0; k < v.hide.length; k += 2) { const cx = bx + v.hide[k], cy = f.br + v.hide[k + 1]; if (cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS) kind[cy * COLS + cx] = 0; }
  }
}
function edRepaintRect(gx0, gz0, gx1, gz1) {
  paintRect(gx0, gz0, gx1, gz1, true);
  const C = cathedral;
  edRehide((gx0 * MS + C.ox) / CW, (C.oy - gz1 * SINP * MS) / CH, (gx1 * MS + C.ox) / CW, (C.oy - gz0 * SINP * MS) / CH);
}
function edRepaintChunk(key) { const [kx, kz] = key.split(',').map(Number), s = PCH * PAINT_RES; edRepaintRect(kx * s, kz * s, (kx + 1) * s, (kz + 1) * s); }
function edStamp(gx, gz) {
  const r = ED.size * PAINT_RES, code = Math.max(0, PCODES.indexOf(ED.tool));
  for (let pz = Math.floor((gz - r) / PAINT_RES); pz <= Math.floor((gz + r) / PAINT_RES); pz++) for (let px = Math.floor((gx - r) / PAINT_RES); px <= Math.floor((gx + r) / PAINT_RES); px++) {
    const dx = (px + 0.5) * PAINT_RES - gx, dz = (pz + 0.5) * PAINT_RES - gz;
    if (dx * dx + dz * dz <= r * r) edSetPaint(px, pz, code);
  }
  edRepaintRect(gx - r - PAINT_RES, gz - r - PAINT_RES, gx + r + PAINT_RES, gz + r + PAINT_RES);
}
function edStrokeTo(gx, gz) {
  const s = ED.stroke, step = Math.max(PAINT_RES, ED.size * PAINT_RES * 0.5);
  const d = Math.hypot(gx - s.gx, gz - s.gz), n = Math.ceil(d / step);
  for (let k = 1; k <= n; k++) edStamp(s.gx + (gx - s.gx) * k / n, s.gz + (gz - s.gz) * k / n);
  s.gx = gx; s.gz = gz;
}

// ---------- objects ----------
// Ground point under a screen point: the feet of whoever would stand there.
const edGround = (sx, sy) => toModelXZ(sx / CW + camX, sy / CH + camY - 0.7);
const edScreen = (x, y) => [(x - camX) * CW, (y + 0.7 - camY) * CH];   // the feet of x, y on the screen
// Everything that can be picked, with its feet on the screen. Before the first bake the index in the
// generated lists stands in for the map index: edBake lists them in the same order.
function edObjects() {
  const out = [];
  flora.forEach((f, k) => { if (f.br > VY0 - 4 && f.br < VY1 + 40) { const [sx, sy] = edScreen(f.x, f.br - 0.7); out.push({ kind: 'flora', mi: f.mi ?? k, sx, sy, r: Math.max(10, f.v.R * 0.45), top: f.v.Hc * 1.1, f }); } });
  cows.forEach((c, k) => { const [sx, sy] = edScreen(c.x, c.y); out.push({ kind: 'cows', mi: c.mi ?? k, sx, sy, r: cowHalf() * CW * 0.8, top: knightPx() * 0.5 }); });
  braziers.filter(b => b.ground).forEach((b, k) => { const [sx, sy] = edScreen(b.x, b.y); out.push({ kind: 'fires', mi: b.mi ?? k, sx, sy, r: 3 * CW, top: 4 * CH }); });
  const st = MEADOW_MAP.start ? mapToCell(MEADOW_MAP.start[0], MEADOW_MAP.start[1]) : [pathX(ROWS - VR * 0.3) - 3, ROWS - VR * 0.3], [sx, sy] = edScreen(st[0], st[1]);
  out.push({ kind: 'start', mi: 0, sx, sy, r: 3 * CW, top: knightPx() * 0.9 });
  return out;
}
function edPick(sx, sy) {   // the frontmost object whose body covers the point
  let best = null;
  for (const o of edObjects()) {
    const inside = Math.abs(sx - o.sx) < o.r && sy < o.sy + CH * 1.5 && sy > o.sy - o.top;
    if (inside && (!best || o.sy > best.sy)) best = o;
  }
  return best;
}
function edPlace(tool, gx, gz) {
  edBake();
  edRecord({ map: mapSnapshot() });
  const p = [edR1(gx), edR1(gz)];
  if (tool === 'start') { MEADOW_MAP.start = p; applyObjects({ start: 1 }); ED.sel = { kind: 'start', mi: 0 }; return; }
  if (tool === 'cow') { MEADOW_MAP.cows.push(p); applyObjects({ cows: 1 }); ED.sel = { kind: 'cows', mi: MEADOW_MAP.cows.length - 1 }; return; }
  if (tool === 'fire') { MEADOW_MAP.fires.push(p); applyObjects({ fires: 1 }); ED.sel = { kind: 'fires', mi: MEADOW_MAP.fires.length - 1 }; return; }
  MEADOW_MAP.flora.push([tool, ED.variant[tool], ...p]);
  applyObjects({ flora: 1 }); ED.sel = { kind: 'flora', mi: MEADOW_MAP.flora.length - 1 };
}
function edMoveSelected(gx, gz) {
  const s = ED.sel, p = [edR1(gx), edR1(gz)];
  edRecord({ map: mapSnapshot() });
  if (s.kind === 'start') MEADOW_MAP.start = p;
  else if (s.kind === 'flora') { const e = MEADOW_MAP.flora[s.mi]; e[2] = p[0]; e[3] = p[1]; }
  else MEADOW_MAP[s.kind][s.mi] = p;
  applyObjects({ [s.kind]: 1 });
}
function edDeleteSelected() {
  const s = ED.sel; if (!s || s.kind === 'start') return;
  edRecord({ map: mapSnapshot() });
  MEADOW_MAP[s.kind].splice(s.mi, 1);
  ED.sel = null;
  applyObjects({ [s.kind]: 1 });
}
function edStepVariant(d) {
  const s = ED.sel;
  if (s && s.kind === 'flora') {
    const e = MEADOW_MAP.flora[s.mi], n = variantsOf(e[0]).length;
    edRecord({ map: mapSnapshot() }); e[1] = (e[1] + d + n) % n; ED.variant[e[0]] = e[1];
    applyObjects({ flora: 1 }); return;
  }
  const type = ED.variant[ED.tool] !== undefined ? ED.tool : null;
  if (type) { const n = variantsOf(type).length; ED.variant[type] = (ED.variant[type] + d + n) % n; edSyncUI(); }
}

// ---------- open, close, play ----------
function openEditor() {
  if (!EDIT || !COLS) return;
  editing = true; ED.keys.clear(); keys.clear(); mouse.on = false;
  document.body.classList.add('editing'); ED.ui.root.hidden = false; ED.ui.open.hidden = true;
  edCheckDraft(); edSyncUI();
}
function closeEditor() {
  editing = false; ED.keys.clear(); ED.drag = ED.pan = ED.stroke = null;
  document.body.classList.remove('editing'); ED.ui.root.hidden = true; ED.ui.open.hidden = false;
}
function edPlayHere() {   // the knight walks on from the middle of the view
  let x = camX + VC / 2, y = camY + VR * 0.62;
  for (let k = 0; k < 40 && blocked(x, y, null); k++) y += 1;
  player.x = x; player.y = y; const h = surfAt(x, y); player.hT = player.h = isFinite(h) ? h : 0;
  closeEditor();
}

// ---------- the frame: camera keys, and the overlay ----------
function updateEditor(dt) {
  const k = ED.keys, fast = k.has('ShiftLeft') || k.has('ShiftRight') ? 2.6 : 1;
  const mx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
  const my = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
  camX += mx * VC * 0.8 * fast * dt; camY += my * VR * 0.8 * fast * dt;
}
function drawEditor() {
  const g = ctx;
  g.save(); g.font = `500 11px ${'"Rubik", system-ui, sans-serif'}`; g.textBaseline = 'bottom';
  const objs = edObjects(), sel = ED.sel;
  for (const o of objs) {   // every editable object gets a foot mark; the selected one a frame
    const on = sel && sel.kind === o.kind && sel.mi === o.mi, hov = ED.hover && ED.hover.kind === o.kind && ED.hover.mi === o.mi;
    if (o.kind === 'flora' && !on && !hov && ED.tool !== 'select') continue;
    g.strokeStyle = on ? 'rgba(255,214,120,.95)' : hov ? 'rgba(250,250,250,.8)' : o.kind === 'flora' ? 'rgba(250,250,250,.2)' : 'rgba(250,250,250,.4)'; g.lineWidth = on ? 1.5 : 1;
    if (on || hov) g.strokeRect(o.sx - o.r, o.sy - o.top, o.r * 2, o.top + CH * 1.5);
    g.beginPath(); g.ellipse(o.sx, o.sy, Math.min(o.r, 8), Math.min(o.r, 8) * 0.45, 0, 0, Math.PI * 2); g.stroke();
    const label = o.kind === 'start' ? 'старт' : o.kind === 'fires' ? 'костёр' : o.kind === 'cows' ? 'корова' : on || hov ? (o.f.v.type === 'tree' ? 'дерево ' : o.f.v.type === 'dead' ? 'сухое ' : 'куст ') + (variantsOf(o.f.v.type).indexOf(o.f.v) + 1) : '';
    if (label) { g.fillStyle = on ? 'rgba(255,214,120,.95)' : 'rgba(250,250,250,.7)'; g.fillText(label, o.sx + 6, o.sy - 4); }
  }
  if (ED.drag && ED.drag.moved) {   // where the dragged object will land
    const [x, y] = mapToCell(ED.drag.gx, ED.drag.gz), [sx, sy] = edScreen(x, y);
    g.setLineDash([4, 3]); g.strokeStyle = 'rgba(255,214,120,.95)'; g.beginPath(); g.ellipse(sx, sy, 12, 5, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  }
  if (ED.inView && !ED.pan && ED.mx >= 0) {
    const r = ED.size * PAINT_RES;
    g.strokeStyle = 'rgba(250,250,250,.75)'; g.setLineDash([5, 4]); g.lineWidth = 1;
    if (edIsBrush(ED.tool)) { g.beginPath(); g.ellipse(ED.mx, ED.my, r * MS, r * SINP * MS, 0, 0, Math.PI * 2); g.stroke(); }
    else if (ED.tool !== 'select') { g.beginPath(); g.ellipse(ED.mx, ED.my, 10, 4.5, 0, 0, Math.PI * 2); g.stroke(); }
    g.setLineDash([]);
    const t = ED.tool !== 'select' && ED_BRUSHES.concat(ED_OBJECTS).find(b => b[0] === ED.tool);   // what a click will do
    if (t) { g.fillStyle = 'rgba(250,250,250,.8)'; g.fillText(t[1] + (ED.variant[ED.tool] !== undefined ? ' ' + (ED.variant[ED.tool] + 1) : ''), ED.mx + 12, ED.my - 8); }
  }
  g.restore();
  edDrawMini();
}

// ---------- the minimap ----------
function edMiniBase() {   // the whole field, one pixel per few cells, redrawn after edits
  const c = ED.mini, w = c.width, h = c.height, img = c.getContext('2d').createImageData(w, h), d = img.data;
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const x = Math.min(COLS - 1, (px + 0.5) / w * COLS | 0), y = Math.min(ROWS - 1, (py + 0.5) / h * ROWS | 0), i = y * COLS + x, k = kind[i];
    let r, gg, b;
    if (bmask[i]) r = gg = b = 176;                                                        // castle
    else if (k === 1 || k === 0) r = gg = b = 30 + height[i] * 34 + (segs[i] > 2 ? 16 : 0) - bshade[i] * 26;   // grass, taller is lighter
    else if (k === 2) { r = 22; gg = 20; b = 18; }                                        // earth
    else if (k === 5) r = gg = b = 96;                                                     // stones
    else if (k === 7) { r = 150; gg = 144; b = 132; }                                      // trail
    else { r = 200; gg = 198; b = 190; }                                                   // flowers
    const o = (py * w + px) * 4; d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255;
  }
  const g = (ED.miniImg || (ED.miniImg = document.createElement('canvas')));
  g.width = w; g.height = h; const gc = g.getContext('2d'); gc.putImageData(img, 0, 0);
  gc.fillStyle = 'rgba(0,0,0,.9)';
  for (const f of flora) { const r = f.v.type === 'bush' ? 1 : 1.5; gc.fillRect(f.x / COLS * w - r, f.br / ROWS * h - r * 2, r * 2, r * 2); }
}
function edDrawMini() {
  const c = ED.mini; if (!c) return;
  const key = COLS + 'x' + ROWS;
  if (ED.miniKey !== key) { c.height = Math.round(c.width * (ROWS * CH) / (COLS * CW)); edMiniBase(); ED.miniKey = key; }
  const g = c.getContext('2d'), w = c.width, h = c.height, sx = w / COLS, sy = h / ROWS;
  g.drawImage(ED.miniImg, 0, 0);
  g.fillStyle = '#f2efe6'; for (const cw of cows) g.fillRect(cw.x * sx - 1.5, cw.y * sy - 1.5, 3, 3);
  g.fillStyle = '#e0803a'; for (const b of braziers) g.fillRect(b.x * sx - 1.5, b.y * sy - 1.5, 3, 3);
  g.fillStyle = '#d04b3c'; g.beginPath(); g.arc(player.x * sx, player.y * sy, 2.5, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(250,250,250,.9)'; g.lineWidth = 1; g.strokeRect(camX * sx + 0.5, camY * sy + 0.5, VC * sx, VR * sy);
}
function edMiniJump(e) {
  const r = ED.mini.getBoundingClientRect();
  camX = (e.clientX - r.left) / r.width * COLS - VC / 2; camY = (e.clientY - r.top) / r.height * ROWS - VR / 2;
}

// ---------- the panel ----------
function edCheckDraft() {
  let d = null; try { d = JSON.parse(localStorage.getItem(ED_DRAFT) || 'null'); } catch { d = null; }
  const same = d && JSON.stringify(d.map) === JSON.stringify(mapSnapshot());
  ED.ui.draft.hidden = !d || same;
  if (d && !same) ED.ui.draftText.textContent = 'Черновик от ' + new Date(d.t).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  ED.draftData = d;
}
function edStatus(text) { ED.ui.status.textContent = text; }
function edSyncUI() {
  if (!ED.ui) return;
  for (const b of ED.ui.root.querySelectorAll('[data-tool]')) b.classList.toggle('on', b.dataset.tool === ED.tool);
  ED.ui.size.value = ED.size; ED.ui.sizeOut.textContent = ED.size;
  const vt = ED.sel && ED.sel.kind === 'flora' ? MEADOW_MAP.flora[ED.sel.mi][0] : ED.variant[ED.tool] !== undefined ? ED.tool : null;
  ED.ui.variant.hidden = !vt;
  if (vt) ED.ui.variantOut.textContent = (ED.sel && ED.sel.kind === 'flora' ? MEADOW_MAP.flora[ED.sel.mi][1] : ED.variant[vt]) + 1 + ' из ' + variantsOf(vt).length;
  ED.ui.undo.disabled = !ED.undo.length; ED.ui.redo.disabled = !ED.redo.length;
}
function edSave() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([mapFileText()], { type: 'text/javascript' })); a.download = 'map.js';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  edStatus('map.js скачан. Положите его в src/data/ репозитория — сайт обновится сам.');
}
function edBuildUI() {
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const btn = (label, key, data) => { const b = el('button', 'ed-btn', `<span>${label}</span>` + (key ? `<kbd>${key}</kbd>` : '')); b.type = 'button'; Object.assign(b.dataset, data); return b; };
  const root = el('aside', 'ed'); root.hidden = true; root.setAttribute('aria-label', 'Редактор карты');
  const head = el('header', 'ed-head', '<h2>Редактор карты</h2>'); const close = btn('×', '', { act: 'close' }); close.title = 'Закрыть (M)'; close.classList.add('ed-x'); head.append(close);
  const draft = el('div', 'ed-draft'); draft.hidden = true; const draftText = el('span'); draft.append(draftText, btn('Восстановить', '', { act: 'draft-load' }), btn('Убрать', '', { act: 'draft-drop' }));
  const sBr = el('section', 'ed-sec', '<h3>Кисть</h3>'), gBr = el('div', 'ed-grid'); for (const [t, n, k] of ED_BRUSHES) gBr.append(btn(n, k, { tool: t })); sBr.append(gBr);
  const sizeRow = el('label', 'ed-size', 'Размер'); const size = el('input'); size.type = 'range'; size.min = 1; size.max = 30; const sizeOut = el('output'); sizeRow.append(size, sizeOut); sBr.append(sizeRow);
  const sOb = el('section', 'ed-sec', '<h3>Объекты</h3>'), gOb = el('div', 'ed-grid'); for (const [t, n, k] of ED_OBJECTS) gOb.append(btn(n, k, { tool: t })); sOb.append(gOb);
  const variant = el('div', 'ed-variant', 'Вариант'); const variantOut = el('output'); variant.append(btn('‹', '[', { act: 'var-' }), variantOut, btn('›', ']', { act: 'var+' })); sOb.append(variant);
  const sMap = el('section', 'ed-sec', '<h3>Карта</h3>'); const mini = el('canvas', 'ed-mini'); mini.width = 216; mini.height = 300; sMap.append(mini);
  const acts = el('div', 'ed-acts'); const undo = btn('Отменить', '', { act: 'undo' }), redo = btn('Повторить', '', { act: 'redo' });
  const file = el('input'); file.type = 'file'; file.accept = '.js,.json,text/javascript,application/json'; file.hidden = true;
  acts.append(undo, redo, btn('Сохранить', '', { act: 'save' }), btn('Открыть…', '', { act: 'open' }), btn('Сбросить', '', { act: 'reset' }), btn('Играть отсюда', '', { act: 'play' }), file);
  const help = el('p', 'ed-help', 'Камера: WASD или стрелки (Shift — быстрее), правая кнопка или пробел — тащить, клик по карте — перейти. Колесо — размер кисти или вариант. Delete — удалить выбранное. Ctrl Z / Ctrl Shift Z — отменить и повторить, Ctrl S — сохранить.');
  const status = el('p', 'ed-status');
  root.append(head, draft, sBr, sOb, sMap, acts, help, status);
  const open = el('button', 'ed-open', 'Редактор карты <kbd>M</kbd>'); open.type = 'button';
  document.body.append(root, open);
  ED.ui = { root, open, size, sizeOut, variant, variantOut, undo, redo, draft, draftText, status, file };
  ED.mini = mini;

  open.addEventListener('click', () => { open.blur(); openEditor(); });
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; b.blur();
    if (b.dataset.tool) { ED.tool = b.dataset.tool; if (!edIsBrush(ED.tool) && ED.tool !== 'select') ED.sel = null; edSyncUI(); return; }
    const a = b.dataset.act;
    if (a === 'close') closeEditor();
    else if (a === 'undo') edUndo();
    else if (a === 'redo') edRedo();
    else if (a === 'var-' || a === 'var+') edStepVariant(a === 'var+' ? 1 : -1);
    else if (a === 'save') edSave();
    else if (a === 'open') file.click();
    else if (a === 'play') edPlayHere();
    else if (a === 'reset') {
      if (!confirm('Вернуть сгенерированную карту? Нарисованное и расставленное пропадёт (можно отменить).')) return;
      edRecord({ map: mapSnapshot() }); applyWholeMap({}); ED.sel = null; edStatus('Карта сброшена к генерации.');
    } else if (a === 'draft-load' && ED.draftData) { edRecord({ map: mapSnapshot() }); applyWholeMap(ED.draftData.map); draft.hidden = true; edStatus('Черновик восстановлен.'); }
    else if (a === 'draft-drop') { try { localStorage.removeItem(ED_DRAFT); } catch { /* nothing to drop */ } draft.hidden = true; }
    edSyncUI();
  });
  size.addEventListener('input', () => { ED.size = +size.value; edSyncUI(); });
  file.addEventListener('change', () => {
    const f = file.files[0]; if (!f) return;
    f.text().then(text => { const m = parseMapText(text); edRecord({ map: mapSnapshot() }); applyWholeMap(m); ED.sel = null; edSyncUI(); edStatus('Открыт ' + f.name + '.'); })
      .catch(() => edStatus('Не получилось прочитать карту из ' + f.name + '.'));
    file.value = '';
  });
  mini.addEventListener('pointerdown', e => { mini.setPointerCapture(e.pointerId); edMiniJump(e); });
  mini.addEventListener('pointermove', e => { if (e.buttons) edMiniJump(e); });
}

// ---------- input: the editor hears first, and the game not at all while it is open ----------
function edKey(e) {
  if (e.target && e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
  const c = e.code, mod = e.ctrlKey || e.metaKey;
  if (c === 'KeyM' && !mod) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) (editing ? closeEditor() : openEditor()); return; }
  if (!editing) return;
  e.stopImmediatePropagation();
  if (mod && c === 'KeyZ') { e.preventDefault(); if (e.shiftKey) edRedo(); else edUndo(); return; }
  if (mod && c === 'KeyY') { e.preventDefault(); edRedo(); return; }
  if (mod && c === 'KeyS') { e.preventDefault(); edSave(); return; }
  if (mod) return;
  if (c === 'Escape') { if (ED.sel) { ED.sel = null; edSyncUI(); } else closeEditor(); return; }
  if (c === 'Space') { ED.space = true; e.preventDefault(); return; }
  if (c === 'Delete' || c === 'Backspace') { e.preventDefault(); edDeleteSelected(); return; }
  if (c === 'BracketLeft' || c === 'BracketRight') { edStepVariant(c === 'BracketRight' ? 1 : -1); return; }
  if (c === 'Minus' || c === 'Equal') { ED.size = Math.max(1, Math.min(30, ED.size + (c === 'Equal' ? 1 : -1))); edSyncUI(); return; }
  const tool = ED_BRUSHES.concat(ED_OBJECTS).find(b => c === (b[2] >= '0' && b[2] <= '9' ? 'Digit' : 'Key') + b[2]);
  if (tool) { ED.tool = tool[0]; edSyncUI(); return; }
  if (c.startsWith('Arrow')) e.preventDefault();
  ED.keys.add(c);
}
function edPointer(e) {
  if (!editing || (e.target !== cv && !ED.drag && !ED.pan && !ED.stroke)) return;
  e.stopImmediatePropagation();
  ED.mx = e.clientX; ED.my = e.clientY; ED.inView = true;
  if (e.type === 'pointerdown') {
    cv.setPointerCapture(e.pointerId);
    if (e.button === 1 || e.button === 2 || ED.space) { ED.pan = { x: e.clientX, y: e.clientY, cx: camX, cy: camY }; e.preventDefault(); return; }
    if (e.button !== 0) return;
    const [gx, gz] = edGround(e.clientX, e.clientY);
    if (edIsBrush(ED.tool)) { ED.stroke = new Map(); ED.stroke.gx = gx; ED.stroke.gz = gz; edStamp(gx, gz); return; }
    if (ED.tool === 'select') {
      const o = edPick(e.clientX, e.clientY);
      ED.sel = o ? { kind: o.kind, mi: o.mi } : null;
      if (o) { edBake(); ED.drag = { gx, gz, sx: e.clientX, sy: e.clientY, moved: false }; }
      edSyncUI(); return;
    }
    edPlace(ED.tool, gx, gz); edSyncUI(); return;
  }
  if (e.type === 'pointermove') {
    if (ED.pan) { camX = ED.pan.cx - (e.clientX - ED.pan.x) / CW; camY = ED.pan.cy - (e.clientY - ED.pan.y) / CH; return; }
    const [gx, gz] = edGround(e.clientX, e.clientY);
    if (ED.stroke) { edStrokeTo(gx, gz); return; }
    if (ED.drag) { const d = ED.drag; d.gx = gx; d.gz = gz; if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 4) d.moved = true; return; }
    ED.hover = ED.tool === 'select' ? edPick(e.clientX, e.clientY) : null;
    return;
  }
  // pointerup / pointercancel
  if (ED.stroke) { if (ED.stroke.size) edRecord({ paint: ED.stroke }); ED.stroke = null; edChanged(); }
  if (ED.drag) { if (ED.drag.moved && ED.sel) edMoveSelected(ED.drag.gx, ED.drag.gz); ED.drag = null; }
  ED.pan = null;
}

if (EDIT) {
  edBuildUI();
  addEventListener('keydown', edKey, true);
  addEventListener('keyup', e => { ED.keys.delete(e.code); if (e.code === 'Space') ED.space = false; }, true);
  for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) addEventListener(t, edPointer, true);
  cv.addEventListener('pointerleave', () => { ED.inView = false; ED.hover = null; });
  cv.addEventListener('contextmenu', e => { if (editing) e.preventDefault(); });
  cv.addEventListener('wheel', e => {
    if (!editing) return;
    e.preventDefault();
    const d = e.deltaY > 0 ? -1 : 1;
    if (edIsBrush(ED.tool)) { ED.size = Math.max(1, Math.min(30, ED.size + d)); edSyncUI(); } else edStepVariant(d);
  }, { passive: false });
}
