# Knight sheet from the updated atlases (knight_atlases_package/).
#   walk:  8 rows = directions S, SE, E, NE, N, NW, W, SW; 8 frames each = one stride
#   idle:  a 60-frame turntable starting at S and turning through SW, W, NW, N, NE, E, SE
#   jump:  7 rows = directions S, SE, E, NE, N, W, SW; 11 columns = phases
# Output order follows the game's d8 index: 0 S, 1 SW, 2 W, 3 NW, 4 N, 5 NE, 6 E, 7 SE.
import pickle, numpy as np, base64, io
from PIL import Image
R = pickle.load(open('raw3.pkl', 'rb'))
def erode(m, r):
    o = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1): o &= np.roll(np.roll(m, dy, 0), dx, 1)
    return o
def meas(f):
    m = f['A'] > 128; e = erode(m, 3); ys, xs = np.nonzero(e); allys = np.nonzero(m)[0]
    top, bot = allys.min(), ys.max(); h = bot - top
    tx = xs[(ys > top + h * 0.22) & (ys < top + h * 0.55)].mean()
    return dict(tx=tx, top=top, bot=bot, h=h)
TW, TH, FX, FY = 144, 112, 72, 107   # the dither samples ~80 px of height: more is wasted
FH = 92
STAND = np.median([meas(f)['h'] for f in R['idle']])
sc = FH / STAND
tiles = []
def place(f, mode='feet', ref=None):
    m = meas(f); ref = ref or STAND; sc = FH / ref
    L = Image.fromarray(f['L']); A = Image.fromarray(f['A'])
    w, h = max(1, round(L.width * sc)), max(1, round(L.height * sc))
    L = L.resize((w, h), Image.LANCZOS); A = A.resize((w, h), Image.LANCZOS)
    footy = m['bot'] if mode == 'feet' else m['top'] + ref * 0.985   # airborne: hang from the helmet
    t = Image.new('LA', (TW, TH), (0, 0)); im = Image.merge('LA', (L, A))
    t.paste(im, (round(FX - m['tx'] * sc), round(FY - footy * sc)), im)
    tiles.append(t)
ATL = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW']           # atlas row order
D8 = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE']            # game order
IDLE = {'S': 0, 'SW': 10, 'W': 19, 'NW': 25, 'N': 31, 'NE': 40, 'E': 52, 'SE': 57}
JROW = {'S': 0, 'SE': 1, 'E': 2, 'NE': 3, 'N': 4, 'NW': 4, 'W': 5, 'SW': 6}
for d in D8: place(R['idle'][IDLE[d]])                                   # 0-7
WREF = np.median([meas(f)['h'] for f in R['walk']]) / 0.985               # a walking knight dips a little
for d in D8:                                                              # 8-71
    r = ATL.index(d)
    for k in range(8): place(R['walk'][r * 8 + k], ref=WREF)
JREF = np.median([meas(R['jump'][r * 11 + 10])['h'] for r in range(7)])   # the last column stands upright
for r in range(7):                                                        # 72-148
    for c in range(11): place(R['jump'][r * 11 + c], 'air' if 3 <= c <= 7 else 'feet', ref=JREF)
C = 8; rows = (len(tiles) + C - 1) // C
sheet = Image.new('LA', (TW * C, TH * rows), (0, 0))
for i, t in enumerate(tiles): sheet.paste(t, ((i % C) * TW, (i // C) * TH))
buf = io.BytesIO(); sheet.convert('RGBA').save(buf, 'WEBP', quality=80, method=6)
open('sheet3.b64', 'w').write('data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode())
print('tiles', len(tiles), 'sheet', sheet.size, 'bytes', len(buf.getvalue()), 'jrow', [JROW[d] for d in D8])
prev = Image.new('RGB', sheet.size, (150, 30, 30)); prev.paste(sheet.convert('L'), mask=sheet.split()[1]); prev.resize((sheet.width // 2, sheet.height // 2)).save('prev3.png')
