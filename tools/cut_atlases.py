# Cut an RGBA atlas laid out as rows x cols into frames. Components of the alpha mask go to the row whose
# centre (k-means on the big components) is nearest and the column cell their centroid falls in, so a sword
# or tail poking into a neighbour's cell stays with its owner.
import sys, pickle, numpy as np, cv2
from collections import deque
from PIL import Image, ImageDraw
def label(mask):
    H, W = mask.shape; lab = np.zeros((H, W), np.int32); comps = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if lab[y0, x0]: continue
        cid = len(comps) + 1; q = deque([(y0, x0)]); lab[y0, x0] = cid; pts = []
        while q:
            y, x = q.popleft(); pts.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not lab[ny, nx]: lab[ny, nx] = cid; q.append((ny, nx))
        p = np.array(pts); comps.append(dict(n=len(pts), cy=p[:, 0].mean(), cx=p[:, 1].mean(), pts=p))
    return comps
def cut(path, nrows, ncols):
    im = np.asarray(Image.open(path).convert('RGBA')).astype(np.uint8)
    A = im[..., 3]; H, W = A.shape
    comps = label(A > 24)
    big = [c for c in comps if c['n'] > 300]
    ys = np.array([c['cy'] for c in big]); cen = np.linspace(ys.min(), ys.max(), nrows)
    for _ in range(50):
        k = np.abs(ys[:, None] - cen[None]).argmin(1)
        cen = np.array([ys[k == r].mean() if (k == r).any() else cen[r] for r in range(nrows)])
    # column centres per row from the big components (k-means along x)
    cells = {}
    for r in range(nrows):
        row = [c for c in big if np.abs(cen - c['cy']).argmin() == r]
        xs = np.array([c['cx'] for c in row]); allx = np.array([c['cx'] for c in big]); cc = np.linspace(np.percentile(allx, 1), np.percentile(allx, 99), ncols)
        for _ in range(50):
            k = np.abs(xs[:, None] - cc[None]).argmin(1)
            cc = np.array([xs[k == j].mean() if (k == j).any() else cc[j] for j in range(ncols)])
        cells[r] = cc
    # Figures that touch (a sword tip resting on the next figure's cloak) arrive as one component: split it.
    # Erode until it falls into one body per column it spans; the thin bits erosion removed (swords, tails)
    # each go whole to the body they touch most, i.e. the hand holding the hilt, not the cloak at the tip.
    split = []
    for c in comps:
        r = int(np.abs(cen - c['cy']).argmin()); cc = cells[r]
        x0, x1 = c['pts'][:, 1].min(), c['pts'][:, 1].max()
        span = [j for j in range(ncols) if x0 < cc[j] < x1]
        if c['n'] < 600 or len(span) < 2: split.append(c); continue
        y0, xa = c['pts'].min(0); m = np.zeros(tuple(c['pts'].max(0) - [y0, xa] + 1), np.uint8); m[c['pts'][:, 0] - y0, c['pts'][:, 1] - xa] = 1
        ok = False
        for k in range(1, 30):
            e = cv2.erode(m, np.ones((3, 3), np.uint8), iterations=k)
            n, lab, st, _ = cv2.connectedComponentsWithStats(e, 8)
            bigs = [i for i in range(1, n) if st[i, 4] > 150]
            if len(bigs) >= 2: ok = True; break
            if not bigs: break
        if not ok: split.append(c); continue   # one wide figure, not two touching
        seeds = np.zeros_like(lab)
        for t, i in enumerate(bigs): seeds[lab == i] = t + 1
        # grow the seeds back over the body for k steps (restores their outline)
        for _ in range(k):
            g = cv2.dilate(seeds.astype(np.uint8), np.ones((3, 3), np.uint8)); seeds = np.where((seeds == 0) & (m > 0), g, seeds)
        rest = ((m > 0) & (seeds == 0)).astype(np.uint8)
        n2, lab2 = cv2.connectedComponents(rest, connectivity=8)
        for i in range(1, n2):
            piece = lab2 == i; ring = cv2.dilate(piece.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
            touch = [(ring & (seeds == t + 1)).sum() for t in range(len(bigs))]
            seeds[piece] = int(np.argmax(touch)) + 1
        for t in range(len(bigs)):
            yy, xx = np.nonzero(seeds == t + 1)
            P = np.stack([yy + y0, xx + xa], -1)
            split.append(dict(n=len(P), cy=P[:, 0].mean(), cx=P[:, 1].mean(), pts=P))
    comps = split
    groups = {}
    for c in comps:
        if c['n'] < 4: continue
        r = int(np.abs(cen - c['cy']).argmin()); j = int(np.abs(cells[r] - c['cx']).argmin())
        groups.setdefault((r, j), []).append(c)
    frames = [[None] * ncols for _ in range(nrows)]
    for (r, j), cs in groups.items():
        p = np.concatenate([c['pts'] for c in cs]); y0, x0 = p.min(0); y1, x1 = p.max(0) + 1
        out = np.zeros((y1 - y0, x1 - x0, 4), np.uint8); out[p[:, 0] - y0, p[:, 1] - x0] = im[p[:, 0], p[:, 1]]
        frames[r][j] = dict(rgba=out, x0=int(x0), y0=int(y0), n=sum(c['n'] for c in cs), parts=len([c for c in cs if c['n'] > 300]))
    return frames
if __name__ == '__main__':
    base, out = sys.argv[1], sys.argv[2]
    spec = {'knight_idle': (5, 10), 'knight_walk': (5, 10), 'knight_run': (5, 10), 'knight_jump': (6, 10),
            'cow_idle': (8, 6), 'cow_walk': (8, 7), 'cow_run': (8, 7), 'cow_jump': (8, 7)}
    R = {}
    for name, (nr, nc) in spec.items():
        who = name.split('_')[0]
        R[name] = cut('%s/%s/%s_atlas.png' % (base, who, name), nr, nc)
        print(name, [[(f['parts'] if f else 'X') for f in row] for row in R[name]])
    pickle.dump(R, open(out, 'wb'))
