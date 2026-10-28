# Lays the captured frames side by side without retouching them.
import sys
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
here = Path(__file__).parent
ev = here / 'evidence'
rows = [
    [('native05-whole.png', '参照 native05（採用美術・固定模型）'), ('sample-T-whole.png', '方式T 段丘輪郭（保存データから生成）'), ('sample-G-whole.png', '方式G 連続高さ場（同じデータ）')],
    [('sample-T-hill.png', 'T：水鉢3つ＝段を下る水庭'), ('sample-G-hill.png', 'G：同じ水鉢が平たい模様に'), (str(here.parent / '2026-10-23-place-brush-trial/evidence/water-v28-master-first.png'), '現行ゲーム試作v28（参考）')],
    [('edited-T-whole.png', 'T：子どもの編集13操作（受理11）後'), ('random24-T-whole.png', 'T：さらに無作為24編集後'), ('random24-G-whole.png', 'G：同じ無作為24編集後')],
]
W, H, pad, cap = 720, 450, 16, 40
font = None
for f in ['/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc', '/System/Library/Fonts/Hiragino Sans GB.ttc']:
    try: font = ImageFont.truetype(f, 24); break
    except Exception: pass
sheet = Image.new('RGB', (pad + 3 * (W + pad), pad + len(rows) * (H + cap + pad)), '#f4f1ea')
d = ImageDraw.Draw(sheet)
for r, row in enumerate(rows):
    for c, (name, label) in enumerate(row):
        p = Path(name) if name.startswith('/') else ev / name
        im = Image.open(p).convert('RGB')
        im.thumbnail((W, H)); x = pad + c * (W + pad); y = pad + r * (H + cap + pad)
        sheet.paste(im, (x + (W - im.width) // 2, y + cap + (H - im.height) // 2))
        d.text((x, y + 6), label, fill='#2a3350', font=font)
sheet.save(ev / 'contact-sheet.png')
print(sheet.size)
