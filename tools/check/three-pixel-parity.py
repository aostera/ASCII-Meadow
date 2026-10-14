#!/usr/bin/env python3
"""Compare the actual unchanged original game's pixels with its Three.js raster.
Shots are captured with the SAME simulation paused in CI (parityTest=1).
Exclude toolbar, editor and FPS counters from the comparison region.
Report exact mismatch; only reject catastrophic blank/empty Three output until
the prototype reaches strict pixel-parity acceptance.
"""
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageStat
base = Path(sys.argv[1] if len(sys.argv)>1 else "shots/three-parity")
failed = False
for kind in ("desktop","phone"):
    orig=Image.open(base/f"{kind}-original.png").convert("RGB")
    port=Image.open(base/f"{kind}-three.png").convert("RGB")
    if orig.size!=port.size:
        raise SystemExit(f"FAIL {kind}: canvas dimensions changed")
    w,h=orig.size
    region=(.34,.22,.96,.82) if kind=="desktop" else (.08,.28,.94,.76)
    box=tuple(map(int,(w*region[0],h*region[1],w*region[2],h*region[3])))
    a,b=orig.crop(box),port.crop(box)
    diff=ImageChops.difference(a,b)
    stat=ImageStat.Stat(diff)
    mae=sum(stat.mean)/3
    old_luma=ImageStat.Stat(a.convert("L")).mean[0]
    new_luma=ImageStat.Stat(b.convert("L")).mean[0]
    bright_a=sum(int(v) for v in a.convert("L").histogram()[36:]) / (a.width*a.height)
    bright_b=sum(int(v) for v in b.convert("L").histogram()[36:]) / (b.width*b.height)
    print(f"{kind.upper()} same-scene pixel diff: MAE={mae:.2f}/255; "
          f"original mean={old_luma:.2f}, Three mean={new_luma:.2f}; "
          f"brightness coverage original={bright_a:.2%}, Three={bright_b:.2%}")
    diff.save(base/f"{kind}-difference.png")
    # No assertion of exact parity until differences have been examined.
    # Do not accept the earlier black-screen failure ever again.
    if bright_a>0.007 and bright_b < bright_a*0.25:
        failed=True
        print(f"FAIL {kind}: Three.js lost at least 75% of the original's visible detail")
    if new_luma<2 and old_luma>5:
        failed=True
        print(f"FAIL {kind}: Three.js scene appears blank")
if failed:raise SystemExit(1)
print("PASS catastrophic regression guard only. Strict pixel-for-pixel match is NOT yet proven.")
