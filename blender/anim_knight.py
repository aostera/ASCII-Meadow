"""ASCII Meadow: Masked Knight animation clips, bake and glTF export (replaces anim_walk.py).

Needs blender/masked_knight.blend after rig_masked_knight.py and cloak_sim_masked_knight.py.

Clips (24 fps):
  Idle    48 f loop   breathing, weight shifts; cloak settles from a still start
  Walk    32 f loop   two steps, 0.62 m/s (same motion as the old anim_walk.py)
  Run     20 f loop   two strides with a flight phase, ~1.9 m/s
  Jump    36 f once   load, take-off (f9), tuck, touch-down (f23), absorb, recover (in place: the
                      game owns the height of the jump arc; air time 14 f = 0.58 s)
  Crouch  24 f once   down onto the haunches and hold

How a clip is made (bake_clip):
  1. an authoring action "Author_<clip>" poses the IK rig every frame. Locomotion really travels
     (Root moves forward at the planted-foot speed) and the jump really leaves the ground, so the
     cloth cloak feels the motion;
  2. the cloth is simulated through the authoring range. The 63 cloak bones follow the simulated
     proxy through Damped Track constraints to empties pinned on proxy vertices;
  3. every exported bone's final pose (IK, constraints, cloth tracking included) is recorded and
     written as plain FK keys into the action "<clip>" with the Root zeroed, i.e. in place.
     That is what glTF/Three.js plays back: no IK, no cloth, no constraints needed there.

export_glb() writes experiments/three/assets/knight/masked_knight.glb with the clips as glTF
animations (NLA tracks), the skinned body decimated for the web and the sword on its bone.
render_clip() renders the 8 sprite directions of a clip for the ASCII pipeline.

Live Blender (MCP / execute_code): set KNIGHT_ROOT before exec, then call the functions.
"""
import bpy, math, os
from mathutils import Vector, Matrix, Quaternion

_g = globals()
ROOT = _g.get("KNIGHT_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V = Vector
FPS = 24
FEET = {"L": V((0.10, -0.17)), "R": V((-0.14, -0.17))}     # feet tracks (x, y) under the hips
IDLE_FEET = {"L": V((0.12, -0.22)), "R": V((-0.16, -0.13))}  # relaxed, slightly staggered stance
CLOAK_CHAINS = ["L4", "L3", "L2", "L1", "C", "R1", "R2", "R3", "R4"]
CLOAK_BONES = 7
PROXY_SUB = 3                      # proxy grid steps between cloak joints (cloak_sim_masked_knight.py)
GLB = os.path.join(ROOT, "experiments", "three", "assets", "knight", "masked_knight.glb")
WEB_TRIS = 40000                   # body triangles in the exported GLB

LOCO = {
    "Walk": dict(N=32, cycles=3, stride=0.50, stance=0.60, lift=0.13, heel=14, toe=28, bob=0.035,
                 rise=0.0, sway=0.022, yaw=6, roll=3, lean=2, chest_yaw=4, head_yaw=2,
                 arm=14, arm_r=6, fore=6, fore_bias=0, fore_r=0),
    "Run": dict(N=20, cycles=4, stride=0.95, stance=0.38, lift=0.26, heel=8, toe=38, bob=0.05,
                rise=0.035, sway=0.015, yaw=9, roll=2, lean=11, chest_yaw=7, head_yaw=3,
                arm=32, arm_r=14, fore=30, fore_bias=38, fore_r=18),
}
CLIPS = {"Idle": 48, "Walk": 32, "Run": 20, "Jump": 36, "Crouch": 24}
PREROLL = 16                       # still frames before one-shot clips so the cloak hangs at rest


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def rot_xyz(pitch=0.0, roll=0.0, yaw=0.0):
    """World rotation: pitch about X, roll about Y, yaw about Z (degrees)."""
    r = math.radians
    return Matrix.Rotation(r(yaw), 3, "Z") @ Matrix.Rotation(r(roll), 3, "Y") @ Matrix.Rotation(r(pitch), 3, "X")


# ---------------------------------------------------------------- posing

def reset_pose(arm, keep_root=True):
    for pb in arm.pose.bones:
        if keep_root and pb.name == "Root":
            continue
        pb.location = (0, 0, 0)
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.scale = (1, 1, 1)
    bpy.context.view_layer.update()


def turn(pb, rot, pivot=None):
    """Rotate a bone, as currently posed by its parents, about a world axis through its head."""
    bpy.context.view_layer.update()
    M = pb.matrix.copy()
    c = pivot if pivot is not None else M.to_translation()
    pb.matrix = Matrix.Translation(c) @ rot.to_4x4() @ Matrix.Translation(-c) @ M
    bpy.context.view_layer.update()


def shift(pb, d):
    bpy.context.view_layer.update()
    pb.matrix = Matrix.Translation(V(d)) @ pb.matrix
    bpy.context.view_layer.update()


def place_foot(arm, side, x, y, lift, pitch):
    """IK foot target: ankle at (x, y, rest height + lift) relative to Root, toe pitch (+ = up)."""
    P = arm.pose.bones
    ik = P[f"IK_Foot.{side}"]
    root = P["Root"].matrix @ P["Root"].bone.matrix_local.inverted()      # Root motion so far
    rest = ik.bone.matrix_local
    target = root @ V((x, y, rest.to_translation().z + lift))
    M = root @ rest
    M = Matrix.Translation(-M.to_translation()) @ M
    ik.matrix = Matrix.Translation(target) @ rot_xyz(pitch=-pitch).to_4x4() @ M
    bpy.context.view_layer.update()


def body(arm, hips=(0, 0, 0), hips_rot=(0, 0, 0), spine=(0, 0, 0), chest=(0, 0, 0), head=(0, 0, 0),
         arm_l=0.0, arm_r=0.0, fore_l=0.0, fore_r=0.0):
    """Upper body; rotations are (pitch, roll, yaw) in degrees."""
    P = arm.pose.bones
    shift(P["Hips"], hips)
    turn(P["Hips"], rot_xyz(*hips_rot))
    turn(P["Spine"], rot_xyz(*spine))
    turn(P["Chest"], rot_xyz(*chest))
    turn(P["Head"], rot_xyz(*head))
    turn(P["UpperArm.L"], rot_xyz(pitch=arm_l))
    turn(P["UpperArm.R"], rot_xyz(pitch=arm_r))
    turn(P["Forearm.L"], rot_xyz(pitch=fore_l))
    turn(P["Forearm.R"], rot_xyz(pitch=fore_r))


def loco_foot(L, p):
    """(y along the track, lift, pitch + = toe up) for phase p of one foot."""
    if p < L["stance"]:
        s = p / L["stance"]
        y = -L["stride"] / 2 + L["stride"] * s
        pitch = L["heel"] * (1 - smooth(s / 0.15)) - L["toe"] * smooth((s - 0.70) / 0.30)
        return y, 0.045 * smooth((s - 0.75) / 0.25), pitch
    s = (p - L["stance"]) / (1 - L["stance"])
    y = L["stride"] / 2 - L["stride"] * smooth(s)
    lift = 0.045 * (1 - smooth(s / 0.2)) + L["lift"] * math.sin(math.pi * s)
    pitch = -L["toe"] * (1 - smooth(s / 0.5)) + L["heel"] * smooth((s - 0.5) / 0.5)
    return y, lift, pitch


def pose_loco(arm, L, phi):
    reset_pose(arm)
    c, s2 = math.cos(2 * math.pi * phi), math.sin(2 * math.pi * phi)
    hz = -L["bob"] * (0.5 + 0.5 * math.cos(4 * math.pi * phi)) + L["rise"] * (0.5 - 0.5 * math.cos(4 * math.pi * phi))
    body(arm, hips=(L["sway"] * s2, 0, hz), hips_rot=(L["lean"] * 0.4, -L["roll"] * s2, -L["yaw"] * c),
         spine=(L["lean"] * 0.6, 0, L["yaw"] * 0.3 * c), chest=(0, L["roll"] * 0.5 * s2, L["chest_yaw"] * c),
         head=(-L["lean"] * 0.6, 0, -L["head_yaw"] * c),
         arm_l=L["arm"] * c, arm_r=-L["arm_r"] * c,
         fore_l=-(L["fore_bias"] + L["fore"] * max(0.0, -c)), fore_r=-(L["fore_r"]))
    for side, off in (("L", 0.0), ("R", 0.5)):
        y, lift, pitch = loco_foot(L, (phi + off) % 1.0)
        place_foot(arm, side, FEET[side].x, FEET[side].y + y, lift, pitch)


def pose_idle(arm, phi):
    reset_pose(arm)
    b = math.sin(2 * math.pi * phi)                      # one breath per cycle
    w = math.sin(2 * math.pi * phi + 1.3)                # slow weight shift
    body(arm, hips=(0.008 * w, 0, -0.004 - 0.004 * b), hips_rot=(0, -0.8 * w, 0),
         spine=(0.6 * b, 0, 0), chest=(-1.2 * b, 0.4 * w, 0), head=(0.8 * b, 0, 0.6 * w),
         arm_l=1.5 * b, arm_r=-0.8 * b)
    for side in ("L", "R"):
        place_foot(arm, side, IDLE_FEET[side].x, IDLE_FEET[side].y, 0.0, 0.0)


# one-shot clips: key poses (frame, values) blended with smoothstep
JUMP_KEYS = [  # f, hips_dz, spine, chest, head, feet_lift, feet_pitch, arm_l, arm_r, fore_l
    (0, 0.00, 0, 0, 0, 0.00, 0, 0, 0, 0),
    (6, -0.20, 16, 6, -10, 0.00, 0, -28, -10, -20),       # load
    (9, 0.03, -2, -4, 4, 0.00, -30, 30, 18, -10),          # push off, toes last
    (13, 0.00, 6, 2, -4, 0.24, 10, 22, 12, -35),           # tuck
    (18, 0.00, 4, 0, -2, 0.20, 12, 18, 10, -30),
    (21, 0.00, 2, 0, 0, 0.04, 14, 10, 6, -15),             # reach for the ground
    (23, -0.06, 6, 2, -2, 0.00, 4, 0, 0, -18),             # touch down
    (26, -0.18, 15, 6, -8, 0.00, 0, -10, -6, -25),         # absorb
    (34, 0.00, 0, 0, 0, 0.00, 0, 0, 0, 0),                 # recover
    (36, 0.00, 0, 0, 0, 0.00, 0, 0, 0, 0),
]
CROUCH_KEYS = [
    (0, 0.00, 0, 0, 0, 0.00, 0, 0, 0, 0),
    (10, -0.42, 22, 10, -18, 0.00, 0, 22, 12, -35),
    (24, -0.42, 22, 10, -18, 0.00, 0, 22, 12, -35),
]
JUMP_AIR = (9, 23, 0.40)           # authoring only: take-off, touch-down frames and apex (m);
                                   # 14 frames for 0.40 m is ~9.4 m/s2, so the cloth falls with him


def keyed(keys, f):
    for a, b in zip(keys, keys[1:]):
        if a[0] <= f <= b[0]:
            t = smooth((f - a[0]) / (b[0] - a[0]))
            return [lerp(x, y, t) for x, y in zip(a[1:], b[1:])]
    return list(keys[-1][1:])


def pose_keyed(arm, keys, f):
    reset_pose(arm)
    hz, sp, ch, hd, lift, pitch, al, ar, fl = keyed(keys, f)
    body(arm, hips=(0, 0, hz), spine=(sp, 0, 0), chest=(ch, 0, 0), head=(hd, 0, 0),
         arm_l=al, arm_r=ar, fore_l=fl, fore_r=fl * 0.5)
    for side in ("L", "R"):
        place_foot(arm, side, IDLE_FEET[side].x, IDLE_FEET[side].y, lift, pitch)


# ---------------------------------------------------------------- authoring actions

AUTHOR_BONES = ["Root", "Hips", "Spine", "Chest", "Head", "UpperArm.L", "UpperArm.R",
                "Forearm.L", "Forearm.R", "IK_Foot.L", "IK_Foot.R"]


def author(arm, clip):
    """Build Author_<clip>; returns (first, last) frames of the simulated range and the export range."""
    name = f"Author_{clip}"
    old = bpy.data.actions.get(name)
    if old:
        bpy.data.actions.remove(old)
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data_create()
    arm.animation_data.action = act
    P = arm.pose.bones
    n = CLIPS[clip]
    if clip in LOCO:
        L = LOCO[clip]
        frames = range(1, n * L["cycles"] + 1)
        speed = L["stride"] / (L["stance"] * n)
        export = (n * (L["cycles"] - 1) + 1, n * L["cycles"])
    elif clip == "Idle":
        frames = range(1, n * 2 + 1)
        export = (n + 1, 2 * n)
    else:
        frames = range(1, PREROLL + n + 1)
        export = (PREROLL + 1, PREROLL + n)
    for f in frames:
        P["Root"].location = (0, 0, 0)
        P["Root"].rotation_mode = "QUATERNION"
        P["Root"].rotation_quaternion = (1, 0, 0, 0)
        if clip in LOCO:
            P["Root"].location = (0, -speed * (f - 1), 0)
        elif clip == "Jump":
            t0, t1, h = JUMP_AIR
            k = f - PREROLL - 1
            if t0 < k < t1:
                u = (k - t0) / (t1 - t0)
                P["Root"].location = (0, 0, 4 * h * u * (1 - u))
        bpy.context.view_layer.update()
        if clip in LOCO:
            pose_loco(arm, LOCO[clip], ((f - 1) % n) / n)
        elif clip == "Idle":
            pose_idle(arm, ((f - 1) % n) / n)
        else:
            k = max(0, f - PREROLL - 1)
            pose_keyed(arm, JUMP_KEYS if clip == "Jump" else CROUCH_KEYS, k)
        for b in AUTHOR_BONES:
            P[b].keyframe_insert("location", frame=f)
            P[b].keyframe_insert("rotation_quaternion", frame=f)
    return act, (frames[0], frames[-1]), export


# ---------------------------------------------------------------- cloak tracking for the bake

def cloak_tracking(arm, on=True):
    """Cloak bones aim at empties pinned on the simulated proxy (one per bone tail)."""
    proxy = bpy.data.objects["Knight_CloakProxy"]
    nu = (len(CLOAK_CHAINS) - 1) * PROXY_SUB + 1
    coll = proxy.users_collection[0]
    for ci, chain in enumerate(CLOAK_CHAINS):
        for k in range(1, CLOAK_BONES + 1):
            name = f"Trk_{chain}_{k}"
            pb = arm.pose.bones[f"Cloak_{chain}_{k}"]
            con = pb.constraints.get("ClothTrack")
            emp = bpy.data.objects.get(name)
            if not on:
                if con:
                    pb.constraints.remove(con)
                if emp:
                    bpy.data.objects.remove(emp, do_unlink=True)
                continue
            if emp is None:
                emp = bpy.data.objects.new(name, None)
                emp.empty_display_size = 0.02
                coll.objects.link(emp)
            emp.parent = proxy
            emp.parent_type = "VERTEX"
            emp.parent_vertices = [k * PROXY_SUB * nu + ci * PROXY_SUB, 0, 0]
            emp.matrix_parent_inverse = Matrix()
            emp.location = (0, 0, 0)
            emp.hide_render = True
            if con is None:
                con = pb.constraints.new("DAMPED_TRACK")
                con.name = "ClothTrack"
            con.target = emp
            con.track_axis = "TRACK_Y"


def reset_cloth():
    for ob in bpy.data.objects:
        for m in ob.modifiers:
            if m.type == "CLOTH":
                m.show_viewport = False
                bpy.context.view_layer.update()
                m.show_viewport = True


# ---------------------------------------------------------------- bake

def export_bones(arm):
    skip = ("IK_Foot.", "Pole_Knee.")
    return [b for b in arm.data.bones if not b.name.startswith(skip)]


def bake_clip(clip):
    """Author, simulate, record the final pose and write the in-place FK action <clip>."""
    sc = bpy.context.scene
    arm = bpy.data.objects["Knight_Rig"]
    bpy.data.objects["Knight_Root"].rotation_euler = (0, 0, 0)
    act, (f0, f1), (e0, e1) = author(arm, clip)
    sc.frame_start, sc.frame_end = f0, f1
    for ob in bpy.data.objects:
        for m in ob.modifiers:
            if m.type == "CLOTH":
                m.point_cache.frame_start, m.point_cache.frame_end = f0, f1
    cloak_tracking(arm, True)
    reset_cloth()
    bones = export_bones(arm)
    rec = {}
    for f in range(f0, f1 + 1):
        sc.frame_set(f)
        if e0 <= f <= e1:
            rec[f] = {b.name: arm.pose.bones[b.name].matrix.copy() for b in bones}
    out = bpy.data.actions.get(clip)
    if out:
        bpy.data.actions.remove(out)
    out = bpy.data.actions.new(clip)
    out.use_fake_user = True
    arm.animation_data.action = out
    prev = {}
    for f in range(e0, e1 + 1):
        frame = f - e0 + 1
        for b in bones:
            pb = arm.pose.bones[b.name]
            pose = rec[f][b.name]
            if b.parent:
                local_rest = b.parent.matrix_local.inverted() @ b.matrix_local
                local = rec[f][b.parent.name].inverted() @ pose
            else:
                local_rest = b.matrix_local
                local = pose
            basis = local_rest.inverted() @ local
            loc, q, scl = basis.decompose()
            if b.name == "Root":
                loc, q = V((0, 0, 0)), Quaternion()       # in place: the game moves the knight
            if b.name in prev:
                q.make_compatible(prev[b.name])
            prev[b.name] = q.copy()
            pb.rotation_mode = "QUATERNION"
            pb.location, pb.rotation_quaternion, pb.scale = loc, q, (1, 1, 1)
            for path in ("location", "rotation_quaternion", "scale"):
                pb.keyframe_insert(path, frame=frame)
    cloak_tracking(arm, False)
    sc.frame_start, sc.frame_end = 1, e1 - e0 + 1
    print("BAKED", clip, "frames", e1 - e0 + 1, "bones", len(bones))
    return out


# ---------------------------------------------------------------- playback of the baked clips

def play_baked(clip):
    """Show a baked clip the way glTF will: FK keys only, no IK, no cloth, no Surface Deform."""
    arm = bpy.data.objects["Knight_Rig"]
    body = bpy.data.objects["Knight_Body"]
    for pb in arm.pose.bones:
        for c in pb.constraints:
            c.mute = True
    for m in body.modifiers:
        if m.type == "SURFACE_DEFORM":
            m.show_viewport = m.show_render = False
    arm.animation_data.action = bpy.data.actions[clip]
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, CLIPS[clip]
    sc.frame_set(1)


def play_authoring():
    arm = bpy.data.objects["Knight_Rig"]
    body = bpy.data.objects["Knight_Body"]
    for pb in arm.pose.bones:
        for c in pb.constraints:
            c.mute = False
    for m in body.modifiers:
        if m.type == "SURFACE_DEFORM":
            m.show_viewport = m.show_render = True


# ---------------------------------------------------------------- export

def export_glb(path=GLB, clips=None):
    clips = clips or list(CLIPS)
    arm = bpy.data.objects["Knight_Rig"]
    body = bpy.data.objects["Knight_Body"]
    sword = bpy.data.objects["Knight_Sword"]
    play_baked(clips[0])
    arm.animation_data.action = None
    for t in list(arm.animation_data.nla_tracks):
        arm.animation_data.nla_tracks.remove(t)
    for clip in clips:
        tr = arm.animation_data.nla_tracks.new()
        tr.name = clip
        tr.strips.new(clip, 1, bpy.data.actions[clip])
    dec = body.modifiers.new("WebDecimate", "DECIMATE")
    dec.ratio = min(1.0, WEB_TRIS / max(1, len(body.data.polygons)))
    dec.use_collapse_triangulate = True
    body.modifiers.move(body.modifiers.find("WebDecimate"), 0)   # decimate before skinning
    for o in bpy.context.view_layer.objects:
        o.select_set(o in (arm, body, sword))
    bpy.context.view_layer.objects.active = arm
    os.makedirs(os.path.dirname(path), exist_ok=True)
    wm = bpy.context.window_manager
    win = bpy.context.window or (wm.windows[0] if wm.windows else None)
    kw = dict(filepath=path, export_format="GLB", use_selection=True, export_apply=True,
              export_animations=True, export_animation_mode="NLA_TRACKS", export_skins=True,
              export_def_bones=False, export_force_sampling=True, export_vertex_color="MATERIAL",
              export_yup=True, export_optimize_animation_size=True, export_cameras=False,
              export_lights=False, export_materials="EXPORT", export_morph=False)
    try:
        if win:
            with bpy.context.temp_override(window=win):
                bpy.ops.export_scene.gltf(**kw)
        else:
            bpy.ops.export_scene.gltf(**kw)
    finally:
        body.modifiers.remove(body.modifiers["WebDecimate"])
        for t in list(arm.animation_data.nla_tracks):
            arm.animation_data.nla_tracks.remove(t)
        play_authoring()
    print("EXPORTED", path, round(os.path.getsize(path) / 1024), "KB")
    return path


# ---------------------------------------------------------------- sprite renders

DIRS = [("01_front", 0), ("02_front_right", 45), ("03_right", 90), ("04_back_right", 135),
        ("05_back", 180), ("06_back_left", 225), ("07_left", 270), ("08_front_left", 315)]


def render_clip(clip, dirs=None, out=None, percent=100, baked=False):
    """Render the 8 sprite directions of a clip (authoring rig + live cloth, or the baked FK)."""
    sc = bpy.context.scene
    arm = bpy.data.objects["Knight_Rig"]
    root_empty = bpy.data.objects["Knight_Root"]
    cam = sc.camera
    out = out or os.path.join(ROOT, "blender", "anim", clip.lower())
    saved = (cam.location.copy(), cam.rotation_euler.copy(), sc.render.resolution_percentage)
    sc.render.resolution_percentage = percent
    if baked:
        play_baked(clip)
        first, frames = 1, list(range(1, CLIPS[clip] + 1))
    else:
        act, (f0, f1), (e0, e1) = author(arm, clip)
        sc.frame_start, sc.frame_end = f0, f1
        for ob in bpy.data.objects:
            for m in ob.modifiers:
                if m.type == "CLOTH":
                    m.point_cache.frame_start, m.point_cache.frame_end = f0, f1
        first, frames = e0, list(range(e0, e1 + 1))
    done = 0
    for name, deg in DIRS:
        if dirs and name not in dirs:
            continue
        root_empty.rotation_euler = (0, 0, math.radians(deg))
        reset_cloth()
        sc.frame_set(1 if baked else sc.frame_start)
        os.makedirs(os.path.join(out, name), exist_ok=True)
        for f in range(sc.frame_start, max(frames) + 1):
            sc.frame_set(f)
            if f in frames:
                rp = arm.matrix_world @ arm.pose.bones["Root"].head
                target = V((rp.x, rp.y, 0.98))
                cam.location = target + V((0, -math.cos(math.radians(12)), math.sin(math.radians(12)))) * 12
                cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
                sc.render.filepath = os.path.join(out, name, f"{clip.lower()}_{f - first:04d}.png")
                bpy.ops.render.render(write_still=True)
                done += 1
    root_empty.rotation_euler = (0, 0, 0)
    cam.location, cam.rotation_euler, sc.render.resolution_percentage = saved
    if baked:
        play_authoring()
    print("RENDERED", clip, done)
