# Prints every knight frame as ASCII art, with the same dither the game used to run in the browser.
# Each cell is one of " .:-=+*#%@" (brightness), "'" (dark plate: backing, no glyph) or " " (empty).
import base64, io, json, numpy as np
from PIL import Image
TW, TH = 144, 112
COLS, ROWS = 104, 54                    # cells are 0.6 × 0.9 of the glyph size, so 104 × 54 keeps the tile's shape
RAMP = " .:-=+*#%@"
BAYER = [(v / 16 - 0.5) for v in [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]]
def h32(x, y):
    M = 0xffffffff
    h = (x * 374761393 + y * 668265263) & M
    h = ((h ^ (h >> 13)) * 1274126177) & M
    return ((h ^ (h >> 16)) & M) / 4294967295
GRAIN = [[(h32(cx * 7 + 186, cy * 13) - 0.5) * 0.16 for cx in range(COLS)] for cy in range(ROWS)]
sheet = Image.open(io.BytesIO(base64.b64decode(open('sheet3.b64').read().split(',')[1]))).convert('RGBA')
n = 149; frames = []
for i in range(n):
    c, r = i % 8, i // 8
    tile = sheet.crop((c * TW, r * TH, c * TW + TW, r * TH + TH)).resize((COLS * 2, ROWS * 2), Image.BICUBIC)
    a = np.asarray(tile).astype(float)
    R = a[..., 0].reshape(ROWS, 2, COLS, 2).sum((1, 3)); A = a[..., 3].reshape(ROWS, 2, COLS, 2).sum((1, 3)) / (4 * 255)
    lines = []
    for cy in range(ROWS):
        row = []
        for cx in range(COLS):
            al = A[cy, cx]
            if al < 0.3: row.append(' '); continue
            rr = R[cy, cx] / (4 * 255 * al)
            rr = 0.16 + 0.84 * min(1, rr / 0.5) ** 0.75
            v = max(0, rr * 1.3 - 0.06) ** 0.8 * min(1, al * 1.2) + BAYER[(cy & 3) * 4 + (cx & 3)] * 0.24 + GRAIN[cy][cx]
            if v < 0.16: row.append("'"); continue
            v = min(0.999, v); row.append(RAMP[min(9, 1 + int(v * 9))])
        lines.append(''.join(row).rstrip())
    top = 0
    while top < len(lines) and not lines[top]: top += 1
    frames.append((top, lines[top:]))
# rows were trimmed from the top: remember how many, so the feet stay put
# JS source: one template literal per frame, first line is the number of empty rows above the art
# The page keeps idle 0-7, one stride pose per walk direction (the atlas strides barely differ; the step
# is animated in code) and the 77 jump frames: 93 frames.
KWB = [0, 7, 0, 0, 0, 0, 2, 5]
keep = list(range(8)) + [8 + d * 8 + KWB[d] for d in range(8)] + list(range(72, 149))
js = ['  const KNIGHT_ART = [']
for i, (top, lines) in enumerate(frames[i] for i in keep):
    body = '\n'.join(lines).replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${')
    js.append('`' + str(top) + '\n' + body + '`,')
js.append('  ];')
open('knight_ascii.js', 'w').write('\n'.join(js) + '\n')
print('bytes', len('\n'.join(js)))
