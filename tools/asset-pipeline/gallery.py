#!/usr/bin/env python3
"""Create a portable static source/render comparison page from a completed batch."""
import argparse
import html
import json
import os
from pathlib import Path


def build(state_path):
    state_path = Path(state_path).resolve()
    state = json.loads(state_path.read_text())
    root, output = Path(state['root']), state_path.parent
    cards = []
    rows = []
    for aid, job in state['assets'].items():
        base = root/'assets'/aid
        relative = lambda path: html.escape(os.path.relpath(path, output), quote=True)
        report = json.loads((base/'final/verification.json').read_text())
        timing = json.loads((base/'meshy_raw/timing.json').read_text()) if (base/'meshy_raw/timing.json').exists() else {}
        review = json.loads((base/'final/review.json').read_text()) if (base/'final/review.json').exists() else {'notes':'未レビュー'}
        manifest = {**job, 'batch_id':state['batch_id'], 'timing':timing, 'review':review,
                    'files':{'source':'source/input.png','raw':'meshy_raw/model.glb','final':'final/model.glb'},
                    'verification':report}
        (base/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
        cells = ''.join(f'<figure><img src="{relative(path)}" alt="{html.escape(job["label"]+label)}"><figcaption>{label}</figcaption></figure>' for label,path in [
            ('元画像',base/'source/input.png'),('正面',base/'final/front.png'),('背面',base/'final/back.png'),('底面',base/'final/bottom.png')])
        metrics = f'{job["final"]["triangles"]:,} 三角形 · 高さ {job["target_height"]} m · {job["final"]["bytes"]/1e6:.2f} MB · {timing.get("generation_seconds",0):.1f} 秒'
        cards.append(f'<article><h2>{html.escape(job["label"])}</h2><p>{metrics}</p><div class="grid">{cells}</div><p>{html.escape(review["notes"])}</p><p><a href="{relative(base/"final/model.glb")}" download>最終GLB</a> <a href="{relative(base/"meshy_raw/model.glb")}" download>未加工GLB</a> <a href="{relative(base/"final/verification.json")}">検証記録</a></p></article>')
        rows.append((aid,base))
    balance = json.loads((output/'balance.json').read_text()) if (output/'balance.json').exists() else {}
    document = '''<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>島の素材 — 制作レビュー</title><style>
    body{font-family:system-ui,sans-serif;background:#f6f4ee;color:#23342b;margin:0;padding:32px;line-height:1.7}main{max-width:1400px;margin:auto}h1{font-size:32px}h2{font-size:23px;margin-bottom:0}article{border-top:1px solid #c7cdc3;padding:24px 0}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0}img{width:100%;aspect-ratio:1;object-fit:contain;background:white;border-radius:12px}figcaption{color:#526357}a{color:#23604c;margin-right:18px}p{max-width:1000px}@media(max-width:700px){body{padding:16px}.grid{grid-template-columns:repeat(2,1fr)}}
    </style><main><h1>島の素材 · 3D制作ルーチン</h1>'''
    document += f'<p>Meshy 7 · PBR / 2K · {len(rows)}件各1回 · 消費 {balance.get("consumed","未確認")} / {state["budget_credits"]} クレジット。原点・寸法・テクスチャ・再インポートを検証済み。</p><p>技術検証と見た目の判定は別。ゲーム内配置・実機性能・子どもの理解は未検証です。</p>'
    document += ''.join(cards) + '</main></html>'
    (output/'index.html').write_text(document)
    try:
        from PIL import Image, ImageDraw
        sheet = Image.new('RGB',(1280,len(rows)*350),'#f6f4ee')
        draw = ImageDraw.Draw(sheet)
        for row,(aid,base) in enumerate(rows):
            for col,(label,path) in enumerate([('SOURCE',base/'source/input.png'),('FRONT',base/'final/front.png'),('BACK',base/'final/back.png'),('BOTTOM',base/'final/bottom.png')]):
                image = Image.open(path).convert('RGBA'); image.thumbnail((310,310))
                x=col*320+(320-image.width)//2; y=row*350+30+(310-image.height)//2
                sheet.paste(image,(x,y),image);draw.text((col*320+10,row*350+10),aid+' / '+label,fill='#25302b')
        sheet.save(output/'review.jpg',quality=92)
    except ImportError:
        print('Pillow unavailable; HTML gallery still generated')
    print(output/'index.html')


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('state')
    build(parser.parse_args().state)
