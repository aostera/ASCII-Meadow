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
