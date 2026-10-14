#!/usr/bin/env python3
"""Strict same-frame pixel parity across original WebGL2 and Three.js.
No creative brightness, color, or transparency changes. Entire screenshots
are compared (test-only HUD/FPS overlays hidden during capture).
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageStat
import sys

folder = Path(sys.argv[1] if len(sys.argv) > 1 else "shots/three-parity")
sources = sorted(folder.glob("*-original.png"))
if len(sources) < 8:
    raise SystemExit(f"FAIL missing authored scene captures: got {len(sources)}, need 8")

errors = []
for original in sources:
    newer = original.with_name(original.name.replace("-original.png", "-three.png"))
    if not newer.exists():
        errors.append(f"{original.name}: Three.js screenshot missing")
        continue
    a = Image.open(original).convert("RGB")
    b = Image.open(newer).convert("RGB")
    if a.size != b.size:
        errors.append(f"{original.name}: image dimensions changed")
        continue
    diff = ImageChops.difference(a, b)
    extrema = diff.getextrema()
    max_diff = max(channel[1] for channel in extrema)
    mean = sum(ImageStat.Stat(diff).mean) / 3
    pixels = a.width * a.height
    exact = sum(1 for v in diff.convert("L").getdata() if v == 0) / pixels
    name = original.stem
    diff.save(original.with_name(original.name.replace("-original.png", "-difference.png")))
    print(f"PIXEL PARITY {name}: exact={exact:.6%}, MAE={mean:.5f}/255, maxDelta={max_diff}")
    # Guard true glyph fidelity, permitting only subpixel driver differences.
    if exact < 0.9999 or mean > 0.01 or max_diff > 5:
        errors.append(f"{name}: exceeds strict parity tolerance")

if errors:
    raise SystemExit("FAIL: " + "; ".join(errors))
print(f"PASS: {len(sources)} full-screen, same-state authored-world pixel comparisons")
