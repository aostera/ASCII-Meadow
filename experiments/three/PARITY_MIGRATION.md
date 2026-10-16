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


## 2026-10-14 — safe offscreen native glyph optimization
No author visual changes. Opt-in testing uses one frozen original buffer for a pair of exact screenshot outputs, with and without conservative GPU glyph culling. Under parityTest=1, QA API setGlyphCullingForTest toggles the algorithm. Normal Three rendering defaults to culling. The pure layout packer preserves paint ordering and all vertex UV/alpha IDs; original input is not mutated. Test CPU upload/render median and p95 on SwiftShader with tools/check/three-performance.cjs. Validate with all prior static 8/8 and animated 10/10 pixel-parity tests. Real mobile-device GPU performance and Safari memory checks remain pending.


## 2026-10-14 — opt-in original-driven 3D knight
The experimental full-world page now offers 3D риг. It connects the original player x/y, eight d8 facings and walking, running, jumping to the real source knight 3D hierarchy, visible only within the existing diagnostic inset. No source 192-frame sprite is replaced, source colors and transparency do not change. The existing real Gothic depth and actor geometry share the original Three WebGLRenderer; no new GPU contexts. Automated QA tests preserve the authored map and every glyph outside the designated 3D inset. This 3D model is still a mechanical test; fine-grain character mesh visual parity and 3D cow/NPC assets require further work.


## 2026-10-14 — true native 3D cow movement diagnostic

Optional `3D корова` in the experiment loads one source-driven articulated 3D cow in the existing shared Three renderer and focuses the diagnostic inset on its real position. The source herd, silhouettes, grazing atlas and editor never change. Native head-lowering follows real down/loop/up phases and hop/walk/run follow real simulation states. This is NOT a complete replacement or visually accepted 1:1 3D cow; preserve original art until user approval. The mode cleans GPU geometry and materials on disable and returns the original view untouched. CI tests desktop/mobile original sprite isolation and original herd state transitions.


## 2026-10-14 — original-preserving real-device performance probe
Use `/experiments/three/?profile=1` on the physical mobile/desktop device. The profiler is opt-in only and does not create another GPU context or touch the author scene's brightness, alpha or artwork. Ten-second recording measures user-observed vsync-limited RAF FPS, p95 frame pacing, long frame stalls, and CPU-side Three glyph upload/draw calls. Tap Copy JSON and provide results for hardware-specific optimizations. A physical screen running at 60/120Hz will cap observed RAF at 60/120 fps; 200+ real displayed frames requires higher-refresh hardware. Test mode `?profile=1&profileTest=1` is CI-only and runs for under one second.

## 2026-10-14 — Stage 4B, fair original ↔ Three real-device comparison (opt-in)

Use **/experiments/three/?profile=compare** on a *physical* iPhone/iPad or desktop. New `engine-comparison.mjs` runs two baseline-original and two Three periods in ABBA order, with per-period foreground RAF sampling, a separate initial warm-up, inactive-tab exclusion, cleanup, automatic restoration of the user's original engine mode, and a **Copy JSON** report. It records original and native Three observed display FPS and p50/p95/p99 timing, Three CPU upload/draw submission, glyph counts, and a map-unchanged check; it **does not** pretend these are uncapped GPU FPS or a visual-art acceptance. URL `?profile=compare&profileTest=1` is for short software Chromium CI only.

`tools/check/three-engine-comparison.mjs` checks pure math/report aggregation; `tools/check/three-engine-comparison.cjs` checks desktop/phone RAF captures, all four mode legs, pixel-source glyph availability, restoration to original, immutable authored map and detached overlay; both are in `three-parity` CI. Genuine physical device readings require the user to open the page and copy JSON; headless CI timings must never be used to claim 200+ FPS or hardware wins. The original gameplay build `main`, map, sprites, brightness, transparency and artist shadows are untouched. Depth-aware NPC occlusion and moving bushes remain deferred until source-native 3D art + full migration and hardware acceptance are verified.

## 2026-10-14 — Native physical bushes and NPC world-depth, accepted in CI

The author requested **no intermediate side-by-side visual review**; finish the full Three migration on the isolated experimental branch first. Do NOT merge or touch production `main` or modify authored `MEADOW_MAP`, global brightness, alpha or knight/cow source frames.

Native game only (`/experiments/three/native.html`):
- `native-bushes.js` wraps source `updateFlora/drawFlora` without touching original source files. Player, catalog NPCs and cows trigger actual left/right brush displacement of source leaves and clipped dark backing; damped spring restores plant when they leave. Source leaf IDs, y, tone and alpha unchanged. Ordinary remote bushes still call the source draw fast path. No edits to world coordinates, color, fog, original assets.
- `native-npcs.js` addresses the always-front layering defect: source `drawEntity` previously rasterized NPC *body* glyphs on global overlay #c, bypassing the ordered Three glyph painter. Native mode now reconstructs the original atlas-frame/pose, per-cell luminance, original tint/shade font glyphs into an extension of the existing shared GPU atlas and emits NPC backing and body glyphs into `GB` in world Y/painter order. GPU atlas extends AFTER source `bakeFloraSprites`, with normalized UVs rebuilt; original sprites remain unmodified. Name/dialogue UI continues to render on #c. Current registered types villager/hermit have GPU palettes. Fallback for future unregistered tint types is still the source drawer and needs generalization before full acceptance.
- `tools/check/three-native-bush.cjs` tests physical opening/restoration on real source bush, 600+ original leaves and **zero differences in leaf glyph ID, Y and alpha** on desktop/phone.
- `tools/check/three-native-npcs.cjs` checks two registered tint palettes, actual source villager drawing **476 body glyphs into GPU**, only one 2D UI text call instead of always-front NPC body, GPU IDs valid, same painter as flora, map unchanged on desktop/phone.
- `tools/check/three-native-game.cjs` still passes single WebGL context, unchanged source map, user input and functional Canvas2D fallback.
- CI run `38578424190`, job `115901568487`, head `ae94d38c`: native game desktop/phone PASS; physical bush desktop/phone PASS; native NPC depth desktop/phone PASS; parity 10/10 source/Three static images 100% exact (includes lightning) plus prior animation/source-rig/depth tests. CI software GPU timing is not real hardware FPS. Only source-parity lab frames are guaranteed pixel exact; new native-world bush displacement and NPC compositing necessarily change the picture intentionally.
- Keep actual Safari/iPad hardware acceptance, full source geometry depth compositing, shadows, 3D character art fidelity and memory/performance work open. Do not call full Three migration complete. Preserve independent draft PR #37 and main production.



## 2026-10-14 — Native main-frame architectural Z compositing (follow-on)

The author requested complete Three migration before reviewing side-by-side comparisons. Keep `main` intact and PR #37 draft. Changes exist **only** under `experiments/three` and checking tools; no original brightness, alpha, map, or sprite images changed.

`native-architecture-depth.mjs` creates THREE.MeshDepthMaterial and a half-resolution real WebGL2 DepthTexture from the **actual castle + three ruin source solids** (`createNativeSourceWorld`), in the **same** Three.WebGLRenderer as full-world glyphs; no preview inset, no second GPU context, no grey 3D replacement of authored pixel masonry. It allocates lazily and renders only when an actor's projected screen silhouette approaches a stone building, rebuilding source meshes on `worldGen` changes. Renderer target/viewport/scissor/clear state is restored. It disposes on fallback or context loss. A failed depth prepass falls back to the original glyph painter rather than blanking gameplay.

The normal native `render()` now resets `GB.nativeActorRanges` at frame start. `native-npcs.js` tags each NPC original GPU silhouette glyph span, and now also tags the original knight and cow GB glyph batches, without changing authored character frames. `native.js` computes their physical source camera Z from `toModelXZ` and sends foot depth/footY to Three. `glyph-visibility.mjs` conservatively carries exact actor metadata alongside unchanged glyph IDs, color and alpha through viewport culling. `three-glyphs.js` uses shader depth texture and actor-specific per-pixel height correction to discard only actor fragments that are behind nearer 3D masonry. ALL normal terrain, grass, tree, stone pixels and name/dialogue overlays render as before. The stand-alone parity laboratory still has depth uniforms disabled and must remain pixel-exact 1:1.

`tools/check/three-native-depth.cjs` validates desktop and mobile the actual *GPU* clipping in the normal native game after disabling source CPU masonry re-overlay in a test fixture, with no map mutation or new contexts, then restores the old functions. A test-only `?nativeDepthTest=1` gate toggles the depth-mask for proofs; the player is never shown a compare UI. The 3D-prepass test runs in the `three-parity` CI job along with static parity and earlier native bushes/NPC. Source actor Z is ortho near/far 0.01/40000 and projective world north direction, including apparent sprite vertical height: active only when native depth texture is available. Native depth terrain/tree/camp 3D geometry and full lighting remain later migration tasks.

**CI status must be checked for the current head** `ac4f2378` (and successive documentation commits): do NOT claim tests passed or full migration completed until results are verified. Previous last fully green CI head `35b4f626`. Shader validation on real mobile Safari is still pending and software SwiftShader browser timings MUST NOT be called actual device FPS. Preserve original release and avoid asking the user to review incomplete intermediate work.


## 2026-10-16 — Shadow-layer order and environment migration register

The current authoritative environment stage-by-stage ledger is
[ENVIRONMENT_MIGRATION_LOG.md](ENVIRONMENT_MIGRATION_LOG.md): PRs #46–#49,
map preservation, exact browser QA evidence, known phone thicket occlusion,
and outstanding real-device art/performance acceptance. `main` remains isolated.

Native architectural penumbra refinement now runs immediately after
`buildWorld()`, **before** flora shades are painted or the editor freezes
`bshadeCastle`. The source castle/ruin raycast is still authoritative;
this changes only where the native-only edge filter is applied. Individual
cell adjustments are capped at 0.16 of the 0–0.7 ambient shadow scale so
large bands cannot swallow genuine Gothic arch openings. The source map,
source sprites, other game routes and artist color/alpha are not edited.

Regressions: `tools/check/three-native-shadow-layer.cjs` and
`.github/workflows/three-shadow-layer-qa.yml` compare raw 3D raycasts with
native feathering, untouched bright and dark interiors, architecture/foliage
layer ordering, editor shadow snapshot parity, exported map and single WebGL
context on desktop and phone simulation. **Visual review on real Android/iOS
and removing all remaining rectangular shadows are still pending.**
