#!/usr/bin/env python3
"""Opt-in source knight 3D diagnostics may change only the tiny 3D inset,
not original characters, gamma, transparency, grass, map or NPC pixels.
"""
from PIL import Image, ImageChops, ImageDraw
from pathlib import Path
import sys
root=Path(sys.argv[1] if len(sys.argv)>1 else 'shots/three-knight')
for n in ('desktop','phone'):
    base=Image.open(root/(n+'-base.png')).convert('RGB')
    rig=Image.open(root/(n+'-rig.png')).convert('RGB')
    if base.size!=rig.size:raise SystemExit('FAIL '+n+' viewport changed')
    w,h=base.size
    # Screenshots include device-scale physical pixels. The architecture
    # inset is strictly within the RIGHT 41% / TOP 32% + mobile tool offset.
    # Exclude a conservative diagnostic corner; all game elsewhere must match.
    scale=2 if n=='phone' else 1
    cssw=w/scale;cssh=h/scale
    insetw=min(cssw*.41,340);inseth=min(cssh*.32,230)
    x=max(0,cssw-insetw-14)
    top=(min(244,max(14,cssh-inseth-14)) if cssw<650 else 14)
    mask=Image.new('L',(w,h),255)
    bounds=(max(0,int((x-3)*scale)),max(0,int((top-3)*scale)),
            min(w,int((x+insetw+3)*scale)),min(h,int((top+inseth+3)*scale)))
    ImageDraw.Draw(mask).rectangle(bounds,fill=0)
    diff=ImageChops.difference(base,rig)
    outside=Image.composite(diff,Image.new('RGB',(w,h)),mask)
    mx=max(ch[1] for ch in outside.getextrema())
    if mx:raise SystemExit('FAIL source native knight changed original ASCII pixels outside inset '+n+' max='+str(mx))
    print(n.upper()+' SOURCE KNIGHT OUTSIDE-RECT PIXEL PASS; original image unchanged')
print('PASS: optional native rig does not modify source artwork outside its isolated viewport')
