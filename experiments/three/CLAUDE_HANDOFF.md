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


## 2026-10-14 — Stage 3, live original art animation proof
New QA API in experimental parity.js retains referenceSimulate() from the unchanged real game and exposes stepAnimatedReferenceForTest(dt, action) behind parityTest=1. CI freezes the ordinary RAF, explicitly advances the original game (grass, true 192-frame knight sprite jumping, cow grazing, NPC/world update), renders one original prepared glyph batch, and uses captureThreeForTest() to render that exact same source frame without another animation tick. tools/check/three-motion-parity.cjs captures 5 original/Three screenshot pairs each on desktop and phone. tools/check/three-motion-pixels.py rejects even 1 pixel difference and tests nonstatic actual images. Outputs in shots/three-motion/ are uploaded. This proves native Three.js carries the ORIGINAL 2D sprite animation without loss, NOT that its standalone procedural 3D rig has achieved equivalent skeletal animation. Main, color, original brightness and transparency are untouched. After QA, continue native source depth/geometry and opt-in motion integration, and compare performance on real hardware; bush, shadows and NPC layering remain deferred by user order.


## 2026-10-14 — Stage 4, glyph culling and performance evidence
The native ThreeGlyphBackend now conservatively clips only glyph rectangles wholly outside the original active camera plus 4 CSS px safety margin; the original GB.buf, painted sprite order/UV, author brightness and alpha are never changed. See experiments/three/glyph-visibility.mjs and tools/check/three-glyph-visibility.mjs. The source-count API stats.glyphs is preserved, while stats.visibleGlyphs, culledGlyphs, uploadCpuMs, renderCpuMs are added. Behind ?parityTest=1 only, setGlyphCullingForTest(enabled) toggles the filter. tools/check/three-performance.cjs compares 9 prepared render repetitions for culling off/on, requires identical entire PNG bytes, outputs CPU median/p95 and per-frame GPU instance reductions to shots/three-performance (in CI artifact). Software Chromium SwiftShader timings are NOT physical iPhone/iPad desktop GPU speeds or evidence for 200+ FPS. Do not claim a performance win without hardware measurement. Keep PR #37 draft, main/MEADOW_MAP/lighting/alpha untouched.


## 2026-10-14 — Stage 3B, native 3D skeletal knight controlled by REAL player (opt-in)
The new source-motion.mjs mathematically maps the actual player’s grounded foot x*CW / (y+.7)*CH to the native camera and exact source sprite height, and maps all 8 d8 facings and original run/walk/jump state. The native rig reuses the existing hierarchy in knight-rig.js (leg, arms, cape springs and air arc). The live-architecture.js diagnostic scene creates the rig only when the tester selects the 3D риг button and drives it directly from the original player snapshot and game clock, in the SAME WebGL context as the source castle and ruins. The original 192-frame ASCII knight remains visible, unchanged and authoritative in the main game. This is mechanical 3D rig exploration, not an approved 1:1 visual replacement. Disabling rig or returning to Original disposes its GPU geometry and materials.

New tests: tools/check/three-source-motion.mjs unit-checks source foot projection, 8 directions, jump edges and immutable source data; tools/check/three-live-knight.cjs drives source walk + jump on desktop and phone, checks original map, single canvas and cleanup. tools/check/three-live-knight-pixels.py requires exact source pixels outside the diagnostic inset. Art fidelity review, native cow rigs, true GPU measurements and eventual 3D actor occlusion are still unfinished. User order: do not work on shadows, bushes or NPC depth until first migration/animation/perf stages are complete.


## 2026-10-14 — Stage 3C: native source-driven cow, opt-in; never a visual replacement

Added `source-cow-motion.mjs`: reads the actual game's cow state and authored position/d8/at/gp, with precise source walk/run, hop phase (.18–.66), grazing-down (.9s)/loop/up (.75s), and no edits to entities, map, cow frames, gamma or alpha. Added `cow-rig.js` with a controlled mechanical 3D anatomical hierarchy (legs, hooves, movable grazing neck/head, ears, tail), deliberately isolated to the 3D inset and sharing the same Three WebGLRenderer. In `live-architecture.js`, optional `setCowRig`, `updateCowFromSource`, nearest source cow focus, mesh disposal; `parity.js` exposes the separate `3D корова` toggle and original herd snapshot. It is exclusive with the native knight preview for camera framing; the original ASCII cow continues to be rendered normally.

This is STILL a *diagnostic rig*, not the final cow asset or 1:1 3D character mesh. No source 2D animations are replaced. `tools/check/three-source-cow-motion.mjs` verifies state mapping and immutability. `tools/check/three-live-cow.cjs` drives source walk/run/hop/graze in desktop and mobile and verifies all events reach the native rig; `tools/check/three-live-cow-pixels.py` asserts the full original game image outside inset stays byte-identical. CI screenshots in `shots/three-cow`. Main remains untouched; original brightness and transparency are NEVER adjusted. Pending: CI acceptance, user art review, native 3D NPC assets, actual iPad Safari GPU/RAF numbers; afterward shadows/bushes/NPC depth ordering as requested.


## 2026-10-14 — native performance measurement available on user's own hardware

Open the EXPERIMENTAL preview with `/experiments/three/?profile=1` (no production/main changes). This opt-in view automatically switches to the Three glyph renderer and starts `device-profiler.mjs` for ~10 seconds. Overlay provides actual display-RAF observed FPS (vsync-capped 60/120/144Hz), frame p50/p95/p99/max, frame stalls over 50ms, Three source glyphs/visible glyphs, per-frame CPU upload/renderer submission p95, optional JS heap (if browser exposes it), UA/viewport/DPR, tab-background interruptions, and a **Copy JSON** button; Repeat/Close stop RAF correctly. It is completely absent from the ordinary game, so there is NO art/brightness/alpha change. The data is gathered when user opens page on actual iPhone/iPad/desktop, not from GitHub. Do not claim GPU hardware milliseconds or uncapped 200+ display FPS: requestAnimationFrame measures display pacing, and WebGL renderer.render() returns CPU submission time. Browser smoke at `?profile=1&profileTest=1` uses a shorter sample solely to verify the UI; SwiftShader tests are not hardware measurements. Source QA already includes static 8/8, animated 10/10, live 3D knight and native 3D cow opt-in image isolation. Pending real hardware p95 results and visual 1:1 acceptance for actual 3D model geometry.

## 2026-10-14 — Stage 4B, fair original ↔ Three real-device comparison (opt-in)

Use **/experiments/three/?profile=compare** on a *physical* iPhone/iPad or desktop. New `engine-comparison.mjs` runs two baseline-original and two Three periods in ABBA order, with per-period foreground RAF sampling, a separate initial warm-up, inactive-tab exclusion, cleanup, automatic restoration of the user's original engine mode, and a **Copy JSON** report. It records original and native Three observed display FPS and p50/p95/p99 timing, Three CPU upload/draw submission, glyph counts, and a map-unchanged check; it **does not** pretend these are uncapped GPU FPS or a visual-art acceptance. URL `?profile=compare&profileTest=1` is for short software Chromium CI only.

`tools/check/three-engine-comparison.mjs` checks pure math/report aggregation; `tools/check/three-engine-comparison.cjs` checks desktop/phone RAF captures, all four mode legs, pixel-source glyph availability, restoration to original, immutable authored map and detached overlay; both are in `three-parity` CI. Genuine physical device readings require the user to open the page and copy JSON; headless CI timings must never be used to claim 200+ FPS or hardware wins. The original gameplay build `main`, map, sprites, brightness, transparency and artist shadows are untouched. Depth-aware NPC occlusion and moving bushes remain deferred until source-native 3D art + full migration and hardware acceptance are verified.


## 2026-10-14 — отдельный игровой Three runtime (не лаборатория сравнения)

Требование автора: **не просить оценивать промежуточные сравнения; сначала закончить перенос, затем единая финальная визуальная приёмка.** Основная игра `main` не редактировалась, PR #37 остаётся draft.

Новая страница `/experiments/three/native.html` загружает все исходные игровые скрипты, карту, редактор, существующие анимации, 2D-эффекты и логику, но **вместо старого `src/renderer/webgl.js`** подставляет отдельный экспериментальный `native-gl.js`. `native.js` создаёт один полноэкранный `ThreeGlyphBackend` (один WebGL2 контекст), а скрытый `#g` остаётся только Canvas2D fallback. Нет UI переключения или тестовых мини-окон. Старая карта и авторские яркость/прозрачность не изменяются. При ошибке нового GPU контекста движок возвращает Canvas2D; Safari context restore получает обновление текстур и отображения.

Три слоя настоящего авторского замка теперь воспроизводятся в исходном порядке: нормальный камень, аддитивная вспышка молнии (отдельный материал/меш с GL ONE, ONE) и glyph world. Старый эксперимент смешивал вспышку как стандартную альфу. Новый тест `three-parity.cjs` снимает отдельные castle-flash референс/Three пары desktop+phone и пропускает через жёсткое попиксельное сравнение. Новый `three-native-game.cjs` проверяет игровую страницу, отсутствие второго GPU, неизменность `MEADOW_MAP`, доступность реального глиф-мира на телефоне/desktop, управление и Canvas2D fallback.

**Не утверждать полное завершение миграции:** native-страница пока использует исходную CPU ASCII-симуляцию/систему рисования для точного 1:1 и аппаратное Three преобразование glyphs, но НЕ закончена полная 3D-геометрия травы/животных/NPC, интеграция native depth в окончательную картинку, исправление NPC layering/кустов, финальная shadow-pass и реальное тестирование Safari/нагрузки. Пока все они не выполнены, не подавать страницу как окончательный результат автору и не переключать production. CI статус нужно проверять отдельно.

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
