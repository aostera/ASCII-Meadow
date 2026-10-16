# ASCII Meadow — Three.js experiment

Status: **isolated renderer experiment**. This is not a playable port or a replacement for the current game.

## Run
From repository root: python3 -m http.server 8080

Open http://localhost:8080/experiments/three/

Needs internet for pinned Three.js 0.186.1 module CDN. Existing src/data/map.js is imported **read-only**. The current main game and its editor are unchanged.

## Implemented
- Scene placement of real authored flora, tents, fences, and the three ruins at their exact map x, z, yaw.
- Four locations: camp, cloister, abbey, gate. Local origin rebased but source coordinates preserved.
- Orthographic 3D camera and orbit/pinch controls.
- Real depth-buffered occlusion of scene geometry, dynamically lit material and shadows.
- Instanced GPU grass (wind vertex shader) and two-pass GPU-only glyph-atlas ASCII effect.
- Switch for ASCII versus unfiltered 3D, wind, shadows, grass quality, and runtime synthetic density.
- Stats: frame-interval median FPS and p95, CPU submit time (NOT measured GPU execution), draw calls, triangles, instance counts.

## Not implemented or verified
- These primitive 3D ruin/tent/knight models are **visual stand-ins**. They are not parity with authored architectural meshes or the real knight frames.
- Ground-contact grass masks, actor interaction, real character animation and physics, terrain paint, roads, fires, marsh, fog brushes, cows, NPCs, interaction logic and editor are not ported.
- Current GPU grass does not move when brushed by the knight and may intersect opaque structures. **This is a known issue**, not a visual fix.
- On-device Safari context recovery and a fair equivalent-density cross-engine FPS test are not yet verified.
- Moving the +density checkbox adds unsaved synthetic structures only; it never changes the map.
- Only the original 2D game is deployable gameplay. Do not merge this as a game replacement.

## Acceptance criteria for eventual migration
1. Preserve src/data/map.js byte-for-byte and editing semantics. No regeneration.
2. Match the original scene's placement and equivalent visual fidelity before FPS comparisons.
3. Ground-contact/occlusion verified for ruins, castles, trees, tents, fences, player and grass at different camera angles.
4. Real knight motion and its cloth/secondary animation, not an anonymous 3D placeholder.
5. Physical Safari/iPadOS and iPhone checks alongside desktop, plus profiling.
6. Preserve native Canvas2D fallback on the production site until any replacement supports the same device class.

## Recommended next split
- Claude: model/asset pipeline (glTF gothic architecture, animation and rigs) on a child branch.
- GPT: scene adapter, grass contact / depth integration, performance regression and Safari QA.
- Split experiments/three/app.js into small modules before simultaneous editing, to avoid conflicts.


## Expanded graphical experiment, 2026-10-13
- `gothic.js`: batched detailed solid masonry, pointed **open** arches, buttresses and ruins. Not final glTF fidelity.
- `knight-rig.js`: animated procedural gothic knight (WASD, Shift, Space), separate arm/leg joints and damped cape. Not original authored knight frames.
- `ground-contacts.js`: deterministic geometry footprints, skip planted GPU blades under solid stone and tents; bend near posts; character pushes GPU grass. Approximate, not finished gameplay physics.
- Browser smoke checks model mesh counts, idle/walk/run, contacts and read-only map.
- Pending: exact asset conversion/LOD, game/editor parity, on-device Safari QA and fair performance comparisons.


## Live preview and latest progress (2026-10-14)

**Live branch preview:** https://experiment-threejs-ascii-prototype-ascii-meadow.aloster36.workers.dev/experiments/three/

The main game at https://ascii-meadow.aloster36.workers.dev/ remains unchanged. Preview uses Cloudflare Workers Builds on the experimental branch, not the main deployment.

- `castle.js`: batched gothic main castle with towers, real open gate, walls, inner courtyard, keep, buttresses and shadow geometry. **Visual prototype, NOT the authored castle model.**
- `knight-ascii.js`: direct read-only 192-frame bridge to `src/data/knight-frames.js`. One reused `CanvasTexture`, updated only when original-sprite mode is shown. Choose `Рыцарь → 192 кадра оригинала` to compare with the procedural rig; sprites use 3D depth but may need aliasing/fidelity work.
- `index.html` has touch D-pad and run/jump controls on mobile; keyboard WASD, Shift, Space on PC. Both modes move from one common player position, and map.js is not modified.
- `ground-contacts.js` prevents basic solid footprint penetration in 3D experiment, but does not represent original gameplay collision logic. True collision and mobile Safari verification are still required.
- `tools/check/three-prototype.cjs` checks authored scenes, real castle meshes and foundations, original-frame registration, toggled animation and control states. These are automated smoke tests, not user acceptance of visual quality.

The link is for testing and may briefly show the previous build while Cloudflare updates branch previews. No GPU FPS improvement has been established.


## Real GPU timing, when supported
`gpu-timing.js` records asynchronous WebGL2 `EXT_disjoint_timer_query_webgl2` elapsed GPU milliseconds for the entire scene plus ASCII postprocessing. The HUD shows a GPU p95 (or unsupported), next to actual requestAnimationFrame interval and CPU submit duration. This is not a prediction of mobile FPS and requires equal-scene benchmarking. The timer never calls blocking GPU readback; it also drops pending queries after context loss. `tools/check/three-unit.cjs` validates timer lifecycle and oriented grass masks without Chromium.

## Side-by-side performance QA on actual hardware (2026-10-14)

Use [the opt-in original / Three A/B comparison](https://experiment-threejs-ascii-prototype-ascii-meadow.aloster36.workers.dev/experiments/three/?profile=compare) on the same device. Four sequential 5-second samples run **Original → Three → Three → Original** (plus warm-up per segment), restore the initial renderer on completion or Close, and show both measured FPS and frame p95. Press **Скопировать JSON** to share the result. This runs the actual unchanged source game on both renderers; no brightness, alpha or world-data substitutions. Results are display-vsync capped and affected by scene movement and thermals; for a meaningful performance decision, compare several runs on the same physical device. CI SwiftShader is a functional smoke test, not a real-world speed benchmark.

## Tripo V2 — interactive skeleton / motion workshop (2026-10-16)

- Route: `experiments/three/ashen-tripo-animation-workshop.html` (works when this feature branch is deployed; does not affect main).
- Loads the **existing** 10.7 MB skinned Tripo V2 GLB, not a procedural silhouette or a new generation.
- Uses the **same** `createGltfKnight()` / `ashen-tripo-native-rig.mjs` runtime as `native-tripo-v2.mjs`. No separate rig logic, credit spend, or glTF animation-clips claim.
- Inspect Idle / Walk / Run / Jump, eight quick compass presets, **any 0–359° angle** with a one-degree slider, and the **Авто 360°** 8-second rotation for multi-angle anatomy inspection; pause, one 1/60 s pose step, 0.5–1.5x playback, skeleton, wireframe and camera angles. Detached Gothic sword follows the right wrist joint.
- Animation is evaluated at fixed 60 Hz for deterministic inspection; **display FPS depends on the device**. This is a pose preview and cannot establish physically correct foot contact, cloth simulation or final visual fidelity until watched and accepted in browser/on mobile.
- The original V2 viewer remains a static skeleton/geometry inspection. The authored source map and original production knight remain unchanged.
- Bone-axis bug fix: reconstruct each animation axis in **original model anatomical space** before converting to the Tripo bone's local rest frame. This prevents the parent's fixed +X to +Z turn from changing knee flex into a sideways rotation; pose state version `Tripo-IK-v3-model-space-axes`.
- Idle fixes: both feet are flagged planted when still. The reported foot-contact states are **procedural estimates** and must not be presented as a verified ground-contact physics system.
- The workshop previews vertical jump height on its own root/group and softens a fake contact shadow; this does **not** change in-game jump physics or source map.
- Automatic test: `node tools/check/ashen-tripo-animation-workshop.cjs http://127.0.0.1:8181` (serve repo root on port 8181 first). Tests actual GLB loading, 4 motion modes, 8 headings, jump lift, manual frame step, wrist sword, and skeleton/wireframe on desktop and mobile Playwright/SwiftShader. The existing `ashen-tripo-motion-sword.cjs` also asserts pose version v3 in the native game.
- Browser/CI smoke tests and SwiftShader screenshots are **not a substitute for artist visual approval** or physical iPhone/iPad Safari QA. The production game and world map must remain untouched.

### The Ashen Vow workshop color study (reversible, NOT final art)

The workshop has an opt-in/out **Gothic palette · эксперимент** control. The studio loads the existing Tripo 40-bone skinned mesh and applies only a reversible vertex-color tint: darkened steel, worn bone mask, grey linen tabard, subdued burgundy hood/back fabric. Original GLB geometry, UVs, maps, bones and inverse bind matrices are untouched. An original-material toggle restores the same mesh without reloading or another Tripo request. This is an approximate location/skin-weight-based art experiment; the owner reference is **not yet reproduced** (see `ASHEN_VOW_REFERENCE_LOCK.md`). There are no newly authored heraldic markings, textures or detail sculpts.

The `+1 кадр` control advances the fixed 1/60-second skin pose synchronously even if a slow software GPU skips or delays the next display refresh. The browser may still **render** fewer frames per second than the pose evaluator. The new Playwright regression verifies paused → one step deterministically, 0–359° compass, both materials, real skin mesh and separate weapon. Actual in-game player/editor/map and source GLB are never modified.

### Character secondary motion refinement (2026-10-16)

The existing three cape-chain bones now receive a damped, capped follow-through from actual player heading changes and locomotion speed; no additional geometry, unpaid physics solver, or art assets are generated. `capeDeflection` is exposed in the existing pose diagnostics for automatic finite/bounded regression tests. This is **subtle bone sway, not simulated cloth**, and cannot establish believable fabric behavior without inspecting in-game silhouettes and receiving visual approval.

### Right-hand sword and shoulder/elbow correction (2026-10-16)

The previous Tripo rig's source T-pose shoulders were only lowered about 0.69 rad and arm swing was incorrectly applied around Z even though arms rest along ±Z: hands stuck far from the ribcage and the sword cut across the tabard. The v4 controller bends shoulder downward about source X (**0.98 rad** after visual review; 1.28 folded the gloves onto the belt), swings in the anatomical forward plane around model Y, and bends the elbows gently on model Y. The weapon remains parented to *the original right wrist bone 19*, but its local orientation is counter-rotated each animation tick to keep the blade pointed down at the character's right side. Rest geometries/40 skin joints are unchanged.

The Playwright studio regression measures **actual shoulder-to-wrist world-space vectors** (not state labels) and the blade tip relative to its pommel, and captures front/side animated screenshots. This is a correction pending screenshot-level review, NOT an assertion of approved shoulder armour deformation or authentic weapon gripping.

The `tools/check/ashen-tripo-arm-review.cjs` fast visual test is now included in the isolated `.github/workflows/ashen-arm-quick-review.yml`. It captures actual front idle/walk, side run and front jump from the same authentic Tripo GLB. The first screenshot review rejected the overcorrected 1.28-radian shoulder angle; the accepted-for-further-inspection 0.98-radian iteration leaves hands beside the thighs and the longsword outside the right leg. Fingers remain visibly open because this rig lacks separate finger bones; sword grasp is **not final approved**.

### Authentic hand-surface grip anchor (2026-10-16)

The wrist-held sword used to sit at the origin of Tripo joint 19, regardless of where the actual palm mesh lay; the gauntlet visibly hovered away from the hilt. On load the v5/v6 rig now samples **real skinned vertices with ≥52% right-wrist weight** in the existing GLB, transforms them to the original wrist's local rest coordinates and computes a weighted palm-area hilt anchor (285 qualifying glove vertices in browser QA). It falls back to joint origin for malformed/no-weight assets, never substitutes new finger geometry. The same separate longsword still follows the true wrist, with world counter-rotation to keep the blade down. **This improves alignment, but does not close fingers:** the 40-bone Tripo export has no usable separate finger curl chain; credible clenching needs artist rig/mesh work.

The v6 authored animation continues walk/run phase across transitions and adds restrained elbow flex while running, with small balancing arm motion in the jump. This requires visual acceptance, not just pose data. The quick Playwright test exercises **4 movement states × 8 headings × at least 60 skeleton steps** and checks conservative right-hip/ground/vertical-blade clearance, rather than pretending to do exact per-triangle collision. Art and real-world device performance remain under review. Native game source world/map and main stay untouched.

### 2026-10-16 — Correcting backwards-bending knees in Run (v7, under visual QA)

Earlier authored `legPose` solved its two-bone sagittal IK with `hip=theta-alpha`, `knee=+bend`. Because source Tripo anatomical forward is **+X**, that chooses the mirrored/backwards knee solution. The sprint additionally requested a very long forward step and large swing-foot lift, folding the knee far beyond comfortable motion. v7 chooses the other anatomical knee branch (`hip=theta+alpha`, `shin=-bend`), limits knee flexion through a minimum reachable hip-to-ankle distance, and reduces running step/lift. **This is still a hand-authored, approximate gait**: foot contacts are inferred from phase and are NOT locked to the ground; it is not a foot-plant IK/animation capture solution. Test thresholds verify bounded joint motion, but front/side/back frame review is still required before production approval. No edits to `main`/authored game map.
