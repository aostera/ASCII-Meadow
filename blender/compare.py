"""Side-by-side sheet: 3D renders (top) against atlas frames (bottom). python blender/compare.py [out.png]"""
import glob, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
atlas = Image.open(os.path.join(ROOT, "assets/dark_knight/dark_knight_idle_all_directions_atlas.png")).convert("RGBA")
CW, RH = 1254 / 10, 225
# atlas cells (row, col) closest to each 3D view, picked by eye
REF = {"01": (0, 0), "02": (4, 0), "03": (3, 3), "04": (2, 5), "05": (2, 0), "06": (1, 5), "07": (1, 0), "08": (0, 8)}

renders = sorted(glob.glob(os.path.join(ROOT, "blender/previews/knight_0*.png")))
H = 520
tiles = []
for p in renders:
    key = os.path.basename(p)[7:9]
    im = Image.open(p).convert("RGB")
    im = im.resize((int(im.width * H / im.height), H), Image.LANCZOS)
    r, c = REF[key]
    ref = atlas.crop((int(c * CW), int(r * RH) + 5, int((c + 1) * CW), int((r + 1) * RH) + 5))
    bg = Image.new("RGBA", ref.size, (15, 15, 16, 255))
    bg.alpha_composite(ref)
    ref = bg.convert("RGB").resize((int(ref.width * (H - 60) / ref.height), H - 60), Image.LANCZOS)
    t = Image.new("RGB", (im.width, H * 2), (15, 15, 16))
    t.paste(im, (0, 0))
    t.paste(ref, ((im.width - ref.width) // 2, H + 30))
    tiles.append(t)
sheet = Image.new("RGB", (sum(t.width for t in tiles), H * 2), (15, 15, 16))
x = 0
for t in tiles:
    sheet.paste(t, (x, 0))
    x += t.width
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "blender/previews/compare.png")
sheet.save(out)
print(out, sheet.size)
