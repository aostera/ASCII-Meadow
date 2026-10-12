// Read-only visual library of NPC animations for the ?edit panel.
// Uses the production procedural rig or already-attached PNG; never mutates the world,
// RNG, map, atlas, or legacy player/cow images. Draws only when explicitly opened/refreshed.
const ED_NPC_GALLERY_STATES = ['idle', 'walk', 'talk'];
function edNpcGalleryPhase(frame, count) { return (frame + 0.5) / count * Math.PI * 2; }
function edNpcGalleryFrames(count, limit) {
  const result = [];
  for (let i = 0; i < Math.min(count, limit); i++) {
    const f = Math.floor(i * count / Math.min(count, limit));
    if (!result.includes(f)) result.push(f);
  }
  return result;
}
function edNpcGalleryImage(type, state, direction, frame, frames) {
  const spec = ACTOR_TYPES.get(type);
  if (!spec) return null;
  const phase = edNpcGalleryPhase(frame, frames);
  const actor = { actorType: type, cls: spec.renderClass, rigMotion: spec.rigMotion,
    aiState: state, walk: state === 'walk' ? 1 : 0, step: state === 'walk' ? phase : 0,
    d8: direction, x: 0 };
  return npcAtlasPreviewImage(actor, state, phase) || npcRigPreviewImage(actor);
}
function edNpcGalleryDraw(canvas, image) {
  // Same luminance ramp and alpha handling as the large ASCII preview, but a
  // bounded 12x14 glyph grid; each canvas is independently rasterized at 48x70.
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#c4c4c4';
  context.font = '600 6px monospace';
  context.textBaseline = 'top';
  const ramp = ' .:-=+*#%@';
  const cols = 12, rows = 14;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    let value = 0, weight = 0;
    const x0 = Math.floor(x * image.width / cols), x1 = Math.floor((x + 1) * image.width / cols);
    const y0 = Math.floor(y * image.height / rows), y1 = Math.floor((y + 1) * image.height / rows);
    for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) {
      const i = (py * image.width + px) * 4, alpha = image.data[i + 3] / 255;
      value += image.data[i] * alpha; weight += alpha;
    }
    if (weight < 1) continue;
    const brightness = value / (weight * 255);
    const rank = Math.max(1, Math.min(ramp.length - 1, Math.floor(brightness * (ramp.length - 1))));
    context.fillText(ramp[rank], x * 4, y * 5);
  }
}
function edNpcGallerySelect(button) {
  const type = button.dataset.galleryType, state = button.dataset.galleryState;
  const frame = Number(button.dataset.galleryFrame), direction = Number(button.dataset.galleryDir);
  const types = [...ACTOR_TYPES.keys()], item = NPC_ATLASES.get(type);
  if (!ED.galleryOpen || !types.includes(type) || !ED_NPC_GALLERY_STATES.includes(state) ||
      !Number.isInteger(frame) || frame < 0 || !Number.isInteger(direction) ||
      direction < 0 || direction > 7) return;
  const row = item?.status === 'ready' ? (item.layout.states[state] || item.layout.states.idle) : null;
  const frames = row ? row.frames : 8;
  if (frame >= frames || (direction > 0 && (!row || row.rows.length !== 8))) return;
  ED.tool = 'npc'; ED.sel = null; ED.variant.npc = types.indexOf(type);
  ED.previewState = state; ED.previewDirection = direction;
  ED.previewPhase = edNpcGalleryPhase(frame, frames); ED.previewAuto = false; ED.previewClock = 0;
  edSyncUI();
}
function edNpcGalleryRender() {
  const ui = ED.ui;
  if (!ui || !ED.galleryOpen || ui.npcGallery.hidden) return;
  const root = ui.npcGallery;
  root.replaceChildren();
  const title = document.createElement('p');
  title.className = 'ed-gallery-help';
  title.textContent = 'Все типы · idle / walk / talk · до 4 кадров на строку. Выберите кадр для редактирования.';
  root.append(title);
  const selected = ED.sel?.kind === 'actors' ? MEADOW_MAP.actors?.[ED.sel.mi]?.[1] : null;
  const activeType = selected || [...ACTOR_TYPES.keys()][ED.variant.npc];
  function makeSamples(container, type, state, direction, count, maximum) {
    const strip = document.createElement('div');
    strip.className = 'ed-gallery-strip';
    for (const frame of edNpcGalleryFrames(count, maximum)) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'ed-gallery-frame';
      button.dataset.galleryType = type; button.dataset.galleryState = state;
      button.dataset.galleryDir = String(direction); button.dataset.galleryFrame = String(frame);
      const active = type === activeType && state === ED.previewState &&
        direction === ED.previewDirection && frame === npcAtlasFrameIndex(count, ED.previewPhase);
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-label', type + ', ' + state + ', ' +
        ED_NPC_DIRECTIONS[direction] + ', кадр ' + (frame + 1) + ' из ' + count);
      if (active) button.classList.add('on');
      const canvas = document.createElement('canvas');
      canvas.width = 48; canvas.height = 70;
      canvas.setAttribute('aria-hidden', 'true');
      const number = document.createElement('span');
      number.textContent = String(frame + 1).padStart(2, '0');
      button.append(canvas, number);
      strip.append(button);
      edNpcGalleryDraw(canvas, edNpcGalleryImage(type, state, direction, frame, count));
    }
    container.append(strip);
  }
  const group = document.createElement('div');
  group.className = 'ed-gallery-groups';
  for (const [type, spec] of ACTOR_TYPES) {
    const item = NPC_ATLASES.get(type), ready = item?.status === 'ready';
    for (const state of ED_NPC_GALLERY_STATES) {
      const card = document.createElement('section'); card.className = 'ed-gallery-card';
      const heading = document.createElement('p'); heading.className = 'ed-gallery-heading';
      const ownState = ready && !!item.layout.states[state];
      const row = ready ? (item.layout.states[state] || item.layout.states.idle) : null;
      const direction = row && row.rows.length === 8 ? ED.previewDirection : 0;
      heading.textContent = spec.name + ' · ' + state +
        (ready ? (' · PNG ' + row.frames + ' кадров / ' + row.fps + ' FPS' +
          (ownState ? '' : ' (idle fallback)')) : ' · процедурный риг');
      card.append(heading);
      makeSamples(card, type, state, direction, row ? row.frames : 8, 4);
      group.append(card);
    }
  }
  root.append(group);
  const sectionTitle = document.createElement('p');
  sectionTitle.className = 'ed-gallery-heading';
  sectionTitle.textContent = 'Ракурсы · ' + (ACTOR_TYPES.get(activeType)?.name || activeType) +
    ' · ' + ED.previewState;
  root.append(sectionTitle);
  const item = NPC_ATLASES.get(activeType);
  const row = item?.status === 'ready'
    ? (item.layout.states[ED.previewState] || item.layout.states.idle) : null;
  if (!row || row.rows.length !== 8) {
    const hint = document.createElement('p');
    hint.className = 'ed-gallery-help';
    hint.textContent = 'Матрица из 8 ракурсов доступна только для PNG с 8 авторскими направлениями. Процедурный риг не подменяется поворотами.';
    root.append(hint); return;
  }
  const directions = document.createElement('div'); directions.className = 'ed-gallery-directions';
  for (let d = 0; d < 8; d++) {
    const card = document.createElement('section'); card.className = 'ed-gallery-direction';
    const heading = document.createElement('p'); heading.className = 'ed-gallery-heading';
    heading.textContent = ED_NPC_DIRECTIONS[d] + ' · ' + row.frames + ' кадров';
    card.append(heading);
    makeSamples(card, activeType, ED.previewState, d, row.frames, 2);
    directions.append(card);
  }
  root.append(directions);
}
