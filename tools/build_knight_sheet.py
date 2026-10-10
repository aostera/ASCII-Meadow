# Knight sheet from the dark-knight atlases. Game d8 order: 0 S, 1 SW, 2 W, 3 NW, 4 N, 5 NE, 6 E, 7 SE.
# The atlases cover the left-facing half; the right-facing directions are mirrored where no frame exists.
#   0-7      idle, one pose per direction (from the idle turntable)
#   8-87     walk, 8 directions x 10 frames ("run" atlas: a calm stride whose legs really alternate)
#   88-151   run, 8 directions x 8 frames ("walk" atlas: knee high, cloak flying)
#   152-191  jump, 4 rows (S, NW, N, NE = NW mirrored) x 10 phases
import pickle, sys, json, numpy as np
from PIL import Image
sys.path.insert(0, sys.argv[2])
from to_ascii import frame_to_ascii
R5 = pickle.load(open(sys.argv[1], 'rb'))
def fr(name, idx):
    a = R5['knight_' + name][idx // 10][idx % 10]['rgba']
    return dict(L=a[..., :3].mean(2).astype(np.uint8), A=a[..., 3].copy())
def erode(m, r):
    o = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1): o &= np.roll(np.roll(m, dy, 0), dx, 1)
    return o
def meas(f):
    m = f['A'] > 128; e = erode(m, 3); ys, xs = np.nonzero(e); allys = np.nonzero(m)[0]
    top, bot = allys.min(), ys.max(); h = bot - top
    sel = (ys > top + h * 0.18) & (ys < top + h * 0.5)
    tx = np.median(xs[sel])
    return dict(tx=tx, top=top, bot=bot, h=h)
TW, TH, FX, FY, FH = 144, 112, 72, 107, 92
# Every frame was looked at. The idle turntable turns S -> W -> N, then back to W, then jumps to E -> S:
# there is no back-right (NE) pose, so NE is NW mirrored (frame 3.0 is E in profile, not NE).
IDLE = {0: 0, 1: 6, 2: 9, 3: 14, 4: 20, 5: 14, 6: 31, 7: 35}; IFLIP = {5}
STAND = np.median([meas(fr('idle', i))['h'] for i in IDLE.values()])
def place(f, mode='feet', ref=None, flip=False):
    m = meas(f); ref = ref or STAND; sc = FH / ref
    L = Image.fromarray(f['L']); A = Image.fromarray(f['A'])
    w, h = max(1, round(L.width * sc)), max(1, round(L.height * sc))
    L = L.resize((w, h), Image.LANCZOS); A = A.resize((w, h), Image.LANCZOS)
    footy = m['bot'] if mode == 'feet' else m['top'] + ref * 0.985
    t = Image.new('RGBA', (TW, TH), (0, 0, 0, 0)); im = Image.merge('RGBA', (L, L, L, A))
    t.paste(im, (round(FX - m['tx'] * sc), round(FY - footy * sc)), im)
    return t.transpose(Image.FLIP_LEFT_RIGHT) if flip else t
def seq(ids, n): return [ids[min(len(ids) - 1, int(k * len(ids) / n))] for k in range(n)]
tiles = []
for d in range(8): tiles.append(place(fr('idle', IDLE[d]), flip=d in IFLIP))
WALK = {0: list(range(0, 10)), 1: list(range(10, 20)), 2: list(range(20, 30)), 5: list(range(30, 40)), 4: list(range(40, 47))}   # row 3 walks away to the right
MIR = {3: 5, 5: 3, 6: 2, 7: 1}
WREF = np.median([meas(fr('run', i))['h'] for ids in WALK.values() for i in ids]) / 0.985
for d in range(8):
    src, flip = (WALK[d], False) if d in WALK else (WALK[MIR[d]], True)
    for i in seq(src, 10): tiles.append(place(fr('run', i), ref=WREF, flip=flip))
# Run ("walk" atlas): row 1 back-left (1.0-1.5) turning front-left (1.6-1.9), row 2 back-left (2.0-2.3)
# turning to profile (2.4-2.9), row 3 back-right (3.0-3.5) turning front-right (3.6-3.9), row 4 S. There is
# no straight-back run: N takes the back-right frames. Only E is a mirror.
RUN = {0: list(range(40, 50)), 1: list(range(16, 20)), 2: list(range(24, 30)), 3: list(range(10, 16)), 4: list(range(30, 36)),
       5: list(range(30, 36)), 7: list(range(36, 40))}
RMIR = {6: 2}
RREF = np.median([meas(fr('walk', i))['h'] for ids in RUN.values() for i in ids]) / 0.97
for d in range(8):
    src, flip = (RUN[d], False) if d in RUN else (RUN[RMIR[d]], True)
    for i in seq(src, 8): tiles.append(place(fr('walk', i), ref=RREF, flip=flip))
# Jump rows: 0 and 1 S, 2 back-right (2.8-2.9 land facing back-left), 3 back-left, 4 back-right with
# 4.4 straight back (4.7-4.9 land facing the camera!), 5 back-left (5.9 lands facing the camera).
# Game rows S, NW, N, NE; the landings that turn are replaced by row 3's landing, mirrored where needed.
J = lambda ids, fl=False: [(i, fl) for i in ids]
JROWS = [J(range(0, 10)), J(range(30, 40)), J(range(40, 47)) + J(range(37, 40), True), J(range(20, 28)) + J(range(38, 40), True)]
JREF = np.median([meas(fr('jump', 39))['h'], meas(fr('jump', 9))['h']])
for row in JROWS:
    for c, (i, flip) in enumerate(row): tiles.append(place(fr('jump', i), 'air' if 2 <= c <= 5 else 'feet', ref=JREF, flip=flip))
out = []
for t in tiles:
    top, lines = frame_to_ascii(t)
    out.append(str(top) + '\n' + '\n'.join(lines))
json.dump(out, open(sys.argv[3], 'w'))
C = 8; rows = (len(tiles) + C - 1) // C
prev = Image.new('RGB', (TW * C, TH * rows), (60, 15, 15))
for i, t in enumerate(tiles): prev.paste(t, ((i % C) * TW, (i // C) * TH), t)
prev.save(sys.argv[4])
print('frames', len(out), 'chars', sum(map(len, out)))
