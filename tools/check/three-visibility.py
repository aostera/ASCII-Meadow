#!/usr/bin/env python3
"""Fail CI if a Three.js screenshot is virtually empty/black.
Samples just the game world; excludes the overlay controls and mobile D-pad.
The thresholds reject the original near-invisible ASCII output; they do NOT
certify artistic parity or high visual quality. This is a smoke gate.
"""
import sys
from pathlib import Path
from PIL import Image

if len(sys.argv) < 2:
    raise SystemExit("usage: python3 tools/check/three-visibility.py shots/three/desktop.png shots/three/phone.png")
bad = False
for file in sys.argv[1:]:
    im = Image.open(file).convert("L")
    w, h = im.size
    mobile = "phone" in Path(file).name
    bounds = ((.10, .36, .90, .82) if mobile else (.46, .12, .96, .84))
    box = (int(w*bounds[0]), int(h*bounds[1]), int(w*bounds[2]), int(h*bounds[3]))
    crop = im.crop(box)
    data = crop.tobytes()
    bright = sum(1 for px in data if px >= 48) / max(1, len(data))
    visible = sum(1 for px in data if px >= 24) / max(1, len(data))
    mean = sum(data) / max(1, len(data))
    # Old broken renderer: phone bright=0.0002, desktop bright=0.0011.
    print(f"VISIBILITY {file}: bright>=48={bright:.3%}; visible>=24={visible:.3%}; mean={mean:.1f}")
    if bright < .007 or visible < .025:
        bad = True
        print(f"FAIL {file}: scene is still too dark to evaluate")
if bad:
    raise SystemExit(1)
print("PASS: ASCII scene contains readable bright detail above dark-screen baseline")
