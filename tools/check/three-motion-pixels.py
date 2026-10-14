#!/usr/bin/env python3
"""The original and Three.js should render identical animated authored frames."""
from pathlib import Path
from PIL import Image, ImageChops
import sys
root=Path(sys.argv[1] if len(sys.argv)>1 else 'shots/three-motion')
for viewport in ('desktop','phone'):
    originals=sorted(root.glob(viewport+'-motion-*-original.png'))
    if len(originals)!=5:
        raise SystemExit('FAIL expected 5 '+viewport+' animated scene captures')
    unique=set()
    for orig in originals:
        rendered=orig.with_name(orig.name.replace('-original.png','-three.png'))
        if not rendered.exists():raise SystemExit('FAIL missing '+str(rendered))
        a=Image.open(orig).convert('RGB')
        b=Image.open(rendered).convert('RGB')
        if a.size!=b.size:raise SystemExit('FAIL changed animation viewport')
        mx=max(channel[1] for channel in ImageChops.difference(a,b).getextrema())
        if mx:raise SystemExit(f'FAIL {orig.name}: Three changed source animation pixels by {mx}')
        print('MOTION PIXEL PASS',orig.stem)
        unique.add(a.tobytes())
    if len(unique)<2:raise SystemExit('FAIL no visual animation '+viewport)
print('PASS: 10 original/Three animation frames have exact pixel equality')
