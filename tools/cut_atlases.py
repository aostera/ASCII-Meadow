# usage: python3 tools/cut_atlases.py assets/dark_knight raw4.pkl
# Cut the dark-knight atlases (RGBA, 10 columns) into frames: components of the alpha mask go to the grid
# cell nearest their centroid, so swords that cross into a neighbour's cell stay with their owner.
import sys, pickle, numpy as np
from collections import deque
from PIL import Image
def label(mask):
    H, W = mask.shape; lab = np.zeros((H, W), np.int32); comps = []; cur = 0
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if lab[y0, x0]: continue
        cur += 1; q = deque([(y0, x0)]); lab[y0, x0] = cur; n = 0; sx = sy = 0; pts = []
        while q:
            y, x = q.popleft(); n += 1; sx += x; sy += y; pts.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not lab[ny, nx]: lab[ny, nx] = cur; q.append((ny, nx))
        comps.append(dict(id=cur, n=n, cx=sx / n, cy=sy / n, pts=pts))
    return lab, comps
def cut(path, nrows, ncols=10):
    im = np.asarray(Image.open(path).convert('RGBA')).astype(np.float32)
    A = im[..., 3]; L = im[..., :3].mean(2)
    H, W = A.shape
    mask = A > 24
    lab, comps = label(mask)
    big = [c for c in comps if c['n'] > 400]
    # row centres: 1-D k-means on the big components' centroids
    ys = np.array([c['cy'] for c in big]); cen = np.linspace(ys.min(), ys.max(), nrows)
    for _ in range(30):
        k = np.abs(ys[:, None] - cen[None]).argmin(1)
        cen = np.array([ys[k == r].mean() if (k == r).any() else cen[r] for r in range(nrows)])
    cw = W / ncols
    frames = [[None] * ncols for _ in range(nrows)]
    cells = {}
    for c in comps:
        if c['n'] < 6: continue
        r = int(np.abs(cen - c['cy']).argmin()); col = int(min(ncols - 1, max(0, c['cx'] // cw)))
        cells.setdefault((r, col), []).append(c)
    for (r, col), cs in cells.items():
        pts = [p for c in cs for p in c['pts']]
        py = np.array([p[0] for p in pts]); px = np.array([p[1] for p in pts])
        y0, y1, x0, x1 = py.min(), py.max() + 1, px.min(), px.max() + 1
        a = np.zeros((y1 - y0, x1 - x0), np.float32); l = np.zeros_like(a)
        a[py - y0, px - x0] = A[py, px]; l[py - y0, px - x0] = L[py, px]
        frames[r][col] = dict(L=l.astype(np.uint8), A=a.astype(np.uint8), x0=x0, y0=y0)
    return frames
if __name__ == '__main__':
    out = {}
    base = sys.argv[1]
    for name, nr in [('walk', 5), ('run', 5), ('idle', 5), ('jump', 6)]:
        fn = base + '/dark_knight_%s_%s.png' % (name, 'all_directions_atlas' if name == 'idle' else 'multi_angle_atlas')
        out[name] = cut(fn, nr)
        print(name, [[f is not None for f in row].count(True) for row in out[name]])
    pickle.dump(out, open(sys.argv[2], 'wb'))
