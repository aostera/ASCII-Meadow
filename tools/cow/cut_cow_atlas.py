# usage: python3 tools/cow/cut_cow_atlas.py assets/cow/cow_animation_atlas.png raw.pkl sheet.png
# Cut the cow atlas (RGBA, transparent background) into frames: rows of animations, one frame per cow.
# Row labels (dark boxes at the left of each row) are dropped; stray bits (tail tips, tufts of grass)
# join the cow whose box they fall in.
import sys, pickle, numpy as np
from collections import deque
from PIL import Image
im = np.asarray(Image.open(sys.argv[1]).convert('RGBA')).astype(np.float32)
A = im[..., 3]; H, W = A.shape
mask = A > 40
lab = np.zeros((H, W), np.int32); comps = []
for y0, x0 in zip(*np.nonzero(mask)):
    if lab[y0, x0]: continue
    cid = len(comps) + 1; q = deque([(y0, x0)]); lab[y0, x0] = cid; pts = []
    while q:
        y, x = q.popleft(); pts.append((y, x))
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                ny, nx = y + dy, x + dx
                if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not lab[ny, nx]: lab[ny, nx] = cid; q.append((ny, nx))
    ys = np.array([p[0] for p in pts]); xs = np.array([p[1] for p in pts])
    comps.append(dict(id=cid, n=len(pts), y0=ys.min(), y1=ys.max(), x0=xs.min(), x1=xs.max(), ys=ys, xs=xs))
big = [c for c in comps if c['n'] > 1500]
labels = [c for c in big if c['y1'] - c['y0'] < 40 and c['x0'] < 140]
cows = [c for c in big if c not in labels]
print('components', len(comps), 'cows', len(cows), 'labels', len(labels))
# rows: cluster by vertical centre
cows.sort(key=lambda c: (c['y0'] + c['y1']) / 2)
rows = []
for c in cows:
    cy = (c['y0'] + c['y1']) / 2
    if rows and abs(cy - rows[-1]['cy']) < 60: rows[-1]['c'].append(c); rows[-1]['cy'] = np.mean([(k['y0'] + k['y1']) / 2 for k in rows[-1]['c']])
    else: rows.append(dict(cy=cy, c=[c]))
small = [c for c in comps if c['n'] <= 1500]
frames = []
for r in rows:
    row = []
    for c in sorted(r['c'], key=lambda c: c['x0']):
        ys, xs = [c['ys']], [c['xs']]
        for s in small:   # strays inside this cow's box (with a margin) are part of it
            if s['x0'] >= c['x0'] - 12 and s['x1'] <= c['x1'] + 12 and s['y0'] >= c['y0'] - 12 and s['y1'] <= c['y1'] + 12: ys.append(s['ys']); xs.append(s['xs'])
        ys = np.concatenate(ys); xs = np.concatenate(xs)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        rgba = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
        rgba[ys - y0, xs - x0] = im[ys, xs].astype(np.uint8)
        row.append(dict(rgba=rgba, x0=x0, y0=y0))
    frames.append(row)
print('rows', [len(r) for r in frames])
pickle.dump(frames, open(sys.argv[2], 'wb'))
# a contact sheet with indices
TW, TH = 210, 150
sheet = Image.new('RGB', (TW * max(len(r) for r in frames), TH * len(frames)), (40, 40, 40))
from PIL import ImageDraw
d = ImageDraw.Draw(sheet)
for ri, r in enumerate(frames):
    for ci, f in enumerate(r):
        t = Image.fromarray(f['rgba']); t.thumbnail((TW - 6, TH - 16))
        sheet.paste(t, (ci * TW + 3, ri * TH + 14), t); d.text((ci * TW + 3, ri * TH + 1), '%d.%d' % (ri, ci), fill=(255, 220, 0))
sheet.save(sys.argv[3])
