"""The Ashen Vow: a Gothic longsword as one separate mesh, built procedurally (bmesh).

Sword-local frame: +Y runs from the pommel to the tip, the origin is the middle of the grip
(where the fist closes), +X is the edge direction (across the blade), +Z the flat's normal.
Units follow the knight: 1.0 = his height (about 1.9 m), so the blade is ~0.88 m long.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

GRIP_R = 0.0120         # fills the fist (finger arc radius 0.0255 minus the glove's fingers)
GRIP = (-0.045, 0.045)  # grip from the pommel collar to the guard
GUARD_Y = 0.052
GUARD_HALF = 0.056
BLADE = (0.058, 0.52)
BLADE_W = 0.021         # half width at the ricasso
BLADE_T = 0.0050        # half thickness at the spine
POMMEL_Y = -0.064
POMMEL_R = 0.019


def _ring(bm, y, rx, rz, n, phase=0.0):
    return [bm.verts.new((rx * math.cos(phase + 2 * math.pi * k / n), y, rz * math.sin(phase + 2 * math.pi * k / n)))
            for k in range(n)]


def _bridge(bm, a, b):
    n = len(a)
    for k in range(n):
        bm.faces.new((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]))


def _cap(bm, ring, reverse=False):
    bm.faces.new(list(reversed(ring)) if reverse else ring)


def _loft(bm, sections, n, phase=0.0, close=(True, True)):
    rings = [_ring(bm, y, rx, rz, n, phase) for y, rx, rz in sections]
    for a, b in zip(rings, rings[1:]):
        _bridge(bm, a, b)
    if close[0]:
        _cap(bm, rings[0], reverse=True)
    if close[1]:
        _cap(bm, rings[-1])
    return rings


def _blade(bm):
    """Diamond section with a shallow fuller: 6 points around, tapering to a sharp tip."""
    y0, y1 = BLADE
    steps = 14
    rings = []
    for i in range(steps + 1):
        t = i / steps
        y = y0 + (y1 - y0) * t
        # long straight taper, then a quicker one into the point
        w = BLADE_W * (1 - 0.55 * t) * (1 - max(0.0, (t - 0.82) / 0.18) ** 1.6)
        th = BLADE_T * (1 - 0.6 * t)
        fuller = 0.45 if t < 0.65 else 0.45 + (t - 0.65) / 0.35 * 0.55   # fuller fades out near the point
        pts = [(w, 0.0), (w * 0.5, th * fuller + th * 0.35), (0.0, th), (-w * 0.5, th * fuller + th * 0.35),
               (-w, 0.0), (-w * 0.5, -(th * fuller + th * 0.35)), (0.0, -th), (w * 0.5, -(th * fuller + th * 0.35))]
        if i == steps:
            tip = bm.verts.new((0.0, y + 0.012, 0.0))
            rings.append(tip)
            break
        rings.append([bm.verts.new((x, y, z)) for x, z in pts])
    for a, b in zip(rings[:-2], rings[1:-1]):
        _bridge(bm, a, b)
    last, tip = rings[-2], rings[-1]
    for k in range(len(last)):
        bm.faces.new((last[k], last[(k + 1) % len(last)], tip))
    _cap(bm, rings[0], reverse=True)


def _guard(bm):
    """Cross-guard: a square bar whose quillons sweep down toward the blade, with claw ends."""
    segs = 10
    for side in (1, -1):
        rings = []
        for i in range(segs + 1):
            t = i / segs
            x = side * GUARD_HALF * t
            y = GUARD_Y + 0.016 * t ** 2.2          # quillons curve toward the blade
            s = 0.0075 * (1 - 0.45 * t) + (0.004 if i == segs else 0)
            rings.append([bm.verts.new((x, y + dy, dz)) for dy, dz in ((-s, -s), (s, -s), (s, s), (-s, s))])
        for a, b in zip(rings, rings[1:]):
            _bridge(bm, a, b) if side > 0 else _bridge(bm, b, a)
        _cap(bm, rings[-1], reverse=side < 0)
    # central block (langet) where the bar meets the blade
    _loft(bm, [(GUARD_Y - 0.011, 0.016, 0.011), (GUARD_Y + 0.011, 0.018, 0.012), (GUARD_Y + 0.024, 0.010, 0.007)], 4,
          phase=math.pi / 4)


def _grip(bm):
    """Leather-wrapped grip: an octagon with wrap ridges, swelling slightly in the middle."""
    y0, y1 = GRIP
    sections = []
    wraps = 9
    for i in range(wraps * 2 + 1):
        t = i / (wraps * 2)
        y = y0 + (y1 - y0) * t
        swell = 1 + 0.10 * math.sin(math.pi * t)
        ridge = 1.06 if i % 2 else 1.0
        r = GRIP_R * swell * ridge
        sections.append((y, r, r * 0.92))
    _loft(bm, sections, 8, phase=math.pi / 8)
    # iron collars at both ends of the wrap
    for y in (y0 - 0.004, y1 + 0.002):
        _loft(bm, [(y - 0.004, GRIP_R * 1.25, GRIP_R * 1.18), (y + 0.004, GRIP_R * 1.25, GRIP_R * 1.18)], 8)


def _pommel(bm):
    """Eight-facet pommel: a flattened bicone with a short neck."""
    y = POMMEL_Y
    r = POMMEL_R
    _loft(bm, [(y + 0.022, 0.006, 0.006), (y + 0.012, r * 0.75, r * 0.55), (y, r, r * 0.72),
               (y - 0.012, r * 0.75, r * 0.55), (y - 0.022, 0.004, 0.004)], 8, phase=math.pi / 8)


def build_sword(name="Ashen_Sword"):
    old = bpy.data.objects.get(name)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    bm = bmesh.new()
    _blade(bm)
    _guard(bm)
    _grip(bm)
    _pommel(bm)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = False
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def sword_frame(grip_centre, blade_dir, edge_hint):
    """World matrix that puts the grip's middle at grip_centre, +Y along blade_dir and the edge
    (+X) as close to edge_hint as the blade direction allows."""
    y = Vector(blade_dir).normalized()
    x = Vector(edge_hint)
    x = (x - x.dot(y) * y).normalized()
    z = x.cross(y).normalized()
    M = Matrix((x, y, z)).transposed().to_4x4()
    M.translation = Vector(grip_centre)
    return M


def attach_to_bone(ob, rig, bone_name, world):
    """Parent to a bone without the offset ending up in the object's own transform (identity
    basis, explicit parent inverse from the bone's current pose matrix)."""
    pb = rig.pose.bones[bone_name]
    ob.parent = rig
    ob.parent_type = "BONE"
    ob.parent_bone = bone_name
    ob.matrix_basis = Matrix()
    bone_world = rig.matrix_world @ pb.matrix @ Matrix.Translation((0, pb.bone.length, 0))
    ob.matrix_parent_inverse = bone_world.inverted() @ world
    bpy.context.view_layer.update()
