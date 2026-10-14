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


## Owner order / non-negotiables (2026-10-14)
Do not touch author-set **brightness or transparency**. Deliver first: original-image fidelity (without brightness/alpha tuning), improved gothic 3D architecture, faithful animation migration, measurable performance optimization. **After** these stages, correct shadows, add bushes physically parting when player/NPC passes (spring return like grass), and repair NPC depth ordering so trees, ruins, houses and vegetation occlude NPCs correctly when in front. The later tasks are noted in `notes/Бэклог.md`. Keep the production branch untouched.


## Stage 2 / optional true source-geometry inspection (2026-10-14)
- Open `/experiments/three/?geometry=1` to inspect **real native Three.js geometry generated from original castle and Gothic ruin raycast primitives**, never from handcrafted generic replacements. Original ASCII pixel-perfect comparison stays the default at `/experiments/three/`.
- `architecture-viewer.mjs` consumes actual `solids`, `ruinDetail`, `ruinRotateMesh` and authoritative `MEADOW_MAP.ruins` without modifying any source map file. It uses `source-masonry.mjs` to intersect source half-spaces into triangulated native meshes and batch by material kind. The visual styling in this **opt-in geometry inspector** is temporary; author-set original ASCII brightness and transparency remain unchanged.
- User can select castle/ruins, rotate and zoom. The viewer pauses hidden simulation and resumes it on close, releasing its GPU resources.
- CI `tools/check/three-architecture.cjs` verifies geometry, screenshot, source map immutability, return to legacy, distinct from the eight 100% matching original ASCII frames.
- **Still pending**: camera/texturing parity and integration of this real source mesh into the live game's hybrid depth/lighting pipeline, 3D character animation and real-device performance acceptance.


## 2026-10-14 — Stage 2, native geometry in original world coordinates

A new `source-world.mjs` projects **the castle and all 3 original Gothic ruins together**, using actual `cathedral.kx/ky`, `cathedral.ox/oy`, authored `ruinSites()`, `MS` / `WS`, and `PITCH`. Mesh transforms encode exactly the old raycast-to-glyph projection. This is not an invented map or placeholder asset.

Open `/experiments/three/?geometry=world` to see the combined original-world 3D geometry, not individual orbit-only prototypes. In the same viewer, choose `Камера игры` to switch to an orthographic camera matching the real game's tilt, zoom and scroll; toggle back for a castle-centred view. The original `/experiments/three/` continues unchanged with 1:1 glyph raster buttons.

`tools/check/three-world-projection.mjs` asserts pixel correspondence for transformed source vertices, authored ruin offsets/yaw, castle and ruin scales, restored solids and unchanged map data. `tools/check/three-architecture.cjs` exercises complete world, four source site IDs, camera switch and game restoration. The source mesh inspector does **not** replace the live gameplay rasterizer or touch user brightness/opacity; full 3D scene integration, animation and actual Safari FPS remain open.


## Native Gothic geometry in the live game (opt-in; 2026-10-14)
Open `/experiments/three/`, press **Three.js**, then **3D архитектура**. This draws the *same authored four buildings* into a small 3D camera-aligned inset on the **same GPU renderer context** as the glyph world. Source meshes are rebuilt only on original game `worldGen` changes (resize/rebuild), and disposed on disable. The original 1:1 ASCII frame remains unchanged outside this opt-in inset, without modifying its brightness or alpha. This is a safe intermediate integration gate before final in-world depth occlusion. `tools/check/three-live-architecture.cjs` tests opt-in, mobile, shared context, map preservation and teardown. FPS improvements and shadow/bush/NPC work are not accepted yet.


## 2026-10-14 — GPU source depth is now a live in-world resource

The Three live game offers **Глубина 3D** as an opt-in engineering layer alongside **3D архитектура**. It renders actual authored Gothic architecture to a depth texture in the same GPU context, with the same camera and map and without allocating a second canvas. A diagnostic inset displays white for source stone and black for open space. Pixel-perfect original sprites, their brightness and transparency remain untouched. Depth values are now available for a future carefully tested glyph actor/building occlusion pass, not yet applied. The CI test pairs a frozen castle frame before/after enabling depth on phone and desktop, tests real stone/empty-space pixels, disables the layer and requires unchanged pixels outside the inset. This also checks no GPU context leaks.


## 2026-10-14 — acceptance: GPU source depth diagnostic PASSED

**Verified against actual Chromium WebGL2 CI, workflow run 38537748888, experimental code SHA 6956b708e6d9c5ef2f45cdcc443a7c53466ce63c.**
- All 8 frozen, full-screen original WebGL vs Three ASCII scene captures still **exact=100%, MAE=0, maxDiff=0**.
- Live native source masonry: castle + 3 Gothic ruin buildings, one game GPU context, no author map modification.
- Desktop depth texture **550×370** for **1100×740** game; phone **195×422** for **390×844** viewport (half CSS-resolution). Observed 4 source depth draw calls in CI; not a real-device FPS number.
- Actual depth-test occupancy: **stone=88.46% desktop and 63.37% phone** within the selected castle diagnostic frame; black empty-space pixels present. A pure white/empty fake texture is rejected.
- Frame comparison outside depth-inset: **maxRGBchange=0/255**. After disabling the depth pass and auto-created source geometry, **all screen pixels restored exactly: maxRGBchange=0/255** for BOTH desktop and mobile.
- The first CI failed because the original overlay canvas colors the debug mask and disabling depth left the default 3D inspector active. The corrected QA hides `#c` *only during depth-mask proof* and captures screenshots with CSS-pixel scale. Gameplay canvas and fog remain untouched. Depth activation tracks whether it created the architecture layer; disabling it also disposes that layer while not switching off a manually activated 3D inspector.
- Main `index.html`, `src/data/map.js`, `src/renderer/render.js` **not edited**. PR #37 remains draft; `main` separate and safe.

**Not yet complete:** using the native depth texture for actual per-actor occlusion in the *full* original ASCII image, depth-aware 3D character/rig animation, real hardware speed and GPU memory measurements, original shadows, bushes parting, and NPC ordering. Do not claim these are complete. User explicitly required later shadows/bush/NPC only AFTER architecture, animation and optimization.
