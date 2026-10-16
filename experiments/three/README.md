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
- Inspect Idle / Walk / Run / Jump, all 8 compass directions, pause, one 1/60 s pose step, 0.5–1.5x playback, skeleton, wireframe and camera angles. Detached Gothic sword follows the right wrist joint.
- Animation is evaluated at fixed 60 Hz for deterministic inspection; **display FPS depends on the device**. This is a pose preview and cannot establish physically correct foot contact, cloth simulation or final visual fidelity until watched and accepted in browser/on mobile.
- The original V2 viewer remains a static skeleton/geometry inspection. The authored source map and original production knight remain unchanged.
- QA: JavaScript module syntax was checked offline. A full GLB render, shader compilation and actual hardware validation still require the deployed page.
