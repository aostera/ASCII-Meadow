import sys, base64, io
from PIL import Image, ImageDraw
sheet = Image.open(io.BytesIO(base64.b64decode(open('atl3/sheet3.b64').read().split(',')[1]))).convert('RGBA')
KWB=[0,7,0,0,0,0,2,5]
keep=list(range(8))+[8+d*8+KWB[d] for d in range(8)]+list(range(72,149))
TW,TH=144,112
cw,ch=9,13
def render(i):
    o=keep[i]; c,r=o%8,o//8
    t=sheet.crop((c*TW,r*TH,c*TW+TW,r*TH+TH)).resize((104*cw,54*ch),Image.BICUBIC)
    bg=Image.new('RGBA',t.size,(0,0,0,255)); bg.alpha_composite(t)
    im=Image.new('RGB',(104*cw+30,54*ch+20),(0,0,0)); im.paste(bg.convert('RGB'),(30,20))
    d=ImageDraw.Draw(im)
    for x in range(0,104,4):
        d.line((30+x*cw,20,30+x*cw,20+54*ch),fill=(150,40,40) if x%20==0 else (70,20,20))
        if x%8==0:d.text((30+x*cw,4),str(x),fill=(255,90,90))
    for y in range(0,54,2):
        d.line((30,20+y*ch,30+104*cw,20+y*ch),fill=(50,50,170) if y%10==0 else (20,20,60))
        if y%4==0: d.text((2,20+y*ch),str(y),fill=(120,140,255))
    # crop to figure
    return im.crop((0,0,30+90*cw,20+54*ch)) if True else im
for i in map(int,sys.argv[1:]):
    render(i).save('kseg/g%02d.png'%i)
