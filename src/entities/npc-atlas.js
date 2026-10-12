// Optional atlases for *new catalog NPCs*. Neither the player nor cows use this path.
// A layout is a PNG grid with one horizontal strip of frames per state/direction.
// Rows are indexed in engine direction order: S, SW, W, NW, N, NE, E, SE.
const NPC_ATLASES = new Map();
const NPC_ATLAS_STATES = ['idle', 'walk', 'talk'];

function npcAtlasLayout(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      Object.keys(raw).some(k => !['frameWidth', 'frameHeight', 'states'].includes(k)))
    throw new Error('Invalid NPC atlas layout');
  const { frameWidth, frameHeight } = raw;
  if (![frameWidth, frameHeight].every(v => Number.isInteger(v) && v >= 8 && v <= 1024))
    throw new Error('Invalid NPC atlas frame size');
  if (!raw.states || typeof raw.states !== 'object' || Array.isArray(raw.states) ||
      !raw.states.idle || !Object.keys(raw.states).length ||
      Object.keys(raw.states).some(k => !NPC_ATLAS_STATES.includes(k)))
    throw new Error('Invalid NPC atlas states');
  const states = {};
  for (const [name, value] of Object.entries(raw.states)) {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).some(k => !['frames', 'fps', 'rows'].includes(k)) ||
        !Number.isInteger(value.frames) || value.frames < 1 || value.frames > 60 ||
        !Number.isFinite(value.fps) || value.fps <= 0 || value.fps > 60 ||
        !Array.isArray(value.rows) || ![1, 8].includes(value.rows.length) ||
        value.rows.some(r => !Number.isInteger(r) || r < 0 || r > 255))
      throw new Error('Invalid NPC atlas state: ' + name);
    states[name] = Object.freeze({ frames: value.frames, fps: value.fps,
      rows: Object.freeze(value.rows.slice()) });
  }
  return Object.freeze({ frameWidth, frameHeight, states: Object.freeze(states) });
}
function npcAtlasAttach(type, raw, source) {
  if (!ACTOR_TYPES.has(type)) throw new Error('Unknown NPC atlas actor: ' + type);
  const layout = npcAtlasLayout(raw);
  // No external image hosts or SVG: explicit PNG files in the NPC directory,
  // or locally chosen blob URLs; both WebP and PNG uploads remain supported. data:image/png and data:image/webp are also accepted for tests.
  if (typeof source !== 'string' || !(
    /^assets\/npc\/[a-zA-Z0-9_./-]+\.(?:png|webp)$/.test(source) && !source.includes('..') ||
    /^blob:https?:\/\//.test(source) || /^blob:null\//.test(source) ||
    /^data:image\/(?:png|webp);base64,[A-Za-z0-9+/=]+$/.test(source)))
    throw new Error('Invalid NPC atlas PNG source');
  const image = document.createElement('img');
  const entry = { layout, image, source, status: 'loading', error: '' };
  NPC_ATLASES.set(type, entry);
  image.onload = () => {
    if (NPC_ATLASES.get(type) !== entry) return; // superseded async load
    const { frameWidth: w, frameHeight: h } = layout;
    const maxRows = Math.max(...Object.values(layout.states).flatMap(s => s.rows));
    const maxFrames = Math.max(...Object.values(layout.states).map(s => s.frames));
    if (!image.naturalWidth || !image.naturalHeight ||
        image.naturalWidth % w || image.naturalHeight % h ||
        image.naturalWidth < maxFrames * w || image.naturalHeight < (maxRows + 1) * h) {
      entry.status = 'error'; entry.error = 'PNG dimensions do not match atlas layout';
    } else {
      // Loading an image from file:// may succeed while reading its pixels is
      // prohibited by the browser's opaque origin policy. Probe before enabling
      // the atlas, otherwise the rig's getImageData would throw and halt the game.
      const probe = document.createElement('canvas');
      probe.width = probe.height = 1;
      try {
        const context = probe.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0, 1, 1);
        context.getImageData(0, 0, 1, 1);
        entry.status = 'ready';
      } catch {
        entry.status = 'error';
        entry.error = 'PNG pixels unavailable (file:// security). Use HTTP or import PNG inside ?edit.';
      }
    }
  };
  image.onerror = () => { if (NPC_ATLASES.get(type) === entry) {
    entry.status = 'error'; entry.error = 'Unable to load NPC atlas PNG';
  } };
  image.src = source;
  return entry;
}
// Normalized phase (0–2π) has a single, stable frame mapping for both editor and renderer.
function npcAtlasFrameIndex(count, phase) {
  return Math.floor((((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) /
    (Math.PI * 2) * count) % count;
}
function npcAtlasFrame(actor, state, phase) {
  const item = NPC_ATLASES.get(actor.actorType);
  if (!item || item.status !== 'ready') return null;
  const { layout, image } = item;
  const row = layout.states[state] || layout.states.idle;
  const heading = Number.isInteger(actor.d8) ? ((actor.d8 % 8 + 8) % 8) : 0;
  const direction = row.rows.length === 8 ? heading : 0;
  // phase: editor's explicit 0..2π scrubber. Runtime: elapsed seconds.
  const frame = phase === undefined
    ? Math.floor(Math.max(0, actor.actorAnimTime || 0) * row.fps) % row.frames
    : npcAtlasFrameIndex(row.frames, phase);
  return { image, x: frame * layout.frameWidth, y: row.rows[direction] * layout.frameHeight,
    width: layout.frameWidth, height: layout.frameHeight, frame, direction };
}
function npcAtlasPreviewImage(actor, state, phase) {
  const frame = npcAtlasFrame(actor, state, phase);
  if (!frame) return null;
  const canvas = document.createElement('canvas');
  canvas.width = BOX_W; canvas.height = BOX_H;
  const c = canvas.getContext('2d', { willReadFrequently: true });
  c.drawImage(frame.image, frame.x, frame.y, frame.width, frame.height,
    0, 0, BOX_W, BOX_H);
  return c.getImageData(0, 0, BOX_W, BOX_H);
}

// JSON metadata is deliberately separate from the image. Export never serializes
// a blob: URL, raw PNG bytes or anything from the map.
function npcAtlasExportSettings(type) {
  const entry = NPC_ATLASES.get(type);
  if (!entry || entry.status !== 'ready') throw new Error('Load a PNG atlas before exporting animation settings');
  return JSON.stringify({ version: 1, type, layout: entry.layout }, null, 2);
}
function npcAtlasImportSettings(type, raw) {
  const entry = NPC_ATLASES.get(type);
  if (!entry || entry.status !== 'ready') throw new Error('Load a PNG atlas before importing animation settings');
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      Object.keys(data).length !== 3 ||
      Object.keys(data).some(k => !['version', 'type', 'layout'].includes(k)) ||
      data.version !== 1 || data.type !== type)
    throw new Error('Invalid animation settings file or NPC type');
  const layout = npcAtlasLayout(data.layout);
  const { naturalWidth: width, naturalHeight: height } = entry.image;
  const maxRow = Math.max(...Object.values(layout.states).flatMap(s => s.rows));
  const maxFrames = Math.max(...Object.values(layout.states).map(s => s.frames));
  // Ensure a valid schema is also physically compatible with the *current* PNG.
  if (width % layout.frameWidth || height % layout.frameHeight ||
      width < maxFrames * layout.frameWidth || height < (maxRow + 1) * layout.frameHeight)
    throw new Error('Animation settings exceed the loaded PNG dimensions');
  entry.layout = layout; // commit only after all checks; no partially applied settings
  return layout;
}
