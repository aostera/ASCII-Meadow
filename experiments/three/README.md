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

### 2026-10-16 — Human gait calibration pass (v8, screenshot approval pending)

A direct 40-bone Tripo browser inspection found both legs have naturally bent rest joints: left hip→knee→ankle corresponds to source-bone offsets ~0.209/0.169 and a forward-pointing knee, not a straight aligned limb. Simply adding absolute IK rotations double-deformed the knee. The updated solver measures **each leg's own rest hip and shin angle** and real bone lengths, then applies only differences from rest. Idle now restores source bone quaternions exactly. Walking versus running use different timing: walking includes double-support, running includes a short aerial interval; a 2-step gait cycle is ~0.9Hz walk versus ~1.8Hz sprint, instead of the earlier excessive cadence. New heel-strike, toe-off, knee flex limits, slightly lowered support pelvis and modest vertical recoil seek a more human rhythm.

**Remaining blockers before saying 'real-human movement':** the stationary workshop still previews a treadmill cycle; in actual movement a planted foot needs world-space locking to avoid sliding; lateral weight shift, landing anticipation, head stabilization, armor/cloth intersections and device animation frame pacing need more visual review. The project currently has authored procedural animation—not captured human motion. Never claim mocap quality or final acceptance based on CI alone.

### 2026-10-16 — v9 enlarged running arc and real-boot QA

The v9 study increases forward/back running foot travel while lowering the real root/pelvis joint further at heel strike to stay within the calibrated thigh/shin reach. The forward body lean is adjusted with the torso, rather than pivoting the entire knight around the floor. The rapid browser test now samples actual Tripo toe joints 34/29, pelvis bone 0 and real knee angles over 200 × 60 Hz updates per Walk and Run, across eight headings for sword clearance. Tested v9 boot pivot standing-phase height: **0.0027–0.0430 m**; swing rises to **0.0975 m**; running pelvis center varied by **0.0347 m**. This is improved over impossible knee bending but the up-to-4.3cm apparent planted-foot vertical drift is **not acceptable final grounded contact**. True planted-foot IK synchronized with the native game's externally moving ASCII avatar, further arm counter-swing and artist/mocap reference are required before anyone may call the result natural human locomotion.

### 2026-10-16 — v10 map-distance-driven planted feet (experimental)

Previously `NativeKnightGlyphs.draw()` passed speed and heading only: the skinned rig's gait phase moved on an internal clock independently of how far the player actually advanced on the original ASCII map. v10 measures horizontal displacement of the **original source actor** `e.x/e.y` in glyph-pixel space; converts from sprite pixels into normalized metres and then original Tripo bone units; and passes cumulative monotonic `travelSource` to `createGltfKnight`. This is only enabled for valid walking/running deltas, ignoring jump movement and large teleport discontinuities.

On the authentic 40-bone rig, stance-foot targets now retain a longitudinal virtual-world anchor: during a single support phase, **stanceFootLocalForward + cumulativeActorDistance stays constant** until toe-off. The run/walk gait phase also advances from ACTUAL movement, so holding Run against an immovable obstacle cannot make the character moonwalk. A sharp heading change releases the scalar pins to avoid stretching a planted leg across the torso. The unchanged fixed-camera 3D-to-ASCII glyph pipeline can stay at its original origin while the two legs react to the actual underlying map travel. In workshop-only treadmill previews without `travelSource`, the 60 Hz procedural cycle remains visible but does not claim foot locking.

A second, bounded root/pelvis contact correction compares **genuine left/right boot pivot world Y** to their original ground levels, lowering/raising the pelvis slightly under loaded stance. A browser regression compares longitudinal anchor invariants across 300 steps and confirms a stopped character does not advance its phase; the existing native desktop/phone smoke covers gameplay integration, as well as 8-heading sword clearance and 12-frame run preview.

**Explicit limitations:** This is 1D/sagittal distance locking, NOT a full 2D/3D IK constraint. World-space turns, diagonal strafes, hills, terrain depth, toe-roll triangles and per-surface penetration still require a full planar foot contact solver and gameplay world-transform bridge. No mocap; no independently closing fingers; do not label motion anatomically final or PR mergeable without owner visual acceptance.

### 2026-10-16 — v12 planar original-map boot contact (experimental; art acceptance open)

The original map-to-rig adapter now accumulates *both* source actor ground axes in normalized original Tripo bone units (right/down glyph movement becomes negative world X/Z). Input intent alone never advances either axis; moving into a wall settles the gait. The scalar distance clock remains for phase continuity and for older callers.

The existing genuine Tripo left/right boot bones (indices 34 and 29) now receive per-stance X/Z anchors in the actor's original-map world plane. On each 60 Hz pose step, the real boot bone is sampled in root space, transformed by the *current eased character heading* and original-map location, and corrected with a bounded sagittal knee IK plus a small hip abduction angle (maximum 0.23 rad). Turns over 0.55 rad since planting trigger a safe replant rather than a knee-crossing twist. This makes diagonal movement and gradual rotation **represented by actual skinned bones**, not by a fixed foot-placement label. Backwards compatibility retains 1D pins when original-map coordinates are unavailable and the studio treadmill when no travel signal is provided.

Added tests: native actual-map diagonal displacement followed by blocked Run (no continued gait travel), and an independent 280-frame straight/diagonal/lateral/turning probe measuring *true boot-joint XZ positions* against the anchors, maximum slip, abduction and knee flex. Source GLB, original map, source collisions, input controls, renderer count, sprite fallback, and production `main` remain unchanged. This is a prototype; authored procedural poses are not motion capture. The checks still need successful CI and actual browser/mobile screenshot review. Foot *mesh* triangles, stance yaw/toe-roll, terrain elevation, slopes and finger grip are not solved; no final-art or production approval is implied.

### 2026-10-16 — v13 contact rocker, weight transfer and opposite-phase arms (draft)

This pass modifies only `experiments/three/ashen-tripo-native-rig.mjs` on the isolated Tripo workshop branch. It continues to deform the owner's existing 40-joint Tripo skin and to use the old game's source map without changing the source map, terrain physics, editor, authored GLB, paid Tripo tasks or production `main`.

- **Three stance subphases** now drive the true boot/ankle and toe-joint skin: initial heel pitch, near-neutral midfoot support and a bounded toe-off pitch; swing gets a small independent ankle pose. Curves use smooth edges and the true phase derived from map travel when present. These are approximate rig joint poses, **not** verified mesh-sole pressure or force simulation.
- **Loaded hip and torso counterweight:** the support phase on each actual leg determines a small (max 0.006 original rig units) pelvis side shift toward the planted leg, inferred from left/right original hip-joint positions, with upper-body counter-lean (max around 0.013 rad). Running aerial intervals and jumps fade the load instead of leaning toward a non-existent planted foot.
- **Contralateral arm travel:** left/right arms now swing oppositely in Run. The right wrist is intentionally restrained to retain the attached Gothic sword outside the hip; elbow, weapon orientation and 40-bone skin remain from the previous authentic rig.
- **Airborne release:** visual toe/heel rocker and lateral hip loading vanish when the jump arc lifts the actor; the original gameplay jump physics remain untouched.
- **Quality checks added:** 240 × 60 Hz genuine toe-bone, rocker-stage and left/right support diagnostics with opposite-arm and knee bounds; a jump-off-ground gate; all earlier 280-step world-XZ planar foot/turn checks, desktop/mobile native in-game checks, 4 movement modes and 8-heading sword clearance still required. The JS source parses and the native actor adapter's 6 movement/block/teleport scenarios pass in isolation; **this is not equivalent to a successful full Three GLB browser CI**.

**Not accepted for release.** Still requires visual browser screenshots, physical mobile-device testing, true sole mesh contact/heel pivot measurements, collision inspection of the swinging sword against cloth/leg armor and performance measurement. Current automated GitHub status was not available at the last check; PR #56 stays draft. No claim of mocap, 60 rendered FPS, real cloth simulation, or final natural gait.

### 2026-10-16 — v14 grounded transitions and no-snap rocker QA

This checkpoint is **implemented on the isolated draft workshop branch**, not merged or approved as final animation. It builds on the genuine 40-joint Tripo V2 model and v12 planar boot contact; no changes to the original ASCII world or author map. No paid generation or motion capture was used.

**Fixes:**
- The shared `sourceKnightMotion` helper now derives gait speed from actual source-map displacement and rejects a held Run against an obstacle, map teleport jumps and airborne travel, matching the behaviour already implemented in the real native Tripo game adapter.
- Support-weight diagnostics and the small pelvis and upper-body counterbalance all unload smoothly to zero in Idle and airborne Jump. This corrects the old state inconsistency where foot load could be reported during a jump even while the foot-rocker was disabled.
- Original heel-strike and toe-off envelopes previously had a discontinuity at the stance/swing boundary. Their new smooth, zero-at-both-ends rocker curves avoid a single-frame ~0.052 rad toe-joint snap; actual Tripo ankle/toe bones still animate rather than substituting sprites.

**Regression gates:**
- Added a zero-WebGL `tools/check/ashen-tripo-source-motion.cjs` test (spawn, diagonal, reverse, stuck Run, teleport, jump, false intent-only sprint and eight headings), and included it in **both** Github Actions workflows and their path triggers.
- Added a **670-step / 60 Hz uninterrupted** genuine-boot-joint playback on the Tripo studio rig: Idle → Walk → Run → turn → stuck Run → Jump → Idle. Assert no phase restart, no one-frame boot-joint teleport, bounded knees/hip, no stationary moonwalk, unloaded jump and final idle. The earlier **280-step X/Z true-boot contact**, 240-step heel/toe and 32-directional sword clearance checks remain active. The toe/ankle test now also rejects one-frame angular jumps from the real GLB bone quaternions.
- Source/helper runtime scenarios and JavaScript grammar were checked directly. **Full Playwright/WebGL CI results, final sword/body mesh clearance, actual sole contact, and physical phone performance were not confirmed.** The suite is a meaningful regression definition, not proof that a real mobile game has passed QA; PR #56 remains draft.

### 2026-10-16 — v15 real weighted skinned-sole and blade/boot geometry QA

This pass remains **experimental and deliberately unmerged** in draft PR #56. The existing Tripo H3.1 V2 40-bone GLB and original authored ASCII Meadow map are unchanged.

- The new independent `ashen-sole-contact.mjs` module selects a bounded set of authentic original-foot weighted **mesh vertices**, restricted to the bottom of each boot and divided into actual source-model heel and toe regions. Decoy cape/torso vertices are excluded by skin weight. It does not create alternate geometry or collide with the world.
- The animation controller now publishes `pose.soleSurface[0|1]` every 60 Hz simulation update: genuine CPU-skinned GLB heel/toe height, sampled boot surface minimum/maximum Y and sample counts in **actor-local** coordinates. These measurements are diagnostics and NOT terrain intersection claims. They intentionally do not modify game gravity or source map physics.
- A browser GLB QA section samples the TRUE boot mesh in Idle, Walk and Run; both feet must provide finite original weighted geometry readings. This catches the misleading situation where toe-joint height looks planted while the actual skinned boot hovers or penetrates.
- The right-side Gothic sword is now assessed across **four motion modes × eight headings × fifty samples** against authentic weighted right-boot mesh vertices. A very-close blade centreline point is flagged; this is a **sampled surface proximity test, not exhaustive per-triangle blade/armor/cape collision detection**.
- Standalone zero-WebGL `ashen-tripo-sole-contact.cjs` uses synthetic weighted input to verify genuine left and right boot selection, heel/toe separation and safe missing-mesh handling. Both GitHub Actions workflows include this check and trigger when its code changes. The isolated pure-sampler function passed its direct test in the code execution environment.

**Still pending:** an accessible complete Playwright/SwiftShader CI success, real screenshots at each angle, a physical phone performance pass, approved ankle/heel/ground contact limits and an all-body sword/cloth collision review. Github Actions check status for the newest commits was not externally available from this session. Keep PR #56 as draft and do not merge or modify the original map.

### v16 — 2026-10-16: real boot contact and sword envelope

The actual weighted heel/toe mesh sample now contributes to a bounded pelvis correction (limit 0.045 original Tripo units) during ground stance; the original toe-pivot solver is retained as fallback. Idle and Jump do not engage the sampled grounded correction. The neutral reference is measured on the authentic original Tripo skin. This is flat-ground support only, not terrain collision.

The separate Gothic sword and its penetration test share the same eight taper stations and true diamond cross-section. The sampled right-boot test now flags points inside the sword volume, not only near its centerline. This is not exhaustive triangle-triangle collision testing. Standalone pure-function tests passed; complete WebGL browser, visual and physical mobile QA remain unconfirmed. PR #56 remains draft and the game map/main remain untouched.

### 2026-10-16 — v17 rate-limited floor load and jump re-entry (draft)

The genuine Tripo boot surface remains the v16 stance-contact sensor. v17 adds `advanceSoleCorrection`: pelvis height compensation is now limited to a maximum speed of **0.18 original model units/sec** (as well as the existing absolute cap) while loading or unloading a foot. A deterministic test covers step-time independence, upward/downward target changes, invalid timing, and smooth support release. The 60 Hz GLB browser contact probe checks the cap against consecutive real rig poses.

The original-map adapter and its pure companion also discard displacement in the **first grounded frame after a jump**, so motion accumulated during flight cannot become a phantom sprint on touchdown. The native-game regression now includes a seven-sample walk → wall stop → teleport → jump → first landing → resumed ground travel sequence. Direct JavaScript checks of the actual functions passed; these checks do not replace WebGL/GLB visual testing.

A new `soleVertexReads` pose field counts the actual weighted skinned vertex reads used per 60 Hz pose; the real-GLB browser test rejects unbounded sampling (more than 64 per frame). This is an operation-count guard, **not a benchmark of real iPhone FPS**. Both CI workflows remain configured, but no successful current 3D browser run or physical device review has been confirmed. PR #56 stays draft. No authored map, original GLB or production main was changed.

### 2026-10-16 — v17 review gates: genuine running flight, 60 consecutive PNG frames, 8 compass views

The v17 browser QA previously demanded a planted mesh-sole contact at **every** moving pose, but the authentic Run motion deliberately has a double-flight interval with **both** skinned boots lifted. The regression now explicitly separates planted frames (requires original weighted `skinned-sole` adjustment) and double-flight frames (requires contact correction mode `off`), and verifies that actual Run includes a measurable aerial interval. This prevents an incorrect false-positive test failure without disguising genuine contact problems.

The fast Tripo studio CI now exports **60 sequential single-step Run PNG screenshots** rather than 12 widely spaced samples, checks per-frame knee, ankle and pelvis displacement, and saves eight additional original-skeleton Run pictures at 0°,45°,90°,135°,180°,225°,270°,315°. These 68 visual-evidence files go into the existing `ashen-arm-review-frames` Actions artifact *if the workflow completes*. They are not yet retrieved, approved, or published as a ready-to-download game sprite archive.

The native game regression now checks actual **ASCII raster refresh** separately from skinned bone evaluation; skeleton simulation uses a 60 Hz fixed step while the costly offscreen rasterizer currently targets **20 Hz desktop / 12 Hz touch**, not 60 visible rendered frames/sec. Frame-pacing/performance optimisation or a precomputed atlas is therefore a separate remaining acceptance gate; do not market 60 Hz skeleton stepping as 60 FPS visual animation.

**Completion estimate (unverified):** four acceptance gates remain: real GLB/CI execution; quantitative planted-sole and sword geometry review; all-angle 60-frame visual refinement; native desktop/mobile glyph pacing and final art signoff. The original source map/main remain untouched and PR #56 stays draft.
