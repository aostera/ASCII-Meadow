"""ASCII Meadow: skeleton for the Masked Knight (blender/masked_knight.blend), built in place.

Joints were measured on the prepared model (metres): front/side orthographic renders with a 10 cm
grid plus slice centroids. The knight leans forward (head and chest toward -Y), stands with the
left foot forward and the right foot back and wide, the right fist holds the greatsword at
(-0.41, -0.30, 1.05), the left hand hangs forward.

Builds:
  Knight_Rig (armature, child of Knight_Root), 91 bones
    deform: Hips, Spine, Spine1, Chest, Neck, Head, Shoulder/UpperArm/Forearm/Hand .L/.R,
            Thigh/Shin/Foot/Toe .L/.R, Cloak_{L4..L1,C,R1..R4}_1..7 (9 chains of 7 bones laid on
            the cloak surface, from the left front edge round the back to the right front edge)
    control (no deform): Root (ground), IK_Foot.L/.R (ankle position + foot rotation), Pole_Knee.L/.R
            (legs use IK, chain 2),
            Weapon.R (child of Hand.R; the sword object rides on it)
  Knight_Body: Armature modifier with automatic (heat) weights
  Knight_Sword: parented to the Weapon.R bone

Live Blender (MCP / execute_code): set KNIGHT_ROOT before exec. Background:
    blender -b blender/masked_knight.blend --python blender/rig_masked_knight.py
"""
import bpy, math, os
from mathutils import Vector, Matrix

_g = globals()
ROOT = _g.get("KNIGHT_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAVE = _g.get("KNIGHT_SAVE", True)

V = Vector
J = {  # joint positions, metres
    "root": V((-0.02, -0.18, 0.0)),
    "hips": V((-0.02, -0.20, 0.98)),
    "spine": V((-0.02, -0.21, 1.10)),
    "spine1": V((-0.02, -0.19, 1.25)),
    "chest": V((-0.02, -0.18, 1.40)),
    "neck": V((-0.025, -0.20, 1.56)),
    "head": V((-0.026, -0.22, 1.66)),
    "head_top": V((-0.026, -0.27, 1.92)),
    # arms
    "clav.R": V((-0.06, -0.19, 1.52)), "shoulder.R": V((-0.24, -0.16, 1.50)),
    "elbow.R": V((-0.36, -0.07, 1.24)), "wrist.R": V((-0.395, -0.235, 1.09)), "hand_end.R": V((-0.41, -0.33, 1.02)),
    "clav.L": V((0.02, -0.19, 1.52)), "shoulder.L": V((0.20, -0.16, 1.50)),
    "elbow.L": V((0.33, -0.21, 1.24)), "wrist.L": V((0.35, -0.38, 1.02)), "hand_end.L": V((0.32, -0.50, 0.88)),
    # legs
    "hip.R": V((-0.12, -0.20, 0.97)), "knee.R": V((-0.26, -0.18, 0.66)), "ankle.R": V((-0.34, -0.08, 0.11)),
    "hip.L": V((0.08, -0.20, 0.97)), "knee.L": V((0.18, -0.30, 0.66)), "ankle.L": V((0.21, -0.24, 0.11)),
}
# Cloak chains: body angle (0 = front, 90 = his left, 180 = back) at the top and at the hem.
# The edge chains wrap from behind the shoulders to the open front edges beside the legs.
CLOAK_CHAINS = [("L4", 110, 100), ("L3", 128, 118), ("L2", 145, 136), ("L1", 162, 157), ("C", 180, 180),
                ("R1", 198, 203), ("R2", 215, 224), ("R3", 232, 242), ("R4", 250, 260)]
CLOAK_Z = [1.45, 1.25, 1.05, 0.85, 0.65, 0.45, 0.25, 0.05]   # joint heights, top to hem (7 bones per chain)
CLOAK_AXIS = V((-0.02, -0.20, 0.0))                          # body axis the angles are measured around
CLOAK_INSET = 0.025                                          # joints sit this far inside the cloak surface
LEG_CLEAR = 0.11                                             # surface points this close to a leg bone are leg


def cloak_points(body):
    """For each chain, the outer cloak surface at each height (a joint just inside it)."""
    legs = [(J[f"hip.{s}"], J[f"knee.{s}"]) for s in "LR"] + [(J[f"knee.{s}"], J[f"ankle.{s}"]) for s in "LR"] +            [(J[f"ankle.{s}"], J[f"ankle.{s}"] + V((0, -0.28, -0.08))) for s in "LR"]       # boots

    def near_leg(c):
        for a, b in legs:
            ab = b - a
            t = max(0.0, min(1.0, (c - a).dot(ab) / ab.length_squared))
            if (a + ab * t - c).length < LEG_CLEAR:
                return True
        return False

    co = [v.co for v in body.data.vertices if v.co.z > 0.9 or not near_leg(v.co)]
    chains = {}
    for name, th0, th1 in CLOAK_CHAINS:
        pts = []
        for k, z in enumerate(CLOAK_Z):
            th = math.radians(th0 + (th1 - th0) * k / (len(CLOAK_Z) - 1))
            d = V((math.sin(th), -math.cos(th), 0))
            best = None
            for win in (0.03, 0.06, 0.10):          # widen the slice where the hem is torn
                for c in co:
                    if abs(c.z - z) > win:
                        continue
                    q = V((c.x - CLOAK_AXIS.x, c.y - CLOAK_AXIS.y, 0))
                    r = q.length
                    if r < 1e-6 or q.angle(d) > math.radians(9):
                        continue
                    if best is None or r > best:
                        best = r
                if best:
                    break
            if best is None and len(pts) >= 2:      # torn hem with no cloth here: carry the chain on
                nxt = pts[-1] + (pts[-1] - pts[-2])
                nxt.z = z
                pts.append(nxt)
                continue
            r = max((best or 0.3) - CLOAK_INSET, 0.12)
            pts.append(V((CLOAK_AXIS.x + d.x * r, CLOAK_AXIS.y + d.y * r, z)))
        chains[name] = pts
    return chains


def log(*a):
    print("RIG", *a)


def window_override():
    wm = bpy.context.window_manager
    win = bpy.context.window or (wm.windows[0] if wm.windows else None)
    if win is None:
        return {}
    area = next((a for a in win.screen.areas if a.type == "VIEW_3D"), None)
    d = {"window": win}
    if area:
        d["area"] = area
        d["region"] = next(r for r in area.regions if r.type == "WINDOW")
    return d


def toe_tip(body, ankle):
    """Front-most point of the boot under this ankle."""
    pts = [v.co for v in body.data.vertices if v.co.z < 0.07 and abs(v.co.x - ankle.x) < 0.12
           and abs(v.co.y - ankle.y) < 0.35]
    tip = min(pts, key=lambda c: c.y)
    return V((tip.x, tip.y + 0.02, 0.04))


def build(body, sword, root_empty):
    old = bpy.data.objects.get("Knight_Rig")
    if old:
        body.modifiers.clear()
        for ob in (body, sword):
            if ob.parent == old:
                ob.parent = root_empty
                ob.parent_type = "OBJECT"
                ob.matrix_parent_inverse = Matrix()
                ob.matrix_basis = Matrix()
        for g in list(body.vertex_groups):
            body.vertex_groups.remove(g)
        bpy.data.objects.remove(old, do_unlink=True)
    arm_data = bpy.data.armatures.new("Knight_Rig")
    arm = bpy.data.objects.new("Knight_Rig", arm_data)
    body.users_collection[0].objects.link(arm)
    arm.parent = root_empty
    arm_data.display_type = "STICK"
    arm.show_in_front = True

    ov = window_override()
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    with bpy.context.temp_override(**ov):
        bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_data.edit_bones

    def bone(name, head, tail, parent=None, deform=True, connect=False, roll_up=None):
        b = eb.new(name)
        b.head, b.tail = head, tail
        b.use_deform = deform
        if parent:
            b.parent = eb[parent]
            b.use_connect = connect
        if roll_up is not None:
            b.align_roll(roll_up)
        return b

    fwd = V((0, -1, 0))
    bone("Root", J["root"], J["root"] + V((0, 0.35, 0)), deform=False)
    bone("Hips", J["hips"], J["spine"], "Root")
    bone("Spine", J["spine"], J["spine1"], "Hips", connect=True)
    bone("Spine1", J["spine1"], J["chest"], "Spine", connect=True)
    bone("Chest", J["chest"], J["neck"], "Spine1", connect=True)
    bone("Neck", J["neck"], J["head"], "Chest", connect=True)
    bone("Head", J["head"], J["head_top"], "Neck", connect=True)
    for s in ("L", "R"):
        bone(f"Shoulder.{s}", J[f"clav.{s}"], J[f"shoulder.{s}"], "Chest", roll_up=fwd)
        bone(f"UpperArm.{s}", J[f"shoulder.{s}"], J[f"elbow.{s}"], f"Shoulder.{s}", connect=True, roll_up=fwd)
        bone(f"Forearm.{s}", J[f"elbow.{s}"], J[f"wrist.{s}"], f"UpperArm.{s}", connect=True, roll_up=fwd)
        bone(f"Hand.{s}", J[f"wrist.{s}"], J[f"hand_end.{s}"], f"Forearm.{s}", connect=True, roll_up=fwd)
        toe = toe_tip(body, J[f"ankle.{s}"])
        ball = J[f"ankle.{s}"].lerp(toe, 0.62)
        ball.z = 0.05
        bone(f"Thigh.{s}", J[f"hip.{s}"], J[f"knee.{s}"], "Hips", roll_up=fwd)
        bone(f"Shin.{s}", J[f"knee.{s}"], J[f"ankle.{s}"], f"Thigh.{s}", connect=True, roll_up=fwd)
        bone(f"Foot.{s}", J[f"ankle.{s}"], ball, f"Shin.{s}", connect=True, roll_up=V((0, 0, 1)))
        bone(f"Toe.{s}", ball, toe, f"Foot.{s}", connect=True, roll_up=V((0, 0, 1)))
        # controls: the foot IK target is a copy of the Foot bone (ankle -> ball, same roll), so it
        # places the ankle and also turns the foot (heel strike, toe off); knee pole 0.6 m in front
        ank = J[f"ankle.{s}"]
        bone(f"IK_Foot.{s}", ank, ball, "Root", deform=False, roll_up=V((0, 0, 1)))
        pole = J[f"knee.{s}"] + V((0, -0.6, 0))
        bone(f"Pole_Knee.{s}", pole, pole + V((0, -0.1, 0)), "Root", deform=False)
    # weapon bone: from the fist along the sword axis, so the sword turns with the hand
    co = [v.co for v in sword.data.vertices]
    tip = max(co, key=lambda c: c.z)
    grip = J["wrist.R"].lerp(J["hand_end.R"], 0.5)
    bone("Weapon.R", grip, grip + (tip - grip).normalized() * 0.3, "Hand.R", deform=False)
    for side, pts in cloak_points(body).items():
        parent = "Chest"
        for i in range(len(pts) - 1):
            name = f"Cloak_{side}_{i + 1}"
            bone(name, pts[i], pts[i + 1], parent, connect=i > 0)
            parent = name
    with bpy.context.temp_override(**ov):
        bpy.ops.object.mode_set(mode="OBJECT")

    # leg IK
    for s in ("L", "R"):
        pb = arm.pose.bones[f"Shin.{s}"]
        c = pb.constraints.new("IK")
        c.target, c.subtarget = arm, f"IK_Foot.{s}"
        c.pole_target, c.pole_subtarget = arm, f"Pole_Knee.{s}"
        c.pole_angle = math.radians(-90)
        c.chain_count = 2
        cr = arm.pose.bones[f"Foot.{s}"].constraints.new("COPY_ROTATION")
        cr.target, cr.subtarget = arm, f"IK_Foot.{s}"
        cr.target_space = cr.owner_space = "WORLD"
    calibrate_poles(arm)
    log("bones", len(arm_data.bones))
    return arm


def calibrate_poles(arm):
    """Pick each leg's IK pole angle so that the rest pose stays exactly as modelled."""
    for s in ("L", "R"):
        c = arm.pose.bones[f"Shin.{s}"].constraints[0]
        thigh = arm.pose.bones[f"Thigh.{s}"]
        rest = (thigh.bone.tail_local - thigh.bone.head_local).normalized()
        best = None
        for deg in range(-180, 180, 1):
            c.pole_angle = math.radians(deg)
            bpy.context.view_layer.update()
            err = (thigh.tail - thigh.head).normalized().angle(rest)
            if best is None or err < best[0]:
                best = (err, deg)
        c.pole_angle = math.radians(best[1])
        bpy.context.view_layer.update()
        log("pole", s, best[1], "deg, rest error", round(math.degrees(best[0]), 2), "deg")


def bind(arm, body, sword):
    ov = window_override()
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    body.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    with bpy.context.temp_override(**ov):
        bpy.ops.object.parent_set(type="ARMATURE_AUTO", keep_transform=True)
    log("vertex groups", len(body.vertex_groups))
    # sword rides on Weapon.R. Its mesh is stored in world coordinates, so the object keeps an
    # identity transform and only the parent inverse cancels the bone's rest matrix (computed in
    # the rest pose; setting matrix_world instead would bake an offset into the object itself).
    sword.parent = arm
    sword.parent_type = "BONE"
    sword.parent_bone = "Weapon.R"
    bpy.context.view_layer.update()
    pb = arm.pose.bones["Weapon.R"]
    sword.matrix_basis = Matrix()
    sword.matrix_parent_inverse = (arm.matrix_world @ pb.bone.matrix_local @
                                   Matrix.Translation((0, pb.bone.length, 0))).inverted()
    return body


def fill_unweighted(arm, body):
    """Give vertices the heat solver left empty to the nearest deforming bone."""
    segs = [(b.name, b.head_local.copy(), b.tail_local.copy()) for b in arm.data.bones if b.use_deform]

    def dist(p, a, c):
        ab = c - a
        t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
        return (a + ab * t - p).length

    groups = {g.name: g for g in body.vertex_groups}
    n = 0
    for v in body.data.vertices:
        if not any(g.weight > 0.01 for g in v.groups):
            name = min(segs, key=lambda s: dist(v.co, s[1], s[2]))[0]
            g = groups.get(name) or body.vertex_groups.new(name=name)
            groups[name] = g
            g.add([v.index], 1.0, "REPLACE")
            n += 1
    log("filled unweighted", n)


def legs_off_cloak(arm, body):
    """Boots and legs must not ride on cloak bones: drop cloak weights near the leg bones and
    renormalise what is left onto the legs."""
    # (segment, clearance): the boots are thinner than the thighs, so the torn hem hanging
    # right beside them stays cloth
    legs = [((J[f"hip.{s}"], J[f"knee.{s}"]), 0.13) for s in "LR"] +            [((J[f"knee.{s}"], J[f"ankle.{s}"]), 0.10) for s in "LR"] +            [((J[f"ankle.{s}"], J[f"ankle.{s}"] + V((0, -0.28, -0.08))), 0.075) for s in "LR"]

    boots = []
    for s in "LR":                      # heel-to-toe box per boot, along the Toe bone
        ank = J[f"ankle.{s}"]
        toe = arm.data.bones[f"Toe.{s}"].tail_local
        d = V((toe.x - ank.x, toe.y - ank.y, 0))
        boots.append((ank, d.normalized(), d.length))

    def inside_leg(c):
        for ank, d, length in boots:
            q = V((c.x - ank.x, c.y - ank.y, 0))
            t = q.dot(d)
            if c.z < 0.20 and -0.16 < t < length + 0.04 and (q - d * t).length < 0.085:
                return True
        for (a, b), clear in legs:
            ab = b - a
            t = max(0.0, min(1.0, (c - a).dot(ab) / ab.length_squared))
            if (a + ab * t - c).length < clear:
                return True
        return False

    names = {g.index: g.name for g in body.vertex_groups}
    cloak = {i for i, n in names.items() if n.startswith("Cloak_")}
    fixed = 0
    for v in body.data.vertices:
        if v.co.z > 0.95 or not inside_leg(v.co):
            continue
        cw = [g for g in v.groups if g.group in cloak and g.weight > 0]
        if not cw:
            continue
        for g in cw:
            body.vertex_groups[names[g.group]].remove([v.index])
        rest = [(names[g.group], g.weight) for g in v.groups if g.weight > 0]
        tot = sum(w for _, w in rest)
        if tot > 1e-4:
            for n, w in rest:
                body.vertex_groups[n].add([v.index], w / tot, "REPLACE")
        else:
            side = "L" if v.co.x > J["hips"].x else "R"
            bone = f"Shin.{side}" if v.co.z < J[f"knee.{side}"].z else f"Thigh.{side}"
            body.vertex_groups[bone].add([v.index], 1.0, "REPLACE")
        fixed += 1
    log("leg verts taken off the cloak", fixed)


def weight_report(body):
    counts = {g.name: 0 for g in body.vertex_groups}
    names = {g.index: g.name for g in body.vertex_groups}
    unweighted = 0
    for v in body.data.vertices:
        w = [g for g in v.groups if g.weight > 0.01]
        if not w:
            unweighted += 1
        for g in w:
            counts[names[g.group]] += 1
    log("unweighted verts", unweighted, "of", len(body.data.vertices))
    log("verts per bone", {k: n for k, n in sorted(counts.items())})


def main():
    body = bpy.data.objects["Knight_Body"]
    sword = bpy.data.objects["Knight_Sword"]
    root_empty = bpy.data.objects["Knight_Root"]
    arm = build(body, sword, root_empty)
    bind(arm, body, sword)
    fill_unweighted(arm, body)
    legs_off_cloak(arm, body)
    weight_report(body)
    if SAVE:
        bpy.ops.wm.save_mainfile()
        log("saved", bpy.data.filepath)


main()
