# The Ashen Vow knight (Tripo) — Blender repair v01

Source, read only: `experiments/three/assets/ashen-vow/ashen_tripo_v2_skeleton_lod.glb`
(SHA256 `5e1e2ff4686ba1503de61192a0537a85c6b9fdb51d2be8352b894fd91e2ac2b5`, unchanged).
Result: `experiments/three/assets/ashen-vow/ashen_tripo_blender_repaired_v01.glb` (4.1 MB) and
the editable `blender/ashen/ashen_tripo_blender_repaired_v01.blend` (local, not in git).

## Rebuild (Blender 5.2, live MCP session or `blender -b`)

```python
B = r"C:\Users\alost\Desktop\Other\ASCII-Meadow\blender\ashen"
g, sw, an, rv = ({"__name__": n} for n in ("ashen", "ashen_sword", "ashen_anim", "ashen_review"))
exec(open(B + r"\repair_ashen_rig.py", encoding="utf-8").read(), g)
exec(open(B + r"\build_ashen_sword.py", encoding="utf-8").read(), sw)
exec(open(B + r"\anim_ashen.py", encoding="utf-8").read(), an)
exec(open(B + r"\review_ashen.py", encoding="utf-8").read(), rv)
g["load_source"](); g["fix_weights"](); g["pose_arms_down"](); g["apply_rest_pose"]()
# sword fist + wrist + right arm back: the exact pose is grip_pose_v01.json (bone -> matrix_basis);
# apply it, sword = sw["build_sword"](), place it at the JSON's "sword_world", g["apply_rest_pose"](),
# sw["attach_to_bone"](sword, g["rig"](), "bone_19", sword_world)
g["paint_vertex_colours"](); g["sword_material"]()
for c in ("Idle", "Walk", "Run", "Jump"):
    an["bake_clip"](c)
an["export_glb"]()
```

Then restore the source joint order (Blender writes its own) and check:

```
node blender/ashen/fix_joint_order.cjs experiments/three/assets/ashen-vow/ashen_tripo_v2_skeleton_lod.glb experiments/three/assets/ashen-vow/ashen_tripo_blender_repaired_v01.glb
node tools/check/ashen-blender-glb.cjs
```

## What changed against the source

| Area | Source Tripo | Repaired v01 |
| --- | --- | --- |
| Bind pose | T-pose, arms horizontal | arms hanging, hands by the thighs (drop 0.92; V22 failed at 0.666); right fist on the sword |
| Weights | cape behind the shoulders and chest plates by the armpits carried upper-arm weight | that weight moves smoothly (per vertex) to the clavicle of the same side; everything else is Tripo's own |
| Skeleton | 40 bones | the same 40 bones; names and joint order/indices identical (checked) |
| Hands | open gloves | right glove closed on the grip with its own finger chains (`bone_23-25` fingers, `bone_20-22` thumb); left fingers relaxed |
| Sword | none in the source (V22 had a wrist-bound JS sword) | separate procedural Gothic longsword mesh, child of `bone_19` |
| Mesh | 400k triangles in 1171 pieces, a stray `Icosphere` | 70k triangles in the GLB (decimated copy at export), stray sphere removed |
| Material | one flat grey material, no UVs | vertex colours per piece: dark steel; burgundy cape, hood, scarf and shoulder mantle (as marked by the author); wine tabard; leather straps |
| Animation | none | Idle 121, Walk 69, Run 85, Jump 73 frames at 60 fps, in place, plain FK keys; feet planted by per-frame IK while authoring |

Numbers: the planted ball of the foot stays within 0.008 of the ground (~1.5 cm); stance slide
speed error under 9% (walk) / 5% (run); the blade tip never drops below 0.14 (knee height).

## Review

`review/compare_*.png`: source / V22 / repair (body, shoulders), Idle and Run from three sides,
the sword fist, one Walk pose from 8 headings, and contact sheets of every frame of each clip.
`make_review_sheets.py` builds the source / V22 / repair sheets. `.blend` files and per-view PNGs
are not tracked; rebuild them with the scripts.
