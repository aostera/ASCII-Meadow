# Compares two screenshot sets taken by det.cjs (<prefix>_<name>.png) pixel by pixel.
# Exit 0 only when both sets hold the same shots and every pair matches; an empty or missing set is a failure,
# never a pass.   usage: python3 tools/check/diff.py <reference prefix> <candidate prefix> [--tolerance N] [--out DIR]
#   --tolerance N   ignore per-channel differences up to N (1 absorbs the ±1 text rasterisation noise of mobile runs)
#   --out DIR       write a highlighted difference image for every pair that differs
import sys, glob, os
try:
    from PIL import Image, ImageChops
except ImportError:
    print('ERROR: Pillow is not installed (pip install pillow)'); sys.exit(2)

args = sys.argv[1:]
def opt(name, default):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
tol = int(opt('--tolerance', 0)); out = opt('--out', None)
if len(args) != 2: print('usage: diff.py <reference prefix> <candidate prefix> [--tolerance N] [--out DIR]'); sys.exit(2)
a, b = args
shots = lambda p: {f[len(p) + 1:] for f in glob.glob(p + '_*.png') if 'sheet' not in os.path.basename(f)}
ref, cand = shots(a), shots(b)
bad = 0
if not ref: print('ERROR: no reference shots match', a + '_*.png'); sys.exit(2)
for name in sorted(ref | cand):
    if name not in cand: print('%-28s MISSING in candidate' % name); bad += 1; continue
    if name not in ref: print('%-28s MISSING in reference' % name); bad += 1; continue
    A = Image.open('%s_%s' % (a, name)).convert('RGB'); B = Image.open('%s_%s' % (b, name)).convert('RGB')
    if A.size != B.size: print('%-28s SIZE %s vs %s' % (name, A.size, B.size)); bad += 1; continue
    d = ImageChops.difference(A, B)
    if tol: d = d.point(lambda v: v if v > tol else 0)
    bb = d.getbbox()
    if not bb: print('%-28s identical%s' % (name, ' (within ±%d)' % tol if tol else '')); continue
    r, g, bl = d.split(); m = ImageChops.lighter(ImageChops.lighter(r, g), bl)
    n = m.width * m.height - m.histogram()[0]   # pixels where any channel differs
    print('%-28s DIFF %d px, bbox %s' % (name, n, bb)); bad += 1
    if out:
        os.makedirs(out, exist_ok=True)
        Image.blend(A, d.point(lambda v: 255 if v else 0), 0.6).save(os.path.join(out, 'diff_' + name))
print('compared %d shots, %d failing' % (len(ref | cand), bad))
sys.exit(1 if bad else 0)
