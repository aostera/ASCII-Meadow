"""The Ashen Vow: repair the original 40-bone Tripo knight in Blender (non-destructive).

Run inside Blender (live MCP session or `blender -b --python`), in this order:
    load_source()      import the untouched GLB into a fresh scene
    fix_weights()      cloak behind the shoulders stops following the upper arm
    pose_arms_down()   natural hanging arms from the T-pose bind
    measure()          edge-stretch and hand-placement numbers for review
The source GLB is only read. Bone names, order and count stay exactly as in the source.

Findings that drive these steps (2026-10-17):
- the mesh is 1171 separate pieces (plates, straps, cloth strips), 248k verts, one grey material,
  no UVs; the bind pose is a T-pose with the model facing +X, height normalised to 1.0;
- the original smooth weights already keep the layered pauldron plates together when the arm
  goes down; per-piece rigid weights tore the plates apart (gaps), so they are NOT used;
- what does stretch is the cloak behind the shoulders, which carries upper-arm weights.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix

ROOT = globals().get("ASHEN_ROOT", r"C:\Users\alost\Desktop\Other\ASCII-Meadow")
SRC = ROOT + r"\experiments\three\assets\ashen-vow\ashen_tripo_v2_skeleton_lod.glb"
RIG, BODY = "Ashen_Rig", "Ashen_Body"

# Tripo names are not anatomical: the +Y arm is 0_Left_Limb_*, the -Y arm is bone_16..25.
ARM = {
    "L": dict(clav="tripo::0_Left_Limb_1", upper="tripo::0_Left_Limb_2", fore="tripo::0_Left_Limb_3",
              hand="tripo::0_Left_Limb_4", fingers=["bone_10", "bone_11", "bone_12"],
              thumb=["tripo::0_Left_Limb_5", "tripo::0_Left_Limb_6", "tripo::0_Left_Limb_7"], side=1),
    "R": dict(clav="bone_16", upper="bone_17", fore="bone_18", hand="bone_19",
              fingers=["bone_20", "bone_21", "bone_22"], thumb=["bone_23", "bone_24", "bone_25"], side=-1),
}
LEG = {"L": ["tripo::1_Right_Limb_0", "tripo::1_Right_Limb_1", "tripo::1_Right_Limb_2",
             "tripo::1_Right_Limb_3", "tripo::1_Right_Limb_4"],
       "R": ["tripo::1_Left_Limb_0", "tripo::1_Left_Limb_1", "tripo::1_Left_Limb_2",
             "tripo::1_Left_Limb_3", "tripo::1_Left_Limb_4"]}
CLOAK = ["tripo::0_Right_Limb_0", "tripo::0_Right_Limb_1", "tripo::0_Right_Limb_2", "tripo::0_Right_Limb_3"]


def rig():
    return bpy.data.objects[RIG]


def body():
    return bpy.data.objects[BODY]


def load_source():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    wm = bpy.context.window_manager
    if wm.windows:
        with bpy.context.temp_override(window=wm.windows[0]):
            bpy.ops.import_scene.gltf(filepath=SRC)
    else:
        bpy.ops.import_scene.gltf(filepath=SRC)
    stray = bpy.data.objects.get("Icosphere")        # a leftover 42-vertex sphere in the source GLB
    if stray:
        bpy.data.objects.remove(stray, do_unlink=True)
    next(o for o in bpy.data.objects if o.type == "ARMATURE").name = RIG
    next(o for o in bpy.data.objects if o.type == "MESH").name = BODY
    assert len(rig().data.bones) == 40, "the source rig must have 40 bones"
    return rig(), body()


def world_co(me):
    n = len(me.data.vertices)
    co = np.empty(n * 3)
    me.data.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    return (np.c_[co, np.ones(n)] @ np.array(me.matrix_world).T)[:, :3]


def islands(me):
    """Connected pieces of the mesh (label per vertex)."""
    bm = bmesh.new()
    bm.from_mesh(me.data)
    bm.verts.ensure_lookup_table()
    n = len(bm.verts)
    lab = np.full(n, -1)
    adj = [[e.other_vert(v).index for e in v.link_edges] for v in bm.verts]
    k = 0
    for s in range(n):
        if lab[s] >= 0:
            continue
        stack = [s]
        lab[s] = k
        while stack:
            i = stack.pop()
            for j in adj[i]:
                if lab[j] < 0:
                    lab[j] = k
                    stack.append(j)
        k += 1
    bm.free()
    return lab


CLOAK_X = (-0.005, -0.055)    # behind the arm axis: arm weight fades out over this depth
CLOAK_Z = (0.40, 0.90)


def fix_weights():
    """The cape behind the shoulders stops swinging with the arm: per vertex, a share of its
    upper-arm/forearm/hand weight moves to the clavicle of the same side, growing from nothing at
    the arm's axis to all of it 5 cm behind. Per vertex, not per piece: where the cloak meets the
    pauldron both keep moving together (a per-piece cut opened a hole there)."""
    me = body()
    G = me.vertex_groups
    co = world_co(me)
    arm_groups = {s: {G[n].index for n in [a["upper"], a["fore"], a["hand"], *a["fingers"], *a["thumb"]]}
                  for s, a in ARM.items()}
    x0, x1 = CLOAK_X
    t = np.clip((co[:, 0] - x0) / (x1 - x0), 0, 1)
    f = t * t * (3 - 2 * t)
    f[(co[:, 2] < CLOAK_Z[0]) | (co[:, 2] > CLOAK_Z[1])] = 0
    moved = 0
    for j in np.where(f > 0)[0].tolist():
        v = me.data.vertices[j]
        for s, a in ARM.items():
            ws = [(g.group, g.weight) for g in v.groups if g.group in arm_groups[s]]
            w = sum(x for _, x in ws)
            if w <= 0:
                continue
            for gi, x in ws:
                G[gi].add([j], x * (1 - f[j]), "REPLACE")
            G[a["clav"]].add([j], w * f[j], "ADD")
            moved += 1
    return moved + fix_armpits(co, arm_groups)


ARMPIT_IN = (0.015, 0.06)     # inward from the shoulder joint: arm weight fades out over this
ARMPIT_BELOW = 0.025          # only below the joint, so the pauldron's crown keeps its weights


def fix_armpits(co, arm_groups):
    """The chest plates by the armpit stop being dragged by the upper arm (they crumpled when the
    arm came down): inward of the shoulder joint and below it, arm weight moves to the clavicle."""
    me = body()
    G = me.vertex_groups
    A = rig().matrix_world
    moved = 0
    for s, a in ARM.items():
        sh = A @ rig().data.bones[a["upper"]].head_local
        inward = abs(sh.y) - co[:, 1] * a["side"]          # > 0 towards the spine
        t = np.clip((inward - ARMPIT_IN[0]) / (ARMPIT_IN[1] - ARMPIT_IN[0]), 0, 1)
        f = t * t * (3 - 2 * t)
        f[(co[:, 2] > sh.z - ARMPIT_BELOW) | (co[:, 2] < sh.z - 0.30) | (co[:, 1] * a["side"] < 0)] = 0
        for j in np.where(f > 0)[0].tolist():
            v = me.data.vertices[j]
            ws = [(g.group, g.weight) for g in v.groups if g.group in arm_groups[s]]
            w = sum(x for _, x in ws)
            if w <= 0:
                continue
            for gi, x in ws:
                G[gi].add([j], x * (1 - f[j]), "REPLACE")
            G[a["clav"]].add([j], w * f[j], "ADD")
            moved += 1
    return moved


def wrot(pb, axis, deg):
    """Rotate a pose bone about its head, in world space."""
    A = rig().matrix_world
    M = A @ pb.matrix
    head = M.to_translation()
    R = Matrix.Translation(head) @ Matrix.Rotation(math.radians(deg), 4, axis) @ Matrix.Translation(-head)
    pb.matrix = A.inverted() @ R @ M
    bpy.context.view_layer.update()


# Natural hanging arms: down from the T-pose, a little forward, soft elbow.
ARM_DOWN = 74
ARM_FORWARD = 6
ELBOW_BEND = 14


def pose_arms_down(reset=True):
    P = rig().pose.bones
    if reset:
        for pb in P:
            pb.matrix_basis = Matrix()
        bpy.context.view_layer.update()
    for s, a in ARM.items():
        wrot(P[a["upper"]], "X", -a["side"] * ARM_DOWN)
        wrot(P[a["upper"]], "Y", -ARM_FORWARD)      # swing towards +X (the knight's front)
        wrot(P[a["fore"]], "Y", -ELBOW_BEND)


def measure(tag=""):
    """Edge stretch of the posed mesh against the bind, and where the wrists ended up."""
    me = body()
    bpy.context.view_layer.update()
    ev = me.evaluated_get(bpy.context.evaluated_depsgraph_get())
    m2 = ev.to_mesh()
    n = len(me.data.vertices)
    r = np.empty(n * 3); me.data.vertices.foreach_get("co", r); r = r.reshape(-1, 3)
    p = np.empty(n * 3); m2.vertices.foreach_get("co", p); p = p.reshape(-1, 3)
    ev.to_mesh_clear()
    E = np.empty(len(me.data.edges) * 2, dtype=np.int64)
    me.data.edges.foreach_get("vertices", E)
    E = E.reshape(-1, 2)
    lr = np.linalg.norm(r[E[:, 0]] - r[E[:, 1]], axis=1)
    lp = np.linalg.norm(p[E[:, 0]] - p[E[:, 1]], axis=1)
    s = np.abs(np.log(np.maximum(lp, 1e-9) / np.maximum(lr, 1e-9)))
    out = {"tag": tag, "edges": int(len(E)),
           "stretch_x1.5": int((s > math.log(1.5)).sum()),
           "stretch_x2": int((s > math.log(2)).sum()),
           "stretch_x3": int((s > math.log(3)).sum())}
    A = rig().matrix_world
    P = rig().pose.bones
    for side, a in ARM.items():
        sh, el, wr = (A @ P[a[k]].head for k in ("upper", "fore", "hand"))
        length = (el - sh).length + (wr - el).length
        out["wrist_" + side] = [round(x, 3) for x in wr]
        out["drop_" + side] = round((sh.z - wr.z) / length, 3)
    return out


def render_review(out_dir, prefix, views=None, size=(640, 760)):
    """Workbench evidence renders of the current pose: orthographic, studio light, same framing
    for every stage (bind, repaired) so the PNGs compare one to one."""
    import os
    from mathutils import Vector
    sc = bpy.context.scene
    cam = bpy.data.objects.get("QC_Camera")
    if cam is None:
        cam = bpy.data.objects.new("QC_Camera", bpy.data.cameras.new("QC_Camera"))
        sc.collection.objects.link(cam)
    cam.data.type = "ORTHO"
    cam.data.clip_end = 100
    sc.camera = cam
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "SINGLE"
    sc.display.shading.single_color = (0.55, 0.53, 0.5)
    sc.display.shading.show_cavity = True
    sc.render.image_settings.file_format = "PNG"
    sc.render.film_transparent = False
    views = views or {
        "front": ((0, 0, 0.5), (1, 0, 0.05), 1.15),
        "side": ((0, 0, 0.5), (0, 1, 0.05), 1.15),
        "back": ((0, 0, 0.5), (-1, 0, 0.05), 1.15),
        "shoulderL": ((0, 0.17, 0.74), (1, 0.45, 0.2), 0.36),
        "shoulderR": ((0, -0.17, 0.74), (1, -0.45, 0.2), 0.36),
        "backShoulders": ((-0.03, 0, 0.74), (-1, 0, 0.15), 0.5),
    }
    paths = []
    for name, (c, d, scale) in views.items():
        c = Vector(c)
        cam.data.ortho_scale = scale
        cam.location = c + Vector(d).normalized() * 5
        cam.rotation_euler = (c - cam.location).to_track_quat("-Z", "Y").to_euler()
        sc.render.resolution_x, sc.render.resolution_y = size
        sc.render.filepath = os.path.join(out_dir, f"{prefix}_{name}.png")
        bpy.ops.render.render(write_still=True)
        paths.append(sc.render.filepath)
    return paths


def apply_rest_pose():
    """The current pose (arms down) becomes the bind: the deformation is baked into the mesh,
    the pose applied as the armature's rest, and the mesh skinned again with the same groups.
    Animations then stay close to the bind, where linear blend skinning (Three.js) is clean."""
    arm, me = rig(), body()
    hidden = arm.hide_get()
    arm.hide_set(False)
    for o in bpy.context.selected_objects:
        o.select_set(False)
    mod = next(m for m in me.modifiers if m.type == "ARMATURE")
    with bpy.context.temp_override(object=me, active_object=me, selected_objects=[me]):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.select_all(action="SELECT")
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    m = me.modifiers.new("Armature", "ARMATURE")
    m.object = arm
    m.use_vertex_groups = True
    arm.hide_set(hidden)
    assert len(arm.data.bones) == 40 and len(me.vertex_groups) == 40
