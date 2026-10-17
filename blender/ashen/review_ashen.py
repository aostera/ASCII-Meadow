"""Review renders for the repaired Ashen Vow knight (Workbench, vertex colours, orthographic).

    eight_directions(out, clip, frame)   the same pose seen from 8 compass headings
    pose_views(out, clip, frame, tag)    front / side / back of one pose
    hand_closeup(out)                    the sword fist, three angles
    contact_sheet(out, clip, step)       every `step`-th frame of a clip, side view, one PNG
Run inside the Blender session after repair_ashen_rig.py, build_ashen_sword.py and anim_ashen.py.
"""
import math
import os

import bpy
from mathutils import Vector

RIG = "Ashen_Rig"


def _setup(scene, size):
    cam = bpy.data.objects.get("QC_Camera")
    if cam is None:
        cam = bpy.data.objects.new("QC_Camera", bpy.data.cameras.new("QC_Camera"))
        scene.collection.objects.link(cam)
    cam.data.type = "ORTHO"
    cam.data.clip_end = 100
    scene.camera = cam
    scene.render.engine = "BLENDER_WORKBENCH"
    sh = scene.display.shading
    sh.light = "STUDIO"
    sh.color_type = "VERTEX"
    sh.show_cavity = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    for o in bpy.data.objects:
        if o.name.startswith("Look_"):
            o.hide_render = True
    sword = bpy.data.objects.get("Ashen_Sword")
    if sword and not sword.data.color_attributes:
        a = sword.data.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
        a.data.foreach_set("color", [0.45, 0.45, 0.47, 1.0] * len(sword.data.vertices))
    return cam


def _shoot(scene, cam, centre, direction, scale, path):
    c = Vector(centre)
    cam.data.ortho_scale = scale
    cam.location = c + Vector(direction).normalized() * 6
    cam.rotation_euler = (c - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path


def _set(clip, frame):
    rig = bpy.data.objects[RIG]
    rig.animation_data.action = bpy.data.actions[clip]
    bpy.context.scene.frame_set(frame)


def eight_directions(out, clip="Walk", frame=17, size=(300, 360)):
    sc = bpy.context.scene
    cam = _setup(sc, size)
    _set(clip, frame)
    paths = []
    for k in range(8):
        a = math.radians(k * 45)                 # 0 = in front of the knight (+X)
        d = (math.cos(a), math.sin(a), 0.12)
        paths.append(_shoot(sc, cam, (0.05, 0, 0.5), d, 1.25, os.path.join(out, f"dir_{clip}_{k * 45:03d}.png")))
    return paths


def pose_views(out, clip, frame, tag, size=(420, 500)):
    sc = bpy.context.scene
    cam = _setup(sc, size)
    _set(clip, frame)
    return [_shoot(sc, cam, (0.05, 0, 0.5), d, 1.2, os.path.join(out, f"{tag}_{name}.png"))
            for name, d in (("front", (1, 0, 0.08)), ("side", (0, -1, 0.08)), ("back", (-1, 0, 0.08)))]


def hand_closeup(out, size=(420, 420)):
    sc = bpy.context.scene
    cam = _setup(sc, size)
    _set("Idle", 0)
    rig = bpy.data.objects[RIG]
    hand = rig.matrix_world @ rig.pose.bones["bone_19"].tail
    return [_shoot(sc, cam, hand, d, 0.2, os.path.join(out, f"hand_{name}.png"))
            for name, d in (("outside", (0.1, -1, 0.15)), ("front", (1, -0.3, 0.2)), ("below", (0.3, -0.5, -1)))]


def contact_sheet(out, clip, step=2, size=(160, 200), cols=12):
    """Every `step`-th frame of a clip from the side, tiled into one PNG with a ground line."""
    sc = bpy.context.scene
    cam = _setup(sc, size)
    rig = bpy.data.objects[RIG]
    n = int(bpy.data.actions[clip].frame_range[1])
    tiles = []
    for f in range(0, n + 1, step):
        _set(clip, f)
        tiles.append(_shoot(sc, cam, (0.12, 0, 0.5), (0, -1, 0.0), 1.15, os.path.join(out, f"_cs_{clip}_{f:03d}.png")))
    img = bpy.data.images.new(f"cs_{clip}", size[0] * min(cols, len(tiles)), size[1] * math.ceil(len(tiles) / cols))
    W, H = img.size
    px = [0.08, 0.08, 0.08, 1.0] * (W * H)
    for k, t in enumerate(tiles):
        im = bpy.data.images.load(t)
        src = list(im.pixels)
        ox, oy = (k % cols) * size[0], (math.ceil(len(tiles) / cols) - 1 - k // cols) * size[1]
        for y in range(size[1]):
            row = (oy + y) * W + ox
            px[row * 4:(row + size[0]) * 4] = src[y * size[0] * 4:(y + 1) * size[0] * 4]
        bpy.data.images.remove(im)
        os.remove(t)
    img.pixels = px
    path = os.path.join(out, f"contact_{clip}.png")
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    return path, len(tiles)
