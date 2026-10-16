"""Reproduce equal-scale crops from committed runtime evidence (Python + Pillow)."""
import argparse
import hashlib
import io
import json
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs/portal/comparison'
SOURCES = ['c1/shape', 'c4/full']
BASE = 'docs/design/2026-10-12-authored-cove-runtime/'
BOX = (200, 300, 860, 740)


def committed(relative):
    data = (ROOT / relative).read_bytes()
    frozen = subprocess.check_output(['git', 'show', 'HEAD:' + relative], cwd=ROOT)
    assert data == frozen, f'Comparison input differs from committed evidence: {relative}'
    return data


def outputs():
    cameras = []
    records = []
    result = {}
    for folder, label in zip(SOURCES, ['before', 'after']):
        report_path = BASE + folder + '/report.json'
        report_bytes = committed(report_path)
        report = json.loads(report_bytes)
        capture = next(c for c in report['captures'] if c['file'] == 'desktop-cove-close-day.png')
        cameras.append(json.loads(capture['metadata']['growingCamera']))
        source = BASE + folder + '/' + capture['file']
        source_bytes = committed(source)
        image = Image.open(io.BytesIO(source_bytes))
        assert image.size == (1280, 900) and capture['viewport'] == {'width': 1280, 'height': 900}
        buffer = io.BytesIO()
        image.crop(BOX).save(buffer, format='PNG')
        name = f'cove-{label}.png'
        result[name] = buffer.getvalue()
        records.append({'source': source, 'sourceSha256': hashlib.sha256(source_bytes).hexdigest(),
                        'report': report_path, 'reportSha256': hashlib.sha256(report_bytes).hexdigest(),
                        'camera': cameras[-1], 'crop': list(BOX), 'output': name,
                        'outputSha256': hashlib.sha256(result[name]).hexdigest()})
    a, b = cameras
    assert a['projectionMatrix'] == b['projectionMatrix'], 'Same orthographic magnification'
    assert a['matrixWorld'][:12] == b['matrixWorld'][:12], 'Same camera orientation'
    assert a['center'] == b['center'] and a['curved'] == b['curved']
    # Translation along the viewing axis does not change an orthographic frame.
    delta = [b['matrixWorld'][12+i] - a['matrixWorld'][12+i] for i in range(3)]
    for offset in [0, 4]:
        assert abs(sum(delta[i] * a['matrixWorld'][offset+i] for i in range(3))) < 1e-10, 'Same screen origin'
    result['comparison.json'] = (json.dumps({'scope': 'Historical rectangular apron versus curved shore; not the current open-inlet candidate',
        'operation': 'identical pixel crop, no resizing or retouching', 'outputSize': [660, 440], 'records': records}, indent=2) + '\n').encode()
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    for name, data in outputs().items():
        target = OUT / name
        if args.check:
            assert target.read_bytes() == data, f'Stale comparison crop: {target}'
        else:
            OUT.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
    print('PASS: committed sources, equal orthographic scale/frame, identical crops' + (' verified' if args.check else ' generated'))
