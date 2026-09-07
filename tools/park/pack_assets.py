"""Lossless geometry/pivots, compact WebP transport. Requires Pillow."""
import json
from pathlib import Path
from PIL import Image

root=Path(__file__).resolve().parents[2]
source=root/'art/park/renders';dest=root/'public/assets/park/resin-v1';dest.mkdir(parents=True,exist_ok=True)
manifest=json.loads((source/'manifest.json').read_text())
total=0
for name,sprite in manifest['sprites'].items():
    image=Image.open(source/(name+'.png')).convert('RGBA')
    assert image.size==(sprite['width'],sprite['height']),name
    bounds=image.getchannel('A').getbbox()
    assert bounds, f'Empty render: {name}'
    sprite['bounds']=list(bounds)
    image.save(dest/sprite['file'],'WEBP',quality=88,method=6,exact=True)
    restored=Image.open(dest/sprite['file']).convert('RGBA')
    assert restored.getchannel('A').tobytes()==image.getchannel('A').tobytes(),f'Alpha drift: {name}'
    total+=(dest/sprite['file']).stat().st_size
manifest['compressedBytes']=total
assert Image.open(source/'actor-pink-stand.png').tobytes()!=Image.open(source/'actor-violet-stand.png').tobytes(), 'Paint tint did not reach the rendered actor material'
manifest['expandedBytes']=sum(s['width']*s['height']*4 for s in manifest['sprites'].values())
(root/'src/components/park/artManifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(root/'art/park/asset-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'{len(manifest["sprites"])} assets, {total/1024:.0f} KiB transport, {manifest["expandedBytes"]/1024**2:.1f} MiB expanded')
