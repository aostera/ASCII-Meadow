"""ASCII Meadow: cloth simulation for the Masked Knight's cloak (run after rig_masked_knight.py).

Why a proxy: the cloak is fused into the 80k-triangle body. Simulating that directly is slow and
unstable, so a light sheet (Knight_CloakProxy, 25 x 22 vertices) is laid over the 63 cloak bones,
pinned at the shoulders and simulated as cloth with the legs and pelvis as colliders. The real
cloak on Knight_Body follows the proxy through a Surface Deform modifier, weighted by the
"CloakSim" vertex group (0 at the shoulders, 1 from the small of the back down).

Stack on Knight_Body: Armature -> Surface Deform (proxy, group CloakSim).
Stack on the proxy:  Armature (weights to the cloak bones) -> Cloth (pin group "Pin").
The sim reads whatever action the rig plays; re-bake after changing the animation
(scene.frame_set through the range, or Physics > Cloth > Cache > Bake).

Also adds a test action "Test_Cloak" (run, sudden stop, quarter turn, jump) when KNIGHT_TEST is set.
Live Blender (MCP / execute_code): set KNIGHT_ROOT before exec.
"""
import bpy, bmesh, math
from mathutils import Vector, Matrix

_g = globals()
TEST = _g.get("KNIGHT_TEST", True)
V = Vector
CHAINS = ["L4", "L3", "L2", "L1", "C", "R1", "R2", "R3", "R4"]   # left front edge -> back -> right front edge
BONES_PER_CHAIN = 7
SUB_U, SUB_V = 3, 3              # proxy subdivisions between chains / along a chain
PUSH_OUT = 0.022                 # proxy sits on the cloak surface (the joints are 2.5 cm inside)
AXIS = V((-0.02, -0.20, 0.0))
PIN_ROWS = [1.0, 0.85, 0.55, 0.25]  # pin weight of the top proxy rows (shoulders), the rest is free
LEG_CUT = 0.25                   # leg-bone weight at which a body vertex stops following the cloth
HARD_BELOW = 0.60                # below this height a body vertex is either all cloth or all body
CLOAK_SURFACE = 0.09             # body vertices farther than this from the cloak proxy are not cloth
CRUMB_VERTS = 40                 # loose low islands smaller than this (tatter crumbs) are deleted
COLLIDERS = {  # bone: radius (m)
    "Hips": 0.17, "Thigh.L": 0.105, "Thigh.R": 0.105, "Shin.L": 0.085, "Shin.R": 0.085,
}


def log(*a):
    print("CLOAK", *a)


def ctx():
    wm = bpy.context.window_manager
    win = bpy.context.window or (wm.windows[0] if wm.windows else None)
    return {"window": win} if win else {}


def remove(name):
    ob = bpy.data.objects.get(name)
    if ob:
        me = ob.data if ob.type == "MESH" else None
        bpy.data.objects.remove(ob, do_unlink=True)
        if me and me.users == 0:
            bpy.data.meshes.remove(me)


def grid_points(arm):
    """9 x 8 joints of the cloak chains in rest position (armature space = world at rest)."""
    G = []
    for c in CHAINS:
        col = [arm.data.bones[f"Cloak_{c}_{k + 1}"].head_local.copy() for k in range(BONES_PER_CHAIN)]
        col.append(arm.data.bones[f"Cloak_{c}_{BONES_PER_CHAIN}"].tail_local.copy())
        G.append(col)
    return G


def catmull(p0, p1, p2, p3, t):
    t2, t3 = t * t, t * t * t
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)


def sample(G, u, v):
    """Smooth surface through the joint grid: u across chains, v down a chain (grid units)."""
    nu, nv = len(G), len(G[0])

    def along(ci, v):
        col = G[max(0, min(nu - 1, ci))]
        k = min(int(v), nv - 2)
        t = v - k
        return catmull(col[max(k - 1, 0)], col[k], col[k + 1], col[min(k + 2, nv - 1)], t)

    i = min(int(u), nu - 2)
    t = u - i
    return catmull(along(i - 1, v), along(i, v), along(i + 1, v), along(i + 2, v), t)


def build_proxy(arm, coll):
    remove("Knight_CloakProxy")
    G = grid_points(arm)
    nu = (len(G) - 1) * SUB_U + 1
    nv = (len(G[0]) - 1) * SUB_V + 1
    bm = bmesh.new()
    verts = []
    for r in range(nv):
        row = []
        for c in range(nu):
            p = sample(G, c / SUB_U, r / SUB_V)
            d = V((p.x - AXIS.x, p.y - AXIS.y, 0))
            if d.length > 1e-6:
                p = p + d.normalized() * PUSH_OUT
            row.append(bm.verts.new(p))
        verts.append(row)
    for r in range(nv - 1):
        for c in range(nu - 1):
            bm.faces.new((verts[r][c], verts[r][c + 1], verts[r + 1][c + 1], verts[r + 1][c]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("Knight_CloakProxy")
    bm.to_mesh(me)
    bm.free()
    proxy = bpy.data.objects.new("Knight_CloakProxy", me)
    coll.objects.link(proxy)
    proxy.parent = arm
    proxy.hide_render = True
    proxy.display_type = "WIRE"

    # skin weights: each vertex between two chains, on one bone of each
    groups = {}
    for r in range(nv):
        k = min(r // SUB_V, BONES_PER_CHAIN - 1)
        for c in range(nu):
            idx = r * nu + c
            ci, f = divmod(c, SUB_U)
            f /= SUB_U
            for chain, w in ((CHAINS[ci], 1 - f), (CHAINS[min(ci + 1, len(CHAINS) - 1)], f)):
                if w <= 0:
                    continue
                name = f"Cloak_{chain}_{k + 1}"
                g = groups.get(name) or proxy.vertex_groups.new(name=name)
                groups[name] = g
                g.add([idx], w, "ADD")
    pin = proxy.vertex_groups.new(name="Pin")
    for r, w in enumerate(PIN_ROWS):
        pin.add([r * nu + c for c in range(nu)], w, "REPLACE")
    m = proxy.modifiers.new("Armature", "ARMATURE")
    m.object = arm

    cl = proxy.modifiers.new("Cloth", "CLOTH")
    s = cl.settings
    s.quality = 10
    s.mass = 0.45
    s.air_damping = 1.5
    s.tension_stiffness = s.compression_stiffness = 25
    s.shear_stiffness = 8
    s.bending_stiffness = 1.5
    s.tension_damping = s.compression_damping = 5
    s.vertex_group_mass = "Pin"
    s.pin_stiffness = 2.0
    c = cl.collision_settings
    c.use_collision = True
    c.distance_min = 0.012
    c.use_self_collision = False
    sc = bpy.context.scene
    cl.point_cache.frame_start = sc.frame_start
    cl.point_cache.frame_end = sc.frame_end
    log("proxy", nu, "x", nv, "=", len(me.vertices), "verts")
    return proxy


def build_colliders(arm, coll):
    for ob in [o for o in bpy.data.objects if o.name.startswith("Knight_Collider_")]:
        remove(ob.name)
    for bname, r in COLLIDERS.items():
        b = arm.data.bones[bname]
        h, t = b.head_local, b.tail_local
        L = (t - h).length
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=r, radius2=r * 0.9, depth=L + r)
        me = bpy.data.meshes.new(f"Knight_Collider_{bname}")
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(f"Knight_Collider_{bname}", me)
        coll.objects.link(ob)
        q = V((0, 0, 1)).rotation_difference((t - h).normalized())
        mw = Matrix.Translation((h + t) / 2) @ q.to_matrix().to_4x4()
        ob.parent = arm
        ob.parent_type = "BONE"
        ob.parent_bone = bname
        ob.matrix_world = arm.matrix_world @ mw
        ob.hide_render = True
        ob.display_type = "WIRE"
        col = ob.modifiers.new("Collision", "COLLISION")
        ob.collision.thickness_outer = 0.02
        ob.collision.damping = 0.6
    log("colliders", list(COLLIDERS))


def sim_weights(body):
    """How much each body vertex belongs to the free cloak (cloak bones below the shoulders)."""
    idx = {g.index: g.name for g in body.vertex_groups}
    leg = ("Thigh.", "Shin.", "Foot.", "Toe.")
    out = []
    for v in body.data.vertices:
        w = leg_w = 0.0
        for ge in v.groups:
            name = idx.get(ge.group, "")
            if name.startswith("Cloak_"):
                k = int(name.rsplit("_", 1)[1])
                w += ge.weight * (0.0 if k == 1 else 0.5 if k == 2 else 1.0)
            elif name.startswith(leg):
                leg_w += ge.weight
        # anything noticeably on a leg bone is armour/boot, not free cloth (soft edge 0..LEG_CUT)
        w = min(1.0, w * max(0.0, 1.0 - leg_w / LEG_CUT))
        if v.co.z < HARD_BELOW:          # low down the legs swing far from the cloth: no in-between
            w = 1.0 if w >= 0.5 else 0.0
        out.append(w)
    return out


def cut_hem_from_boots(body, w):
    """The torn hem is fused to the boots in places; free those edges so a flying hem tip does not
    drag a strip of boot behind it."""
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bm.verts.ensure_lookup_table()
    cut = [e for e in bm.edges
           if all(v.co.z < HARD_BELOW for v in e.verts)
           and w[e.verts[0].index] != w[e.verts[1].index]]
    if cut:
        bmesh.ops.split_edges(bm, edges=cut)
        bm.to_mesh(body.data)
    bm.free()
    log("hem edges cut from the boots", len(cut))


def build_ground(coll):
    """A wide floor collider at z = 0 so the hem lies on the ground instead of sinking."""
    remove("Knight_Collider_Ground")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=15.0)
    me = bpy.data.meshes.new("Knight_Collider_Ground")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("Knight_Collider_Ground", me)
    coll.objects.link(ob)
    ob.hide_render = True
    ob.display_type = "WIRE"
    ob.modifiers.new("Collision", "COLLISION")
    ob.collision.thickness_outer = 0.01
    ob.collision.cloth_friction = 0.3          # the hem slides over the ground, it must not stick


def low_rigid_to_legs(arm, body, w):
    """Below HARD_BELOW a vertex that is not cloth must go with the legs: hanging on the cloak
    bones it would stay with the chest while the legs swing and stretch the mesh between."""
    idx = {g.index: g.name for g in body.vertex_groups}
    legs = [b for b in arm.data.bones if b.name.startswith(("Thigh.", "Shin.", "Foot.", "Toe."))]

    def nearest_leg(c):
        def dist(b):
            h, t = b.head_local, b.tail_local
            ab = t - h
            k = max(0.0, min(1.0, (c - h).dot(ab) / ab.length_squared))
            return (h + ab * k - c).length
        return min(legs, key=dist).name

    moved = 0
    for v in body.data.vertices:
        if v.co.z >= HARD_BELOW or w[v.index] > 0:
            continue
        cl = [(idx[g.group], g.weight) for g in v.groups if idx.get(g.group, "").startswith("Cloak_") and g.weight > 0]
        if not cl:
            continue
        for n, _ in cl:
            body.vertex_groups[n].remove([v.index])
        rest = [(idx[g.group], g.weight) for g in v.groups
                if idx[g.group] != "CloakSim" and g.weight > 0]
        tot = sum(x for _, x in rest)
        if tot > 1e-4:
            for n, x in rest:
                body.vertex_groups[n].add([v.index], x / tot, "REPLACE")
        else:
            body.vertex_groups[nearest_leg(v.co)].add([v.index], 1.0, "REPLACE")
        moved += 1
    log("low rigid verts moved to the legs", moved)


def cloak_only_on_cloth(arm, body, proxy):
    """Heat weights spill cloak-bone influence onto armour plates and legs 15-40 cm away from the
    cloth; those parts were dragged along by the cloak (a "board" flying off the hip in the run).
    Only vertices within CLOAK_SURFACE of the proxy sheet (it lies on the cloak) keep cloak
    weights; the rest goes back to the body and leg bones."""
    from mathutils.bvhtree import BVHTree
    pm = proxy.data
    tree = BVHTree.FromPolygons([v.co.copy() for v in pm.vertices], [p.vertices[:] for p in pm.polygons])
    idx = {g.index: g.name for g in body.vertex_groups}
    segs = [(b.name, b.head_local.copy(), b.tail_local.copy()) for b in arm.data.bones
            if b.use_deform and not b.name.startswith("Cloak_")]

    def nearest_body_bone(c):
        def dist(s):
            ab = s[2] - s[1]
            k = max(0.0, min(1.0, (c - s[1]).dot(ab) / ab.length_squared))
            return (s[1] + ab * k - c).length
        return min(segs, key=dist)[0]

    moved = 0
    for v in body.data.vertices:
        cl = [(idx[g.group], g.weight) for g in v.groups if idx.get(g.group, "").startswith("Cloak_") and g.weight > 0]
        if not cl:
            continue
        hit = tree.find_nearest(v.co)
        if hit[0] is not None and hit[3] <= CLOAK_SURFACE:
            continue
        for n, _ in cl:
            body.vertex_groups[n].remove([v.index])
        rest = [(idx[g.group], g.weight) for g in v.groups if idx[g.group] != "CloakSim" and g.weight > 0]
        tot = sum(x for _, x in rest)
        if tot > 1e-4:
            for n, x in rest:
                body.vertex_groups[n].add([v.index], x / tot, "REPLACE")
        else:
            body.vertex_groups[nearest_body_bone(v.co)].add([v.index], 1.0, "REPLACE")
        moved += 1
    log("off-cloth verts taken off the cloak bones", moved)


def bind_body(arm, body, proxy):
    for g in [g for g in body.vertex_groups if g.name == "CloakSim"]:
        body.vertex_groups.remove(g)
    cloak_only_on_cloth(arm, body, proxy)
    w = sim_weights(body)
    low_rigid_to_legs(arm, body, w)
    cut_hem_from_boots(body, w)
    w = sim_weights(body)
    # a triangle with both cloth and leg corners cannot be cut apart: drop those few slivers
    bm = bmesh.new()
    bm.from_mesh(body.data)
    mixed = [f for f in bm.faces if all(v.co.z < HARD_BELOW for v in f.verts)
             and len({w[v.index] for v in f.verts}) > 1]
    bmesh.ops.delete(bm, geom=mixed, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    # cutting the hem leaves a few tiny islands of tatter tips that float about: drop them
    bm.verts.ensure_lookup_table()
    seen, crumbs = set(), []
    for v in bm.verts:
        if v.index in seen:
            continue
        part, stack = [], [v]
        seen.add(v.index)
        while stack:
            x = stack.pop()
            part.append(x)
            for e in x.link_edges:
                o = e.other_vert(x)
                if o.index not in seen:
                    seen.add(o.index)
                    stack.append(o)
        if len(part) < CRUMB_VERTS and max(p.co.z for p in part) < HARD_BELOW:
            crumbs.extend(part)
    bmesh.ops.delete(bm, geom=crumbs, context="VERTS")
    bm.to_mesh(body.data)
    bm.free()
    log("mixed hem slivers removed", len(mixed), "| loose crumbs removed", len(crumbs), "verts")
    sim = body.vertex_groups.new(name="CloakSim")
    n = 0
    for i, w in enumerate(sim_weights(body)):
        if w > 0.01:
            sim.add([i], w, "REPLACE")
            n += 1
    for m in [m for m in body.modifiers if m.type == "SURFACE_DEFORM"]:
        body.modifiers.remove(m)
    sd = body.modifiers.new("CloakSim", "SURFACE_DEFORM")
    sd.target = proxy
    sd.vertex_group = "CloakSim"
    sd.falloff = 4.0
    bpy.context.scene.frame_set(bpy.context.scene.frame_start)
    with bpy.context.temp_override(**ctx(), object=body, active_object=body):
        bpy.ops.object.surfacedeform_bind(modifier=sd.name)
    log("body verts on the sim", n, "bound", sd.is_bound)


def test_action(arm):
    """Run forward, stop dead, quarter turn, jump: shows the cloak's inertia."""
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, 96
    sc.render.fps = 24
    arm.animation_data_create()
    act = bpy.data.actions.get("Test_Cloak") or bpy.data.actions.new("Test_Cloak")
    arm.animation_data.action = act
    for fc in list(getattr(act, "fcurves", [])):
        act.fcurves.remove(fc)
    P = arm.pose.bones
    for pb in P:
        pb.location = (0, 0, 0)
        pb.rotation_mode = "XYZ"
        pb.rotation_euler = (0, 0, 0)
    root, hips = P["Root"], P["Hips"]

    def key(f, loc=None, rot=None, hz=None):
        if loc is not None:
            root.location = (0, loc, 0)  # Root lies along world +Y: its local y is world Y
            root.keyframe_insert("location", frame=f)
        if rot is not None:
            root.rotation_euler = (0, 0, math.radians(rot))
            root.keyframe_insert("rotation_euler", frame=f)
        if hz is not None:
            hips.location = (0, hz, 0)   # Hips points up: its local y is world Z
            hips.keyframe_insert("location", frame=f)

    key(1, 0.0, 0, 0)
    key(10, 0.0, 0, 0)
    key(30, -0.9, 0, 0)       # run forward (-Y)
    key(34, -1.05, 0, 0)      # dead stop
    key(50, -1.05, 0, 0)
    key(62, -1.05, 90, 0)     # quarter turn
    key(70, None, 90, -0.12)  # crouch to jump
    key(78, None, 90, 0.35)   # up
    key(86, None, 90, 0.0)    # land
    key(96, -1.05, 90, 0)
    log("test action", act.name, sc.frame_start, "-", sc.frame_end)


def main():
    arm = bpy.data.objects["Knight_Rig"]
    body = bpy.data.objects["Knight_Body"]
    coll = body.users_collection[0]
    bpy.data.objects["Knight_Root"].rotation_euler = (0, 0, 0)
    sc = bpy.context.scene
    if TEST:
        test_action(arm)
    sc.frame_set(sc.frame_start)
    proxy = build_proxy(arm, coll)
    build_colliders(arm, coll)
    build_ground(coll)
    bind_body(arm, body, proxy)
    bpy.ops.wm.save_mainfile()
    log("saved", bpy.data.filepath)


main()
