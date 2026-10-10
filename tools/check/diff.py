import sys, glob, os
from PIL import Image, ImageChops
a, b = sys.argv[1], sys.argv[2]; tot = 0
for fa in sorted(f for f in glob.glob(a + '_*.png') if 'sheet' not in f):
    fb = b + fa[len(a):]
    if not os.path.exists(fb): print('missing', fb); tot += 1; continue
    A, B = Image.open(fa).convert('RGB'), Image.open(fb).convert('RGB')
    if A.size != B.size: print('size', fa, A.size, B.size); tot += 1; continue
    d = ImageChops.difference(A, B); bb = d.getbbox(); n = sum(1 for p in d.get_flattened_data() if p != (0, 0, 0)) if bb else 0
    print('%-28s %s' % (os.path.basename(fa)[len(os.path.basename(a)):], 'identical' if not bb else 'DIFF %d px bbox %s' % (n, bb))); tot += bool(bb)
print('TOTAL differing shots:', tot)
