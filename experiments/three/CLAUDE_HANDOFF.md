# Claude handoff — Three.js exploration (2026-10-13)

Repo: aostera/ASCII-Meadow
Branch: experiment/threejs-ascii-prototype
Start: experiments/three/index.html
Engine: pinned Three.js 0.186.1 WebGLRenderer (WebGL2); no WebGPU promises.
Legacy: index.html and src/ unchanged; original authored map loaded directly via src/data/map.js.

Purpose: test dense gothic 3D architecture, correct tree-building depth, better animation pipeline and mobile performance. Do not announce an FPS boost without measurements.

Prototype topology:
- WebGLRenderer renders 3D to WebGLRenderTarget with regular depth testing.
- A full-screen ShaderMaterial converts the 3D texture to fixed monospace glyphs on GPU (no per-frame readPixels).
- Grass uses InstancedBufferGeometry with a vertex shader wind loop.
- Source map coordinates rebase around selected site: worldSceneX=(mapX-anchorX)*0.12 and sceneZ=(mapZ-anchorZ)*0.12.
- Original ruins and yaw, original flora and tents/fences are read but their primitive models are approximations.
- UI allows authored camp, abbey, gate and cloister; synthetic +density is runtime only.
- Outputs median RAF FPS and p95 frame interval, draw calls, geometry count. No hardware GPU execution-time measurement.

Critical missing parts:
- No real 192-frame knight, animation blending, map paint, original grass physics or editor.
- No contact mask around tent, ruins or stone: grass may visibly intersect these objects.
- No exact collision mesh or authored ruin geometry parity.
- Shadow and browser behavior needs physical Safari testing.
- No controlled cross-renderer benchmark yet.

Rules:
1. Main and authored map must not be modified by this experiment.
2. Never call placeholder graphics final parity.
3. Work in a separate branch and keep production behavior intact.
4. Agree on scene object data structure and scene units before modifying world assembly.
5. Develop graphics/rigs separately from map adapter/performance QA to avoid simultaneous edits to experiments/three/app.js.
6. Use explicit staged visual review before merging any graphics PR.
7. Record measured data, browser/device info, reproducible failure screenshots and unresolved issues in the handoff.

First recommended Claude task: design one detailed reusable gothic abbey/ruin glTF asset with accurate void arches, broken stone courses and colliders, expose LOD and shadow-caster geometry; keep the world origin and yaw from the source map. Do not convert the authored map to a new arbitrary scene.


## Update: GPT implemented the initial Claude graphics scope (2026-10-13)
The isolated branch now has `gothic.js` with real arch voids, columns, buttresses, broken courses and batched stone; `knight-rig.js` with hierarchical procedural idle/walk/run/jump and cape inertia; `ground-contacts.js` with read-only map-footprint geometry, grass edge bending and GPU character response. `app.js` imports all three; controls are WASD/Shift/Space. Current models are still **approximations**. Next: detailed glTF models/LOD, exact grass collision, animations matching existing 192-frame knight, cross-engine FPS validation, iPad Safari physical QA. Avoid overwriting working modules or touching main/map.


## 2026-10-13 / Dense forest batching
`forest.js` now generates reusable living/dead/bush geometry variants and uses InstancedMesh instead of drawing each branch and leaf separately. `app.js` preserves map x,z and existing root-contact masks; stress objects remain temporary. CI smoke checks instanced forest meshes and no map changes. Chromium SwiftShader draw calls decreased in the camp smoke scene from ~472 to ~302, but frame time worsened in this software-GPU run, so this is NOT evidence of higher actual FPS. Real Safari/desktop GPU profiling remains mandatory.


## Expanded migration scope as of 2026-10-14
The owner requested GPT to implement the originally planned Claude tasks during Claude usage limits. Additional modules are now implemented:
- `forest.js`: deterministic geometry variants, batched leaf/branch bark per material, `InstancedMesh` for authored trees, dead trees and bushes. Preserves authored map positions.
- `castle.js`: modelled multi-tower main gothic castle / courtyard with open entrance, keep and contact rectangles. Located at the authored `map.castle` or unshifted world origin when null. Model is a placeholder, NOT final original visual parity.
- `knight-ascii.js`: 192-frame read-only legacy knight bridge from `src/data/knight-frames.js`; uses a SINGLE reused GPU canvas texture, keeping the procedural 3D rig as an alternative. The depth-tested camera billboard is not a skinned mesh.
- `index.html` / `style.css` / `app.js`: character mode selector plus a real multitouch D-pad, run and jump; castle location added.
- `tools/check/three-prototype.cjs`: asserts original frame count/animation, mapped gothic castle geometry, contacts and touch control.

The permanent preview link (Cloudflare Workers Builds) is https://experiment-threejs-ascii-prototype-ascii-meadow.aloster36.workers.dev/experiments/three/ . Main `src/data/map.js` and renderer must remain unchanged. DO NOT claim 200 FPS or parity without measurements, nor treat CI Chromium/SwiftShader as iPad Safari verification. When Claude returns, start with glTF art fidelity, dynamic 3D colliders, camera matching original scene, actual cinematic rig cloth and equal-detail GPU profiling.


## GPU profiling added (2026-10-14)
`gpu-timing.js` implements non-blocking optional WebGL2 disjoint timer queries. `app.js` includes GPU p95 in the diagnostic object and on-screen HUD; unavailable extensions report unsupported instead of making up numbers. Reinitialize GPU profiling following context restoration, and never confuse Chromium SwiftShader with actual iPhone/iPad measurements. New `tools/check/three-unit.cjs` verifies GPU async sample, missing extension, context loss/restoration and ground contacts.


## 2026-10-14 — IMPORTANT: original black preview / actual screenshot QA
User viewed branch preview and reported only a few symbols on almost black screen. This was reproduced by inspecting GitHub Actions 3D screenshots. Broken baseline main image pixels (excluding HUD): desktop >=48 intensity only 0.111%; phone 0.014%. Fixes in `app.js`: brighter lit materials/fog; dirt variation texture; more perceptual luminance transfer; final `#include <colorspace_fragment>` in custom ShaderMaterial (Three.js linear→sRGB); CSS-pixel-sized glyph cells corrected for DPR; closer camera. A temporary initialization regression (locally-called texture setup using later `const hash` before initialization) was caught by browser smoke and fixed with a local deterministic hash. For mobile, the controls HUD now collapses by default.
Automated `tools/check/three-visibility.py` now rejects screenshots approximating the broken near-empty output; CI successful 38513859707: desktop >=48 brightness 11.165%, phone 8.799%, plus regular UI/scene checks. **But manual inspection found that ASCII still looks like broad random punctuation/noise, NOT an artistically acceptable gothic silhouette.** Unfiltered 3D scene demonstrates geometry, while full-screen glyph transfer visually obscures it. Next graphics work must separate ground/grass/architecture glyph treatment (object or depth/normal aware, not a single global brightness threshold), improve silhouettes, compare against original ASCII visual reference, and only then ask user to evaluate. Unfiltered scene and ASCII scene screenshots are in Actions run 38513859707 artifacts. Software SwiftShader FPS (3-5) is not actual GPU-performance evidence. Keep PR draft, main unaffected.


## CRITICAL: Migration approach changed to fidelity-first (2026-10-14)

The user correctly rejected the reconstructed low-poly scene: it discarded original art, map paint, animated grass and original occlusion. Do not pursue procedural `app.js` as the replacement game. Old model experiment still exists at `procedural.html`.

**New public default** `experiments/three/index.html` (alias `parity.html`) loads the actual **47 original game scripts** and their exact authored map; it includes an "Оригинал / Three.js" toggle. It always opens with the original rendering. The module `parity.js` swaps only `GL.flush`; `three-glyphs.js` is a real Three.WebGLRenderer rasterizing existing `GB.buf` glyph instances via instanced geometry and original `SPF` sprite UV texture/`GB.atlasCv` glyph atlas. This ensures ALL source animation/environment/gameplay comes from the actual game, not invented 3D geometry. It has a safe fallback to original on Three errors. DO NOT assert actual Three 1:1 parity yet — measure it.

**Quality gates**:
- `tools/check/three-source-sync.cjs` ensures parity pages load all source scripts in the original order.
- `tools/check/three-parity.cjs` uses real Playwright Chromium software WebGL2 and frozen same-game-state screenshots to check original/Three switching, map immutability, and restoration.
- `tools/check/three-pixel-parity.py` measures visible errors and guards against catastrophic blank output. It does not yet declare full pixel equality.
- Previous malformed CSS link was detected in browser smoke and fixed in both parity pages; never rely on syntax only for visual QA.
- Next: resolve differences in GL data uploads, alpha premultiplication, sprite UV orientation, colorspace and blend order, then capture screenshot diffs on original vs Three at same frame, iPhone/iPad Safari real devices.
- Keep PR #37 draft; absolutely no main or map modifications.

See `experiments/three/PARITY_MIGRATION.md`.


## 2026-10-14 — NEW OWNER PRIORITY ORDER (explicit instruction)

The user wants the following **after** the previous migration checklist, not before. **Do not modify the original lighting brightness or transparency/alpha.** First complete: (1) 1:1 original-world renderer/art fidelity without a brightness/alpha creative adjustment; (2) materially improved high-detail real Three.js gothic geometry, still preserving authored composition; (3) faithful character/cow/NPC animations; (4) measured real-device performance. Only **after all four**: correct object/character shadows; implement physical bush branches parting around moving characters like the existing grass spring; fix NPCs incorrectly drawing over everything, ensuring tree/house/ruin/bush depth and occlusion. Avoid changing `main`, `src/data/map.js`, author maps, colors or alpha. Keep PR #37 draft and test in separate preview.

Initial read of existing code, for that later phase:
- `src/world/flora.js::updateFlora`: bush rustling currently measures **only `player`** and pointer; decays exponential, mostly per-leaf noise, no persistent sideways split vectors for nearby NPCs.
- `src/world/flora.js::drawFlora`: animated `rs` mostly jitter/fade; split spring should affect positions of branches/leaves based on entity-to-plant direction, not edit original atlas.
- `src/renderer/render.js`: dynamic `order` is grounded-y sorted and `occlude(e)` / `occludeRuins(e)` restore architecture, but `coverFloraWithArchitecture(f)` is vegetation-specific. Check the NPC `drawEntity(e)` and `geomOf(e)` bounding foot/depth calculations, avoid a blunt global zIndex; labels may be Canvas2D overlays and also need coherent treatment.
- `src/world/shadows.js::castShadow` has contact + directional ground shadows of `ents`; reconcile with true scene depth and authored static shadows without changing overall brightness.
- Any fixes must be scoped to the experiment first and have regression tests for near/far ordering and bushes being displaced by both player and an NPC. Do not implement these secondary tasks prematurely.


## 2026-10-14 — implemented, follow latest branch CI (strict parity + source 3D)
Stage 1: Full-screen original/Three.js same-frame glyph comparison now samples eight authored map scenes across desktop/phone, hides only UI while screenshots are taken, and rejects 1:1 regressions. Temporary camera moves reuse mapToCell and never alter MEADOW_MAP. `parity.js` restores a newly initialized `GL.flush` after Safari/iPadOS context restore rather than using the stale closure. Important: no edits to color, brightness, transparency or alpha.

Stage 2 groundwork (separate from authoritative parity renderer): new `experiments/three/source-masonry.mjs` triangulates actual original castle/ruin raycaster convex primitives from `solid.pl` half-space intersections; it outputs true outward faces, batches by original material kind and can produce Three.BufferGeometry + Mesh. Node unit `tools/check/three-source-masonry.mjs` validates cube and pitched roof topology. Source converter is not yet drawn in the primary preview, so do not call the 3D architecture migration complete; no fake procedural replacements. Next is attaching native source-based geometry in a 3D architectural view with exact original site transform, compare screenshots and keep baseline original glyph mode intact. Deferred tasks: shadows, physical bush splitting for NPC/player, NPC depth ordering per user.


## 2026-10-14 — Stage 1 accepted in CI / native Gothic geometry viewer

On GitHub Actions run 38523623080 / parity job 115719062168: **all eight desktop/mobile scenes pixel-identical** (`exact=100.000000%`, `MAE=0`, maxDelta=0) using one frozen `GB.buf` source snapshot per pair. Places include camp/gate/abbey/cloister/castle; author map unchanged. Earlier false visual diffs were caused by `drawFlora()` mutating its easing during sequential renders, not Three color/alpha. We now freeze both simulation AND draw, call `captureReferenceForTest()` then `captureThreeForTest()` on the exact same glyph batch. Do not modify brightness or alpha.

For Stage 2, an opt-in `?geometry=1` viewer `architecture-viewer.mjs` now connects the original Gothic raycaster primitives to native Three BufferGeometry via `source-masonry.mjs`. It reconstructs source castle and each authored ruin from real `ruinDetail`, `ruinRotateMesh`, with no edits to `main` or authored `MEADOW_MAP`; exposes stats and a smoke test. This is a geometry inspect/debug view only, not yet an accepted 3D ASCII replacement or integrated 3D depth model. Use CI screenshots to validate actual geometry and avoid premature claims.


## Stage 2 real-world integration — 2026-10-14

Added `experiments/three/source-world.mjs`: mathematically maps castle/ruin convex 3D meshes into the game's exact author-space using `cathedral.kx/ky`, `cathedral.ox/oy`, `MS, WS, PITCH`, and real `ruinSites()` yaw. Rendering uses a right-handed Three camera with horizontal source-axis mirroring to preserve the original raycast's screen X, and an orthographic camera matching the source oblique projection and viewport. Pure pixel transform equations and source immutability covered by `tools/check/three-world-projection.mjs`.

The existing `architecture-viewer.mjs` supports the `world` choice (all 4 original castle/ruin structures in place) and original camera synchronization toggle; direct URL `/experiments/three/?geometry=world`. New screenshots/tests in `tools/check/three-architecture.cjs`, and `main` still untouched. This is a distinct geometry QA renderer for source-based meshes, not yet the fully live hybrid renderer. Do not change brightness/alpha or implement shadow/bush/NPC fixes before fidelity, architecture, rigs, and performance are completed.


## 2026-10-14 — Stage 2 first LIVE GPU integration (opt-in, zero 1:1 drift)
New `experiments/three/live-architecture.js` uses the **existing** `ThreeGlyphBackend.renderer` and `source-world.mjs` to build real native Gothic meshes (author castle + 3 ruins), render them with depth in a clipped camera-aligned diagnostic inset, and restore viewport/scissor/clear state after every pass. This happens on actual game frames, tracking the real `camX/camY/W/H/VZ/worldGen`, not a paused separate viewer. Lazy creation only after explicit click `3D архитектура`; clicking again disposes original source mesh geometry/materials. Crucially 1:1 full-screen glyphs are ALWAYS drawn first untouched: stage 2D parities must stay 8/8 pixel exact with feature OFF. No brightness, transparency, gamma or author map changes. No second WebGL context created.

Browser test `tools/check/three-live-architecture.cjs` validates desktop + mobile 4 source sites, >1000 source solids, original game camera, zero new canvas contexts, map immutability and live toggle cleanup. This is **an integrated on-screen diagnostic of real geometry**; it is not yet the *final* depth-composited world (hard task next: design true native depth/ASCII entity occlusion without overwriting original glyph painter order, retain real-game FPS). Do not claim gameplay 3D migration done. Deferred shadows/bushes/NPC tasks remain after animation and performance per user's order.


## 2026-10-14 — Stage 2.5: real GPU Gothic depth attachment (opt-in)

Added `experiments/three/architecture-depth.js` and the `Глубина 3D` button on both full original-world preview pages. The live source world of the real castle + all 3 ruins is rendered into `WebGLRenderTarget.depthTexture` at half resolution, using the **same** `ThreeGlyphBackend.renderer` and exact original `configureNativeCamera`. A small black/white diagnostic inset maps occupied stone vs empty background from the **actual hardware depth buffer**. This does not replace or recolor original ASCII glyphs, and the default always remains pixel-perfect. The depth texture is retained as the real input for later actor/world occlusion; this step does NOT yet apply depth to NPCs/player glyphs because doing so prematurely causes unacceptable ordering regressions.

Switching back to original or disabling the mode disposes the texture, shaders and meshes and restores original WebGL fallback. Safari/iPadOS restore and true FPS improvement still require real-device tests. Automated `tools/check/three-depth.cjs` captures a frozen authored castle with and without native depth (desktop + phone); `three-depth-visibility.py` proves the mask contains stone + empty space and **every pixel outside the diagnostic inset is exactly unchanged**. The preceding 8/8 100%-identical scene proof must remain green. No brightness or transparency edits. Deferred shadows, bushes, NPC sorting only after 3D, animations and performance.


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
