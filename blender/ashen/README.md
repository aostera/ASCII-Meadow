# The Ashen Vow knight (Tripo) — Blender repair

Source (read only): `experiments/three/assets/ashen-vow/ashen_tripo_v2_skeleton_lod.glb`
(SHA256 `5e1e2ff4686ba1503de61192a0537a85c6b9fdb51d2be8352b894fd91e2ac2b5`).

From the live Blender session (MCP `execute_blender_code`) or `blender -b`:

```python
g = {"__name__": "ashen"}
exec(open(r"C:\Users\alost\Desktop\Other\ASCII-Meadow\blender\ashen\repair_ashen_rig.py", encoding="utf-8").read(), g)
g["load_source"]()
g["fix_weights"]()
g["pose_arms_down"]()
print(g["measure"]("v01"))
g["render_review"](r"...\blender\ashen\review", "02_repaired")
```

`make_review_sheets.py` puts the source bind, V22 Idle and the repair side by side
(`review/compare_body.png`, `review/compare_shoulders.png`). `.blend` files and per-view PNGs are
not tracked; rebuild them with the scripts.

Status v01: shoulders and cape weights repaired, arms hang naturally. Next: apply the arms-down
rest pose, sword grip, Idle/Walk/Run/Jump (60+ frames), materials, lighter mesh, GLB export.
