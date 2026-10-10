# usage: python3 tools/cow/build_cow_frames.py raw.pkl cow_ascii.json preview.png  (cow_ascii.json → COW_ART, cow_ascii_index.json → CI6 in index.html; needs opencv-python-headless)
# Cow frames as glyph art, on the knight's fine grid. All frames face right (the atlas's left-facing ones
# are mirrored); the game mirrors them back when a cow heads left.
#   idle 5 poses; walk, run and eat cycles and the hurt and die moves get in-betweens made along optical
#   flow, so the motion reads smooth (frame ranges are written to <out>_index.json)
import sys, pickle, json, numpy as np
from PIL import Image, ImageFilter
R = pickle.load(open(sys.argv[1], 'rb'))
COLS, ROWS = 144, 54                    # 0.6 x 0.9 cells: a 199 x 112 tile keeps its shape
TW, TH, FX, FY = 199, 112, 99.5, 107
RAMP = " .:-=+*#%@"
B = np.array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]).reshape(4, 4) / 16 - 0.5
def h32(x, y):
    M = 0xffffffff; h = (x * 374761393 + y * 668265263) & M; h = ((h ^ (h >> 13)) * 1274126177) & M
    return ((h ^ (h >> 16)) & M) / 4294967295
GRAIN = np.array([[(h32(cx * 7 + 91, cy * 13) - 0.5) * 0.05 for cx in range(COLS)] for cy in range(ROWS)])
def to_ascii(tile, detail=1.0):
    t = tile.resize((COLS * 2, ROWS * 2), Image.BICUBIC); a = np.asarray(t).astype(float)
    lum = a[..., :3].mean(2) / 255; al = a[..., 3] / 255
    pm = Image.fromarray((lum * al * 255).astype(np.uint8)); cov = Image.fromarray((al * 255).astype(np.uint8))
    bl = np.asarray(pm.filter(ImageFilter.GaussianBlur(2.5))).astype(float); bc = np.asarray(cov.filter(ImageFilter.GaussianBlur(2.5))).astype(float)
    sharp = lum + detail * (lum - np.where(bc > 8, bl / np.maximum(bc, 1), lum))
    A = al.reshape(ROWS, 2, COLS, 2).mean((1, 3))
    S = (sharp * al).reshape(ROWS, 2, COLS, 2).sum((1, 3)) / np.maximum(al.reshape(ROWS, 2, COLS, 2).sum((1, 3)), 1e-6)
    inside = A >= 0.3; lo, hi = np.percentile(S[inside], 3), np.percentile(S[inside], 98)
    V = np.clip((S - lo) / max(1e-3, hi - lo), 0, 1)
    # Lit like the trees: a dark mass under a low moon. The coat's own pattern is kept only faintly;
    # the light catches the back, the poll and the rump (the top edge of every column) and dies away
    # down the flank, so belly and legs sink into the grass.
    rim = np.zeros_like(V)
    for cx in range(COLS):
        col = np.nonzero(inside[:, cx])[0]
        if len(col) == 0: continue
        d = np.arange(ROWS) - col.min()
        rim[:, cx] = np.clip(1 - d / 7.0, 0, 1) ** 1.4
    down = np.clip((np.arange(ROWS)[:, None] - 30) / 22, 0, 1)        # lower rows: belly and legs darker
    L = (0.32 * V ** 1.2 + 0.62 * rim) * (1 - 0.55 * down)
    lines = []
    for cy in range(ROWS):
        row = []
        for cx in range(COLS):
            if A[cy, cx] < 0.3: row.append(' '); continue
            v = L[cy, cx] * min(1, A[cy, cx] * 1.25) + B[cy & 3, cx & 3] * 0.22 + GRAIN[cy, cx] * 2
            if v < 0.2: row.append("'"); continue
            row.append(RAMP[min(9, 1 + int(min(0.999, v) * 9))])
        lines.append(''.join(row).rstrip())
    top = 0
    while top < len(lines) and not lines[top]: top += 1
    return str(top) + '\n' + '\n'.join(lines[top:])
def img(r, c):
    f = R[r][c]; return Image.fromarray(f['rgba'])
walk = R[1]
# the 5th walk cow is two cows touching: split them at the emptiest column
w4 = walk[4]['rgba']; col = (w4[..., 3] > 40).sum(0); mid = w4.shape[1] // 2
cut = mid - 40 + int(np.argmin(col[mid - 40: mid + 40]))
def trim(a):
    ys, xs = np.nonzero(a[..., 3] > 10); return a[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1]
WALK = [img(1, 0), img(1, 1), img(1, 2), img(1, 3), Image.fromarray(trim(w4[:, :cut])), Image.fromarray(trim(w4[:, cut:])), img(1, 5), img(1, 6)]
L = lambda r, c: img(r, c).transpose(Image.FLIP_LEFT_RIGHT)
IDLE = [img(0, 3), L(0, 1), L(0, 0), L(0, 4), img(0, 5)]
RUN = [img(2, c) for c in range(8)]
EAT = [L(3, 0), img(3, 2), img(3, 3), img(3, 4), L(3, 5), img(3, 6)]
HURT = [img(4, 0), img(4, 1), L(4, 2), L(4, 3), img(4, 4), L(4, 5)]
DIE = [img(5, c) for c in range(7)]
frames = IDLE + WALK + RUN + EAT + HURT + DIE
SCALE = 0.7 * 92 / IDLE[0].height          # a standing cow is about 0.7 of the knight
def place(im, mode):
    a = np.asarray(im)[..., 3] > 40; ys, xs = np.nonzero(a); h = ys.max() - ys.min()
    band = ys < ys.min() + h * 0.6                # the back and flank, not the legs or a swinging tail
    cx = np.median(xs[band])
    w, hh = max(1, round(im.width * SCALE)), max(1, round(im.height * SCALE))
    s = im.resize((w, hh), Image.LANCZOS)
    t = Image.new('RGBA', (TW, TH), (0, 0, 0, 0))
    t.paste(s, (round(FX - cx * SCALE), round(FY - ys.max() * SCALE)), s)
    return t
# Work at 3x the tile so the in-betweens are made from real detail, then print each frame as glyphs.
K3 = 3
def place3(im):
    a = np.asarray(im)[..., 3] > 40; ys, xs = np.nonzero(a); h = ys.max() - ys.min()
    cx = np.median(xs[ys < ys.min() + h * 0.6]); sc = SCALE * K3
    s2 = im.resize((max(1, round(im.width * sc)), max(1, round(im.height * sc))), Image.LANCZOS)
    t = Image.new('RGBA', (TW * K3, TH * K3), (0, 0, 0, 0))
    t.paste(s2, (round(FX * K3 - cx * sc), round(FY * K3 - ys.max() * sc)), s2)
    return np.asarray(t).astype(np.float32)
import cv2
def tween(A, B, t):
    """A frame t of the way from A to B: both warped along dense optical flow and blended."""
    ga = (A[..., :3].mean(2) * A[..., 3] / 255).astype(np.uint8); gb = (B[..., :3].mean(2) * B[..., 3] / 255).astype(np.uint8)
    fab = cv2.calcOpticalFlowFarneback(ga, gb, None, 0.5, 4, 21, 5, 7, 1.5, 0)
    fba = cv2.calcOpticalFlowFarneback(gb, ga, None, 0.5, 4, 21, 5, 7, 1.5, 0)
    h, w = ga.shape; gx, gy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    # backward warping: a pixel of the in-between at p came from A at p - t*f and from B at p + (1-t)*f
    wa = cv2.remap(A, gx - t * fab[..., 0], gy - t * fab[..., 1], cv2.INTER_LINEAR, borderValue=0)
    wb = cv2.remap(B, gx - (1 - t) * fba[..., 0], gy - (1 - t) * fba[..., 1], cv2.INTER_LINEAR, borderValue=0)
    out = wa * (1 - t) + wb * t
    # keep the coat crisp: colour from whichever source dominates, coverage blended
    return out
def expand(seq, n, cyclic):
    """n frames between each pair (the originals included)."""
    T = [place3(f) for f in seq]; res = []
    pairs = len(T) if cyclic else len(T) - 1
    for i in range(pairs):
        A, B = T[i], T[(i + 1) % len(T)]
        res.append(A)
        for k in range(1, n): res.append(tween(A, B, k / n))
    if not cyclic: res.append(T[-1])
    return [Image.fromarray(np.clip(r, 0, 255).astype(np.uint8)) for r in res]
SEQ = [('idle', IDLE, 1, False), ('walk', WALK, 6, True), ('run', RUN, 6, True), ('eat', EAT, 5, True), ('hurt', HURT, 3, False), ('die', DIE, 3, False)]
tiles, index = [], {}
for name, seq, n, cyc in SEQ:
    fr = [Image.fromarray(place3(f).astype(np.uint8)) for f in seq] if n == 1 else expand(seq, n, cyc)
    index[name] = [len(tiles), len(fr)]; tiles += fr
print('index', index)
json.dump(index, open(sys.argv[2].replace('.json', '_index.json'), 'w'))
out = [to_ascii(t) for t in tiles]
json.dump(out, open(sys.argv[2], 'w'))
prev = Image.new('RGB', (TW * 8, TH * ((len(tiles) + 7) // 8)), (40, 40, 40))
for i, t in enumerate(tiles): t2 = t.resize((TW, TH), Image.LANCZOS); prev.paste(t2, ((i % 8) * TW, (i // 8) * TH), t2)
prev.save(sys.argv[3])
print('frames', len(out), 'chars', sum(map(len, out)), 'cut', cut)
