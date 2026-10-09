# usage: python3 tools/cow/build_cow_frames.py raw.pkl cow_ascii.json preview.png  (cow_ascii.json → COW_ART in index.html)
# Cow frames as glyph art, on the knight's fine grid. All frames face right (the atlas's left-facing ones
# are mirrored); the game mirrors them back when a cow heads left.
#   idle 0-4, walk 5-12, run 13-20, eat 21-26, hurt 27-32, die 33-39
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
    V = np.clip((S - lo) / max(1e-3, hi - lo), 0, 1) ** 0.9
    lines = []
    for cy in range(ROWS):
        row = []
        for cx in range(COLS):
            if A[cy, cx] < 0.3: row.append(' '); continue
            v = (0.3 + 0.7 * V[cy, cx]) * min(1, A[cy, cx] * 1.25) + B[cy & 3, cx & 3] * 0.14 + GRAIN[cy, cx]
            if v < 0.14: row.append("'"); continue
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
tiles = [place(f, 'feet') for f in frames]
out = [to_ascii(t) for t in tiles]
json.dump(out, open(sys.argv[2], 'w'))
prev = Image.new('RGB', (TW * 8, TH * ((len(tiles) + 7) // 8)), (40, 40, 40))
for i, t in enumerate(tiles): prev.paste(t, ((i % 8) * TW, (i // 8) * TH), t)
prev.save(sys.argv[3])
print('frames', len(out), 'chars', sum(map(len, out)), 'cut', cut)
