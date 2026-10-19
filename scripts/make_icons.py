# Generates PWA icons: NGS mark (cropped from the Live PM icon) + "CiP PERF".
from PIL import Image, ImageDraw, ImageFont, ImageChops
SRC='/home/box/agent-data/agents/f92c8320-81ac-41ef-8574-009621226b4a/assets/9fc654dcba0e0570a607998cbc01680d48e3c7979ecfee076bc17067ace24168.png'
FONT='/usr/share/fonts/truetype/sand-box/google/Public Sans/PublicSans-Italic-VariableFont_wght.ttf'
src=Image.open(SRC).convert('RGB')
top=src.crop((0,0,src.width,460))
bg=Image.new('RGB',top.size,(255,255,255))
bbox=ImageChops.difference(top,bg).convert('L').point(lambda v:255 if v>40 else 0).getbbox()
ngs=top.crop(bbox)
RED=(220,24,38)
def font(sz):
    f=ImageFont.truetype(FONT,sz); f.set_variation_by_name('Black Italic'); return f
def make(pad_frac):
    S=1024
    im=Image.new('RGB',(S,S),(255,255,255))
    inner=S*(1-2*pad_frac)
    w=int(inner); h=int(ngs.height*w/ngs.width)
    n=ngs.resize((w,h),Image.LANCZOS)
    d=ImageDraw.Draw(im)
    text='CiP PERF'
    f=font(int(inner*0.2)); tb=d.textbbox((0,0),text,font=f)
    f=font(int(inner*0.2*inner*0.92/(tb[2]-tb[0]))); tb=d.textbbox((0,0),text,font=f)
    tw,th=tb[2]-tb[0],tb[3]-tb[1]
    gap=int(inner*0.08)
    y0=(S-(h+gap+th))//2
    im.paste(n,((S-w)//2,y0))
    d.text(((S-tw)//2-tb[0], y0+h+gap-tb[1]),text,font=f,fill=RED)
    return im
base=make(0.11); mask=make(0.21)
for s,name in [(32,'icons/icon-32.png'),(192,'icons/icon-192.png'),(512,'icons/icon-512.png'),(180,'apple-touch-icon.png')]:
    base.resize((s,s),Image.LANCZOS).save('public/'+name, optimize=True)
mask.resize((512,512),Image.LANCZOS).save('public/icons/icon-maskable-512.png', optimize=True)
