# Knight frames → ASCII with the detail kept: a local-contrast boost (unsharp mask) brings out plate edges,
# straps and folds, and each frame's tones are stretched between its own dark and light ends instead of
# being pushed to white. " .:-=+*#%@" is brightness, "'" dark plate (backing only), " " empty.
import sys, json, numpy as np
from PIL import Image, ImageFilter
COLS, ROWS = 104, 54
RAMP = " .:-=+*#%@"
BAYER = [(v / 16 - 0.5) for v in [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]]
def h32(x, y):
    M = 0xffffffff
    h = (x * 374761393 + y * 668265263) & M
    h = ((h ^ (h >> 13)) * 1274126177) & M
    return ((h ^ (h >> 16)) & M) / 4294967295
GRAIN = np.array([[(h32(cx * 7 + 186, cy * 13) - 0.5) * 0.05 for cx in range(COLS)] for cy in range(ROWS)])
B = np.array(BAYER).reshape(4, 4)
def frame_to_ascii(tile, detail=1.15, lo_q=3, hi_q=98):
    """tile: RGBA PIL image already framed like the game's 144x112 tiles."""
    t = tile.resize((COLS * 2, ROWS * 2), Image.BICUBIC)
    a = np.asarray(t).astype(float)
    lum = a[..., :3].mean(2) / 255; al = a[..., 3] / 255
    # local contrast on the figure only: blur the premultiplied grey and its coverage, divide
    pm = Image.fromarray((lum * al * 255).astype(np.uint8)); cov = Image.fromarray((al * 255).astype(np.uint8))
    bl = np.asarray(pm.filter(ImageFilter.GaussianBlur(2.5))).astype(float); bc = np.asarray(cov.filter(ImageFilter.GaussianBlur(2.5))).astype(float)
    base = np.where(bc > 8, bl / np.maximum(bc, 1), lum)
    sharp = lum + detail * (lum - base)
    # 2x2 → one cell
    A = al.reshape(ROWS, 2, COLS, 2).mean((1, 3))
    S = (sharp * al).reshape(ROWS, 2, COLS, 2).sum((1, 3)) / np.maximum(al.reshape(ROWS, 2, COLS, 2).sum((1, 3)), 1e-6)
    inside = A >= 0.3
    if inside.sum() < 10: return 0, []
    lo, hi = np.percentile(S[inside], lo_q), np.percentile(S[inside], hi_q)
    V = np.clip((S - lo) / max(1e-3, hi - lo), 0, 1) ** 0.9
    lines = []
    for cy in range(ROWS):
        row = []
        for cx in range(COLS):
            if A[cy, cx] < 0.3: row.append(' '); continue
            v = (0.37 + 0.63 * V[cy, cx]) * min(1, A[cy, cx] * 1.25) + B[cy & 3, cx & 3] * 0.14 + GRAIN[cy, cx]
            if v < 0.14: row.append("'"); continue
            v = min(0.999, v); row.append(RAMP[min(9, 1 + int(v * 9))])
        lines.append(''.join(row).rstrip())
    top = 0
    while top < len(lines) and not lines[top]: top += 1
    return top, lines[top:]
if __name__ == '__main__':
    import base64, io
    TW, TH = 144, 112
    sheet = Image.open(io.BytesIO(base64.b64decode(open(sys.argv[1]).read().split(',')[1]))).convert('RGBA')
    out = []
    for i in range(149):
        c, r = i % 8, i // 8
        top, lines = frame_to_ascii(sheet.crop((c * TW, r * TH, c * TW + TW, r * TH + TH)))
        out.append(str(top) + '\n' + '\n'.join(lines))
    json.dump(out, open(sys.argv[2], 'w'))
    print('frames', len(out))
