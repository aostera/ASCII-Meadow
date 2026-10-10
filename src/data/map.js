// The meadow's map. Edit it in the game: open the page with ?edit and press M; «Сохранить» writes this file.
// Positions are castle ground units (px at MS = 1) from the foot of the castle mound: x to the right, z to the north.
// null: generated as before (trail false: no generated trail). fires: [x, z] on the ground, [x, z, h] raised h units.
// paint: brush strokes over the generated ground, run-length coded per 32×32 chunk; fog: the same for fog
// (c clear, l light, d dense; 16-unit cells).
const MEADOW_MAP = {
  "v": 1, "res": 4,
  "start": null,
  "trail": null,
  "fires": null,
  "cows": null,
  "flora": null,
  "paint": {},
  "fog": {}
};
