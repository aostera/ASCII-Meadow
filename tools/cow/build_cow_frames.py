# Cow frames from the dark-fantasy cow atlases (idle, walk, run, jump, eat; tools/cut_atlases.py cuts them, after tools/cow/key_black.py keys the eat sheet).
# Every frame was looked at; the atlases have faults, worked around here:
#  - directions per row are not the game's eight (walk has no clean E, N or W; run and idle have no NW):
#    each game direction takes the nearest drawn row, mirrored where that is closer (a cow is symmetric);
#  - in the walk and run rows seen from the front the tail travels right to left and snaps back at the loop:
#    the row is followed by its own mirror, so the tail swings back instead of jumping;
#  - idle front, frame 4: the tail jumps to the other leg for one frame: dropped. Idle loops ping-pong;
#  - the jump sheet has directions in columns and phases in rows, and most columns turn mid-jump (S, SE,
#    NE...): only N, W and SW are clean; E and SE are their mirrors; the rest don't hop.
#  - eat (cow_eat, RGB on black: keyed to alpha first): only S, SE, E, NE graze with the head down and N is the
#    back; the SW, W and front-left rows stand with the head up chewing, so the left-facing grazes are the
#    right-facing ones mirrored. S frame 0 has the head straight while the rest turn it: dropped. SW lowers
#    its head from the mirrored SE standing drawing (idle SW is another drawing; the game dissolves to it).
#    The eat cows are drawn at the idle cows' size; every eat frame is registered on the idle frame of its
#    direction by the body (the head end ignored), so the body does not move when the head goes down.
#  - between standing and grazing there is no drawing: the head is lowered from the standing drawing as a
#    layer (side views: turned about the withers, the neck bending between; 3/4: carried down and forward;
#    front: lowered rigidly), the body crossfading underneath, and the drawn grazing head takes over at the end.
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
def mask(im): return (np.asarray(im)[..., 3] > 60).astype(np.float32)
def reg(ref, im, head_side, scales=None):
    A = mask(ref); H, W = A.shape; best = None
    # ignore the head end of the reference (columns on head_side 35%), and for front/back views nothing
    wgt = np.ones_like(A)
    if head_side == 'R': wgt[:, int(W * 0.62):] = 0
    if head_side == 'L': wgt[:, :int(W * 0.38)] = 0
    if head_side == 'C': wgt[:int(H * 0.45), int(W * 0.25):int(W * 0.75)] = 0
    for s in (np.arange(0.86, 1.2, 0.01) if scales is None else scales):
        b = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.BILINEAR); B = mask(b)
        pad = np.zeros((H + 2 * 60, W + 2 * 60), np.float32); 
        # search shifts by template matching of B over padded A
        P = np.zeros((H + 120, W + 120), np.float32); P[60:60 + H, 60:60 + W] = A * wgt
        Pw = np.zeros_like(P); Pw[60:60 + H, 60:60 + W] = wgt
        if B.shape[0] > P.shape[0] or B.shape[1] > P.shape[1]: continue
        inter = cv2.matchTemplate(P, B, cv2.TM_CCORR)
        # union approx: |A w| + |B within weighted area| - inter
        bw = cv2.matchTemplate(Pw, B, cv2.TM_CCORR)
        iou = inter / ((A * wgt).sum() + bw - inter + 1e-6)
        y, x = np.unravel_index(iou.argmax(), iou.shape)
        if best is None or iou[y, x] > best[0]: best = (float(iou[y, x]), float(s), int(x) - 60, int(y) - 60)
    return best
def anchor(ref):
    a = np.asarray(ref)[..., 3] > 40; ys, xs = np.nonzero(a); h = ys.max() - ys.min()
    return (np.median(xs[ys < ys.min() + h * 0.6]), ys.max())
def placed_on(im, ref, side, scale=None):
    b = reg(ref, im, side, None if scale is None else [scale]); s = b[1]; anc = anchor(ref); placed_on.s = s
    e = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    c = Image.new('RGBA', (ref.width + 200, ref.height + 200), (0, 0, 0, 0)); c.paste(e, (100 + b[2], 100 + b[3]), e)
    return place3(c, SC['idle'], (anc[0] + 100, anc[1] + 100))
def bbox(A):
    ys, xs = np.nonzero(A[..., 3] > 40); return xs.min(), xs.max(), ys.min(), ys.max()
def soft(h, w, x0, x1, y0, y1, f):
    # 1 inside the box, fading over f px
    gx, gy = np.meshgrid(np.arange(w), np.arange(h))
    dx = np.maximum(np.maximum(x0 - gx, gx - x1), 0); dy = np.maximum(np.maximum(y0 - gy, gy - y1), 0)
    return np.clip(1 - np.hypot(dx, dy) / f, 0, 1).astype(np.float32)
def warp(L, ang, sc, tx, ty, px, py):
    M = cv2.getRotationMatrix2D((px, py), ang, sc); M[0, 2] += tx; M[1, 2] += ty
    return cv2.warpAffine(L, M, (L.shape[1], L.shape[0]), flags=cv2.INTER_LINEAR, borderValue=0)
def bend(L, ang, sc, px, py, r0, r1):
    # the neck bends: no turn at its root (r0 from the withers), the full turn from r1 on, where the head is
    # carried rigidly. Turning preserves the distance to the pivot, so the inverse map is exact.
    h, w = L.shape[:2]; gx, gy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    vx, vy = gx - px, gy - py; r = np.hypot(vx, vy)
    u = np.clip((r - r0) / max(1, r1 - r0), 0, 1); u = u * u * (3 - 2 * u)
    th = -np.radians(ang) * u; k = 1 / (1 + (sc - 1) * u)
    c, s_ = np.cos(th), np.sin(th)
    sx = px + (c * vx + s_ * vy) * k; sy = py + (-s_ * vx + c * vy) * k
    return cv2.remap(L, sx.astype(np.float32), sy.astype(np.float32), cv2.INTER_LINEAR, borderValue=0)
def ramped(L, ang, sc, tx, ty, px, py, r0, r1):
    h, w = L.shape[:2]; gx, gy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    # iterate the inverse once: weight from the destination, refined at the first source estimate
    sx, sy = gx, gy
    for _ in range(2):
        r = np.hypot(sx - px, sy - py); u = np.clip((r - r0) / max(1, r1 - r0), 0, 1); u = u * u * (3 - 2 * u)
        th = -np.radians(ang) * u; k = 1 / (1 + (sc - 1) * u); c, s_ = np.cos(th), np.sin(th)
        vx, vy = gx - px - tx * u, gy - py - ty * u
        sx = px + (c * vx + s_ * vy) * k; sy = py + (-s_ * vx + c * vy) * k
    return cv2.remap(L, sx.astype(np.float32), sy.astype(np.float32), cv2.INTER_LINEAR, borderValue=0)
def horn_pair(X):
    # the two horns (bright golden brown, the largest such blobs): centre and spread
    rgb = np.clip(X[..., :3], 0, 255).astype(np.uint8); hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    m = ((X[..., 3] > 200) & (hsv[..., 0] > 10) & (hsv[..., 0] < 24) & (hsv[..., 1] > 120) & (hsv[..., 2] > 110)).astype(np.uint8)
    n, lab, st, cen = cv2.connectedComponentsWithStats(m, 8)
    k = sorted(range(1, n), key=lambda i: -st[i, 4])[:2]
    return (cen[k[0]] + cen[k[1]]) / 2, abs(cen[k[0]][0] - cen[k[1]][0])
def head_layers(A, B, cfg):
    h, w = A.shape[:2]; x0, x1, y0, y1 = bbox(A); W_, H_ = x1 - x0, y1 - y0
    hx0, hx1, hy0, hy1 = cfg['box']; px, py = cfg['pivot']
    box = (x0 + hx0 * W_, x0 + hx1 * W_, y0 + hy0 * H_, y0 + hy1 * H_)
    m = soft(h, w, *box, cfg.get('feather', 18))
    P = (x0 + px * W_, y0 + py * H_)
    # target: the eat frame's head = its alpha in a box around where the head ends up
    bx0, bx1, by0, by1 = bbox(B); BW, BH = bx1 - bx0, by1 - by0; tb = cfg['tbox']
    mt = soft(h, w, bx0 + tb[0] * BW, bx0 + tb[1] * BW, by0 + tb[2] * BH, by0 + tb[3] * BH, 12)
    tgt = B[..., 3] / 255 * mt
    src = A[..., 3] / 255 * m
    if cfg['side'] in 'RL' and cfg.get('mode', 'rot') == 'rot':
        # side views: turn about the withers so the muzzle lands on the drawn muzzle at the grass
        sg = 1 if cfg['side'] == 'R' else -1
        ys, xs = np.nonzero(src > 0.5); k = np.argsort(sg * xs)[-12:]; ma = (xs[k].mean(), ys[k].mean())
        ys, xs = np.nonzero((B[..., 3] > 100) & ((sg * np.arange(w))[None, :] > sg * (bx0 + bx1) / 2 + cfg.get('mfront', 0.3) * BW)[[0] * h]) 
        k = np.argsort(ys)[-12:]; mb = (xs[k].mean(), ys[k].mean())
        a0 = np.arctan2(ma[1] - P[1], ma[0] - P[0]); a1 = np.arctan2(mb[1] - P[1], mb[0] - P[0])
        ang = -((np.degrees(a1 - a0) + 180) % 360 - 180); sc = float(np.clip(np.hypot(mb[0] - P[0], mb[1] - P[1]) / np.hypot(ma[0] - P[0], ma[1] - P[1]), 0.92, 1.06))
        head_layers.ma = ma
        return m, P, (0, float(ang), sc, 0, 0), ma, mb
    head_layers.ma = None
    if cfg.get('horns'):
        # front view: the head is carried so its horns land on the drawn grazing head's horns
        (ca, sa), (cb, sb) = horn_pair(A * (m[..., None] > 0.5)), horn_pair(B)
        sc = float(np.clip(sb / sa, 0.85, 1.1)); c2 = P + (ca - P) * sc
        return m, P, (0, 0.0, sc, float(cb[0] - c2[0]), float(cb[1] - c2[1])), None, None
    lumA = A[..., :3].mean(2) / 255; lumB = B[..., :3].mean(2) / 255
    src = src * (0.35 + lumA); tgt = tgt * (0.35 + lumB)
    best = None
    for ang in cfg['angs']:
        for sc in cfg.get('scs', [1.0]):
            for tx in range(-cfg.get('tr', 0), cfg.get('tr', 0) + 1, 6):
                for ty in range(-cfg.get('trv', cfg.get('tr', 0)), cfg.get('trv', cfg.get('tr', 0)) + 1, 6):
                    r = warp(src, ang, sc, tx, ty, *P); v = (r * tgt).sum() / np.sqrt((r * r).sum() * (tgt * tgt).sum() + 1e-6)
                    if best is None or v > best[0]: best = (v, ang, sc, tx, ty)
    return m, P, best, None, None
ease = lambda u: u * u * (3 - 2 * u)
def transition(A, B, cfg, n):
    if cfg.get('kind') == 'dissolve':
        return [A * (1 - ease(k / (n - 1))) + B * ease(k / (n - 1)) for k in range(n)], None
    m, P, best, _, _ = head_layers(A, B, cfg); _, ang, sc, tx, ty = best
    Ah = A * m[..., None]; Ab = A * (1 - m[..., None])
    x0_, x1_, y0_, y1_ = bbox(A); R_ = np.hypot(*(np.array(head_layers.ma) - P)) if head_layers.ma is not None else 0.3 * (x1_ - x0_)
    def move(L, u):
        if cfg.get('rigid'): return warp(L, ang * u, 1 + (sc - 1) * u, tx * u, ty * u, *P)
        return ramped(L, ang * u, 1 + (sc - 1) * u, tx * u, ty * u, *P, R_ * cfg.get('r0', 0.35), R_ * cfg.get('r1', 0.8))
    mfin = move(m, 1.0)
    # the drawn head's own area (so neither its body layer nor the hand-off leaves part of it behind)
    bx0, bx1, by0, by1 = bbox(B); BW, BH = bx1 - bx0, by1 - by0; tb = cfg['tbox']; h, w = A.shape[:2]
    mfin = np.maximum(mfin, soft(h, w, bx0 + tb[0] * BW, bx0 + tb[1] * BW, by0 + tb[2] * BH, by0 + tb[3] * BH, 12))
    # all layers premultiplied by alpha, so masks and crossfades do not darken the edges
    pm = lambda X: np.concatenate([X[..., :3] * X[..., 3:4] / 255, X[..., 3:4]], -1)
    PA, PB = pm(A), pm(B); PAh = PA * m[..., None]; PAb = PA * (1 - m[..., None])
    PBb = PB * (1 - mfin[..., None]); PBh = PB * mfin[..., None]
    out = []
    for k in range(n):
        u = ease(k / (n - 1)); hand = np.clip((k / (n - 1) - 0.7) / 0.3, 0, 1)   # the drawn head takes over at the end
        layer = move(PAh, u) * (1 - hand) + PBh * hand
        ub = ease(min(1, k / (n - 1) * cfg.get('lead', 1))); body = PAb * (1 - ub) + PBb * ub   # the body barely changes: a crossfade
        o = layer + body * (1 - layer[..., 3:4] / 255)
        out.append(np.concatenate([o[..., :3] * 255 / np.maximum(o[..., 3:4], 1e-3), o[..., 3:4]], -1))
    return out, best
def _m(c):   # the same set-up for a cow facing left
    c = dict(c); b = c['box']; c['box'] = (1 - b[1], 1 - b[0], b[2], b[3]); t = c['tbox']; c['tbox'] = (1 - t[1], 1 - t[0], t[2], t[3])
    c['pivot'] = (1 - c['pivot'][0], c['pivot'][1]); c['side'] = 'L'; return c
_E = dict(box=(0.74, 1.05, -0.05, 0.62), pivot=(0.76, 0.24), tbox=(0.80, 1.05, 0.25, 0.95), side='R')
_SE = dict(box=(0.62, 1.05, -0.05, 0.66), pivot=(0.6, 0.2), tbox=(0.62, 1.05, 0.1, 0.9), side='R', mode='search', angs=range(-16, 17, 4), scs=[0.96, 1.0, 1.04, 1.08], tr=36, trv=72)
_NE = dict(box=(0.72, 1.05, -0.05, 0.5), pivot=(0.72, 0.2), tbox=(0.72, 1.05, 0.0, 0.6), side='R', mfront=0.4)
CFG = {
 0: dict(idle=(0, False), eat=(0, False), cols=[1, 2, 3, 4, 5], side='C', rigid=True, horns=True, lead=1.8, box=(0.2, 0.8, -0.05, 0.5), pivot=(0.5, 0.1), tbox=(0.15, 0.85, 0.35, 1.0), angs=[-6, 0, 6], scs=[0.86, 0.92, 0.98], tr=54, trv=96),
 1: dict(idle=(1, True), eat=(1, True), cols=range(6), **_m(_SE)),
 2: dict(idle=(6, False), eat=(2, True), cols=range(6), **_m(_E)),
 3: dict(idle=(3, True), eat=(3, True), cols=range(6), **_m(_NE)),
 4: dict(idle=(4, False), eat=(4, False), cols=range(6), side='C', kind='dissolve'),
 5: dict(idle=(3, False), eat=(3, False), cols=range(6), **_NE),
 6: dict(idle=(2, False), eat=(2, False), cols=range(6), **_E),
 7: dict(idle=(1, False), eat=(1, False), cols=range(6), **_SE),
}
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

# ---- grazing: the head goes down (eatdown, played backwards to rise), then the grazing loop (back and forth)
index['eatdown'] = []; index['eat'] = []
for d in range(8):
    c = CFG[d]; ref = fr('idle', c['idle'][0], 0, c['idle'][1]); A0 = place3(ref, SC['idle'])
    # one scale per row (from its first frame), only the shift is found per frame: the cow keeps its size
    E = [placed_on(fr('eat', c['eat'][0], c['cols'][0], c['eat'][1]), ref, c['side'])]; s0 = placed_on.s
    E += [placed_on(fr('eat', c['eat'][0], k, c['eat'][1]), ref, c['side'], s0) for k in list(c['cols'])[1:]]
    seq, best = transition(A0, E[0], c, 10); print('eatdown', d, best)
    add('eatdown', seq)
    add('eat', expand(E, 2, False))
print('index', json.dumps(index))
json.dump(index, open(sys.argv[2].replace('.json', '_index.json'), 'w'))
out = [to_ascii(t.resize((TW, TH), Image.LANCZOS)) for t in tiles]
json.dump(out, open(sys.argv[2], 'w'))
prev = Image.new('RGB', (TW * 10, TH * ((len(tiles) + 9) // 10)), (40, 40, 40))
for i, t in enumerate(tiles): t2 = t.resize((TW, TH), Image.LANCZOS); prev.paste(t2, ((i % 10) * TW, (i // 10) * TH), t2)
prev.save(sys.argv[3])
print('frames', len(out), 'chars', sum(map(len, out)), 'scales', SC, JSC)
