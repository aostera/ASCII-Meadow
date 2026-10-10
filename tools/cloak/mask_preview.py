# Draws the idle poses and the first walk frames with their cloak mask (KCLOAK/KCLOAKW) in red.
# usage: python3 tools/cloak/mask_preview.py [src/entities/knight.js] [src/data/knight-frames.js]
import json,re,base64,io
from PIL import Image, ImageDraw
import sys
s=open(sys.argv[1] if len(sys.argv)>1 else 'src/entities/knight.js').read()
d=open(sys.argv[2] if len(sys.argv)>2 else 'src/data/knight-frames.js').read()
def outlines(name):   # a hand-traced outline table from the knight module, as JSON
    t=s[s.index('const %s = [' % name):s.index('];',s.index('const %s = [' % name))+1]
    t=re.sub(r'//.*','',t); t=re.sub(r'\s','',t[t.index('['):]); t=re.sub(r',\]',']',t); return json.loads(t)
KC, KCW = outlines('KCLOAK'), outlines('KCLOAKW')
outline = lambda i: (KC[i] if i < 8 else KCW[(i - 8) // 10]) or []   # idle per pose, walk per direction; null = set in code
a=d.index('const KNIGHT_ART = ['); KA=re.findall(r'`([^`]*)`', d[a:d.index('\n];', a)])   # the knight frames
def inside(r,px,py):
    ins=False; n=len(r); k=2; l=n-2
    while k<n:
        xk,yk,xl,yl=r[k],r[k+1],r[l],r[l+1]
        if (yk>py)!=(yl>py) and px<(xl-xk)*(py-yk)/(yl-yk)+xk: ins=not ins
        l=k; k+=2
    return ins
tiles=[]
for i in range(16):
    L=KA[i].split('\n'); top=int(L[0]); cw,ch=6,9
    im=Image.new('RGB',(90*cw,54*ch),(0,0,0)); d=ImageDraw.Draw(im)
    for k,row in enumerate(L[1:]):
        y=top+k
        for x,c in enumerate(row):
            if c==' ' or x>=90: continue
            v=50+int(" .:-=+*#%@".index(c if c!="'" else ' ')/9*150)
            w=0
            for r in outline(i):
                if inside(r,x+.5,y+.5): w=max(w,min(1,max(0,(y+.5-r[0])/(r[1]-r[0]))))
            col=(int(v*(1-w)+255*w),int(v*(1-w)+60*w),int(v*(1-w)+60*w)) if w>0 else (v,v,v)
            d.rectangle((x*cw,y*ch,x*cw+cw-1,y*ch+ch-1),fill=col)
    for r in outline(i):
        pts=[(r[k]*cw,r[k+1]*ch) for k in range(2,len(r),2)]; d.line(pts+[pts[0]],fill=(255,255,0))
    d.text((4,4),str(i),fill=(255,255,0))
    tiles.append(im.crop((90,60,90*cw-30,54*ch)))
W,H=tiles[0].size
m=Image.new('RGB',(W*8,H*2))
for i,t in enumerate(tiles): m.paste(t,((i%8)*W,(i//8)*H))
m.save('tools/cloak/mask.png'); print(m.size)
