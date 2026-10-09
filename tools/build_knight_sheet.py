import pickle, numpy as np, base64, io
from PIL import Image
R = pickle.load(open('raw.pkl', 'rb'))
def erode(m, r):
    o = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1): o &= np.roll(np.roll(m, dy, 0), dx, 1)
    return o
def meas(f):
    m = f['A'] > 128; e = erode(m, 3); ys, xs = np.nonzero(e)
    top, bot = ys.min(), ys.max(); h = bot - top
    tx = xs[(ys > top + h * 0.22) & (ys < top + h * 0.55)].mean()    # torso: the sword and feet don't move it
    return dict(tx=tx, top=np.nonzero(m)[0].min(), bot=bot, h=bot - np.nonzero(m)[0].min())
def medoid(fr):
    ms = [meas(f) for f in fr]; S = 48
    def mask(f, m):
        a = np.zeros((S * 3, S * 3)); im = Image.fromarray(f['A']).resize((max(1, f['A'].shape[1] // 3), max(1, f['A'].shape[0] // 3)))
        b = np.asarray(im) / 255.; ox = int(S * 1.5 - m['tx'] / 3); oy = int(S * 2.6 - m['bot'] / 3)
        h, w = b.shape; a[max(0, oy):oy + h, max(0, ox):ox + w] = b[max(0, -oy):S * 3 - oy, max(0, -ox):S * 3 - ox][:a[max(0, oy):oy + h, max(0, ox):ox + w].shape[0], :a[max(0, oy):oy + h, max(0, ox):ox + w].shape[1]]
        return a
    M = [mask(f, m) for f, m in zip(fr, ms)]
    d = [sum(np.abs(M[i] - M[j]).sum() for j in range(len(M))) for i in range(len(M))]
    return int(np.argmin(d))

TW, TH, FX, FY = 176, 136, 88, 130
STAND_H = np.median([meas(f)['h'] for f in R['idle'][:10]])
FH = 112; sc = FH / STAND_H
tiles, meta = [], []
def place(f, mode='feet', scale=sc):
    m = meas(f)
    L = Image.fromarray(f['L']); A = Image.fromarray(f['A'])
    w, h = max(1, round(L.width * scale)), max(1, round(L.height * scale))
    L = L.resize((w, h), Image.LANCZOS); A = A.resize((w, h), Image.LANCZOS)
    footy = m['bot'] if mode == 'feet' else m['top'] + STAND_H * 0.985 * (sc / scale)   # airborne: hang from the helmet
    t = Image.new('LA', (TW, TH), (0, 0)); im = Image.merge('LA', (L, A))
    t.paste(im, (round(FX - m['tx'] * scale), round(FY - footy * scale)), im)
    tiles.append(t)

# idle: one calm frame per direction (the medoid of its row), every direction the same height
idle_pick = []
for d in range(8):
    row = R['idle'][d * 10:(d + 1) * 10]; k = medoid(row); idle_pick.append(d * 10 + k)
    f = row[k]; place(f, scale=FH / meas(f)['h'])
# walk: eight phases, one per row, normalised height so the body doesn't pump
walk_pick = []
heights = []
for r in range(8):
    row = R['walk'][r * 10:(r + 1) * 10]; k = medoid(row); walk_pick.append(r * 10 + k); heights.append(meas(row[k])['h'])
wh = np.median(heights)
for r, i in enumerate(walk_pick): place(R['walk'][i], scale=sc * STAND_H / wh * 0.985)
# jump: key poses; legs off the ground from 16 to 36
JK = [3, 13, 16, 24, 29, 36, 46, 53, 58, 61]
jh = np.median([meas(R['jump'][i])['h'] for i in (13, 58, 61)])
js = sc * STAND_H / jh
for i in JK: place(R['jump'][i], mode='air' if 16 <= i <= 36 else 'feet', scale=js)
# old atlas: walk towards and away from the camera
old = Image.open(io.BytesIO(base64.b64decode(open('../atlas/knight.b64').read().split(',')[1])))
oa = np.asarray(old.split()[1].crop((0, 4 * 158, 200, 5 * 158)))
oys = np.nonzero(oa > 128)[0]; s2 = FH / (oys.max() - oys.min())
for row in (4, 5):
    for c in range(8):
        tl = old.crop((c * 200, row * 158, c * 200 + 200, row * 158 + 158)).resize((round(200 * s2), round(158 * s2)), Image.LANCZOS)
        t = Image.new('LA', (TW, TH), (0, 0)); t.paste(tl, (round(FX - 100 * s2), round(FY - 155 * s2)), tl); tiles.append(t)
C = 8; rows = (len(tiles) + C - 1) // C
sheet = Image.new('LA', (TW * C, TH * rows), (0, 0))
for i, t in enumerate(tiles): sheet.paste(t, ((i % C) * TW, (i // C) * TH))
buf = io.BytesIO(); sheet.convert('RGBA').save(buf, 'WEBP', quality=84, method=6)
open('sheet2.b64', 'w').write('data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode())
print('tiles', len(tiles), 'idle', idle_pick, 'walk', walk_pick, 'sheet', sheet.size, 'bytes', len(buf.getvalue()))
prev = Image.new('RGB', sheet.size, (150, 30, 30)); prev.paste(sheet.convert('L'), mask=sheet.split()[1])
for x in range(0, sheet.width, TW):
    for y in range(FY, sheet.height, TH): prev.putpixel((x + FX, y), (255, 255, 0))
prev.save('prev2.png')
