# usage: python3 tools/cow/fit_eat_drawing.py raw.pkl 3.2 cow3/reg2.pkl   (scale + place an eat drawing on the standing cow)
# Bring an eat drawing onto the standing cow (idle 0.3): scale from the back's height above the hooves,
# feet on the same ground, then slide sideways until the legs line up.
import pickle, sys, numpy as np
from PIL import Image
R = pickle.load(open(sys.argv[1], 'rb'))
def back_height(X, lo, hi):
    a = X[..., 3] > 60; ys, xs = np.nonzero(a); g = ys.max()
    x0, x1 = xs.min(), xs.max(); w = x1 - x0
    cols = range(int(x0 + lo * w), int(x0 + hi * w))
    tops = [np.nonzero(a[:, c])[0].min() for c in cols if a[:, c].any()]
    return g - np.median(tops), g
A = R[0][3]['rgba'].astype(np.float32)
hA, gA = back_height(A, 0.2, 0.55)
def legs(X, g):   # leg mask: rows in the lowest 30% of the body height
    a = X[..., 3] > 60; m = np.zeros_like(a); m[int(g - 0.3 * hA):g + 1] = a[int(g - 0.3 * hA):g + 1]; return m
LA = legs(A, gA)
out = {}
for key in sys.argv[2].split(','):
    r, c = map(int, key.split('.'))
    B0 = Image.fromarray(R[r][c]['rgba'])
    hB, _ = back_height(np.asarray(B0).astype(np.float32), 0.25, 0.6)
    s = hA / hB
    B = np.asarray(B0.resize((round(B0.width * s), round(B0.height * s)), Image.LANCZOS)).astype(np.float32)
    gB = np.nonzero(B[..., 3] > 60)[0].max(); oy = gA - gB
    best = None
    for ox in range(-90, 60):
        LB = np.zeros_like(LA)
        y0, y1 = max(0, oy), min(A.shape[0], oy + B.shape[0]); x0, x1 = max(0, ox), min(A.shape[1], ox + B.shape[1])
        if x1 <= x0: continue
        sub = B[y0 - oy:y1 - oy, x0 - ox:x1 - ox, 3] > 60
        LB[y0:y1, x0:x1] = sub
        LB[:int(gA - 0.3 * hA)] = False; LB[:, 140:] = False   # head and grass at the front don't count
        e = (LB != LA[:, :]).sum() - 0 * (LB & LA).sum()
        if best is None or e < best[0]: best = (e, ox)
    out[key] = dict(s=float(s), ox=int(best[1]), oy=int(oy))
    print(key, out[key])
pickle.dump(out, open(sys.argv[3], 'wb'))
