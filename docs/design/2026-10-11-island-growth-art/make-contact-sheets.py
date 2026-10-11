"""Arrange actual final QA screenshots; never generate or repaint island pixels."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parent
QA=ROOT/'verification'
report=json.loads((QA/'report.json').read_text())
assert report['pass'], 'Use completed final QA only'
FONT='/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc'
def font(size):return ImageFont.truetype(FONT,size)
def text(draw,xy,value,size=18,color='#24334a'):
    draw.text(xy,value,font=font(size),fill=color)
def fit(image,box):
    image=image.copy();image.thumbnail(box,Image.Resampling.LANCZOS);return image

stages=[('small','小さな島'),('young','育ち途中'),('grown','育った島・採用済み原本')]
views=[('whole','島全体'),('grove','森と大樹'),('spring','段泉と丘'),('harbor','入り江'),('garden','花の庭')]
captures={item['file']:item for item in report['captures'] if 'file' in item}

# Full app frames retain heading, growth selector and the original navigation.
board=Image.new('RGB',(1216,682),'#f5f7fb');draw=ImageDraw.Draw(board)
text(draw,(28,20),'同じ島が育つ — 実アプリの全島3D',27)
text(draw,(28,58),'同じカメラ・家の縮尺。地形と大樹、水の庭、入り江が育つ。',16,'#617086')
for i,(stage,label) in enumerate(stages):
    image=fit(Image.open(QA/f'768-{stage}-whole-day.png').convert('RGB'),(368,491))
    x=28+i*400;y=96
    board.paste(image,(x+(368-image.width)//2,y))
    text(draw,(x,600),label,20)
text(draw,(28,645),report['version']['revision']+' / 768×1024 / art study / gameplay mapping pending',12,'#748093')
board.save(QA/'growth-comparison.png')

# Each grid shows one stage at five views and both lights. Only the measured
# canvas is cropped; the underlying full app captures remain beside the sheet.
for width in [390,768]:
    bounds=captures[f'{width}-small-whole-day.png']['stage']['bounds']
    thumb_height=round(250*bounds['height']/bounds['width'])
    row_height=thumb_height+48
    board_height=106+2*row_height+36
    for stage,label in stages:
        board=Image.new('RGB',(1340,board_height),'#f5f7fb');draw=ImageDraw.Draw(board)
        text(draw,(24,18),f'{label} — {width}幅 / 全景と近景・昼夕',25)
        text(draw,(24,58),report['version']['revision']+' / 実画面のcanvas範囲・controls保持',14,'#617086')
        for row,(light,light_label) in enumerate([('day','昼'),('evening','夕')]):
            for col,(view,view_label) in enumerate(views):
                file=f'{width}-{stage}-{view}-{light}.png';capture=captures[file]
                bounds=capture['stage']['bounds'];frame=Image.open(QA/file).convert('RGB')
                crop=frame.crop(tuple(round(v) for v in [bounds['x'],bounds['y'],bounds['x']+bounds['width'],bounds['y']+bounds['height']]))
                crop=fit(crop,(250,thumb_height));x=24+col*263;y=106+row*row_height
                board.paste(crop,(x+(250-crop.width)//2,y))
                text(draw,(x,y+thumb_height+10),light_label+' / '+view_label,16)
        text(draw,(24,board_height-28),captures[f'{width}-{stage}-whole-day.png']['stage']['artCandidate']+' / full captures and checksums: report.json',12,'#748093')
        board.save(QA/f'{width}-{stage}-contact.png')
print('Saved 1 full-frame comparison and 6 actual-canvas contact sheets.')
