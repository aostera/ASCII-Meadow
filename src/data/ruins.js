// Three authored, permanent gothic ruin landmarks on the meadow map.
// Positions use the same stable castle-ground coordinates as flora and campfire.
// These are actual raycast 3D geometry, never background PNGs.
const RUIN_SITES = Object.freeze([
  { id: 'broken-gate', name: 'Разрушенная башня с аркой', type: 'gate',
    x: -735, z: -1120, width: 202, depth: 122, height: 312, arch: 96, archHeight: 150, yaw: 0.38 },
  { id: 'abbey-front', name: 'Фасад разрушенного аббатства', type: 'abbey',
    x: 630, z: -985, width: 246, depth: 144, height: 344, arch: 108, archHeight: 168, yaw: -0.34 },
  { id: 'cloister-walk', name: 'Готическая галерея с проходными арками', type: 'cloister',
    x: 185, z: -1605, width: 168, depth: 300, height: 260, arch: 100, archHeight: 160, yaw: 0.43 }
]);
