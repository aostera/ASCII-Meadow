# usage: python3 tools/cow/fit_heads.py <workdir>/   (needs cow/raw.pkl and cow3/reg2.pkl; writes cow3/AB.pkl and cow3/headfit.pkl)
import pickle, numpy as np, cv2, sys
from PIL import Image, ImageDraw
S = sys.argv[1]
R = pickle.load(open(S + 'cow/raw.pkl', 'rb')); P = pickle.load(open(S + 'cow3/reg2.pkl', 'rb'))
A0 = Image.fromarray(R[0][3]['rgba']); W, H = A0.width + 40, A0.height + 8
v = P['3.2']; B0 = Image.fromarray(R[3][2]['rgba']); B1 = B0.resize((round(B0.width * v['s']), round(B0.height * v['s'])), Image.LANCZOS)
A = Image.new('RGBA', (W, H), (0, 0, 0, 0)); A.paste(A0, (0, 0)); B = Image.new('RGBA', (W, H), (0, 0, 0, 0)); B.paste(B1, (v['ox'], v['oy']), B1)
A = np.asarray(A).astype(np.float32); B = np.asarray(B).astype(np.float32)
pickle.dump(dict(A=A, B=B, W=W, H=H), open(S + 'cow3/AB.pkl', 'wb'))
def f(X): return X[..., :3].mean(2) * (X[..., 3] / 255)
fa, fb = f(A), f(B)
# head patches: standing head x>=128 y<=70 ; eat head x>=128 y>=58
ha = np.zeros_like(fa); ha[0:70, 128:] = fa[0:70, 128:]
hb = np.zeros_like(fb); hb[58:, 128:] = fb[58:, 128:]
best = None
c0 = np.array([153.0, 35.0])
for ang in np.arange(-10, 36, 1.0):
    for sc in (0.96, 1.0, 1.04):
        M = cv2.getRotationMatrix2D((c0[0], c0[1]), -ang, sc)   # positive ang: head tips down (clockwise on screen)
        for tx in range(-20, 12, 1):
            for ty in range(38, 66, 1):
                M2 = M.copy(); M2[0, 2] += tx; M2[1, 2] += ty
                wa = cv2.warpAffine(ha, M2, (W, H))
                m = (wa > 0) | (hb > 0)
                e = np.abs(wa - hb)[m].mean()
                if best is None or e < best[0]: best = (e, ang, sc, tx, ty)
print('best', best)
pickle.dump(best, open(S + 'cow3/headfit.pkl', 'wb'))
e, ang, sc, tx, ty = best
M = cv2.getRotationMatrix2D((c0[0], c0[1]), -ang, sc); M[0, 2] += tx; M[1, 2] += ty
haR = cv2.warpAffine(A * (np.arange(W)[None, :, None] >= 128) * (np.arange(H)[:, None, None] <= 70), M, (W, H))
K = 4
def toimg(P):
    im = Image.fromarray(np.clip(P, 0, 255).astype(np.uint8)); bg = Image.new('RGBA', im.size, (70, 70, 70, 255)); bg.alpha_composite(im); return bg.resize((W * K, H * K), Image.NEAREST)
Bh = B * (np.arange(W)[None, :, None] >= 128) * (np.arange(H)[:, None, None] >= 58)
m = Image.new('RGB', (W * K * 2, H * K)); m.paste(toimg(haR * 0.5 + Bh * 0.5), (0, 0)); m.paste(toimg(Bh), (W * K, 0)); m.save(S + 'cow3/headfit.png')
