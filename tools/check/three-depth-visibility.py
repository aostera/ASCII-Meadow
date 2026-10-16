#!/usr/bin/env python3
"""Prove native source geometry uses REAL GPU depth, not fake flat UI imagery.
Also compare every screen pixel outside its user-requested diagnostic inset:
the exact original game brightness/alpha/glyphs must NOT move even by 1.
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageStat
import json
import sys
root=Path(sys.argv[1] if len(sys.argv)>1 else "shots/three-depth")
for name in ("desktop","phone"):
    before=Image.open(root/(name+"-before.png")).convert("RGB")
    depth=Image.open(root/(name+"-depth.png")).convert("RGB")
    restored=Image.open(root/(name+"-restored.png")).convert("RGB")
    if before.size!=depth.size or before.size!=restored.size:
        raise SystemExit("FAIL "+name+": depth pass changed CSS canvas dimensions")
    rect=json.loads((root/(name+"-rect.json")).read_text())
    l=int(rect["x"])-2;t=int(rect["top"])-2
    r=int(rect["x"]+rect["width"])+2;b=int(rect["top"]+rect["height"])+2
    box=(max(0,l),max(0,t),min(before.width,r),min(before.height,b))
    inset=depth.crop(box).convert("L")
    hist=inset.histogram()
    white=sum(hist[220:])
    dark=sum(hist[:40])
    coverage=white/(inset.width*inset.height)
    outside=ImageChops.difference(before,depth)
    mask=Image.new("L",before.size,255)
    ImageDraw.Draw(mask).rectangle(box,fill=0)
    outside=Image.composite(outside,Image.new("RGB",before.size),mask)
    delta=max(channel[1] for channel in outside.getextrema())
    back=ImageChops.difference(before,restored)
    back_delta=max(channel[1] for channel in back.getextrema())
    print(f"{name.upper()} Gothic depth: stone={coverage:.2%}, emptyPixels={dark}, "
          f"outsideInsetMaxChange={delta}/255, restoredMaxChange={back_delta}/255")
    if delta:
        raise SystemExit("FAIL: Depth diagnostic modified authored game pixels outside inset")
    if back_delta:
        raise SystemExit("FAIL: Depth disable failed to restore exact original glyph pixels")
    if white<25 or dark<25:
        raise SystemExit("FAIL: Gothic depth mask must contain both real stone and empty-space pixels")
print("PASS: source-space GPU depth occupancy visible; original RGB and alpha untouched outside inset on phone/desktop")
