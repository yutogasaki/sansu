"""Exact triangle/plane sections in metres; no image synthesis or app/source mutation."""
import gzip, json, hashlib, html
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
profile_path = ROOT / 'geometry-profile.json.gz'
base_path = REPO / 'prototypes/place-qa/native05-world.json.gz'
profile = json.loads(gzip.decompress(profile_path.read_bytes()))
base = json.loads(gzip.decompress(base_path.read_bytes()))
names = ['Island / continuous sculpted mature terrain:0', 'Island / continuous sculpted mature terrain:1']
original = []
for d in base['districts']:
    for f in d['floors']:
        if f['id'] in names:
            p = np.array([[v['point'][k] for k in ['x', 'y', 'z']] for v in f['vertices']])
            original.extend(p[np.array(f['indices']).reshape(-1, 3)])
retained = []
for f in profile['retainedFloors']:
    if json.loads(f['floorId'])[1] in names:
        retained.extend(np.array(f['positions'])[np.array(f['indices']).reshape(-1, 3)])
soil = profile['soil']
top = np.array(soil['positions'])[np.array(soil['indices'][:soil['topTriangleCount'] * 3]).reshape(-1, 3)]
bottom_y = min(p[1] for p in soil['positions'])

def intersect(triangles, x):
    segments = []
    for tri in triangles:
        hits = []
        for a, b in zip(tri, np.roll(tri, -1, axis=0)):
            da, db = a[0] - x, b[0] - x
            if abs(da) < 1e-12:
                hits.append(a)
            if da * db < 0:
                hits.append(a + (b - a) * (-da / (db - da)))
        unique = {tuple(np.round(p, 12)): p for p in hits}
        if len(unique) < 2:
            continue
        points = sorted(unique.values(), key=lambda p: p[2])
        a, b = points[0], points[-1]
        if b[2] - a[2] < 1e-12 or b[2] < -7.4 or a[2] > -4.4:
            continue
        lo, hi = max(-7.4, a[2]), min(-4.4, b[2])
        y_at = lambda z: float(a[1] + (b[1] - a[1]) * (z - a[2]) / (b[2] - a[2]))
        segments.append([[lo, y_at(lo)], [hi, y_at(hi)]])
    return sorted(segments)

sections = []
for x, label, height in [(7, 'l34 / birch', 1.585), (8, 'l35 / spire', 1.615)]:
    old, new, rest = intersect(original, x), intersect(top, x), intersect(retained, x)
    hits = [a[1] + (b[1] - a[1]) * (-6 - a[0]) / (b[0] - a[0]) for a, b in new if a[0] - 1e-10 <= -6 <= b[0] + 1e-10]
    assert hits and max(abs(y - height) for y in hits) < 1e-6
    sections.append({'planeX': x, 'owner': label, 'centerZ': -6, 'supportCenterHeight': height,
                     'originalTerrainSegments': old, 'newTopSegments': new, 'retainedTerrainSegments': rest,
                     'closedSoilBottomY': bottom_y, 'centerHeightError': max(abs(y - height) for y in hits)})
report = {'scope': 'Exact mesh-plane intersections in authored world metres, not a camera render or route proof.',
          'inputs': {str(p.relative_to(REPO)): sha(p) for p in [profile_path, base_path]},
          'scale': 'Same pixels per metre on both axes; displayed SVG scale 170 px/m.', 'sections': sections}
(ROOT / 'dimensioned-sections.json').write_text(json.dumps(report, indent=2) + '\n')

svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1180" height="650" viewBox="0 0 1180 650">',
       '<rect width="1180" height="650" fill="#fff"/>',
       '<style>text{font-family:system-ui,sans-serif;fill:#29313b} .grid{stroke:#e5e9ee;stroke-width:1}</style>',
       '<text x="35" y="32" font-size="22">Central shoulder — exact source sections</text>',
       '<text x="35" y="57" font-size="13">Authored world metres · equal horizontal/vertical scale · 35-owner diagnostic source only</text>']
for index, section in enumerate(sections):
    left = 50 + index * 580
    px = lambda z: left + (z + 7.4) * 170
    py = lambda y: 560 - (y + .4) * 170
    svg.append(f'<text x="{left}" y="96" font-size="17">X = {section["planeX"]:.0f} m · {html.escape(section["owner"])}</text>')
    for y in [0, .5, 1, 1.5, 2]:
        svg.append(f'<path d="M{px(-7.4)},{py(y)} H{px(-4.4)}" class="grid"/><text x="{left-33}" y="{py(y)+4}" font-size="11">{y:.1f}</text>')
    for z in [-7, -6.5, -6, -5.5, -5, -4.5]:
        svg.append(f'<path d="M{px(z)},{py(-.4)} V{py(2.2)}" class="grid"/><text x="{px(z)-13}" y="{py(-.4)+18}" font-size="11">{z:.1f}</text>')
    for a, b in section['newTopSegments']:
        svg.append(f'<path d="M{px(a[0])},{py(a[1])} L{px(b[0])},{py(b[1])} L{px(b[0])},{py(bottom_y)} L{px(a[0])},{py(bottom_y)} Z" fill="#e5ddd0"/>')
    for key, color, width, dash in [('originalTerrainSegments', '#777e88', 1.3, '4 3'), ('retainedTerrainSegments', '#29313b', 2, ''), ('newTopSegments', '#2463a5', 2.3, '')]:
        for a, b in section[key]:
            svg.append(f'<path d="M{px(a[0])},{py(a[1])} L{px(b[0])},{py(b[1])}" fill="none" stroke="{color}" stroke-width="{width}" stroke-dasharray="{dash}"/>')
    height = section['supportCenterHeight']
    svg.append(f'<circle cx="{px(-6)}" cy="{py(height)}" r="4" fill="#2463a5"/><text x="{px(-6)+9}" y="{py(height)-12}" font-size="12">H {height:.3f} m</text>')
    svg.append(f'<text x="{left}" y="606" font-size="12">Z / north → south; physical top fixed, buried bottom {bottom_y:.3f} m</text>')
svg.extend(['<text x="35" y="633" font-size="12">Blue: replacement top · dark: retained floor · dashed grey: original top · fill: closed soil. Tree roots omitted from this section.</text>', '</svg>'])
(ROOT / 'dimensioned-sections.svg').write_text('\n'.join(svg) + '\n')
print(json.dumps({'sections': len(sections), 'centerHeightErrors': [s['centerHeightError'] for s in sections], 'outputs': ['dimensioned-sections.json', 'dimensioned-sections.svg']}, indent=2))
