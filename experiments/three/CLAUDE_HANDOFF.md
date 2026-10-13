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
