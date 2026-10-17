# ASCII Meadow / The Ashen Vow — handoff to Claude + Blender (2026-10-17)

## Decision

**Use original Tripo V2 GLB as the technical source, and let Claude + Blender fix actual arm/shoulder deformation, cloth readability and the open glove/weapon grip.** Do not substitute an AI still image for a playable skinned asset.

The already connected Higgsfield 3D Jutsu project (revision 3) is a useful **visual reference only**:
https://higgsfield.ai/3d-jutsu/d1324ee8-071f-4a10-a2ed-da6cc62ea862
It contains ~220 individual mesh objects and no ARMATURE object. Current hosted 3D Jutsu importer accepts catalog results only and cannot import our user-supplied Tripo GLB; its rig/animation does **not** transfer to source Tripo.

## Two real binary assets from GitHub Actions

[Verified downloadable GitHub artifact with both real GLBs, SHA256 and manifest](https://github.com/aostera/ASCII-Meadow/actions/runs/39014001772/artifacts/12094182037).

1. **AUTHORITATIVE SOURCE** `ashen_tripo_original_UNMODIFIED.glb`: copied byte-for-byte from `experiments/three/assets/ashen-vow/ashen_tripo_v2_skeleton_lod.glb`, ~10.7 MB, original one 40-joint Tripo skin, no baked production animations.
2. **REFERENCE ONLY** `ashen_tripo_v22_REVIEW_ONLY_motion_bake.glb`: separate real GLB (11.7 MB) exported from actual Three.js skinned model using GLTFExporter, with four 60 Hz baked review actions `REVIEW_ONLY__Idle` (90 frames), `REVIEW_ONLY__Walk` (120), `REVIEW_ONLY__Run` (120), `REVIEW_ONLY__Jump` (90), each containing all 40 original bone rotation/position channels plus separate sword rig reference.
3. `bake_manifest.json` lists bone names and track counts. SHA256SUMS verifies the binaries.

**DO NOT APPROVE V22 ARMS.** They visibly remain incorrect. The last complete native game regression for V22 **FAILED** with
`AssertionError: left glove should hang BESIDE the hips`, measured `drop≈0.666`; source: [CI run 39012619827](https://github.com/aostera/ASCII-Meadow/actions/runs/39012619827). Other green smoke checks verified model loading, not art approval. Four actual wrong-arm screenshots were uploaded in [V22 shoulder artifact](https://github.com/aostera/ASCII-Meadow/actions/runs/39012619767).

## Important Tripo workflow correction — 2026-10-17

The user makes and revises the Tripo model using **AI generation/prompting**, not manual sub-object sculpting or a DCC-style hierarchy editor. **Do not instruct the user to click a presumed manual "Segment → Detailed" workflow**, and do not claim that an AI segmentation result preserves bone names, weights, UV, original topology or a working rig. Tripo AI may provide separate modular outputs if the model/version supports such outputs; Blender is where independent meshes, hierarchy, geometry, weights, constraints and cloth controls must be verified and authored. The source original is the reference; prompt-driven re-generation is OPTIONAL and requires user approval if it changes the silhouette.

## Additional first-class scope: LEGS, GAIT AND BOOTS — user-requested

The existing original rig maps thigh/knee/ankle/toe (left: source joints 31-34; right: 26-29). The imported source knees are *not* straight in the rest pose; hip/knee joint axes must be calibrated from actual source bind matrices in Blender, otherwise IK double-bends or pushes the knee sideways. Keep this separate from repairing shoulders.

Concrete issues found in `ashen-tripo-native-rig.mjs`:
- **Stride mismatch**: phase/distance uses `stepLength=.076+runMix*.052`, while foot IK swing target uses `step=.079+run*.065`. This mismatch can cause contact timing/stride length disagreement (not proof of exact slip amount); match cycle displacement to actually measured Blender gait and game displacement.
- **Visibility**: front tabard/tassets hide knees and ankle motion; separate their geometry/rig controls in Blender so the boot silhouette can read during Run at game scale. Never slice the original robe destructively without an original backup and 3-view approval.
- **Real soles**: the current code samples skin-weighted boot-sole vertices, supports stance X/Z anchors and gradual pelvis correction. Preserve actual heel-toe contact, not just ankle pivot height. Verify heel-strike → midstance → toe-off → swing and both-feet-off-ground Run frames.
- **Knees/hips**: enforce correct bilateral forward knee flexion, independent foot direction, hip range and pelvis timing. Inspect front/side/back for knee valgus, hyperextension and crossing ankles during 45°/90° turns.
- **Feet/toes**: dedicated left/right boot and toe parts if independent control is required; place meaningful ankle pivot, toe hinge and foot roll. Check boot penetration, hovering, mirrored weights, and foot stability during idle/jump landing.

Claude/Blender acceptance: export matched whole-body Idle and at least 60 frames each of Walk, Run, Jump; add named foot targets/heel/toe controls or provide consistent original-bone mapping. Capture **full-resolution** source-vs-edited feet/knees/front robe at front, side and back plus at least one 60-frame contact sheet and native ASCII map screenshots (links to full files, not small chat thumbnails). For every planted 60 Hz sample report actual boot-sole ground penetration, lateral pin-slip distance, left/right knee angles, toe-off and foot rocker envelope; do not claim "perfect" just from the movement clip.

## 2026-10-17 — New actual modular technical GLB (LOCAL USER HANDOFF)

The user now has an additional **downloadable ChatGPT conversation ZIP**:
`ASCII-Meadow-Tripo-Modular-Legs-Claude-Blender.zip` (13 files, 15,975,644 bytes), containing:

- `ashen_tripo_MODULAR_SEGMENTS_REVIEW_ONLY.glb`: 21 separate skinned mesh nodes from the **same original 40-joint GLB**, each individually selectable in Blender, with **no source geometry invented**;
- the byte-for-byte unchanged `ashen_tripo_original_UNMODIFIED.glb`, and separate V22 `REVIEW_ONLY` motion reference;
- `modularize_tripo_source.py` — skin-influence-weighted face partition, with provisional front tabard/waist split;
- `validate_modular_tripo.py` and machine-readable validation: **399,027 original faces = 399,027 modular faces**, original 247,713 source vertices, each oriented triangle's complete position/normal/skin joint/weight records preserved byte-for-byte after reconstruction, same inverse bind matrices, same grey source PBR parameters and all 40 skeleton joints;
- `blender_setup_modular_legs.py` — imports the 21 meshes, organizes semantic mesh collections, adds foot/toe/knee-pole **guides with IK constraints deliberately disabled** pending art calibration. This script has been syntax-checked but **has not been run in Blender** in the current environment;
- real-data orthographic front/back/side mesh partition comparison PNGs. Diagnostic part colors are **not PBR materials**; export keeps original grey.

**Important limitation:** original source mesh is a fused sculpt with only one material, so weighted-joint partitioning DOES NOT mean clean artist-authored armor seams and detached cloth. `ARM_*_ArmorAndSleeve`, `LEG_*_ThighAndTasset`, `BODY_*_Mixed` contain mixed source shapes. `CLOTH_*_CANDIDATE_*` is exploratory geometry, not a finished deformable tabard. Claude must inspect/repair seam geometry, cloth materials, arm weighting, knee anatomy and actual IK in Blender. New modular GLB is a **DCC staging source**, not a game-optimized replacement (21 draw calls). The source GLB remains unchanged and no art approval is claimed.

**Recipient note:** archive is attached to the current ChatGPT conversation; hand it to Claude locally. GitHub PR currently stores documentation, NOT the new 8.56 MB modular binary (do not assume it is checked in).

## Scope for Claude / Blender

- Import the unmodified Tripo source into a NEW Blender file and save untouched baseline. Import the V22 reference GLB into a **separate** Blender file. Never replace original with the broken animation reference.
- Audit 40-bone armature, parent chain, inverse-bind/rest transforms, shoulder rotation local axes, weighted armor skin vertices. Preserve source GLB and stable skin joint names/indices unless you also provide a complete mapping and update the game adapter.
- Repair shoulder and elbow anatomically in Blender, not by accumulated Euler guesses in `ashen-tripo-native-rig.mjs`. The arm's pauldron must stay continuous and wrists must hang close to outer thigh in Idle, WITHOUT spread A-pose, crushed torso or backwards elbow. Inspect from FRONT/SIDE/BACK and with 360° yaw; run at full movement phase before accepting.
- Rework the open right glove into a convincing sword grip **with geometry/weights and optional true finger controls**. A wrist-parented sword is not proof of a clenched hand. Keep weapon as independent mesh/attachment with no shoulder intersection during Run/Jump.
- Match established gothic/dead-game art direction using authored dark steel, aged fabric, burgundy cape and textured material response. Don't use the unapproved full-body white or crushed-black procedural vertex palette. Reference original approved ASCII silhouette in `src/data/knight-frames.js` and Higgsfield Gothic scene as look only.
- Produce Blender Actions Idle, Walk, Run, Jump, each **>=60 source pose frames**, with in-place walk/run loops, real contact and correct landing. If 8 headings are required, prefer safely rotating the root controller through compass directions rather than exporting 8 independently damaged skins.
- Export edited source `ashen_tripo_blender_repaired_v01.glb` and editable `ashen_tripo_blender_repaired_v01.blend`, untouched `original`, comparison PNG front/side/back, 60-frame Run and Walk screenshot/contact contact-sheet; also capture gameplay render at source ASCII resolution.
- Do not merge or edit main or change user-approved game map. Work on a NEW Claude-owned branch, e.g. `feat/ashen-blender-rig-repair-20261017` based on `feat/ashen-tripo-animation-workshop-20261016`. Attach reproducible geometry/clip test and source/edited hashes. PR #56 stays draft until visual user approval.

## Integration acceptance

- Original 40-bone source asset byte-identical preserved.
- Valid skinned GLB with recognizable bone mapping, correct material texture paths and readable artwork at game scale.
- Arms/pauldrons stay anatomically sound at Idle/Walk/Run/Jump and 8 headings with matched front/side/back captures; no clipping in weapon grip.
- 60+ frames per full walk, run and jump reference animation; real planted-sole contact.
- Native ASCII integration uses same original map, real skinned geometry and no regression in desktop/touch.
- Report numerical measurements honestly: old browser 60Hz pose simulation != 60 visibly distinct ASCII glyph renders; accepted performance needs measurements on target devices.

## Working code

- Source rig: `experiments/three/ashen-tripo-native-rig.mjs`
- Sword: `experiments/three/ashen-gothic-longsword.mjs`
- Source bone skin reference: `experiments/three/assets/ashen-vow/ashen_tripo_v2_skeleton_lod.glb`
- Browser A/B: `experiments/three/ashen-tripo-ab-review.html`
- Native game: `experiments/three/native.html` / `experiments/three/native-tripo-v2.mjs`
- Source art: `src/data/knight-frames.js`
- Blender source/bake exporter: `tools/check/ashen-export-blender-handoff.cjs`
- Blender machine audit script: `ashen_import_and_audit.py` in the user handoff ZIP.

## Claude connection on Windows

Third-party Blender MCP: https://github.com/ahujasid/mcp-for-blender
Install UV, then `uvx mcp-for-blender setup` to select Claude and Blender, or `claude mcp add blender uvx mcp-for-blender` (Claude Code). Blender's N panel exposes the MCP connection; make sure the intended single MCP server is running. See upstream for precise version instructions.

**Handoff state:** authentic GLB and four reference clips exported successfully and independently validated by workflow 39014001772. Blender structural editing of this original file has **not** been performed yet; do not claim all visual bugs fixed.

## Claude result v01 (2026-10-17, branch `feat/ashen-blender-rig-repair-20261017`)

- Repaired GLB: `experiments/three/assets/ashen-vow/ashen_tripo_blender_repaired_v01.glb` (4.1 MB, 70k triangles, the source's 40 joints in the source order, Idle 121 / Walk 69 / Run 85 / Jump 73 frames at 60 fps, separate longsword under `bone_19`, vertex colours). Source GLB byte-identical.
- Scripts, change table and review sheets: `blender/ashen/` (README, `review/compare_*.png`).
- Root cause of the V22 arms: Tripo's own weights hold the pauldrons together when posed correctly; what stretched was the cape and armpit plates carrying upper-arm weight. Fixed in the weights, then the arms-down pose became the bind.
- Native game: `native-ashen-blender.mjs` plays the baked clips and prints them as glyphs; default in `native.html` (`?tripoV2=1` keeps V2). Checks: `tools/check/ashen-blender-glb.cjs`, `tools/check/ashen-blender-native.cjs`.
