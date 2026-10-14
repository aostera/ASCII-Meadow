"""ASCII Meadow: base 3D model of the knight (shape: assets/dark_knight, colour: assets/crimson_knight).

Builds the knight scene, saves blender/knight.blend and renders 8 check views to blender/previews/.
Safe to re-run: it removes what it built before and builds again.

Background (repository root):
    blender -b --factory-startup --python blender/build_knight.py                 # build, save, render 8 views
    blender -b --factory-startup --python blender/build_knight.py -- --no-render
    blender -b --factory-startup --python blender/build_knight.py -- 01_front 05_back
Live Blender (MCP / execute_code): set KNIGHT_ROOT (repo path) and KNIGHT_ARGS (list) before exec.

Conventions: metres, Z up, the knight faces -Y (Blender's Front view), his right hand (sword) is -X.
Angles around the body: 0 = front (-Y), 90 deg = his left (+X), 180 = back.
Everything is plain mesh geometry: armour has Subdivision, cloth Solidify + Subdivision + Displace,
so all shapes stay editable. Object origins are at the world origin, parented to the Knight_Root empty.

What makes him read as the atlas knight (assets/dark_knight):
  helmet  - round bascinet, raised comb strip front-to-back, thin spike, visor coming to a point
            below a dark eye slit, breathing slots
  scarf   - thick rolls round the neck, U drapes on the chest, short pelerine over the shoulders
            whose torn ends flare back and out like wings
  armour  - big smooth pauldrons with rolled rims, banded arms, flared gauntlets, huge round knee
            cops, banded greaves, heavy strapped boots
  below   - wide belt, baldric, fringe hanging in front, two open coat flaps at the sides,
            a long torn panel behind down to the calves
  sword   - long blade with a fuller, slightly drooping guard, wheel pommel, held point-down
"""
import bpy, bmesh, math, os, random, sys
from mathutils import Vector, Matrix

_g = globals()
ROOT = _g.get("KNIGHT_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARGS = _g.get("KNIGHT_ARGS")
if ARGS is None:
    ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT_BLEND = os.path.join(ROOT, "blender", "knight.blend")
OUT_PREV = os.path.join(ROOT, "blender", "previews")
REFS = os.path.join(ROOT, "blender", "refs")
TAU = 2 * math.pi
Z = Vector((0, 0, 1))


def lerp(a, b, t):
    return a + (b - a) * t


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def ang(th):
    """Unit direction in the ground plane for a body angle (0 = front)."""
    return Vector((math.sin(th), -math.cos(th), 0))


# ---------------------------------------------------------------- scene setup

def collection(name):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(c)
    return c


def move_to(ob, coll):
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    coll.objects.link(ob)


def reset_scene():
    """Remove the default cube/light and anything a previous run built."""
    for name in ("Cube", "Light"):
        ob = bpy.data.objects.get(name)
        if ob:
            bpy.data.objects.remove(ob, do_unlink=True)
    for cname in ("Knight", "Refs", "Lights"):
        c = bpy.data.collections.get(cname)
        if c:
            for ob in list(c.objects):
                bpy.data.objects.remove(ob, do_unlink=True)
    for me in list(bpy.data.meshes):
        if me.users == 0:
            bpy.data.meshes.remove(me)
    for ld in list(bpy.data.lights):
        if ld.users == 0:
            bpy.data.lights.remove(ld)


# ---------------------------------------------------------------- materials

def material(name, color, metallic=0.0, rough=0.5, bump=None):
    """Principled material; bump = (noise scale, strength) adds a fine noise bump (wear, weave)."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(p.outputs[0], out.inputs["Surface"])
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Metallic"].default_value = metallic
    p.inputs["Roughness"].default_value = rough
    if bump:
        tex = nt.nodes.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = bump[0]
        tex.inputs["Detail"].default_value = 10.0
        b = nt.nodes.new("ShaderNodeBump")
        b.inputs["Strength"].default_value = bump[1]
        b.inputs["Distance"].default_value = 0.004
        nt.links.new(tex.outputs["Fac"], b.inputs["Height"])
        nt.links.new(b.outputs["Normal"], p.inputs["Normal"])
    m.diffuse_color = (*color, 1)
    return m


# ---------------------------------------------------------------- mesh builders

def _ring(bm, s, n, a0=0.0):
    z, rx, ry = s[0], s[1], s[2]
    cx = s[3] if len(s) > 3 else 0.0
    cy = s[4] if len(s) > 4 else 0.0
    p = s[5] if len(s) > 5 else 2.0
    vs = []
    for i in range(n):
        a = a0 + TAU * i / n
        sa, ca = math.sin(a), -math.cos(a)
        x = rx * math.copysign(abs(sa) ** (2 / p), sa)
        y = ry * math.copysign(abs(ca) ** (2 / p), ca)
        vs.append(bm.verts.new((cx + x, cy + y, z)))
    return vs


def _fan(bm, ring, centre, mi):
    c = bm.verts.new(centre)
    n = len(ring)
    for i in range(n):
        bm.faces.new((ring[i], ring[(i + 1) % n], c)).material_index = mi


def _merge(bm, tmp, matrix=None):
    if matrix is not None:
        bmesh.ops.transform(tmp, matrix=matrix, verts=tmp.verts)
    me = bpy.data.meshes.new("_tmp")
    tmp.to_mesh(me)
    tmp.free()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)


def loft(bm, sections, n=16, mi=0, caps=(True, True), dome=(0.0, 0.0), matrix=None, a0=0.0, keep=None, warp=None):
    """Tube through elliptic/superelliptic sections (z, rx, ry[, cx, cy, p]); fan caps.
    warp(co) -> co bends vertices; keep(co) -> bool trims to a partial shell (no caps then)."""
    tmp = bmesh.new()
    rings = [_ring(tmp, s, n, a0) for s in sections]
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            tmp.faces.new((a[i], a[j], b[j], b[i])).material_index = mi
    if keep is None:
        sgn = 1 if sections[-1][0] >= sections[0][0] else -1
        for k, (ring, s, d) in enumerate(((rings[0], sections[0], -dome[0]), (rings[-1], sections[-1], dome[1]))):
            if caps[k]:
                cx = s[3] if len(s) > 3 else 0.0
                cy = s[4] if len(s) > 4 else 0.0
                _fan(tmp, ring, (cx, cy, s[0] + d * sgn), mi)
    if warp is not None:
        for v in tmp.verts:
            v.co = warp(v.co.copy())
    if keep is not None:
        bmesh.ops.delete(tmp, geom=[v for v in tmp.verts if not keep(v.co)], context="VERTS")
    _merge(bm, tmp, matrix)


def aim(a, b):
    """Matrix taking local -Z onto segment a -> b (length returned)."""
    a, b = Vector(a), Vector(b)
    q = Vector((0, 0, -1)).rotation_difference((b - a).normalized())
    return Matrix.Translation(a) @ q.to_matrix().to_4x4(), (b - a).length


def limb(bm, a, b, secs, n=14, mi=0, dome=(0.01, 0.01)):
    """secs: (t 0..1 along a->b, rx, ry[, cx, cy, p])."""
    m, L = aim(a, b)
    loft(bm, [(-t * L, *rest) for t, *rest in secs], n=n, mi=mi, dome=dome, matrix=m)


def ellipsoid(bm, centre, r, mi=0, n=16, rings=8, matrix=None):
    rx, ry, rz = r
    secs = []
    for k in range(1, rings):
        ph = math.pi * k / rings - math.pi / 2
        secs.append((rz * math.sin(ph), rx * math.cos(ph), ry * math.cos(ph)))
    cap = rz * (1 - math.sin(math.pi / 2 - math.pi / rings))
    loft(bm, secs, n=n, mi=mi, dome=(cap, cap), matrix=(matrix or Matrix()) @ Matrix.Translation(centre))


def circle(r, n=8):
    return [(r * math.cos(TAU * i / n), r * math.sin(TAU * i / n)) for i in range(n)]


def rect(w, h, lift=0.0):
    """Strap/rim profile: w across the path, h outward (sits on the surface when lift = 0)."""
    return [(-w / 2, lift), (w / 2, lift), (w / 2, lift + h), (-w / 2, lift + h)]


def sweep(bm, pts, prof, mi=0, closed=False, up=None, scale=None, caps=True):
    """Extrude a 2D profile (x across, y along the 'up' normal) along a polyline."""
    pts = [Vector(p) for p in pts]
    n, m = len(pts), len(prof)
    rings = []
    for i, p in enumerate(pts):
        if closed:
            t = pts[(i + 1) % n] - pts[i - 1]
        else:
            t = pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]
        t.normalize()
        u = up(p, i) if up else Z
        N = u - t * u.dot(t)
        if N.length < 1e-6:
            N = t.orthogonal()
        N.normalize()
        B = t.cross(N)
        s = scale(i / (n - 1)) if scale else 1.0
        rings.append([bm.verts.new(p + B * x * s + N * y * s) for x, y in prof])
    pairs = list(zip(rings, rings[1:])) + ([(rings[-1], rings[0])] if closed else [])
    for a, b in pairs:
        for j in range(m):
            bm.faces.new((a[j], a[(j + 1) % m], b[(j + 1) % m], b[j])).material_index = mi
    if caps and not closed:
        bm.faces.new(rings[0]).material_index = mi
        bm.faces.new(list(reversed(rings[-1]))).material_index = mi


def loop(z, rx, ry, cx=0.0, cy=0.0, n=40, zf=None, rf=None, th0=0.0, th1=TAU, closed=True):
    """Points round the body: zf(th) / rf(th) add height / radius variation."""
    out = []
    count = n if closed else n + 1
    for i in range(count):
        th = th0 + (th1 - th0) * i / n
        r = 1.0 + (rf(th) if rf else 0.0)
        out.append(Vector((cx + rx * r * math.sin(th), cy - ry * r * math.cos(th), z + (zf(th) if zf else 0.0))))
    return out


def radial(centre):
    c = Vector(centre)

    def f(p, i):
        d = Vector((p.x - c.x, p.y - c.y, 0))
        return d.normalized() if d.length > 1e-6 else Z
    return f


def outward(centre):
    c = Vector(centre)
    return lambda p, i: (p - c).normalized()


def band(bm, a, b, t, r, w=0.022, mi=0, n=20):
    """Raised band round a limb at fraction t of a->b (a short thicker tube)."""
    p = Vector(a).lerp(Vector(b), t)
    d = (Vector(b) - Vector(a)).normalized()
    limb(bm, p - d * w / 2, p + d * w / 2, [(0, r, r), (1, r, r)], n=n, mi=mi, dome=(0, 0))


def mesh_object(name, bm, mats, coll, parent):
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    try:
        me.shade_smooth()
    except AttributeError:
        for p in me.polygons:
            p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    ob.parent = parent
    return ob


def subsurf(ob, view=1, render=2):
    m = ob.modifiers.new("Subdivision", "SUBSURF")
    m.levels, m.render_levels = view, render


def solidify(ob, t=0.012):
    m = ob.modifiers.new("Solidify", "SOLIDIFY")
    m.thickness, m.offset = t, 0.0


def wrinkle(ob, strength=0.018, size=0.06):
    """Low-frequency cloud displacement: soft wrinkles and uneven drape on cloth."""
    tex = bpy.data.textures.get("T_Wrinkle") or bpy.data.textures.new("T_Wrinkle", "CLOUDS")
    tex.noise_scale = size
    tex.noise_depth = 2
    m = ob.modifiers.new("Wrinkles", "DISPLACE")
    m.texture, m.strength, m.mid_level = tex, strength, 0.5
    m.texture_coords = "GLOBAL"


def cloth(bm, nu, nv, closed, pos, v_split, seed, wmin, wmax, lmin, lmax, sway, mi=0, pinch=0.0, point=(0.05, 0.40)):
    """Draped sheet torn below v_split into strips of random width and length.

    pos(u, v, length_factor) -> Vector. Above v_split strips share vertices (merged by
    remove_doubles); below, each strip has its own length, drifts in/out by `sway`, ends
    in a point and (pinch > 0) narrows toward its middle so gaps open between strips."""
    rnd = random.Random(seed)
    cols = nu if closed else nu - 1
    c, strips = 0, []
    while c < cols:
        w = min(rnd.randint(wmin, wmax), cols - c)
        strips.append((c, c + w, rnd.uniform(lmin, lmax), rnd.uniform(-1, 1) * sway, rnd.uniform(*point)))
        c += w

    def at(u, v, w, lf, dr):
        P = pos(u, v, lf)
        if w > 0:
            out = Vector((P.x, P.y, 0))
            if out.length > 1e-6:
                P = P + out.normalized() * dr * w * w
        return P

    for c0, c1, L, dr, pt in strips:
        mid, half = (c0 + c1) / 2, max((c1 - c0) / 2, 0.5)
        umid = (mid % nu) / nu if closed else mid / (nu - 1)
        grid = []
        for ci in range(c0, c1 + 1):
            u = (ci % nu) / nu if closed else ci / (nu - 1)
            k = abs(ci - mid) / half
            tip = 1.0 + pt * (1 - k)
            col = []
            for j in range(nv):
                v = j / (nv - 1)
                w = max(0.0, (v - v_split) / (1 - v_split))
                lf = lerp(1.0, L * tip, smooth(w * 2.5)) if w > 0 else 1.0
                P = at(u, v, w, lf, dr)
                if w > 0 and pinch > 0:
                    P = P.lerp(at(umid, v, w, lf, dr), pinch * smooth(w * 2) * k)
                col.append(bm.verts.new(P))
            grid.append(col)
        for a, b in zip(grid, grid[1:]):
            for j in range(nv - 1):
                bm.faces.new((a[j], b[j], b[j + 1], a[j + 1])).material_index = mi


# ---------------------------------------------------------------- body measurements

TORSO = [  # z, rx, ry, cx, cy, p
    (0.90, 0.180, 0.128, 0, 0.000, 2.4),
    (1.00, 0.200, 0.140, 0, 0.000, 2.4),
    (1.11, 0.194, 0.136, 0, -0.005, 2.4),
    (1.24, 0.224, 0.156, 0, -0.012, 2.5),
    (1.36, 0.254, 0.174, 0, -0.016, 2.6),
    (1.46, 0.252, 0.168, 0, -0.010, 2.6),
    (1.54, 0.202, 0.142, 0, 0.000, 2.4),
    (1.60, 0.095, 0.085, 0, 0.0, 2.0),
    (1.67, 0.075, 0.070, 0, 0.0, 2.0),
]


def torso_at(z):
    for a, b in zip(TORSO, TORSO[1:]):
        if a[0] <= z <= b[0]:
            t = (z - a[0]) / (b[0] - a[0])
            return [lerp(x, y, t) for x, y in zip(a, b)]
    return list(TORSO[0] if z < TORSO[0][0] else TORSO[-1])


def torso_front(x, z, off=0.0):
    """Point on the front of the cuirass at height z, sideways x (superellipse inverse)."""
    _, rx, ry, cx, cy, p = torso_at(z)
    sa = min(1.0, abs(x - cx) / rx) ** (p / 2)
    ca = math.sqrt(max(0.0, 1 - sa * sa))
    return Vector((x, cy - ry * ca ** (2 / p) - off, z))


HELM_C = Vector((0, -0.006, 1.765))     # helmet centre for outward normals


# ---------------------------------------------------------------- the knight

def build_knight(coll, root, M):
    A, LEA, TRIM, VOID, STEEL = range(5)
    mats = [M["armor"], M["leather"], M["trim"], M["void"], M["steel"]]
    parts = {}

    # ================================================================ body
    bm = bmesh.new()
    loft(bm, TORSO, n=24, mi=A, dome=(0.02, 0.0))
    # chest: centre ridge, plackart edge, a roundel on his left breast
    sweep(bm, [torso_front(0, z) for z in [1.50 - 0.02 * i for i in range(19)]], rect(0.014, 0.007), mi=A,
          up=lambda p, i: Vector((0, -1, 0.15)))
    sweep(bm, [torso_front(x, 1.27 - 0.09 * (x / 0.2) ** 2 + 0.0) for x in [-0.20 + 0.02 * i for i in range(21)]],
          circle(0.006, 6), mi=A, up=lambda p, i: Vector((0, -1, 0)))
    rc = torso_front(0.13, 1.335, 0.002)
    sweep(bm, [rc + Vector((0.036 * math.cos(a), 0.0, 0.036 * math.sin(a)))
               for a in [TAU * i / 20 for i in range(20)]], circle(0.006, 6), mi=TRIM, closed=True,
          up=lambda p, i: (p - rc).normalized())
    ellipsoid(bm, rc + Vector((0, 0.004, 0)), (0.022, 0.006, 0.022), mi=A, n=12, rings=6)
    for z in (1.150, 1.192):                                                          # abdomen lames
        loft(bm, [(z, 0.212, 0.151, 0, -0.009, 2.4), (z + 0.032, 0.218, 0.154, 0, -0.010, 2.4)], n=24, mi=A)
    loft(bm, [(1.00, 0.222, 0.160, 0, 0.0, 2.5), (1.06, 0.216, 0.157, 0, 0.0, 2.4)], n=24, mi=A)   # fauld lame
    # wide belt with plates and a big buckle
    loft(bm, [(1.058, 0.222, 0.160, 0, -0.004, 2.4), (1.132, 0.210, 0.154, 0, -0.006, 2.4)], n=24, mi=LEA)
    for th in [math.radians(a) for a in (-75, -45, 45, 75, 110, 140, 180, 220, 250)]:
        p = Vector((0.224 * math.sin(th), -0.004 - 0.161 * math.cos(th), 1.095))
        loft(bm, [(-0.022, 0.016, 0.006, 0, 0, 4), (0.022, 0.016, 0.006, 0, 0, 4)], n=8, mi=A,
             matrix=Matrix.Translation(p) @ Matrix.Rotation(-th, 4, "Z"))
    loft(bm, [(-0.036, 0.042, 0.012, 0, 0, 5), (0.036, 0.042, 0.012, 0, 0, 5)], n=12, mi=TRIM,
         matrix=Matrix.Translation((0.0, -0.166, 1.095)))
    loft(bm, [(-0.026, 0.030, 0.016, 0, 0, 5), (0.026, 0.030, 0.016, 0, 0, 5)], n=12, mi=VOID,
         matrix=Matrix.Translation((0.0, -0.166, 1.095)))
    # sword belt, slung low and tilted
    sweep(bm, loop(1.0, 0.236, 0.176, zf=lambda th: -0.045 * math.sin(th) - 0.02 * math.cos(th), n=40),
          rect(0.030, 0.008), mi=LEA, closed=True, up=radial((0, 0, 0)))
    # baldric from his right shoulder over the chest to his left hip
    bal = [torso_front(lerp(-0.16, 0.20, t), lerp(1.50, 1.07, t), 0.006) for t in [i / 20 for i in range(21)]]
    sweep(bm, bal, rect(0.044, 0.008), mi=LEA, up=lambda p, i: Vector((0, -1, 0)))
    for t in (0.25, 0.6):
        p = bal[int(t * 20)]
        loft(bm, [(-0.006, 0.024, 0.008, 0, 0, 5), (0.006, 0.024, 0.008, 0, 0, 5)], n=8, mi=TRIM,
             matrix=Matrix.Translation(p + Vector((0, -0.006, 0))) @ Matrix.Rotation(math.radians(90), 4, "X"))
    parts["Knight_Body"] = bm

    # ================================================================ helmet
    bm = bmesh.new()
    HELM = [
        (1.595, 0.106, 0.118, 0, -0.012),
        (1.650, 0.127, 0.140, 0, -0.020),
        (1.720, 0.137, 0.150, 0, -0.020),
        (1.800, 0.135, 0.146, 0, -0.010),
        (1.870, 0.119, 0.128, 0, 0.000),
        (1.925, 0.086, 0.094, 0, 0.004),
        (1.960, 0.042, 0.046, 0, 0.006),
        (1.973, 0.010, 0.010, 0, 0.006),
    ]
    loft(bm, HELM, n=24, mi=A, dome=(0.0, 0.002))

    def helm_y(z, sgn):
        for a, b in zip(HELM, HELM[1:]):
            if a[0] <= z <= b[0]:
                t = (z - a[0]) / (b[0] - a[0])
                return lerp(a[4], b[4], t) + sgn * lerp(a[2], b[2], t)
        return HELM[-1][4]

    # comb: a raised strip lying on the dome from the brow over the top to the nape
    zs = [1.835 + (1.972 - 1.835) * math.sin(math.pi / 2 * i / 12) for i in range(13)]
    comb = [Vector((0, helm_y(z, -1), z)) for z in zs] +            [Vector((0, helm_y(z, 1), z)) for z in reversed([1.63 + (1.972 - 1.63) * math.sin(math.pi / 2 * i / 16) for i in range(16)])]
    sweep(bm, comb, rect(0.030, 0.010, -0.002), mi=A, up=outward(HELM_C))
    sweep(bm, comb, rect(0.008, 0.004, 0.008), mi=A, up=outward(HELM_C))
    # visor: a shell standing proud of the face, coming to a point below the chin
    def chin(co):
        if co.z < 1.70:
            k = max(0.0, (-co.y - 0.06) / 0.13)
            co.z -= 0.075 * k ** 2.2 * (1.70 - co.z) / 0.075
        return co
    loft(bm, [(1.625, 0.121, 0.150, 0, -0.030), (1.700, 0.141, 0.169, 0, -0.037),
              (1.764, 0.143, 0.164, 0, -0.026)], n=32, mi=A, keep=lambda co: co.y < -0.045, warp=chin)
    sweep(bm, [Vector((0, -0.195 + 0.004 * k, 1.762 - 0.0175 * k * 1.0)) for k in range(11)], rect(0.016, 0.009),
          mi=A, up=lambda p, i: Vector((0, -1, 0.1)))                                   # visor ridge
    for side in (-1, 1):                                                                # breaths
        for z in (1.725, 1.700, 1.675):
            for x in (0.060, 0.082, 0.102):
                y = -0.037 - 0.169 * math.sqrt(max(0.0, 1 - (x / 0.141) ** 2)) - 0.002
                limb(bm, (side * x, y, z + 0.009), (side * x, y + 0.003, z - 0.009),
                     [(0, 0.0035, 0.004), (1, 0.0035, 0.004)], n=6, mi=VOID, dome=(0, 0))
    loft(bm, [(1.764, 0.139, 0.153, 0, -0.016), (1.798, 0.139, 0.151, 0, -0.012)], n=32, mi=VOID,
         keep=lambda co: co.y < -0.02)                                                  # eye slit
    loft(bm, [(1.798, 0.144, 0.156, 0, -0.011), (1.834, 0.139, 0.150, 0, -0.008)], n=24, mi=A)   # brow band
    sweep(bm, loop(1.797, 0.145, 0.157, cy=-0.011, n=40), circle(0.006, 6), mi=A, closed=True,
          up=radial((0, -0.011, 0)))
    sweep(bm, loop(1.600, 0.110, 0.123, cy=-0.012, n=40), circle(0.009, 8), mi=TRIM, closed=True,
          up=radial((0, -0.012, 0)))                                                    # lower rim
    for th in [TAU * i / 10 for i in range(10)]:                                        # rivets on the brow
        if math.cos(th) < 0.3:
            ellipsoid(bm, Vector((0.146 * math.sin(th), -0.010 - 0.158 * math.cos(th), 1.816)),
                      (0.006, 0.006, 0.006), mi=TRIM, n=8, rings=4)
    loft(bm, [(1.955, 0.028, 0.040), (1.988, 0.022, 0.032)], n=12, mi=TRIM)            # spike collar
    loft(bm, [(0.00, 0.016, 0.040), (0.05, 0.011, 0.024, 0, 0.003), (0.14, 0.006, 0.010, 0, 0.010),
              (0.23, 0.0015, 0.002, 0, 0.020)], n=10, mi=A, dome=(0, 0.002),
         matrix=Matrix.Translation((0, 0.008, 1.980)) @ Matrix.Rotation(math.radians(-6), 4, "X"))
    parts["Knight_Helmet"] = bm

    # ================================================================ arms
    def hand(bm, s, grip_c, axis, knuckle, closed_r):
        """Gauntleted fist: back plate, four curled fingers and a thumb round `axis` at grip_c."""
        axis, knuckle = axis.normalized(), knuckle.normalized()
        e2 = axis.cross(knuckle).normalized()
        for k in range(4):
            c = grip_c + axis * (0.034 - 0.022 * k)
            r = closed_r + 0.011
            pts = [c + (knuckle * math.cos(a) + e2 * math.sin(a) * s) * r
                   for a in [math.radians(lerp(-80, 175, i / 12)) for i in range(13)]]
            sweep(bm, pts, circle(0.0115, 8), mi=A, up=lambda p, i, c=c: (p - c).normalized())
        tc = grip_c + axis * 0.036
        pts = [tc + (knuckle * math.cos(a) + e2 * math.sin(a) * s) * (closed_r + 0.012)
               for a in [math.radians(lerp(150, 250, i / 6)) for i in range(7)]]
        sweep(bm, pts, circle(0.012, 8), mi=A, up=lambda p, i: (p - tc).normalized())
        back = grip_c - e2 * s * (closed_r + 0.010) + knuckle * 0.004 + axis * 0.006
        ellipsoid(bm, Vector(), (0.022, 0.030, 0.046), mi=A, n=14, rings=6,
                  matrix=Matrix.Translation(back) @ Z.rotation_difference(axis).to_matrix().to_4x4())

    def arm(s, shoulder, elbow, wrist, hand_dir):
        bm = bmesh.new()
        c = Vector((0.282 * s, 0.006, 1.418))
        pm = Matrix.Translation(c) @ Matrix.Rotation(math.radians(-27 * s), 4, "Y")
        loft(bm, [(-0.006, 0.150, 0.158, 0, 0, 2.2), (0.045, 0.145, 0.153, 0, 0, 2.2), (0.090, 0.115, 0.123),
                  (0.118, 0.068, 0.074), (0.132, 0.012, 0.014)], n=24, mi=A, dome=(0.0, 0.004), matrix=pm)
        rim = [pm @ p for p in loop(-0.004, 0.152, 0.160, n=40)]
        sweep(bm, rim, circle(0.011, 8), mi=A, closed=True, up=outward(pm @ Vector((0, 0, 0.03))))
        for k, (dz, r) in enumerate(((-0.050, 0.136), (-0.092, 0.122))):
            lm = Matrix.Translation(c + Vector((0.018 * s * (k + 1), 0, dz))) @ \
                Matrix.Rotation(math.radians(-33 * s - 5 * k * s), 4, "Y")
            loft(bm, [(-0.016, r, r * 1.05, 0, 0, 2.2), (0.016, r + 0.005, r * 1.05 + 0.005, 0, 0, 2.2)], n=22, mi=A,
                 matrix=lm)
        limb(bm, shoulder, elbow, [(0, 0.090, 0.092), (0.5, 0.086, 0.088), (1.0, 0.074, 0.076)], mi=A)
        for t in (0.30, 0.48, 0.66, 0.84):                                              # rerebrace lames
            band(bm, shoulder, elbow, t, 0.093 - 0.012 * t, w=0.03, mi=A)
        ellipsoid(bm, Vector(elbow) + Vector((0.012 * s, 0.026, 0)), (0.078, 0.072, 0.080), mi=A)       # couter
        ellipsoid(bm, Vector(elbow) + Vector((0.070 * s, 0.026, 0.0)), (0.016, 0.070, 0.074), mi=A)     # wing
        sweep(bm, [Vector(elbow) + Vector((0.086 * s, 0.026 + 0.070 * math.cos(a), 0.074 * math.sin(a)))
                   for a in [TAU * i / 24 for i in range(24)]], circle(0.007, 6), mi=A, closed=True,
              up=lambda p, i: Vector((s, 0, 0)))
        limb(bm, elbow, wrist, [(0, 0.070, 0.072), (0.55, 0.080, 0.082), (0.92, 0.072, 0.074),
                                (1.0, 0.064, 0.066)], mi=A)
        for t in (0.18, 0.40, 0.62):                                                    # vambrace bands
            band(bm, elbow, wrist, t, 0.078 + 0.006 * t, w=0.014, mi=A)
        hd = Vector(hand_dir)
        limb(bm, wrist, Vector(wrist) + hd * 0.06, [(0, 0.074, 0.076), (0.6, 0.096, 0.098), (1, 0.100, 0.102)],
             mi=A, dome=(0.0, 0.0))                                                     # flared cuff
        sweep(bm, [Vector(wrist) + hd * 0.06 + (Vector((math.cos(a), math.sin(a), 0)) - hd * hd.dot(Vector((math.cos(a), math.sin(a), 0)))).normalized() * 0.101
                   for a in [TAU * i / 28 for i in range(28)]], circle(0.007, 6), mi=A, closed=True,
              up=lambda p, i: hd)
        return bm

    grip_r = Vector((-0.405, -0.078, 0.925))
    grip_d = Vector((-0.30, -0.10, -0.85)).normalized()

    bm = arm(-1, (-0.262, 0.0, 1.45), (-0.335, 0.025, 1.17), (-0.385, -0.040, 0.995),
             Vector((-0.10, -0.20, -0.97)).normalized())
    hand(bm, 1, grip_r, -grip_d, Vector((0.15, -1.0, 0.0)), 0.019)
    parts["Knight_Arm_R"] = bm
    bm = arm(1, (0.262, 0.0, 1.45), (0.325, 0.030, 1.17), (0.355, 0.000, 0.995),
             Vector((0.06, -0.05, -1.0)).normalized())
    hand(bm, -1, Vector((0.366, -0.020, 0.905)), Vector((0.0, -0.25, 1.0)), Vector((0.2, -1.0, 0.0)), 0.006)
    parts["Knight_Arm_L"] = bm

    # ================================================================ legs
    def leg(s):
        hip, knee, ankle = Vector((0.112 * s, 0.0, 0.94)), Vector((0.205 * s, -0.025, 0.53)), Vector((0.272 * s, 0.0, 0.125))
        bm = bmesh.new()
        limb(bm, hip, knee, [(0, 0.112, 0.106), (0.35, 0.114, 0.108), (0.75, 0.096, 0.090), (1.0, 0.080, 0.076)], mi=A)
        for t, r in ((0.30, 0.117), (0.62, 0.103)):                                     # leather straps
            band(bm, hip, knee, t, r, w=0.026, mi=LEA)
        for t, r in ((0.80, 0.094), (0.90, 0.088)):                                     # cuisse lames
            band(bm, hip, knee, t, r, w=0.030, mi=A)
        kc = knee + Vector((0.004 * s, -0.062, 0.004))
        ellipsoid(bm, kc, (0.100, 0.066, 0.104), mi=A, n=20, rings=10)                  # poleyn
        sweep(bm, [kc + Vector((0.098 * math.cos(a), 0.022, 0.102 * math.sin(a))) for a in [TAU * i / 32 for i in range(32)]],
              circle(0.012, 8), mi=A, closed=True, up=lambda p, i: (p - kc - Vector((0, 0.022, 0))).normalized())
        ellipsoid(bm, kc + Vector((0, -0.058, 0)), (0.026, 0.012, 0.026), mi=A, n=12, rings=6)   # boss
        wc = knee + Vector((0.084 * s, -0.026, 0.0))
        ellipsoid(bm, wc, (0.018, 0.074, 0.080), mi=A)                                  # wing
        sweep(bm, [wc + Vector((0.010 * s, 0.072 * math.cos(a), 0.078 * math.sin(a))) for a in [TAU * i / 24 for i in range(24)]],
              circle(0.007, 6), mi=A, closed=True, up=lambda p, i: Vector((s, 0, 0)))
        for dz, r in ((0.090, 0.090), (-0.084, 0.086)):
            loft(bm, [(-0.014, r, r * 0.86), (0.014, r, r * 0.86)], n=20, mi=A,
                 matrix=Matrix.Translation(knee + Vector((0, -0.012, dz))))
        limb(bm, knee, ankle, [(0, 0.086, 0.086), (0.28, 0.096, 0.104, 0, 0.012), (0.75, 0.074, 0.078),
                               (1.0, 0.068, 0.072)], mi=A)
        band(bm, knee, ankle, 0.17, 0.096, w=0.026, mi=A)                                # greave top band
        band(bm, knee, ankle, 0.62, 0.084, w=0.020, mi=LEA)                              # calf strap
        # shin ridge down the front of the greave
        sh = [knee.lerp(ankle, t) + Vector((0, -lerp(0.100, 0.076, t) - 0.004, 0)) for t in [0.2 + 0.035 * i for i in range(21)]]
        sweep(bm, sh, rect(0.012, 0.006), mi=A, up=lambda p, i: Vector((0, -1, 0)))
        # heavy boot: rounded toe, sole, two straps over the instep, ankle cuff
        turn = Matrix.Rotation(math.radians(-17 * s), 4, "Z")
        foot = Matrix.Translation(Vector((ankle.x + 0.008 * s, 0.085, 0.0))) @ turn @ Matrix.Rotation(math.radians(90), 4, "X")
        loft(bm, [(0.00, 0.060, 0.068, 0, 0.072), (0.07, 0.070, 0.088, 0, 0.090), (0.16, 0.074, 0.070, 0, 0.074),
                  (0.25, 0.070, 0.052, 0, 0.058), (0.31, 0.058, 0.042, 0, 0.046), (0.345, 0.034, 0.028, 0, 0.030)],
             n=18, mi=A, dome=(0.012, 0.012), matrix=foot)
        loft(bm, [(-0.01, 0.062, 0.010, 0, 0.010, 4), (0.17, 0.074, 0.010, 0, 0.010, 4), (0.30, 0.060, 0.010, 0, 0.010, 4),
                  (0.355, 0.032, 0.010, 0, 0.010, 4)], n=16, mi=LEA, dome=(0.004, 0.004), matrix=foot)   # sole
        for z, hgt in ((0.14, 0.078), (0.21, 0.066)):
            loft(bm, [(z, 0.078, hgt, 0, hgt + 0.004), (z + 0.022, 0.077, hgt - 0.004, 0, hgt)], n=16, mi=LEA, matrix=foot)
        loft(bm, [(-0.014, 0.080, 0.084), (0.020, 0.076, 0.080)], n=18, mi=LEA,
             matrix=Matrix.Translation(ankle + Vector((0, 0.006, 0.020))))              # ankle cuff
        ellipsoid(bm, ankle + Vector((0.080 * s, -0.004, 0.022)), (0.008, 0.014, 0.014), mi=TRIM, n=8, rings=4)
        return bm

    parts["Knight_Leg_L"] = leg(1)
    parts["Knight_Leg_R"] = leg(-1)

    # ================================================================ sword
    m, _ = aim(grip_r, grip_r + grip_d)
    bm = bmesh.new()
    ellipsoid(bm, Vector((0, 0, 0.140)), (0.038, 0.016, 0.038), mi=TRIM, n=18, rings=8, matrix=m)   # wheel pommel
    ellipsoid(bm, Vector((0, 0, 0.140)), (0.018, 0.020, 0.018), mi=TRIM, n=12, rings=6, matrix=m)
    loft(bm, [(0.112, 0.012, 0.012), (0.100, 0.016, 0.016)], n=10, mi=TRIM, matrix=m)
    loft(bm, [(0.100, 0.016, 0.016), (-0.062, 0.018, 0.018)], n=12, mi=LEA, matrix=m)               # grip
    for zz in [0.085 - 0.022 * i for i in range(7)]:
        loft(bm, [(zz - 0.004, 0.0195, 0.0195), (zz + 0.004, 0.0195, 0.0195)], n=12, mi=LEA, matrix=m)
    loft(bm, [(-0.062, 0.044, 0.024, 0, 0, 4), (-0.090, 0.044, 0.024, 0, 0, 4)], n=12, mi=STEEL, matrix=m)  # langet
    guard = [m @ Vector((x, 0, -0.077 - 0.016 * (abs(x) / 0.14) ** 2.2)) for x in [-0.14 + 0.014 * i for i in range(21)]]
    sweep(bm, guard, [(-0.008, -0.008), (0.008, -0.008), (0.008, 0.008), (-0.008, 0.008)], mi=STEEL,
          up=lambda p, i: m.to_3x3() @ Vector((0, 1, 0)))
    for sx in (-1, 1):
        ellipsoid(bm, Vector((0.142 * sx, 0, -0.098)), (0.014, 0.014, 0.014), mi=STEEL, n=10, rings=6, matrix=m)
    blade = [(-0.090, 0.035, 0.009), (-0.20, 0.033, 0.0085), (-0.76, 0.027, 0.0072), (-0.90, 0.014, 0.0055),
             (-0.96, 0.001, 0.001)]
    loft(bm, blade, n=4, mi=STEEL, caps=(True, False), matrix=m)
    for side in (-1, 1):                                                                 # fuller
        pts = [m @ Vector((0, side * (lerp(0.0085, 0.0074, (zz + 0.10) / -0.62) * 0.92), zz))
               for zz in [-0.10 - 0.031 * i for i in range(21)]]
        sweep(bm, pts, rect(0.009, 0.0016), mi=VOID, up=lambda p, i, sd=side: m.to_3x3() @ Vector((0, sd, 0)))
    parts["Knight_Sword"] = bm

    obs = {}
    for name, bm in parts.items():
        ob = mesh_object(name, bm, mats, coll, root)
        if name == "Knight_Sword":
            for p in ob.data.polygons:
                p.use_smooth = p.material_index not in (STEEL, VOID)
        else:
            subsurf(ob)
        obs[name] = ob

    # ================================================================ scarf: neck rolls, chest drapes, back roll
    bm = bmesh.new()
    rnd = random.Random(4)
    for k, (z, rx, ry, r, dip) in enumerate(((1.700, 0.158, 0.170, 0.032, 0.022), (1.660, 0.180, 0.192, 0.036, 0.040),
                                             (1.618, 0.204, 0.210, 0.038, 0.060), (1.580, 0.226, 0.222, 0.036, 0.080))):
        ph = rnd.uniform(0, TAU)
        pts = loop(z, rx, ry, cy=0.004, n=48, zf=lambda th, dip=dip, ph=ph: -dip * max(0.0, math.cos(th)) ** 2 + 0.008 * math.sin(3 * th + ph),
                   rf=lambda th, ph=ph: 0.04 * math.sin(5 * th + ph))
        sweep(bm, pts, circle(r, 10), closed=True, up=radial((0, 0, 0)),
              scale=None)
    for k, (depth, off, r) in enumerate(((0.10, 0.030, 0.026), (0.175, 0.040, 0.028), (0.245, 0.048, 0.030))):
        pts = []
        for i in range(25):
            ph = lerp(-math.pi / 2, math.pi / 2, i / 24)
            x = (0.165 + 0.02 * k) * math.sin(ph)
            z = 1.585 - depth * math.cos(ph) ** 1.4
            pts.append(torso_front(x, z, off + 0.012 * math.cos(ph)))
        sweep(bm, pts, circle(r, 10), up=lambda p, i: Vector((0, -1, 0.3)), scale=lambda t: 0.55 + 0.45 * math.sin(math.pi * t))
    pts = loop(1.585, 0.215, 0.205, cy=0.01, n=20, th0=math.radians(110), th1=math.radians(250), closed=False,
               zf=lambda th: 0.02 * math.sin(3 * th))
    sweep(bm, pts, circle(0.048, 10), up=radial((0, 0, 0)), scale=lambda t: 0.5 + 0.5 * math.sin(math.pi * t))   # hood roll
    ob = mesh_object("Knight_Scarf", bm, [M["cloth"]], coll, root)
    subsurf(ob)
    obs["Knight_Scarf"] = ob

    # ================================================================ cloth panels
    cl = [M["cloth"]]

    # pelerine: from the neck over the pauldrons; torn ends flare back and out
    COWL = [(0.00, 0.150, 0.168), (0.18, 0.240, 0.200), (0.36, 0.312, 0.232), (0.52, 0.344, 0.248), (1.00, 0.355, 0.248)]
    SPLIT = 0.60

    def pelerine_pos(u, v, Lf):
        th = TAU * u
        c = math.cos(th)
        back = max(0.0, -c)
        side = math.sin(th) ** 2
        z_top = 1.690 + 0.030 * back
        hem = 1.38 - 0.10 * max(0.0, c) ** 6 - 0.17 * back ** 1.5
        zs = [z_top, 1.630, 1.552, 1.468, hem]
        Lf = 1.0 + (Lf - 1.0) * (0.15 + 0.85 * max(side, back))
        vv = v if v <= SPLIT else SPLIT + (v - SPLIT) * Lf
        for k in range(len(COWL) - 1):
            v0, v1 = COWL[k][0], COWL[k + 1][0]
            if vv <= v1 or k == len(COWL) - 2:
                t = (vv - v0) / (v1 - v0)
                rx, ry, z = lerp(COWL[k][1], COWL[k + 1][1], t), lerp(COWL[k][2], COWL[k + 1][2], t), lerp(zs[k], zs[k + 1], t)
                break
        w = max(0.0, (vv - SPLIT) / (1 - SPLIT))
        flare = (0.015 + 0.05 * back + 0.04 * side) * w ** 1.4
        fold = 0.012 * math.sin(9 * th + 0.7) * v ** 1.2
        swag = 0.016 * math.sin(v * math.pi * 6) * max(0.0, c) ** 3 * min(1.0, v * 3)
        r = fold + swag
        return Vector(((rx + r) * math.sin(th), -(ry + r) * c + 0.006, z)) + ang(th) * flare

    bm = bmesh.new()
    cloth(bm, 96, 28, True, pelerine_pos, SPLIT, 11, 2, 4, 0.7, 2.0, 0.02, pinch=0.3, point=(0.2, 0.6))
    ob = mesh_object("Knight_Pelerine", bm, cl, coll, root)
    solidify(ob, 0.010)
    subsurf(ob)
    wrinkle(ob, 0.014)
    obs["Knight_Pelerine"] = ob

    # long torn panel behind, from the belt to the calves, frayed into strands
    def back_pos(u, v, Lf):
        th = math.radians(lerp(118, 242, u))
        e = abs(th - math.pi) / math.radians(62)
        vs = 0.38
        vv = v if v <= vs else vs + (v - vs) * Lf
        z = 1.12 + (0.36 + 0.10 * e ** 2 - 1.12) * vv
        rx, ry = lerp(0.225, 0.34, vv), lerp(0.168, 0.33, vv ** 0.9)
        fold = 0.03 * math.sin(7 * th + 1.1) * vv
        return Vector(((rx + fold) * math.sin(th) + 0.03 * vv * vv, -(ry + fold) * math.cos(th) + 0.01, z))

    bm = bmesh.new()
    cloth(bm, 54, 30, False, back_pos, 0.38, 5, 1, 3, 0.55, 1.30, 0.05, pinch=0.5, point=(0.2, 0.6))
    ob = mesh_object("Knight_BackPanel", bm, cl, coll, root)
    solidify(ob, 0.010)
    subsurf(ob)
    wrinkle(ob, 0.020)
    obs["Knight_BackPanel"] = ob

    # two open coat flaps at the sides, lighter cloth, ending in a few big points
    for side, name in ((-1, "Knight_Flap_R"), (1, "Knight_Flap_L")):
        def flap_pos(u, v, Lf, side=side):
            th = side * math.radians(lerp(38, 105, u))
            e = u                                       # 0 at the front edge, 1 at the back edge
            vs = 0.45
            vv = v if v <= vs else vs + (v - vs) * Lf
            z = 1.10 + (lerp(0.66, 0.46, e) - 1.10) * vv
            rx, ry = lerp(0.232, 0.31, vv), lerp(0.172, 0.25, vv)
            fold = 0.014 * math.sin(6 * u * math.pi + 0.4) * vv
            return Vector(((rx + fold) * math.sin(th), -(ry + fold) * math.cos(th), z))

        bm = bmesh.new()
        cloth(bm, 18, 22, False, flap_pos, 0.45, 21 if side < 0 else 33, 2, 5, 0.75, 1.30, 0.03, pinch=0.25,
              point=(0.3, 0.8))
        ob = mesh_object(name, bm, [M["cloth_light"]], coll, root)
        solidify(ob, 0.010)
        subsurf(ob)
        wrinkle(ob, 0.012)
        obs[name] = ob

    # front fringe from the belt to the knees: many thin strands
    def fringe_pos(u, v, Lf):
        th = math.radians(lerp(-34, 34, u))
        vs = 0.14
        vv = v if v <= vs else vs + (v - vs) * Lf
        z = 1.08 + (0.56 - 1.08) * vv
        rx, ry = lerp(0.228, 0.24, vv), lerp(0.170, 0.235, vv)
        return Vector((rx * math.sin(th), -ry * math.cos(th) - 0.004, z))

    bm = bmesh.new()
    cloth(bm, 30, 20, False, fringe_pos, 0.14, 9, 1, 2, 0.78, 1.15, 0.018, pinch=0.55, point=(0.0, 0.2))
    ob = mesh_object("Knight_Fringe", bm, [M["cloth_dark"]], coll, root)
    solidify(ob, 0.008)
    subsurf(ob)
    obs["Knight_Fringe"] = ob

    # short padded skirt under everything (gambeson), to mid-thigh
    def skirt_pos(u, v, Lf):
        th = TAU * u
        vs = 0.45
        vv = v if v <= vs else vs + (v - vs) * Lf
        z = 1.075 + (0.80 - 1.075) * vv
        rx, ry = lerp(0.214, 0.29, v), lerp(0.158, 0.215, v)
        return Vector((rx * math.sin(th), -ry * math.cos(th), z))

    bm = bmesh.new()
    cloth(bm, 48, 12, True, skirt_pos, 0.45, 8, 2, 4, 0.85, 1.15, 0.01)
    ob = mesh_object("Knight_Skirt", bm, [M["cloth_dark"]], coll, root)
    solidify(ob, 0.010)
    subsurf(ob)
    obs["Knight_Skirt"] = ob
    return obs


# ---------------------------------------------------------------- lights, camera, world

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
        ob.rotation_euler = (Vector((0, 0, 1.05)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()


def setup_camera(scene, coll):
    """Orthographic, 12 deg above the horizon like the atlas drawings; fixed for all 8 directions."""
    cam = bpy.data.objects.get("Camera_Ortho") or bpy.data.objects.get("Camera")
    if cam is None:
        cam = bpy.data.objects.new("Camera_Ortho", bpy.data.cameras.new("Camera_Ortho"))
        coll.objects.link(cam)
    cam.name = cam.data.name = "Camera_Ortho"
    move_to(cam, coll)
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 2.55
    cam.data.clip_end = 50
    elev = math.radians(12)
    target = Vector((0, 0, 1.0))
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


def setup_refs(coll):
    """Atlas frames as viewport-only image empties behind the model (not rendered)."""
    for name, fname, loc, rot in (
        ("Ref_Front", "ref_front.png", (0, 1.6, 0), (math.radians(90), 0, 0)),
        ("Ref_Side", "ref_side.png", (-1.6, 0, 0), (math.radians(90), 0, math.radians(-90))),
    ):
        path = os.path.join(REFS, fname)
        if not os.path.exists(path):
            continue
        img = bpy.data.images.load(path, check_existing=True)
        ob = bpy.data.objects.new(name, None)
        ob.empty_display_type = "IMAGE"
        ob.data = img
        ob.empty_display_size = 2.38
        ob.empty_image_offset = (-0.5, 0.0)
        ob.location, ob.rotation_euler = loc, rot
        ob.hide_render = True
        ob.use_empty_image_alpha = True
        ob.color[3] = 0.5
        coll.objects.link(ob)


# ---------------------------------------------------------------- main

VIEWS = [("01_front", 0), ("02_front_right", 45), ("03_right", 90), ("04_back_right", 135),
         ("05_back", 180), ("06_back_left", 225), ("07_left", 270), ("08_front_left", 315)]


def main():
    scene = bpy.context.scene
    print("SCENE_OBJECTS", [(o.name, o.type) for o in scene.objects])
    reset_scene()
    c_knight, c_refs = collection("Knight"), collection("Refs")
    c_lights, c_cams = collection("Lights"), collection("Cameras")

    M = {
        "armor": material("M_Armor", (0.082, 0.077, 0.074), metallic=0.70, rough=0.55, bump=(140, 0.25)),
        "leather": material("M_Leather", (0.035, 0.025, 0.020), rough=0.75, bump=(220, 0.3)),
        "trim": material("M_Trim_Copper", (0.30, 0.15, 0.075), metallic=1.0, rough=0.40, bump=(160, 0.2)),
        "void": material("M_Void", (0.0, 0.0, 0.0), rough=1.0),
        "steel": material("M_Steel", (0.45, 0.45, 0.47), metallic=1.0, rough=0.32, bump=(300, 0.08)),
        "cloth": material("M_Cloth_Crimson", (0.090, 0.009, 0.008), rough=0.92, bump=(380, 0.35)),
        "cloth_light": material("M_Cloth_Crimson_Light", (0.150, 0.026, 0.020), rough=0.92, bump=(380, 0.35)),
        "cloth_dark": material("M_Cloth_Dark", (0.040, 0.016, 0.014), rough=0.95, bump=(380, 0.35)),
    }

    root = bpy.data.objects.new("Knight_Root", None)
    root.empty_display_type = "ARROWS"
    root.empty_display_size = 0.4
    c_knight.objects.link(root)
    obs = build_knight(c_knight, root, M)

    setup_world(scene)
    setup_lights(c_lights)
    setup_camera(scene, c_cams)
    setup_refs(c_refs)

    deps = bpy.context.evaluated_depsgraph_get()
    pts = [o.evaluated_get(deps).matrix_world @ Vector(c) for o in obs.values() for c in o.evaluated_get(deps).bound_box]
    lo = [round(min(p[i] for p in pts), 3) for i in range(3)]
    hi = [round(max(p[i] for p in pts), 3) for i in range(3)]
    print("KNIGHT_PARTS", {n: (len(o.data.vertices), len(o.data.polygons)) for n, o in obs.items()})
    print("KNIGHT_BOUNDS", lo, hi)

    os.makedirs(os.path.dirname(OUT_BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    try:
        bpy.ops.file.make_paths_relative()
        bpy.ops.wm.save_mainfile()
    except Exception as e:
        print("relative paths:", e)

    if "--no-render" not in ARGS:
        os.makedirs(OUT_PREV, exist_ok=True)
        only = [a for a in ARGS if a[:1].isdigit()]
        for name, deg in VIEWS:
            if only and name not in only:
                continue
            root.rotation_euler = (0, 0, math.radians(deg))
            scene.render.filepath = os.path.join(OUT_PREV, f"knight_{name}.png")
            bpy.ops.render.render(write_still=True)
            print("RENDERED", scene.render.filepath)
        root.rotation_euler = (0, 0, 0)
    print("DONE")


main()
