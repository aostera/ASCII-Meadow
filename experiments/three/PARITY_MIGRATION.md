# 1:1 visual migration — Three.js rasterizer

## Decision (2026-10-14)
The user rejected the visually downgraded procedural 3D world. We therefore **preserve all original world rendering and game systems** and migrate only the GPU glyph output first.

- Public preview entry: `experiments/three/index.html` — the original complete game with a choice between **Оригинал** and **Three.js** backend.
- Alternate parity path: `experiments/three/parity.html`.
- Former simplified procedural scene (not a parity candidate): `experiments/three/procedural.html`.
- Production root `index.html` and source `src/data/map.js`: **UNMODIFIED**.

## Architecture
The 47 original game scripts load in exactly the same order from ../../src/. They still build the entire authored map, geometry/ASCII glyph detail, shadow/grass contact, cows, knight, NPCs, wind, fire/fog, player motion and map editor.

`parity.js` switches **only** the `GL.flush` function. `three-glyphs.js` draws the original `GB.buf` glyph rectangles with a Three.js `InstancedBufferGeometry` and RawShaderMaterial. It uses the original `SPF` sprite UV atlas table and `GB.atlasCv`, camera pan/zoom and painter order. The original GPU canvas remains available and can be restored by clicking **Оригинал**; errors trigger fallback. The Three GPU context initializes only on demand.

## Test gates
- `tools/check/three-source-sync.cjs`: enforces inclusion and order of all original game scripts on parity and default preview pages.
- `tools/check/three-parity.cjs`: desktop/mobile WebGL smoke, immutable map, switch back to original, captured screenshots.
- `tools/check/three-pixel-parity.py`: paired screenshots of a frozen original simulation; reports mean pixel error, guards against an all-black Three image. **A successful basic browser test does NOT prove visual equality.**
- Original game visual-diff CI remains unchanged.

## Work not complete
The Three backend's texture filtering/UV, alpha, sRGB and blending must be adjusted to meet strict pixel-level equality on the same frozen frame. Editor/keyboard/touch/Safari restore and performance at real devices remain unproven. Real 3D lighting and architectural depth upgrades must be added as isolated opt-in enhancements only **after** the baseline matches. The temporary 3D models in `app.js` are NOT authored assets and must never be presented as replacement art.

DO NOT merge draft PR #37 into `main` as a complete engine migration. Read `CLAUDE_HANDOFF.md` and original repo notes before resuming.
