"""The Ashen Vow: Idle / Walk / Run / Jump for the repaired Tripo knight (run after the repair).

All clips are authored in Python and keyed as plain FK (quaternions on every bone, location on
Root only), 60 fps, in place: the game moves the knight and owns the jump height. Legs use an
analytic two-bone IK solved per frame (hip -> knee -> ankle, knee towards +X), then a foot that
rolls heel -> flat -> ball -> toe; nothing but keyframes ends up in the action.

Axes (Blender, as imported): forward +X, the knight's left +Y, up +Z, height 1.0 (~1.9 m).
Rotating about +Y by a NEGATIVE angle swings a hanging limb forward.
"""
import math

import bpy
from mathutils import Matrix, Quaternion, Vector

FPS = 60
RIG = "Ashen_Rig"

LEGS = {  # side: (thigh, shin, foot, toe, toe tip), lateral sign
    "L": (["tripo::1_Right_Limb_0", "tripo::1_Right_Limb_1", "tripo::1_Right_Limb_2",
           "tripo::1_Right_Limb_3", "tripo::1_Right_Limb_4"], 1),
    "R": (["tripo::1_Left_Limb_0", "tripo::1_Left_Limb_1", "tripo::1_Left_Limb_2",
           "tripo::1_Left_Limb_3", "tripo::1_Left_Limb_4"], -1),
}
ARMS = {"L": ("tripo::0_Left_Limb_1", "tripo::0_Left_Limb_2", "tripo::0_Left_Limb_3", "tripo::0_Left_Limb_4"),
        "R": ("bone_16", "bone_17", "bone_18", "bone_19")}
SPINE = ["tripo::Spine_0", "tripo::Spine_1", "tripo::0_Left_Limb_0"]
HEAD = ["tripo::Head_0", "tripo::Head_1"]
CLOAK = ["tripo::0_Right_Limb_0", "tripo::0_Right_Limb_1", "tripo::0_Right_Limb_2", "tripo::0_Right_Limb_3"]
ROOT = "tripo::Root"

# clip: frames (60 fps), loop
CLIPS = {"Idle": (120, True), "Walk": (68, True), "Run": (84, True), "Jump": (72, False)}

# locomotion: one cycle = two steps; Run holds two cycles so its loop is >= 60 frames
LOCO = {
    "Walk": dict(cycle=68, cycles=1, stride=0.60, stance=0.62, lift=0.050, bob=0.010, drop=0.006,
                 lean=4.0, twist=6.0, arm=17.0, sword_arm=5.0, elbow=(12.0, 26.0), cloak=6.0, heel=16.0, toe=28.0),
    "Run": dict(cycle=42, cycles=2, stride=1.10, stance=0.38, lift=0.110, bob=0.022, drop=0.030,
                lean=13.0, twist=9.0, arm=32.0, sword_arm=7.0, elbow=(38.0, 62.0), cloak=24.0, heel=10.0, toe=38.0),
}


def rig():
    return bpy.data.objects[RIG]


class Poser:
    """World-space posing helpers that read rest data once (no depsgraph needed for rest)."""

    def __init__(self):
        self.ob = rig()
        self.A = self.ob.matrix_world.copy()
        self.Ai = self.A.inverted()
        B = self.ob.data.bones
        self.rest = {b.name: self.A @ b.matrix_local for b in B}
        self.len = {b.name: b.length for b in B}
        self.P = self.ob.pose.bones

    def update(self):
        bpy.context.view_layer.update()

    def reset(self):
        for pb in self.P:
            pb.matrix_basis = Matrix()
        self.update()

    def world(self, name):
        return self.A @ self.P[name].matrix

    def head(self, name):
        return self.world(name).translation

    def tail(self, name):
        return self.world(name) @ Vector((0, self.len[name], 0))

    def rotate(self, name, axis, deg, pivot=None):
        """Rotate a bone (and its children) in world space about a point (its head by default)."""
        M = self.world(name)
        p = M.translation if pivot is None else Vector(pivot)
        R = Matrix.Translation(p) @ Matrix.Rotation(math.radians(deg), 4, Vector(axis)) @ Matrix.Translation(-p)
        self.P[name].matrix = self.Ai @ R @ M
        self.update()

    def translate(self, name, delta):
        M = self.world(name)
        M = Matrix.Translation(Vector(delta)) @ M
        self.P[name].matrix = self.Ai @ M
        self.update()

    def aim(self, name, direction, head=None):
        """Point a bone along a world direction: the swing from its rest direction, applied to
        its rest orientation (keeps the rest roll), placed at its current (or given) head."""
        R = self.rest[name]
        rest_dir = (R.to_3x3() @ Vector((0, 1, 0))).normalized()
        q = rest_dir.rotation_difference(Vector(direction).normalized())
        M = (q.to_matrix() @ R.to_3x3()).to_4x4()
        M.translation = self.head(name) if head is None else Vector(head)
        self.P[name].matrix = self.Ai @ M
        self.update()


def smooth(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- legs
def solve_leg(ps, side, ankle, foot_pitch, toe_pitch):
    """Two-bone IK to a world ankle position, knee towards +X; then the foot pitched about the
    lateral axis (deg, + = toes up) and the toes bent back by toe_pitch (deg, + = toes up)."""
    (thigh, shin, foot, toe, tip), lat = LEGS[side]
    L1, L2 = ps.len[thigh], ps.len[shin]
    H = ps.head(thigh)
    T = Vector(ankle)
    d = T - H
    dist = min(d.length, (L1 + L2) * 0.999)
    u = d.normalized()
    T = H + u * dist
    a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist)
    h = math.sqrt(max(0.0, L1 * L1 - a * a))
    fwd = Vector((1, 0, 0))
    n = (fwd - fwd.dot(u) * u).normalized()
    K = H + u * a + n * h
    ps.aim(thigh, K - H)
    ps.aim(shin, T - K, head=K)
    axis = Vector((0, 1, 0))
    rest_foot = (ps.rest[foot].to_3x3() @ Vector((0, 1, 0))).normalized()
    fdir = Matrix.Rotation(math.radians(-foot_pitch), 3, axis) @ rest_foot
    ps.aim(foot, fdir, head=T)
    for b in (toe, tip):
        rest_toe = (ps.rest[b].to_3x3() @ Vector((0, 1, 0))).normalized()
        ps.aim(b, Matrix.Rotation(math.radians(-(foot_pitch + toe_pitch)), 3, axis) @ rest_toe)


def rest_contacts(ps):
    """Rest ankle, ball (foot tail) for each leg, in world space."""
    out = {}
    for side, (bones, _) in LEGS.items():
        thigh, shin, foot, toe, tip = bones
        ankle = ps.rest[foot].translation.copy()
        ball = ps.rest[foot] @ Vector((0, ps.len[foot], 0))
        out[side] = (ankle, ball)
    return out


def foot_cycle(phase, p, ankle0, ball0):
    """Ankle target and foot/toe pitch for one leg at a gait phase in [0,1) (0 = heel strike).
    In place: during stance the foot slides back under the body at the ground speed."""
    S, beta = p["stride"], p["stance"]
    half = S * (beta / 2)                  # stance spans [-half, +half] around the rest ankle
    if phase < beta:                       # stance: heel strike -> flat -> heel off -> ball
        t = phase / beta
        x = half - 2 * half * t
        pitch = 0.0
        if t < 0.12:                       # heel strike, toes coming down
            pitch = p["heel"] * (1 - smooth(t / 0.12))
        elif t > 0.70:                     # heel rises, rolling on the ball
            pitch = -p["toe"] * smooth((t - 0.70) / 0.30)
        ankle = ankle0 + Vector((x, 0, 0))
        toe_pitch = 0.0
        if pitch < 0:                      # pivot about the ball: ball stays put, ankle rises
            ball = ball0 + Vector((x, 0, 0))
            R = Matrix.Rotation(math.radians(-pitch), 3, Vector((0, 1, 0)))
            ankle = ball + R @ (ankle0 - ball0)
            toe_pitch = -pitch             # toes stay flat on the ground
        elif pitch > 0:                    # pivot about the heel point under the ankle
            heel = ankle0 + Vector((x - 0.02, 0, -ankle0.z + 0.004))
            R = Matrix.Rotation(math.radians(-pitch), 3, Vector((0, 1, 0)))
            ankle = heel + R @ (ankle0 + Vector((x, 0, 0)) - heel)
        return ankle, pitch, toe_pitch, x / half
    t = (phase - beta) / (1 - beta)        # swing: back -> forward, lifted
    s = smooth(t)
    x = -half + 2 * half * s
    z = p["lift"] * math.sin(math.pi * t) ** 1.3
    pitch = -p["toe"] * (1 - smooth(t / 0.35)) + p["heel"] * smooth((t - 0.6) / 0.4)
    return ankle0 + Vector((x, 0, z)), pitch, 0.0, x / half


# ---------------------------------------------------------------- body
def pose_upper(ps, lean, twist, breathe=0.0, head_counter=1.0):
    """Spine lean (deg forward), twist (deg, + turns the chest to the left), breathing (0..1)."""
    for i, b in enumerate(SPINE):
        ps.rotate(b, (0, 1, 0), lean / len(SPINE))
        ps.rotate(b, (0, 0, 1), twist / len(SPINE))
    ps.rotate(SPINE[-1], (0, 1, 0), -breathe * 1.2)        # chest rises a little
    # the head keeps looking ahead
    ps.rotate(HEAD[0], (0, 0, 1), -twist * head_counter * 0.8)
    ps.rotate(HEAD[0], (0, 1, 0), -lean * 0.6)


def pose_arm(ps, side, swing, elbow, out=0.0):
    """Shoulder swing (deg, + forward), elbow flex (deg, + bends), abduction (deg, + away)."""
    clav, upper, fore, hand = ARMS[side]
    ps.rotate(upper, (0, 1, 0), -swing)
    if out:
        ps.rotate(upper, (1, 0, 0), -out * (1 if side == "L" else -1))
    ps.rotate(fore, (0, 1, 0), -elbow)


def pose_cloak(ps, lift, sway=0.0, flutter=0.0):
    """The cape's chain: lift (deg) swings it back off the legs, sway (deg) side to side."""
    for i, b in enumerate(CLOAK):
        k = (i + 1) / len(CLOAK)
        ps.rotate(b, (0, 1, 0), lift * (0.45 + 0.25 * k) + flutter * k)
        if sway:
            ps.rotate(b, (1, 0, 0), sway * k)


# ---------------------------------------------------------------- clips
def pose_idle(ps, f, n):
    t = f / n
    br = 0.5 - 0.5 * math.cos(2 * math.pi * t)               # one breath per loop (2 s)
    shift = math.sin(2 * math.pi * t)
    ps.translate(ROOT, (0, 0.004 * shift, -0.003 * br))
    contacts = rest_contacts(ps)
    for side in ("L", "R"):
        ankle, ball = contacts[side]
        solve_leg(ps, side, ankle, 0.0, 0.0)
    pose_upper(ps, lean=1.5 + 0.8 * br, twist=0.8 * shift, breathe=br)
    pose_arm(ps, "L", swing=1.5 * br, elbow=3 * br)
    pose_arm(ps, "R", swing=0.8 * br, elbow=2 * br)
    pose_cloak(ps, lift=1.0 + 1.5 * br, sway=1.2 * shift)


def pose_loco(ps, f, n, p):
    cyc = p["cycle"]
    ph = (f % cyc) / cyc
    contacts = rest_contacts(ps)
    # pelvis: lowest just after each heel strike, highest mid-stance (walk); the run is lowest
    # mid-stance and highest in flight
    if p["stance"] > 0.5:
        bob = -p["bob"] * math.cos(4 * math.pi * (ph - 0.08))
    else:
        bob = p["bob"] * math.cos(4 * math.pi * (ph - p["stance"] / 2 - 0.25))
    sway = 0.006 * math.sin(2 * math.pi * ph) * (1 if p["stance"] > 0.5 else 0.5)
    ps.translate(ROOT, (0, sway, bob - p["drop"]))
    targets, fwd = {}, {}
    for side, off in (("L", 0.0), ("R", 0.5)):
        ankle0, ball0 = contacts[side]
        targets[side] = foot_cycle((ph + off) % 1.0, p, ankle0, ball0)
        fwd[side] = targets[side][3]            # -1 (behind) .. +1 (ahead)
    lead = (fwd["L"] - fwd["R"]) / 2            # + when the left leg leads
    # the pelvis turns with the leading leg (left hip forward = turn to the right, -Z)
    ps.rotate(ROOT, (0, 0, 1), -p["twist"] * 0.5 * lead, pivot=ps.head(SPINE[0]))
    for side in ("L", "R"):
        ankle, pitch, toe, _ = targets[side]
        solve_leg(ps, side, ankle, pitch, toe)
    # chest counter-turns; arms swing against their own leg
    pose_upper(ps, lean=p["lean"], twist=p["twist"] * lead)
    e0, e1 = p["elbow"]
    sl = -lead
    pose_arm(ps, "L", swing=p["arm"] * sl, elbow=e0 + (e1 - e0) * max(0.0, sl))
    # the sword arm swings little and cancels the body's lean, so the blade stays lowered
    pose_arm(ps, "R", swing=p["sword_arm"] * lead - p["lean"] * 0.9, elbow=e0 * 0.35 + 4.0 * max(0.0, lead))
    flutter = math.sin(4 * math.pi * ph + 1.0)
    pose_cloak(ps, lift=p["cloak"] + 0.25 * p["cloak"] * flutter, sway=2.0 * lead, flutter=2.5 * flutter)


JUMP = dict(load=(0, 16), takeoff=(16, 22), air=(22, 48), land=(48, 60), recover=(60, 72))


def pose_jump(ps, f, n):
    contacts = rest_contacts(ps)

    def seg(name):
        a, b = JUMP[name]
        return None if not (a <= f <= b) else (f - a) / (b - a)

    crouch, tuck, lift_feet, lean, arms, cloak = 0.0, 0.0, 0.0, 3.0, 0.0, 2.0
    if seg("load") is not None:
        k = smooth(seg("load"))
        crouch, lean, arms, cloak = 0.075 * k, 3 + 12 * k, -25 * k, 2 + 4 * k
    elif seg("takeoff") is not None:
        k = smooth(seg("takeoff"))
        crouch, lean, arms, cloak = 0.075 * (1 - k) - 0.01 * k, 15 - 9 * k, -25 + 55 * k, 6 - 8 * k
    elif seg("air") is not None:
        k = seg("air")
        up = math.sin(math.pi * k)
        tuck, lift_feet, lean, arms, cloak = up, 0.10 * up, 6 - 2 * up, 30 - 20 * k, -6 + 30 * k
    elif seg("land") is not None:
        k = seg("land")
        absorb = math.sin(math.pi * min(1.0, k * 1.4)) if k < 0.7 else 1 - smooth((k - 0.7) / 0.3) * 0.4
        crouch, lean, arms, cloak = 0.065 * absorb, 4 + 10 * absorb, 10 - 20 * absorb, 24 - 10 * k
    else:
        k = smooth(seg("recover"))
        crouch, lean, arms, cloak = 0.026 * (1 - k), 8 - 6 * k, -10 * (1 - k), 14 - 12 * k
    ps.translate(ROOT, (0, 0, -crouch + lift_feet * 0.0))
    for side in ("L", "R"):
        ankle, ball = contacts[side]
        # in the air the knees draw up under the body (the game lifts the whole knight)
        target = ankle + Vector((-0.02 * tuck, 0, 0.13 * tuck))
        pitch = -18 * tuck
        solve_leg(ps, side, target, pitch, 0.0)
    pose_upper(ps, lean=lean, twist=0.0)
    pose_arm(ps, "L", swing=arms, elbow=18 + 0.4 * abs(arms), out=6 * tuck)
    pose_arm(ps, "R", swing=arms * 0.5, elbow=14 + 0.3 * abs(arms), out=4 * tuck)
    pose_cloak(ps, lift=cloak)


def pose_clip(ps, clip, f):
    n, _ = CLIPS[clip]
    ps.reset()
    if clip == "Idle":
        pose_idle(ps, f, n)
    elif clip == "Jump":
        pose_jump(ps, f, n)
    else:
        pose_loco(ps, f, n, LOCO[clip])


def set_quaternion_mode():
    for pb in rig().pose.bones:
        pb.rotation_mode = "QUATERNION"


def body_modifiers(enabled):
    for o in bpy.data.objects:
        if o.type == "MESH":
            for m in o.modifiers:
                if m.type == "ARMATURE":
                    m.show_viewport = enabled


def bake_clip(clip):
    """Author one clip into an Action of the same name (60 fps, all 40 bones keyed)."""
    ob = rig()
    sc = bpy.context.scene
    sc.render.fps = FPS
    set_quaternion_mode()
    n, loop = CLIPS[clip]
    act = bpy.data.actions.get(clip)
    if act:
        bpy.data.actions.remove(act)
    act = bpy.data.actions.new(clip)
    act.use_fake_user = True
    ob.animation_data_create()
    ob.animation_data.action = act
    ps = Poser()
    body_modifiers(False)                   # posing 40 bones per frame without re-skinning 248k verts
    try:
        last = n if not loop else n        # a loop's last key equals its first
        for f in range(0, last + 1):
            pose_clip(ps, clip, f % n if loop else f)
            for pb in ps.P:
                pb.keyframe_insert("rotation_quaternion", frame=f, group=pb.name)
                if pb.name == ROOT:
                    pb.keyframe_insert("location", frame=f, group=pb.name)
    finally:
        body_modifiers(True)
    act.frame_range = (0, n)
    return act


def push_to_nla(clip):
    """Each clip on its own NLA track (the glTF exporter writes one animation per track)."""
    ob = rig()
    act = bpy.data.actions[clip]
    ad = ob.animation_data
    tr = ad.nla_tracks.get(clip) or ad.nla_tracks.new()
    tr.name = clip
    for s in list(tr.strips):
        tr.strips.remove(s)
    tr.strips.new(clip, 0, act)
    tr.mute = True


def foot_contact_report(clip):
    """How well the planted foot sticks: during stance the ball must sit on the ground and slide
    back at exactly the ground speed (in place). Returns max ball height and speed error."""
    ob = rig()
    n, _ = CLIPS[clip]
    ob.animation_data.action = bpy.data.actions[clip]
    sc = bpy.context.scene
    ps = Poser()
    body_modifiers(False)
    out = {}
    try:
        if clip not in LOCO:
            return out
        p = LOCO[clip]
        v = p["stride"] / (p["cycle"] / FPS)
        for side, off in (("L", 0.0), ("R", 0.5)):
            (thigh, shin, foot, toe, tip), _ = LEGS[side]
            prev, hmax, errs = None, 0.0, []
            for f in range(n + 1):
                sc.frame_set(f)
                ph = ((f % p["cycle"]) / p["cycle"] + off) % 1.0
                ball = ps.tail(foot)
                if ph < p["stance"] * 0.95 and ph > 0.12 * p["stance"]:
                    hmax = max(hmax, ball.z - ps.rest[foot].translation.z * 0 - 0.0)
                    if prev is not None:
                        errs.append(abs((prev.x - ball.x) * FPS - v))
                    prev = ball
                else:
                    prev = None
            out[side] = dict(max_ball_z=round(hmax, 4), speed=round(v, 3),
                             max_slide_error=round(max(errs) if errs else 0.0, 4))
    finally:
        body_modifiers(True)
    return out


# ---------------------------------------------------------------- export
import os

ROOT_DIR = globals().get("ASHEN_ROOT", r"C:\Users\alost\Desktop\Other\ASCII-Meadow")
GLB = os.path.join(ROOT_DIR, "experiments", "three", "assets", "ashen-vow", "ashen_tripo_blender_repaired_v01.glb")
WEB_TRIS = 70000            # 400k source triangles; at 70k the hood, plates and tatters still read
MOBILE_TRIS = 30000         # phones/tablets (pointer:coarse): about 2.3x lighter to skin and raster
GLB_MOBILE = GLB.replace("_v01.glb", "_v01_mobile.glb")


def web_body(body, tris=WEB_TRIS):
    """A decimated copy of the body for export: same vertex groups, colours and material, its
    own Armature modifier. Decimating once here instead of in the modifier stack keeps the
    exporter from re-decimating 400k triangles on every sampled animation frame."""
    old = bpy.data.objects.get("Ashen_Body_Web")
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    web = body.copy()
    web.data = body.data.copy()
    web.name = web.data.name = "Ashen_Body_Web"
    bpy.context.scene.collection.objects.link(web)
    for m in list(web.modifiers):
        web.modifiers.remove(m)
    dec = web.modifiers.new("WebDecimate", "DECIMATE")
    dec.ratio = min(1.0, tris / max(1, len(web.data.polygons)))
    dec.use_collapse_triangulate = True
    with bpy.context.temp_override(object=web, active_object=web, selected_objects=[web]):
        bpy.ops.object.modifier_apply(modifier=dec.name)
    arm_mod = web.modifiers.new("Armature", "ARMATURE")
    arm_mod.object = rig()
    arm_mod.use_vertex_groups = True
    return web


def export_glb(path=GLB, clips=None, tris=WEB_TRIS):
    """Body (decimated copy), 40-bone skin, the sword as a child of the right hand bone, one
    glTF animation per clip (NLA tracks), Y-up, vertex colours."""
    clips = clips or list(CLIPS)
    arm = rig()
    body = bpy.data.objects["Ashen_Body"]
    sword = bpy.data.objects["Ashen_Sword"]
    ad = arm.animation_data_create()
    ad.action = None
    for t in list(ad.nla_tracks):
        ad.nla_tracks.remove(t)
    for clip in clips:
        tr = ad.nla_tracks.new()
        tr.name = clip
        tr.strips.new(clip, 0, bpy.data.actions[clip])
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix()
    web = web_body(body, tris)
    body_vis = body.hide_get()
    body.hide_set(True)
    hidden = {o: o.hide_get() for o in (arm, web, sword)}
    for o in hidden:
        o.hide_set(False)                  # hidden objects cannot be selected, so would not export
    for o in bpy.context.view_layer.objects:
        o.select_set(o in (arm, web, sword))
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
        for t in list(ad.nla_tracks):
            ad.nla_tracks.remove(t)
        for o, h in hidden.items():
            if o is not web:
                o.hide_set(h)
        bpy.data.objects.remove(web, do_unlink=True)
        body.hide_set(body_vis)
    return path
