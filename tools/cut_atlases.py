import numpy as np, base64, io
from collections import deque
from PIL import Image

def bands(mask, axis, mingap, minlen):
    r = mask.sum(axis)
    out, s, gap = [], None, 0
    for i, v in enumerate(r > 0):
        if v:
            if s is None: s = i
            gap = 0; e = i
        elif s is not None:
            gap += 1
            if gap >= mingap:
                if e - s > minlen: out.append((s, e + 1))
                s = None
    if s is not None and e - s > minlen: out.append((s, e + 1))
    return out

def bgmask(a):  # background = near-black region connected to the border
    H, W = a.shape; dark = a < 14
    bg = np.zeros_like(dark); q = deque()
    for x in range(W):
        for y in (0, H - 1):
            if dark[y, x] and not bg[y, x]: bg[y, x] = 1; q.append((y, x))
    for y in range(H):
        for x in (0, W - 1):
            if dark[y, x] and not bg[y, x]: bg[y, x] = 1; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W and dark[ny, nx] and not bg[ny, nx]: bg[ny, nx] = 1; q.append((ny, nx))
    return bg

def label(mask):
    H, W = mask.shape; lab = np.zeros((H, W), np.int32); comps = []; cur = 0
    for y0, x0 in zip(*np.nonzero(mask)):
        if lab[y0, x0]: continue
        cur += 1; q = deque([(y0, x0)]); lab[y0, x0] = cur; xs = []
        while q:
            y, x = q.popleft(); xs.append(x)
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not lab[ny, nx]: lab[ny, nx] = cur; q.append((ny, nx))
        comps.append([cur, len(xs), min(xs), max(xs), sum(xs) / len(xs)])
    return lab, comps

def frames(path, nrows_expect):
    a = np.asarray(Image.open(path).convert('L')).astype(np.uint8)
    bg = bgmask(a); fg = ~bg
    out = []
    for (y0, y1) in bands(fg, 1, 6, 30):
        lab, comps = label(fg[y0:y1])
        big = sorted([c for c in comps if c[1] > 1200], key=lambda c: c[4])
        groups = []                              # bodies: big pieces whose spans overlap belong together
        for c in big:
            g = groups[-1] if groups else None
            if g and min(g[3], c[3]) - max(g[2], c[2]) > 0.35 * min(g[3] - g[2], c[3] - c[2]): g[0].append(c[0]); g[2] = min(g[2], c[2]); g[3] = max(g[3], c[3])
            else: groups.append([[c[0]], 0, c[2], c[3]])
        for c in comps:
            if c[1] <= 1200 and c[1] >= 6:
                g = min(groups, key=lambda g: abs((g[2] + g[3]) / 2 - c[4])); g[0].append(c[0])
        for g in groups:
            M = np.isin(lab, g[0]); ys0, xs0 = np.nonzero(M)
            x0, x1 = xs0.min(), xs0.max() + 1
            m = M[:, x0:x1]; ys, xs = np.nonzero(m)
            yb = ys.max(); h = yb - ys.min()
            sel = ys > yb - h * 0.1
            out.append(dict(L=a[y0:y1, x0:x1] * m, A=(m * 255).astype(np.uint8), fx=xs[sel].mean(), fy=yb, h=h, w=x1 - x0))
    print(path, len(out))
    return out

idle = frames('knight_idle_all_directions_atlas.png', 8)
walk = frames('knight_walk_atlas.png', 8)
jump = frames('knight_jump_atlas.png', 6)
ref = np.median([f['h'] for f in idle[:10]])
FH = 112; sc = FH / ref
TW, TH, FX, FY = 168, 128, 84, 124      # tile, feet anchor
tiles = []
def place(f, flip=False):
    L = Image.fromarray(f['L']); A = Image.fromarray(f['A'])
    w, h = max(1, round(L.width * sc)), max(1, round(L.height * sc))
    L = L.resize((w, h), Image.LANCZOS); A = A.resize((w, h), Image.LANCZOS)
    t = Image.new('LA', (TW, TH), (0, 0)); im = Image.merge('LA', (L, A))
    t.paste(im, (round(FX - f['fx'] * sc), round(FY - f['fy'] * sc)), im)
    tiles.append(t)
for k in range(8):                       # idle: 8 directions × 5 frames
    for j in range(0, 10, 2): place(idle[k * 10 + j])
for j in range(0, len(walk), 2): place(walk[j])     # walk right, 40 frames
for j in range(0, len(jump), 2): place(jump[j])     # jump right
nI, nW, nJ = 40, len(range(0, len(walk), 2)), len(range(0, len(jump), 2))
# old atlas: walk down / walk up rows, rescaled to match
old = Image.open(io.BytesIO(base64.b64decode(open('../atlas/knight.b64').read().split(',')[1])))
s2 = sc * ref / 150 * 150 / ref  # old tiles had fh=150 for the same character height
s2 = FH / 150
for row in (4, 5):
    for c in range(8):
        tl = old.crop((c * 200, row * 158, c * 200 + 200, row * 158 + 158)).resize((round(200 * s2), round(158 * s2)), Image.LANCZOS)
        t = Image.new('LA', (TW, TH), (0, 0)); t.paste(tl, (round(FX - 100 * s2), round(FY - 155 * s2)), tl); tiles.append(t)
COLSN = 14; rows = (len(tiles) + COLSN - 1) // COLSN
sheet = Image.new('LA', (TW * COLSN, TH * rows), (0, 0))
for i, t in enumerate(tiles): sheet.paste(t, ((i % COLSN) * TW, (i // COLSN) * TH))
rgba = sheet.convert('RGBA')
buf = io.BytesIO(); rgba.save(buf, 'WEBP', quality=82, method=6)
open('sheet.b64', 'w').write('data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode())
print('frames', len(tiles), 'idle', nI, 'walk', nW, 'jump', nJ, 'sheet', sheet.size, 'webp', len(buf.getvalue()))
prev = Image.new('RGB', sheet.size, (150, 30, 30)); prev.paste(sheet.convert('L'), mask=sheet.split()[1]); prev.resize((sheet.width // 2, sheet.height // 2)).save('prev.png')
