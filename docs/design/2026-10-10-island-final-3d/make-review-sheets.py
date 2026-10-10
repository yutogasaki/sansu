"""Assemble unaltered browser captures into labelled review evidence."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont

root=Path(__file__).resolve().parent
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',24)
small=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',18)

def sheet(items,output,cols,cell=(760,600)):
    w,h=cell;rows=(len(items)+cols-1)//cols
    canvas=Image.new('RGB',(w*cols,h*rows+72),'#f1f4f8');draw=ImageDraw.Draw(canvas)
    draw.text((24,18),'Actual local 3D viewer / native-05 / GLB 8398eda9ac084a6e',font=font,fill='#26364b')
    draw.text((24,48),'User adoption pending. Old model appears only in the labelled growth comparison.',font=small,fill='#59677a')
    for i,(file,label) in enumerate(items):
        x=(i%cols)*w;y=(i//cols)*h+72
        draw.text((x+18,y+12),label,font=font,fill='#26364b')
        src=Image.open(root/file).convert('RGB')
        fitted=ImageOps.contain(src,(w-36,h-64))
        canvas.paste(fitted,(x+(w-fitted.width)//2,y+50))
    canvas.save(root/output)

sheet([
 ('viewer-day-desktop.png','05 / Whole island / day'),
 ('viewer-whole-desktop.png','05 / Same island / dusk'),
 ('viewer-grove-phone.png','05 / Hollow tree and coloured leaves'),
 ('viewer-village-tablet.png','05 / Mineral source and blue springs'),
 ('viewer-harbor-tablet.png','05 / Tinted shell and shared court'),
 ('viewer-garden-tablet.png','05 / Joined flower canopy'),
], 'viewer-contact-sheet.png',2)
sheet([
 ('viewer-previous-desktop.png','02 / Earlier garden / same scale and camera'),
 ('viewer-day-desktop.png','05 / Mature island / same scale and camera'),
], 'viewer-comparison.png',2,(880,680))

