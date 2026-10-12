// Opt-in asset inspection for NEW catalog NPC PNGs only. No map/RNG/gameplay access.
// The pure evaluator accepts a frame reader, making the exact rules unit-testable in Node.
// Codes: blank-frame (error), duplicate-frame, duplicate-direction, bounds-jump (warnings).
function npcAuditFrames(layout, readFrame) {
  const findings = [];
  let inspected = 0, empty = 0;
  const directions = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'];
  const add = (code, severity, state, direction, frame, detail) => {
    findings.push({ code, severity, state, direction, frame, detail });
  };
  for (const [state, spec] of Object.entries(layout.states)) {
    const sequenceHashes = [];
    for (let d = 0; d < spec.rows.length; d++) {
      const direction = spec.rows.length === 8 ? directions[d] : 'S';
      const signatures = [];
      let previous = null, duplicates = 0, missing = 0;
      let boundsWarning = false;
      for (let f = 0; f < spec.frames; f++) {
        const image = readFrame({ state, direction: d, row: spec.rows[d], frame: f });
        if (!image || !image.data || !Number.isInteger(image.width) || !Number.isInteger(image.height) ||
            image.width < 1 || image.height < 1 ||
            image.data.length !== image.width * image.height * 4)
          throw new Error('Invalid PNG sample for ' + state + '/' + direction + '/' + f);
        const pixels = image.data, width = image.width, height = image.height;
        let visible = 0, minX = width, minY = height, maxX = -1, maxY = -1;
        let hash = 2166136261;
        for (let i = 0; i < pixels.length; i += 4) {
          // Ignore completely transparent RGB noise; it must not make identical art look different.
          const alpha = pixels[i + 3];
          hash ^= alpha; hash = Math.imul(hash, 16777619);
          if (alpha < 16) continue;
          for (let channel = 0; channel < 3; channel++) {
            hash ^= pixels[i + channel]; hash = Math.imul(hash, 16777619);
          }
          const pixel = i / 4, x = pixel % width, y = Math.floor(pixel / width);
          visible++;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
        const signature = String(hash >>> 0);
        signatures.push(signature);
        inspected++;
        if (!visible) {
          empty++; missing++;
          add('blank-frame', 'error', state, direction, f + 1, 'Полностью прозрачный кадр');
          previous = null; continue;
        }
        const bounds = { cx: (minX + maxX) / 2 / width, cy: (minY + maxY) / 2 / height,
          w: (maxX - minX + 1) / width, h: (maxY - minY + 1) / height };
        if (previous) {
          if (signature === previous.signature) duplicates++;
          if (!boundsWarning && (Math.abs(bounds.cx - previous.bounds.cx) > 0.28 ||
              Math.abs(bounds.cy - previous.bounds.cy) > 0.28 ||
              Math.abs(bounds.w - previous.bounds.w) > 0.32 ||
              Math.abs(bounds.h - previous.bounds.h) > 0.32)) {
            add('bounds-jump', 'warning', state, direction, f + 1,
              'Резко меняется положение или размер силуэта');
            boundsWarning = true;
          }
        }
        previous = { signature, bounds };
      }
      if (duplicates && spec.frames > 1)
        add('duplicate-frame', 'warning', state, direction, null,
          duplicates + ' повторяющихся соседних кадров (допустимо для пауз)');
      sequenceHashes.push(signatures.join('/'));
      // A direction with an empty frame is reported even if remaining frames are valid.
      if (missing === spec.frames && spec.frames > 1)
        add('empty-direction', 'error', state, direction, null, 'Во всём направлении нет изображения');
    }
    if (spec.rows.length === 8) {
      const unique = new Set(sequenceHashes);
      if (unique.size < 8)
        add('duplicate-direction', 'warning', state, 'all', null,
          'Уникальных направлений: ' + unique.size + ' из 8 (проверьте ракурсы)');
    }
  }
  const errors = findings.filter(f => f.severity === 'error').length;
  return { inspected, empty, errors, warnings: findings.length - errors, findings };
}
function npcAtlasAudit(type) {
  const item = NPC_ATLASES.get(type);
  if (!item || item.status !== 'ready') throw new Error('Сначала загрузите готовый PNG-атлас NPC');
  // Fixed-resolution 32x32 samples: scanning 60 frames x 8 directions x 3 states
  // is bounded and does not allocate large full-resolution frame copies.
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 32;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { frameWidth: w, frameHeight: h } = item.layout;
  return npcAuditFrames(item.layout, ({ row, frame }) => {
    ctx.clearRect(0, 0, 32, 32);
    ctx.drawImage(item.image, frame * w, row * h, w, h, 0, 0, 32, 32);
    return ctx.getImageData(0, 0, 32, 32);
  });
}
