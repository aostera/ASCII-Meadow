# Cow frames from the dark-fantasy cow atlases (idle, walk, run, jump; tools/cut_atlases5.py cuts them).
# Every frame was looked at; the atlases have faults, worked around here:
#  - directions per row are not the game's eight (walk has no clean E, N or W; run and idle have no NW):
#    each game direction takes the nearest drawn row, mirrored where that is closer (a cow is symmetric);
#  - in the walk and run rows seen from the front the tail travels right to left and snaps back at the loop:
#    the row is followed by its own mirror, so the tail swings back instead of jumping;
#  - idle front, frame 4: the tail jumps to the other leg for one frame: dropped. Idle loops ping-pong;
#  - the jump sheet has directions in columns and phases in rows, and most columns turn mid-jump (S, SE,
#    NE...): only N, W and SW are clean; E and SE are their mirrors; the rest don't hop.
# In-betweens along optical flow make the cycles smooth; the glyphs are lit like the trees (moonlight on the
# back, belly and legs in the grass). d8 order: S, SW, W, NW, N, NE, E, SE.
import sys, pickle, json, numpy as np, cv2
from PIL import Image, ImageFilter
R = pickle.load(open(sys.argv[1], 'rb'))
COLS, ROWS = 144, 54
TW, TH, FX, FY = 199, 112, 99.5, 107
RAMP = " .:-=+*#%@"
B = np.array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]).reshape(4, 4) / 16 - 0.5
def h32(x, y):
    M = 0xffffffff; h = (x * 374761393 + y * 668265263) & M; h = ((h ^ (h >> 13)) * 1274126177) & M
    return ((h ^ (h >> 16)) & M) / 4294967295
GRAIN = np.array([[(h32(cx * 7 + 91, cy * 13) - 0.5) * 0.05 for cx in range(COLS)] for cy in range(ROWS)])
def to_ascii(tile):
    t = tile.resize((COLS * 2, ROWS * 2), Image.BICUBIC); a = np.asarray(t).astype(float)
    lum = a[..., :3].mean(2) / 255; al = a[..., 3] / 255
    pm = Image.fromarray((lum * al * 255).astype(np.uint8)); cov = Image.fromarray((al * 255).astype(np.uint8))
    bl = np.asarray(pm.filter(ImageFilter.GaussianBlur(2.5))).astype(float); bc = np.asarray(cov.filter(ImageFilter.GaussianBlur(2.5))).astype(float)
    sharp = lum + (lum - np.where(bc > 8, bl / np.maximum(bc, 1), lum))
    A = al.reshape(ROWS, 2, COLS, 2).mean((1, 3))
    S = (sharp * al).reshape(ROWS, 2, COLS, 2).sum((1, 3)) / np.maximum(al.reshape(ROWS, 2, COLS, 2).sum((1, 3)), 1e-6)
    inside = A >= 0.3
    if inside.sum() < 5: return '0\n'
    lo, hi = np.percentile(S[inside], 3), np.percentile(S[inside], 98)
    V = np.clip((S - lo) / max(1e-3, hi - lo), 0, 1)
    rim = np.zeros_like(V)
    for cx in range(COLS):
        col = np.nonzero(inside[:, cx])[0]
        if len(col) == 0: continue
        rim[:, cx] = np.clip(1 - (np.arange(ROWS) - col.min()) / 7.0, 0, 1) ** 1.4
    down = np.clip((np.arange(ROWS)[:, None] - 30) / 22, 0, 1)
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
def fr(atlas, r, c, flip=False):
    im = Image.fromarray(R['cow_' + atlas][r][c]['rgba']); return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im
def H(im): a = np.asarray(im)[..., 3] > 60; ys = np.nonzero(a)[0]; return ys.max() - ys.min()
# one scale per atlas: the front rows matched to idle's front row; idle's profile row sets the size
med = lambda ims: float(np.median([H(i) for i in ims]))
ref_S = med([fr('idle', 0, c) for c in range(6)])
BASE = 0.7 * 92 / med([fr('idle', 2, c) for c in range(6)])       # a standing cow ~0.7 of the knight
SC = {'idle': BASE, 'walk': BASE * ref_S / med([fr('walk', 0, c) for c in range(7)]),
      'run': BASE * ref_S / med([fr('run', 0, c) for c in range(7)]),
      }
# the jump sheet's cows are drawn at their own sizes per column: each clean column is matched, standing
# frames to standing frames, to the idle row of the same direction
JMATCH = {4: 4, 5: 6, 6: 7}
JSC = {c: BASE * med([fr('idle', r, k) for k in range(6)]) / med([fr('jump', 0, c), fr('jump', 7, c)]) for c, r in JMATCH.items()}
K3 = 3
def place3(im, sc, anchor=None):
    a = np.asarray(im)[..., 3] > 40; ys, xs = np.nonzero(a); h = ys.max() - ys.min()
    cx, by = (np.median(xs[ys < ys.min() + h * 0.6]), ys.max()) if anchor is None else anchor
    s = sc * K3; s2 = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    t = Image.new('RGBA', (TW * K3, TH * K3), (0, 0, 0, 0))
    t.paste(s2, (round(FX * K3 - cx * s), round(FY * K3 - by * s)), s2)
    return np.asarray(t).astype(np.float32)
def tween(A, B, t):
    ga = (A[..., :3].mean(2) * A[..., 3] / 255).astype(np.uint8); gb = (B[..., :3].mean(2) * B[..., 3] / 255).astype(np.uint8)
    P = (0.5, 4, 25, 5, 7, 1.5, 0)
    fab = cv2.calcOpticalFlowFarneback(ga, gb, None, *P); fba = cv2.calcOpticalFlowFarneback(gb, ga, None, *P)
    h, w = ga.shape; gx, gy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    wa = cv2.remap(A, gx - t * fab[..., 0], gy - t * fab[..., 1], cv2.INTER_LINEAR, borderValue=0)
    wb = cv2.remap(B, gx - (1 - t) * fba[..., 0], gy - (1 - t) * fba[..., 1], cv2.INTER_LINEAR, borderValue=0)
    return wa * (1 - t) + wb * t
def expand(T, n, cyclic):
    res = []
    for i in range(len(T) if cyclic else len(T) - 1):
        A, Bb = T[i], T[(i + 1) % len(T)]; res.append(A)
        for k in range(1, n): res.append(tween(A, Bb, k / n))
    if not cyclic: res.append(T[-1])
    return res
def row(atlas, r, cols, flip=False): return [fr(atlas, r, c, flip) for c in cols]
I6, W7 = range(6), range(7)
# game direction -> drawn frames
IDLE = [row('idle', 0, [0, 1, 2, 3, 5]), row('idle', 5, I6), row('idle', 6, I6), row('idle', 3, I6, True),
        row('idle', 4, I6), row('idle', 3, I6), row('idle', 2, I6), row('idle', 1, I6)]
WALK = [row('walk', 0, W7) + row('walk', 0, W7, True), row('walk', 5, W7), row('walk', 4, W7), row('walk', 3, W7, True),
        row('walk', 3, W7), row('walk', 2, W7), row('walk', 4, W7, True), row('walk', 1, W7)]
RUN = [row('run', 0, W7) + row('run', 0, W7, True), row('run', 7, W7), row('run', 6, W7), row('run', 3, W7, True),
       row('run', 4, W7), row('run', 3, W7), row('run', 2, W7), row('run', 1, W7)]
JCOL = {1: (6, False), 2: (5, False), 4: (4, False), 6: (5, True), 7: (6, True)}
tiles, index = [], {'idle': [], 'walk': [], 'run': [], 'jump': []}
def add(name, frames):
    index[name].append([len(tiles), len(frames)]); tiles.extend(Image.fromarray(np.clip(f, 0, 255).astype(np.uint8)) for f in frames)
for d in range(8):
    add('idle', expand([place3(f, SC['idle']) for f in IDLE[d]], 2, False))     # played back and forth
for d in range(8):
    add('walk', expand([place3(f, SC['walk']) for f in WALK[d]], 3, True))
for d in range(8):
    add('run', expand([place3(f, SC['run']) for f in RUN[d]], 2, True))
for d in range(8):
    if d not in JCOL: index['jump'].append([-1, 0]); continue
    c, fl = JCOL[d]; seq = [fr('jump', r, c, fl) for r in range(8)]
    a0 = np.asarray(seq[0])[..., 3] > 40; ys0 = np.nonzero(a0)[0]; stand = ys0.max() - ys0.min()
    T = []
    for r, im in enumerate(seq):
        a = np.asarray(im)[..., 3] > 40; ys, xs = np.nonzero(a); h = ys.max() - ys.min()
        cx = np.median(xs[ys < ys.min() + h * 0.6])
        by = ys.min() + stand if 2 <= r <= 5 else ys.max()        # in the air: hang from the back, the game adds the arc
        T.append(place3(im, JSC[c], (cx, by)))
    add('jump', expand(T, 2, False))
print('index', json.dumps(index))
json.dump(index, open(sys.argv[2].replace('.json', '_index.json'), 'w'))
out = [to_ascii(t.resize((TW, TH), Image.LANCZOS)) for t in tiles]
json.dump(out, open(sys.argv[2], 'w'))
prev = Image.new('RGB', (TW * 10, TH * ((len(tiles) + 9) // 10)), (40, 40, 40))
for i, t in enumerate(tiles): t2 = t.resize((TW, TH), Image.LANCZOS); prev.paste(t2, ((i % 10) * TW, (i // 10) * TH), t2)
prev.save(sys.argv[3])
print('frames', len(out), 'chars', sum(map(len, out)), 'scales', SC, JSC)
