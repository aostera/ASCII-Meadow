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
