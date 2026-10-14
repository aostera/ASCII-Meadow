#!/usr/bin/env python3
"""A native cow may render ONLY inside opt-in inset; ASCII stays 1:1."""
from PIL import Image, ImageChops, ImageDraw
from pathlib import Path
import sys
root=Path(sys.argv[1] if len(sys.argv)>1 else 'shots/three-cow')
for name in ('desktop','phone'):
    a=Image.open(root/(name+'-base.png')).convert('RGB')
    b=Image.open(root/(name+'-cow.png')).convert('RGB')
    if a.size!=b.size:raise SystemExit('FAIL cow viewport size '+name)
    w,h=a.size
    scale=2 if name=='phone' else 1
    sw,sh=w/scale,h/scale
    iw=min(sw*.41,340);ih=min(sh*.32,230)
    left=max(0,sw-iw-14)
    top=min(244,max(14,sh-ih-14)) if sw<650 else 14
    mask=Image.new('L',(w,h),255)
    ImageDraw.Draw(mask).rectangle((
      max(0,int((left-3)*scale)),max(0,int((top-3)*scale)),
      min(w,int((left+iw+3)*scale)),min(h,int((top+ih+3)*scale))),fill=0)
    diff=ImageChops.difference(a,b)
    outside=Image.composite(diff,Image.new('RGB',(w,h)),mask)
    worst=max(ch[1] for ch in outside.getextrema())
    if worst:raise SystemExit(f'FAIL {name}: source game pixels changed outside 3D inset, {worst}')
    print(f'{name.upper()} 3D COW ORIGINAL ASCII ISOLATION PASS')
print('PASS: original author scene brightness, transparency and pixels unchanged by 3D cow')
