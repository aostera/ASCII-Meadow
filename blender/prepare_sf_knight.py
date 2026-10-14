"""ASCII Meadow: turn the SF medieval knight STL (3D-print sculpt) into our working knight model.

Source: blender/SF_Knight_v1.0/SF_medival_knight_no_supports/SF_medival_knight_pose_2_1.stl
        (1.29 M triangles, print units, stands on a round plinth)
What it does:
  1. imports the STL and splits it into loose parts;
  2. removes the plinth (the loose disc under the feet) and cuts the soles flat where they sank
     into it, so the knight stands on z = 0;
  3. sorts the parts into Knight_Body, Knight_Sword (blade + guard) and Knight_Scabbard
     (scabbard + its wraps), everything else stays with the body;
  4. scales to metres (1.90 m to the top of the helmet), puts the feet centre at the origin,
     facing -Y (his right hand with the sword is -X);
  5. decimates (body ~72k tris, scabbard ~20k, sword ~12k), cleans normals, cuts the guard,
     grip and pommel (fused into the fist in the sculpt) into Knight_Sword, sets sharp edges by
     angle and smooth shading, one dark clay material;
  6. sets up the shared check scene (knight_scene.py), saves blender/knight.blend and
     renders the 8 views to blender/previews/.

Run from the repository root:
    blender -b --factory-startup --python blender/prepare_sf_knight.py [-- --no-render] [--out=path.blend]
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import knight_scene as ks

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
STL = os.path.join(HERE, "SF_Knight_v1.0", "SF_medival_knight_no_supports", "SF_medival_knight_pose_2_1.stl")
OUT_BLEND = next((a[6:] for a in ARGS if a.startswith("--out=")), os.path.join(HERE, "knight.blend"))
OUT_PREV = os.path.join(HERE, "previews")

HEIGHT_M = 1.90          # ground to the top of the helmet
PLINTH_TOP = 1.792       # top face of the plinth, in STL units (measured)
DECIMATE = {"Knight_Body": 0.07, "Knight_Scabbard": 0.10, "Knight_Sword": 0.5}
SHARP_ANGLE = 40         # degrees: edges sharper than this stay crisp


def bbox(ob):
    co = [v.co for v in ob.data.vertices]
    lo = Vector([min(c[i] for c in co) for i in range(3)])
    hi = Vector([max(c[i] for c in co) for i in range(3)])
    return lo, hi


def select_only(ob):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def join(obs, name):
    obs = [o for o in obs if o]
    select_only(obs[0])
    for o in obs[1:]:
        o.select_set(True)
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = ob.data.name = name
    return ob


def axis_distance(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (a + ab * t - p).length


def blade_axis(sword, blade_name_src):
    """Axis of the blade: centroids of its lowest and highest tenth (STL units)."""
    co = [v.co.copy() for v in sword.data.vertices]
    zs = sorted(c.z for c in co)
    z10, z90 = zs[len(zs) // 10], zs[-len(zs) // 10]
    lo = [c for c in co if c.z <= z10]
    hi = [c for c in co if c.z >= z90]
    b0 = sum(lo, Vector()) / len(lo)
    b1 = sum(hi, Vector()) / len(hi)
    return b0, (b1 - b0).normalized(), (b1 - b0).length


# The guard, grip and pommel are fused into the body (the fist closes on the grip). Measured along
# the blade axis from the blade's low end (STL units): guard -1.2..+0.85 past the blade top with
# arms ~3.5 wide; grip radius ~0.33 (fingers start beyond 0.4), ~0.5 above the fist; fist from
# +1.7 to +4.7; pommel above +5.8.
SWORD_ZONES = [  # (t from, t to, max radius) relative to the blade's top
    (-1.2, 0.25, 3.8),      # cross-guard with down-curved quillons
    (0.25, 0.95, 0.90),     # guard centre
    (0.95, 30.0, 0.37),     # grip, through the fist
    (4.75, 30.0, 0.70),     # grip above the fist (thicker wrap)
    (5.80, 30.0, 1.60),     # pommel
]


def cut_sword_from_body(body, axis):
    """Split the guard, grip and pommel faces off the body into their own object."""
    b0, d, L = axis

    def inside(co):
        p = co - b0
        t = p.dot(d) - L
        r = (p - d * p.dot(d)).length
        return any(t0 <= t <= t1 and r <= rmax for t0, t1, rmax in SWORD_ZONES)

    flags = [inside(v.co) for v in body.data.vertices]
    part = body.copy()
    part.data = body.data.copy()
    bpy.context.scene.collection.objects.link(part)
    for ob, keep_inside in ((part, True), (body, False)):
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bm.verts.ensure_lookup_table()
        kill = [f for f in bm.faces if all(flags[v.index] for v in f.verts) != keep_inside]
        bmesh.ops.delete(bm, geom=kill, context="FACES")
        bm.to_mesh(ob.data)
        bm.free()
    print("SWORD_CUT", sum(flags), "verts from the body")
    return part


def move_exposed_grip(body, sword):
    """After scaling: the bits of grip showing between guard, fist and pommel still sit in the body
    mesh. Take body faces within 32 mm of the sword axis, between the guard and the fist and
    between the fist and the pommel, into the sword (metres)."""
    co = [v.co.copy() for v in sword.data.vertices]
    zs = sorted(c.z for c in co)
    pom = [c for c in co if c.z >= zs[-len(zs) // 25]]
    low = [c for c in co if c.z <= zs[len(zs) // 20]]
    b0 = sum(low, Vector()) / len(low)
    d = (sum(pom, Vector()) / len(pom) - b0).normalized()

    def tr(p):
        q = p - b0
        t = q.dot(d)
        return t, (q - d * t).length

    pts = [tr(v.co) for v in body.data.vertices]
    swp = [tr(c) for c in co]
    ptop = max(t for t, r in swp)
    pom_bottom = min(t for t, r in swp if t > ptop - 0.12 and r > 0.025)
    guard_top = max(t for t, r in swp if r > 0.06 and t < ptop - 0.25)
    fist_bottom = min(t for t, r in pts if 0.03 < r < 0.08 and t > guard_top)
    fist_top = max(t for t, r in pts if 0.03 < r < 0.08 and t < pom_bottom)
    keep = {i for i, (t, r) in enumerate(pts) if r < 0.032 and
            (guard_top - 0.004 < t < fist_bottom + 0.004 or fist_top - 0.004 < t < pom_bottom + 0.01)}
    part = body.copy()
    part.data = body.data.copy()
    body.users_collection[0].objects.link(part)
    for ob, inside in ((part, True), (body, False)):
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        kill = [f for f in bm.faces if all(v.index in keep for v in f.verts) != inside]
        bmesh.ops.delete(bm, geom=kill, context="FACES")
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
        bm.to_mesh(ob.data)
        bm.free()
    print("GRIP_MOVED", len(keep), "verts")
    return join([sword, part], "Knight_Sword")


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    bpy.ops.wm.stl_import(filepath=STL)
    src = bpy.context.selected_objects[0]
    print("IMPORTED", len(src.data.polygons), "faces")

    # ---- 1. loose parts
    select_only(src)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="LOOSE")
    bpy.ops.object.mode_set(mode="OBJECT")
    parts = list(bpy.context.selected_objects)
    print("PARTS", len(parts))

    # ---- 2. plinth out
    body_parts, plinth = [], []
    for ob in parts:
        lo, hi = bbox(ob)
        (plinth if hi.z < PLINTH_TOP + 0.05 and (hi.x - lo.x) > 15 else body_parts).append(ob)
    for ob in plinth:
        bpy.data.objects.remove(ob, do_unlink=True)
    print("PLINTH_REMOVED", len(plinth))

    # ---- 3. sort: sword (far to his right), scabbard (big part reaching far behind) and its wraps
    info = {ob: bbox(ob) for ob in body_parts}
    biggest = max(body_parts, key=lambda o: len(o.data.vertices))
    sword = [o for o in body_parts if info[o][1].x < -6.5]
    scab_main = max((o for o in body_parts if info[o][1].y > 9 and o is not biggest),
                    key=lambda o: len(o.data.vertices))
    # scabbard axis by the extreme vertices along its longest diagonal
    co = [v.co for v in scab_main.data.vertices]
    a = max(co, key=lambda c: c.y - c.z)          # low tip, far behind
    b = max(co, key=lambda c: c.z - c.y * 0.5)    # throat, high
    scabbard = [scab_main] + [o for o in body_parts if o not in sword and o is not scab_main and o is not biggest
                              and axis_distance((info[o][0] + info[o][1]) / 2, a, b) < 1.6]
    rest = [o for o in body_parts if o not in sword and o not in scabbard]
    print("SORT body", len(rest), "sword", len(sword), "scabbard", len(scabbard))

    blade = max(sword, key=lambda o: len(o.data.vertices))
    body = join(rest, "Knight_Body")
    sword = join(sword, "Knight_Sword")
    scab = join(scabbard, "Knight_Scabbard")
    sword = join([sword, cut_sword_from_body(body, blade_axis(sword, blade))], "Knight_Sword")
    obs = [body, sword, scab]

    # ---- cut the soles flat at the plinth top
    for ob in obs:
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        if min(v.co.z for v in bm.verts) < PLINTH_TOP:
            geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
            res = bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, PLINTH_TOP), plane_no=(0, 0, 1),
                                         clear_inner=True)
            edges = [e for e in res["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
            if edges:
                bmesh.ops.holes_fill(bm, edges=edges, sides=0)
        bm.to_mesh(ob.data)
        bm.free()

    # ---- 4. metres, feet centre at the origin
    co = [v.co for v in body.data.vertices if v.co.z < PLINTH_TOP + 1.2]
    cx = (min(c.x for c in co) + max(c.x for c in co)) / 2
    cy = (min(c.y for c in co) + max(c.y for c in co)) / 2
    top = max(v.co.z for v in body.data.vertices)
    s = HEIGHT_M / (top - PLINTH_TOP)
    M = Matrix.Scale(s, 4) @ Matrix.Translation((-cx, -cy, -PLINTH_TOP))
    for ob in obs:
        ob.data.transform(M)
        ob.matrix_world = Matrix()
        ob.data.update()
    print("SCALE", round(s, 5), "feet centre", round(cx, 3), round(cy, 3))

    # ---- 5. decimate, clean, shading
    deps = bpy.context.evaluated_depsgraph_get()
    for ob in obs:
        before = len(ob.data.polygons)
        mod = ob.modifiers.new("Decimate", "DECIMATE")
        mod.ratio = DECIMATE[ob.name]
        mod.use_collapse_triangulate = True
        deps.update()
        new = bpy.data.meshes.new_from_object(ob.evaluated_get(deps))
        old = ob.data
        ob.modifiers.clear()
        ob.data = new
        bpy.data.meshes.remove(old)
        new.name = ob.name
        bm = bmesh.new()
        bm.from_mesh(new)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-6)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(new)
        bm.free()
        new.shade_smooth()
        try:
            new.set_sharp_from_angle(angle=math.radians(SHARP_ANGLE))
        except AttributeError:
            pass
        print("DECIMATED", ob.name, before, "->", len(new.polygons))
    sword = move_exposed_grip(body, sword)
    obs = [body, sword, scab]
    for ob in (body, sword):
        ob.data.shade_smooth()
        try:
            ob.data.set_sharp_from_angle(angle=math.radians(SHARP_ANGLE))
        except AttributeError:
            pass

    clay = bpy.data.materials.new("M_Knight_Clay")
    try:
        clay.use_nodes = True
    except Exception:
        pass
    p = clay.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (0.13, 0.125, 0.12, 1)
    p.inputs["Roughness"].default_value = 0.55
    p.inputs["Metallic"].default_value = 0.15
    clay.diffuse_color = (0.13, 0.125, 0.12, 1)

    # ---- 6. scene
    c_knight = ks.collection("Knight")
    c_lights, c_cams = ks.collection("Lights"), ks.collection("Cameras")
    root = bpy.data.objects.new("Knight_Root", None)
    root.empty_display_type = "ARROWS"
    root.empty_display_size = 0.4
    c_knight.objects.link(root)
    for ob in obs:
        for c in list(ob.users_collection):
            c.objects.unlink(ob)
        c_knight.objects.link(ob)
        ob.parent = root
        ob.data.materials.clear()
        ob.data.materials.append(clay)
    ks.setup_world(scene)
    ks.setup_lights(c_lights)
    ks.setup_camera(scene, c_cams)

    pts = [v.co for ob in obs for v in ob.data.vertices]
    print("BOUNDS", [round(min(p[i] for p in pts), 3) for i in range(3)], [round(max(p[i] for p in pts), 3) for i in range(3)])
    print("TRIS", {ob.name: len(ob.data.polygons) for ob in obs})

    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    print("SAVED", OUT_BLEND)
    print("TRIS_FINAL", {ob.name: len(ob.data.polygons) for ob in obs})
    if "--no-render" not in ARGS:
        for f in ks.render_views(scene, root, OUT_PREV, [a for a in ARGS if a[:1].isdigit()]):
            print("RENDERED", f)
        bpy.ops.wm.save_mainfile()
    print("DONE")


main()
