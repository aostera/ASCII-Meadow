"""ASCII Meadow: prepare the Masked Knight (Fab, Meshy-generated OBJ) as our animation model.

Source: blender/Masked_Knight_src/masked_knight.obj — one watertight shell, 816k triangles,
vertex colours ("Color"), Z up, facing -Y, ~75 units tall.
Steps: import -> weld split vertices -> metres (1.90 m to the top of the head), feet centre at the origin ->
decimate to ~80k triangles -> smooth shading with sharp edges by angle -> vertex-colour material ->
cut the greatsword (fused into the right fist) into Knight_Sword -> check scene (knight_scene.py) ->
save blender/masked_knight.blend. Renders: knight_scene.render_views(...) into blender/previews_masked/.

Live Blender (MCP / execute_code): set KNIGHT_ROOT (repo path) before exec. Background:
    blender -b --python blender/prepare_masked_knight.py
"""
import bpy, bmesh, math, os, sys
from mathutils import Matrix, Vector

_g = globals()
ROOT = _g.get("KNIGHT_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERE = os.path.join(ROOT, "blender")
sys.path.insert(0, HERE)
import importlib
import knight_scene as ks
importlib.reload(ks)

OBJ = os.path.join(HERE, "Masked_Knight_src", "masked_knight.obj")
OUT_BLEND = os.path.join(HERE, "masked_knight.blend")
HEIGHT_M = 1.90
TARGET_TRIS = 80000
SHARP_ANGLE = 40


def log(*a):
    print("MK", *a)


def clear_scene():
    """Empty the current file without reloading it (reloading breaks the context of a live session)."""
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras, bpy.data.images):
        for d in list(coll):
            if d.users == 0:
                coll.remove(d)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)


# The greatsword is fused into the right fist. Measured along the blade axis (metres, t from a point
# on the blade at ~1.8 m): blade t -0.70..+0.25 within 6 cm; guard with winged spikes t -0.77..-0.70
# within 16 cm; fist t -0.93..-0.78 (left on the body); grip and pommel below the fist down to -1.25.
SWORD_ZONES = [(-0.70, 0.40, 0.07), (-0.77, -0.70, 0.16), (-1.26, -0.955, 0.06)]


def cut_sword(body):
    import numpy as np
    me = body.data
    co = [v.co.copy() for v in me.vertices]
    tip = max(co, key=lambda c: c.z)
    blade = [c for c in co if c.z > tip.z - 0.45 and c.x < -0.12 and c.y < tip.y + 0.25]
    P = np.array([tuple(c) for c in blade])
    m = P.mean(0)
    d = Vector(np.linalg.svd(P - m)[2][0])
    d = d if d.z > 0 else -d
    b0 = Vector(m)

    def inside(c):
        q = c - b0
        t = q.dot(d)
        r = (q - d * t).length
        return any(t0 <= t <= t1 and r <= rmax for t0, t1, rmax in SWORD_ZONES)

    flags = [inside(c) for c in co]
    sword = body.copy()
    sword.data = me.copy()
    sword.name = sword.data.name = "Knight_Sword"
    body.users_collection[0].objects.link(sword)
    for ob, keep_inside in ((sword, True), (body, False)):
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        kill = [f for f in bm.faces if all(flags[v.index] for v in f.verts) != keep_inside]
        bmesh.ops.delete(bm, geom=kill, context="FACES")
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
        bm.to_mesh(ob.data)
        bm.free()
    log("sword", len(sword.data.polygons), "faces; body", len(body.data.polygons))
    return sword


def main():
    clear_scene()
    scene = bpy.context.scene
    wm = bpy.context.window_manager
    win = bpy.context.window or (wm.windows[0] if wm.windows else None)
    if win is not None:
        with bpy.context.temp_override(window=win):
            bpy.ops.wm.obj_import(filepath=OBJ, forward_axis="Y", up_axis="Z")
    else:
        bpy.ops.wm.obj_import(filepath=OBJ, forward_axis="Y", up_axis="Z")
    ob = [o for o in scene.objects if o.type == "MESH"][0]
    ob.name = "Knight_Body"
    me = ob.data
    me.name = "Knight_Body"
    log("imported", len(me.vertices), "verts", len(me.polygons), "faces")

    # weld the split vertices (the OBJ repeats a vertex per face corner)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bm.to_mesh(me)
    bm.free()
    log("welded", len(me.vertices), "verts")

    # metres, feet centre at the origin
    zs = [v.co.z for v in me.vertices]
    zmin, zmax = min(zs), max(zs)
    low = [v.co for v in me.vertices if v.co.z < zmin + (zmax - zmin) * 0.05]
    cx = (min(c.x for c in low) + max(c.x for c in low)) / 2
    cy = (min(c.y for c in low) + max(c.y for c in low)) / 2
    # height is measured to the top of the head: the sword point rises above it
    span = zmax - zmin
    head_top = max(v.co.z for v in me.vertices
                   if abs(v.co.x - cx) < 0.06 * span and abs(v.co.y - cy) < 0.08 * span) - zmin
    s = HEIGHT_M / head_top
    me.transform(Matrix.Scale(s, 4) @ Matrix.Translation((-cx, -cy, -zmin)))
    me.update()
    log("scale", round(s, 5))

    # decimate to the target, keeping the vertex colours
    mod = ob.modifiers.new("Decimate", "DECIMATE")
    mod.ratio = TARGET_TRIS / len(me.polygons)
    mod.use_collapse_triangulate = True
    deps = bpy.context.evaluated_depsgraph_get()
    deps.update()
    new = bpy.data.meshes.new_from_object(ob.evaluated_get(deps))
    ob.modifiers.clear()
    ob.data = new
    bpy.data.meshes.remove(me)
    new.name = "Knight_Body"
    bm = bmesh.new()
    bm.from_mesh(new)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(new)
    bm.free()
    new.shade_smooth()
    new.set_sharp_from_angle(angle=math.radians(SHARP_ANGLE))
    log("decimated", len(new.polygons), "faces")

    mat = bpy.data.materials.new("M_Knight_VertexColor")
    try:
        mat.use_nodes = True
    except Exception:
        pass
    nt = mat.node_tree
    p = nt.nodes["Principled BSDF"]
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = new.color_attributes[0].name if new.color_attributes else "Color"
    nt.links.new(vc.outputs["Color"], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.6
    p.inputs["Metallic"].default_value = 0.2
    new.materials.append(mat)

    c_knight = ks.collection("Knight")
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    c_knight.objects.link(ob)
    root = bpy.data.objects.new("Knight_Root", None)
    root.empty_display_type = "ARROWS"
    root.empty_display_size = 0.4
    c_knight.objects.link(root)
    ob.parent = root
    sword = cut_sword(ob)
    sword.parent = root
    ks.setup_world(scene)
    ks.setup_lights(ks.collection("Lights"))
    ks.setup_camera(scene, ks.collection("Cameras"))

    # viewport: show the vertex colours in solid mode
    for win in getattr(bpy.context.window_manager, "windows", []):
        for area in win.screen.areas:
            if area.type == "VIEW_3D":
                for sp in area.spaces:
                    if sp.type == "VIEW_3D":
                        sp.shading.type = "SOLID"
                        sp.shading.color_type = "VERTEX"

    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    log("saved", OUT_BLEND)


main()
