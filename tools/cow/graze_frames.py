# usage: python3 tools/cow/graze_frames.py raw.pkl graze.pkl 24   (raw.pkl from cut_cow_atlas.py; graze.pkl next to it)
# Head-lowering frames made from the standing drawing itself: the head and neck are cut out as a layer and
# warped (head turned and carried forward and down as a rigid piece, the neck bending smoothly between it
# and the shoulders); the body stays put. Every frame is the same cow, so there is nothing to dissolve.
import pickle, sys, numpy as np, cv2
from PIL import Image, ImageDraw
R = pickle.load(open(sys.argv[1], 'rb'))
K = 8
src = Image.fromarray(R[0][3]['rgba'])
H0 = src.height
# room below and in front for the lowered head
pad = Image.new('RGBA', (src.width + 30, src.height + 12), (0, 0, 0, 0)); pad.paste(src, (0, 0))
big = np.asarray(pad.resize((pad.width * K, pad.height * K), Image.LANCZOS)).astype(np.float32)
h, w = big.shape[:2]
# head-and-neck layer: everything in front of the cut through the neck base, above the forelegs
poly = [(103, 4), (128, -4), (190, -4), (190, 74), (146, 76), (126, 84), (112, 84), (104, 64)]
m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).polygon([(x * K, y * K) for x, y in poly], fill=255)
mask = np.asarray(m.filter(__import__('PIL.ImageFilter', fromlist=['x']).GaussianBlur(K * 1.2))).astype(np.float32) / 255
head = big.copy(); head[..., 3] *= mask; body = big.copy(); body[..., 3] *= (1 - mask)
C = np.array([104.0, 34.0]) * K            # the neck turns about the base of the neck
HEADC = np.array([150.0, 34.0]) * K
axis = (HEADC - C) / np.linalg.norm(HEADC - C)
U0, U1 = 2 * K, 26 * K                     # along the neck: still at the cut, fully carried by the head
MUZ = np.array([172.0, 58.0]) * K
def frame(s, theta_end=np.radians(62), muz_end=np.array([160.0, 113.0]) * K):
    th = theta_end * s
    c, sn = np.cos(th), np.sin(th)
    Rm = np.array([[c, -sn], [sn, c]])
    T = (muz_end - (Rm @ (MUZ - C) + C)) * s
    # forward: every pixel of the head layer is carried to its new place (no pixel can appear twice, so no
    # ghost head); the head is rigid, the neck blends between staying and following
    ys, xs = np.nonzero(head[..., 3] > 2)
    P = np.stack([xs, ys], -1).astype(np.float32)
    u = (P - C) @ axis
    wt = np.clip((u - U0) / (U1 - U0), 0, 1); wt = wt * wt * (3 - 2 * wt)
    D = P + wt[:, None] * (((P - C) @ Rm.T + C + T) - P)
    dx = np.round(D[:, 0]).astype(int); dy = np.round(D[:, 1]).astype(int)
    ok = (dx >= 0) & (dx < w) & (dy >= 0) & (dy < h)
    out = np.zeros_like(head)
    order = np.argsort(wt[ok])                     # the head lands on top of the neck it drags
    out[dy[ok][order], dx[ok][order]] = head[ys[ok][order], xs[ok][order]]
    # close the pinholes a stretch leaves
    filled = out[..., 3] > 0
    grow = cv2.dilate(out, np.ones((3, 3), np.uint8))
    out = np.where(filled[..., None], out, grow)
    grow2 = cv2.dilate(out, np.ones((3, 3), np.uint8)); filled = out[..., 3] > 0
    hole = (~filled) & (cv2.erode((filled * 1).astype(np.uint8), np.ones((5, 5), np.uint8)) == 0) & (cv2.blur(filled.astype(np.float32), (5, 5)) > 0.55)
    out = np.where(hole[..., None], grow2, out)
    a = out[..., 3:4] / 255
    rgb = (body[..., :3] * (body[..., 3:4] / 255) * (1 - a) + out[..., :3] * a)
    al = body[..., 3:4] / 255 * (1 - a) + a
    rgb = np.where(al > 1e-3, rgb / np.maximum(al, 1e-3), 0)
    res = np.concatenate([np.clip(rgb, 0, 255), al * 255], -1).astype(np.uint8)
    return Image.fromarray(res).resize((pad.width, pad.height), Image.LANCZOS)
if __name__ == '__main__':
    N = int(sys.argv[3]) if len(sys.argv) > 3 else 8
    fr = [frame(k / (N - 1)) for k in range(N)]
    pickle.dump(fr, open(sys.argv[2], 'wb'))
    W2 = fr[0].width * 3; H2 = fr[0].height * 3
    sheet = Image.new('RGB', (W2 * 4, H2 * ((N + 3) // 4)), (70, 70, 70))
    for i, f in enumerate(fr): g = f.resize((W2, H2), Image.NEAREST); sheet.paste(g, ((i % 4) * W2, (i // 4) * H2), g)
    sheet.save(sys.argv[2].replace('.pkl', '.png'))
