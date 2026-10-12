# usage: python3 tools/cow/key_black.py assets/cow_v2/cow_eat_atlas.webp out_rgba.png
# The eat atlas came as RGB on black: the background (large connected areas of near-black) becomes
# transparent, the rim fades with its brightness; dark outlines inside the cow stay opaque.
import sys, numpy as np, cv2
from PIL import Image
a = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(np.uint8); m = a.max(2)
n, lab, st, _ = cv2.connectedComponentsWithStats((m <= 10).astype(np.uint8), 4)
bg = np.isin(lab, [i for i in range(1, n) if st[i, 4] > 150])
alpha = np.where(bg, 0, 255).astype(np.uint8)
rim = (cv2.dilate(bg.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & ~bg
alpha[rim] = np.clip(m[rim].astype(int) * 12, 0, 255)
Image.fromarray(np.dstack([a, alpha])).save(sys.argv[2])
