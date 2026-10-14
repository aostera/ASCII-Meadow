"""Shared check-render setup for the ASCII Meadow knight: world, lights, orthographic camera, 8 views.

Conventions: metres, Z up, the knight stands on z = 0 at the origin and faces -Y.
"""
import bpy, math, os
from mathutils import Vector

VIEWS = [("01_front", 0), ("02_front_right", 45), ("03_right", 90), ("04_back_right", 135),
         ("05_back", 180), ("06_back_left", 225), ("07_left", 270), ("08_front_left", 315)]


def collection(name):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(c)
    return c


def setup_world(scene):
    w = scene.world or bpy.data.worlds.new("World")
    scene.world = w
    try:
        w.use_nodes = True
    except Exception:
        pass
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    lp = nt.nodes.new("ShaderNodeLightPath")
    bg_cam = nt.nodes.new("ShaderNodeBackground")       # seen by the camera: flat dark backdrop
    bg_cam.inputs["Color"].default_value = (0.006, 0.006, 0.0065, 1)
    bg_lit = nt.nodes.new("ShaderNodeBackground")       # lights and reflects on the model: neutral grey
    bg_lit.inputs["Color"].default_value = (0.22, 0.22, 0.23, 1)
    bg_lit.inputs["Strength"].default_value = 0.8
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs[0])
    nt.links.new(bg_lit.outputs[0], mix.inputs[1])
    nt.links.new(bg_cam.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])


def setup_lights(coll):
    for ob in list(coll.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for name, loc, energy, size in (
        ("Light_Key", (-2.4, -3.0, 3.6), 300, 2.5),
        ("Light_Fill", (2.8, -2.2, 1.4), 90, 3.0),
        ("Light_Rim", (0.6, 3.2, 3.0), 260, 2.0),
    ):
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy, ld.size = energy, size
        ob = bpy.data.objects.new(name, ld)
        coll.objects.link(ob)
        ob.location = loc
        ob.rotation_euler = (Vector((0, 0, 1.0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()


def setup_camera(scene, coll, ortho_scale=2.4, target_z=0.98, elev_deg=12):
    """Orthographic, a little above the horizon like the atlas drawings; fixed for all 8 directions."""
    cam = bpy.data.objects.get("Camera_Ortho") or bpy.data.objects.get("Camera")
    if cam is None:
        cam = bpy.data.objects.new("Camera_Ortho", bpy.data.cameras.new("Camera_Ortho"))
        coll.objects.link(cam)
    cam.name = cam.data.name = "Camera_Ortho"
    for c in list(cam.users_collection):
        c.objects.unlink(cam)
    coll.objects.link(cam)
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = ortho_scale
    cam.data.clip_end = 50
    elev = math.radians(elev_deg)
    target = Vector((0, 0, target_z))
    cam.location = target + Vector((0, -math.cos(elev), math.sin(elev))) * 12
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    r = scene.render
    r.resolution_x, r.resolution_y, r.resolution_percentage = 900, 1200, 100
    r.engine = "BLENDER_EEVEE"
    try:
        scene.eevee.taa_render_samples = 48
    except Exception:
        pass
    r.film_transparent = False
    r.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "Standard"
    try:
        scene.view_settings.look = "None"
    except Exception:
        pass
    return cam


def render_views(scene, root, out_dir, only=()):
    """Turn the knight (root empty) to each of the 8 directions and render; camera and light stay put."""
    os.makedirs(out_dir, exist_ok=True)
    done = []
    for name, deg in VIEWS:
        if only and name not in only:
            continue
        root.rotation_euler = (0, 0, math.radians(deg))
        scene.render.filepath = os.path.join(out_dir, f"knight_{name}.png")
        bpy.ops.render.render(write_still=True)
        done.append(scene.render.filepath)
    root.rotation_euler = (0, 0, 0)
    return done
