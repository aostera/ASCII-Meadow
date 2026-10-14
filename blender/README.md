# 3D knight pipeline (Blender)

Builds the Masked Knight as a rigged, animated 3D model for the Three.js migration
(`experiments/three/knight-gltf.js`) and for 8-direction sprite renders. Only the scripts are in
git; sources, `.blend` files and renders are ignored (large or third-party).

## Source model

`blender/Masked_Knight_src/masked_knight.obj` — "Masked Knight" from Fab (Meshy-generated, one
watertight shell, 816k triangles, vertex colours). Not tracked: copy it from the Epic/Fab library
(`EpicGamesLauncher/VaultCache/FabLibrary/Masked_Knight-*/obj/`).

## Rebuild, in order (Blender 5.2, live session via MCP or `blender -b`)

| Step | Script | Result |
| --- | --- | --- |
| 1 | `prepare_masked_knight.py` | import, weld, 1.90 m to the top of the head, feet at the origin facing -Y, 80k triangles, vertex-colour material, sword cut off the fist into `Knight_Sword`; saves `blender/masked_knight.blend` |
| 2 | `rig_masked_knight.py` | `Knight_Rig`, 91 bones: body, arms, IK legs (`IK_Foot.*` also turns the foot, `Pole_Knee.*`), `Weapon.R` carrying the sword, 63 cloak bones (9 chains x 7 laid on the cloth); automatic weights with fixes (legs off the cloak, unweighted vertices filled) |
| 3 | `cloak_sim_masked_knight.py` (`KNIGHT_TEST=False`) | cloth proxy (25x22) pinned at the shoulders, leg/hip/ground colliders; only vertices within 9 cm of the cloth keep cloak weights; hem cut from the boots; Surface Deform binding |
| 4 | `anim_knight.py`: `bake_clip(name)` for Idle, Walk, Run, Jump, Crouch | authoring action `Author_<clip>` with real travel/jump so the cloth reacts, cloth tracked by the cloak bones, everything baked to plain in-place FK action `<clip>` |
| 5 | `anim_knight.py`: `export_glb()` | `experiments/three/assets/knight/masked_knight.glb` (body decimated to 40k triangles, clips as glTF animations, Y-up, facing +Z) |
| — | `anim_knight.py`: `render_clip(name)` | 8 sprite directions into `blender/anim/<clip>/` for the ASCII pipeline |

From the live session (MCP `execute_blender_code`):

```python
KNIGHT_ROOT = r"C:\Users\alost\Desktop\Other\ASCII-Meadow"
B = KNIGHT_ROOT + r"\blender"
exec(open(B + r"\anim_knight.py", encoding="utf-8").read())
play_authoring()
exec(open(B + r"\rig_masked_knight.py", encoding="utf-8").read(), {"KNIGHT_ROOT": KNIGHT_ROOT})
exec(open(B + r"\cloak_sim_masked_knight.py", encoding="utf-8").read(), {"KNIGHT_ROOT": KNIGHT_ROOT, "KNIGHT_TEST": False})
for c in ("Walk", "Idle", "Run", "Jump", "Crouch"):
    bake_clip(c)
export_glb()
```

## Clips (24 fps, all in place)

| Clip | Frames | Notes |
| --- | --- | --- |
| Idle | 48 loop | breathing and a slow weight shift |
| Walk | 32 loop | two steps; the planted foot does not slide at 0.62 m/s |
| Run | 20 loop | two strides with a flight phase, 1.9 m/s |
| Jump | 36 once | load, take-off f9, tuck, touch-down f23, absorb, recover; the game owns the arc height |
| Crouch | 24 once | down onto the haunches and hold |

## Rules learnt the hard way

- Never set `matrix_world` on an object parented to a bone: the offset lands in the object's own
  transform and accumulates across rebuilds. Use identity `matrix_basis` and an explicit
  `matrix_parent_inverse` from the bone's rest matrix.
- Heat weights spread cloak influence onto armour and legs; restrict cloak bones to vertices near
  the cloth and keep low vertices either all cloth or all leg, or parts get dragged and stretched.
- The jump arc must follow real gravity (here 0.40 m in 14 frames), or the cloth floats.
- Blender 5.2: `Mesh.set_sharp_from_angle` (not `set_sharpness_by_angle`); in a live session do not
  reload the file and import in the same call (the window context is lost).

Older experiments kept as scripts: `build_knight.py` (procedural knight), `prepare_sf_knight.py`
(SF Knight STL), `compare.py`, `knight_scene.py` (shared check scene and 8-view renders).
