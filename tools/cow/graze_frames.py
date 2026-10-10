# usage: python3 tools/cow/graze_frames.py <workdir>/ graze.pkl 24   (after fit_eat_drawing.py and fit_heads.py)
# Grazing frames from two real drawings: the standing cow (idle 0.3) and the eat drawing that matches it
# best (eat 3.2, scaled and placed on the standing cow by its back and legs). The body and legs are the
# standing cow's throughout. The head-and-neck of each drawing is its own layer: both travel one shared path
# (the head swinging down about the shoulder and turning 20 degrees, fitted head to head), the neck bending
# between shoulder and head; the standing head hands over to the drawn grazing head in the middle of the
# move, where the two lie on top of each other. Frame 0 is the standing drawing, the last frame the
# drawn grazing pose.
import pickle, sys, numpy as np, cv2
from PIL import Image, ImageDraw, ImageFilter
S = sys.argv[1]; N = int(sys.argv[3]) if len(sys.argv) > 3 else 24
D = pickle.load(open(S + 'cow3/AB.pkl', 'rb')); A, B, W, H = D['A'], D['B'], D['W'], D['H']
e, ANG, SC, TX, TY = pickle.load(open(S + 'cow3/headfit.pkl', 'rb'))
K = 6
def up(X): return cv2.resize(X, (W * K, H * K), interpolation=cv2.INTER_CUBIC).clip(0, 255)
A, B = up(A), up(B); h, w = A.shape[:2]
def poly_mask(pts, blur=1.0):
    m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).polygon([(x * K, y * K) for x, y in pts], fill=255)
    return np.asarray(m.filter(ImageFilter.GaussianBlur(K * blur))).astype(np.float32) / 255
Xg = np.arange(w)[None, :] / K
def ramp(a, b): x = np.clip((Xg - a) / (b - a), 0, 1); return x * x * (3 - 2 * x)
# The shoulder is a soft seam: the standing body stays whole up to x 112 and hands over by x 126, while the
# grazing neck fades in over x 104-120 on top of it, so the two drawings blend there instead of meeting on
# a line (both are opaque across the seam, so nothing shows through).
FSm = poly_mask([(100, -5), (205, -5), (205, 70), (140, 68), (128, 66), (100, 62)], 0.5) * ramp(112, 126)
FEm = poly_mask([(96, -5), (215, -5), (215, 140), (138, 140), (134, 74), (118, 62), (96, 56)], 0.5) * ramp(98, 126)
body = A.copy(); body[..., 3] *= (1 - FSm)
NECK = 1 - poly_mask([(126, 54), (220, 54), (220, 140), (126, 140)], 3.0)   # the grazing neck without its head
FS = A.copy(); FS[..., 3] *= FSm
FE = B.copy(); FE[..., 3] *= FEm
c0 = np.array([153.0, 35.0]); P = np.array([108.0, 38.0])
c1 = c0 + np.array([TX, TY])
r0, a0 = np.linalg.norm(c0 - P), np.arctan2(*(c0 - P)[::-1]); r1, a1 = np.linalg.norm(c1 - P), np.arctan2(*(c1 - P)[::-1])
def T(s):   # rigid head motion at s in [0, 1]: returns (M 2x2, t) with p' = M p + t, in drawing units
    phi = np.radians(ANG) * s; sc = 1 + (SC - 1) * s
    r = r0 + (r1 - r0) * s; a = a0 + (a1 - a0) * s
    c = P + r * np.array([np.cos(a), np.sin(a)])
    M = sc * np.array([[np.cos(phi), -np.sin(phi)], [np.sin(phi), np.cos(phi)]])
    return M, c - M @ c0
def sm(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)
gy, gx = np.mgrid[0:h, 0:w].astype(np.float32); X = gx / K; Y = gy / K
wS = sm((X - 106) / 22)                                   # standing neck: rigid from the jaw on
axis = (c1 - np.array([110.0, 30.0])); L = np.linalg.norm(axis); axis /= L
wE = sm((((X - 110) * axis[0] + (Y - 30) * axis[1]) - 4) / 36)   # grazing neck, along its slope
def carry(layer, wt, M, t):
    """forward-carry every pixel of a layer: p -> p + wt (M p + t - p); the head lands over the neck"""
    ys, xs = np.nonzero(layer[..., 3] > 1)
    p = np.stack([xs / K, ys / K], -1); ww = wt[ys, xs][:, None]
    q = p + ww * (p @ M.T + t - p)
    qx = np.round(q[:, 0] * K).astype(int); qy = np.round(q[:, 1] * K).astype(int)
    ok = (qx >= 0) & (qx < w) & (qy >= 0) & (qy < h)
    order = np.argsort(ww[ok, 0], kind='stable')
    out = np.zeros_like(layer)
    out[qy[ok][order], qx[ok][order]] = layer[ys[ok][order], xs[ok][order]]
    f = out[..., 3] > 0                                     # close the pinholes a stretch leaves
    for _ in range(2):
        g = cv2.dilate(out, np.ones((3, 3), np.uint8)); hole = (~f) & (cv2.blur(f.astype(np.float32), (3, 3)) > 0.45)
        out = np.where(hole[..., None], g, out); f = out[..., 3] > 0
    return out
def over(top, bot):
    at = top[..., 3:4] / 255; ab = bot[..., 3:4] / 255; ao = at + ab * (1 - at)
    rgb = (top[..., :3] * at + bot[..., :3] * ab * (1 - at)) / np.maximum(ao, 1e-4)
    return np.concatenate([rgb, ao * 255], -1)
M1, t1 = T(1); M1i = np.linalg.inv(M1); t1i = -M1i @ t1
frames = []
for k in range(N):
    s = k / (N - 1); s = 0.5 - 0.5 * np.cos(np.pi * s)     # ease the head in and out of the move
    M, t = T(s)
    hs = carry(FS, wS, M, t)
    Me = M @ M1i; te = M @ t1i + t                          # grazing head carried back from its own place
    he = carry(FE, wE, Me, te)
    u = sm((s - 0.2) / 0.6)
    wa, wb = hs[..., 3:4] * (1 - u), he[..., 3:4] * u
    rgb = (hs[..., :3] * wa + he[..., :3] * wb) / np.maximum(wa + wb, 1e-4)
    # coverage: where only one head covers a pixel mid-hand-over it stays solid (no ground showing through),
    # but a head that is only just fading in or out stays faint
    al = np.minimum(255, np.maximum(wa + wb, 2 * np.maximum(wa, wb)))
    head = np.concatenate([rgb, al], -1)
    # the grazing neck and chest lie still underneath, fading in with the hand-over, so no ground shows
    # through the gaps the moving necks open
    under = FE.copy(); under[..., 3] *= sm(s / 0.8) * NECK
    comp = over(head, over(under, body))
    frames.append(Image.fromarray(np.clip(comp, 0, 255).astype(np.uint8)).resize((W, H), Image.LANCZOS))
pickle.dump(frames, open(sys.argv[2], 'wb'))
W2, H2 = W * 3, H * 3; cols = 4
sheet = Image.new('RGB', (W2 * cols, H2 * ((N + cols - 1) // cols)), (70, 70, 70))
for i, f in enumerate(frames): g = f.resize((W2, H2), Image.NEAREST); sheet.paste(g, ((i % cols) * W2, (i // cols) * H2), g)
sheet.save(sys.argv[2].replace('.pkl', '.png'))
