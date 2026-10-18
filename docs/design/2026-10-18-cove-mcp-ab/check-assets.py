import json
import struct
import hashlib
from pathlib import Path

OUT = Path(__file__).resolve().parent
SOURCE = OUT.parent / '2026-10-12-authored-cove-entrance'

def load(path):
    raw = path.read_bytes()
    n = struct.unpack_from('<I', raw, 12)[0]
    return json.loads(raw[20:20+n]), raw[28+n:]

def positions(g, binary, primitive):
    acc = g['accessors'][primitive['attributes']['POSITION']]
    view = g['bufferViews'][acc['bufferView']]
    offset = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
    stride = view.get('byteStride', 12)
    return [struct.unpack_from('<fff', binary, offset+i*stride) for i in range(acc['count'])]

g0, b0 = load(SOURCE / 'cove-corner-v3.glb')
g1, b1 = load(OUT / 'cove-roof-variant.glb')
nodes0 = {n['name']:n for n in g0['nodes'] if 'mesh' in n}
nodes1 = {n['name']:n for n in g1['nodes'] if 'mesh' in n}
assert nodes0.keys() == nodes1.keys()
assert g0['materials'] == g1['materials'], 'Material contract changed'
lower, upper, maximum, delta_xz = 0, 0, 0, 0
for name in nodes0:
    old = g0['meshes'][nodes0[name]['mesh']]['primitives']
    new = g1['meshes'][nodes1[name]['mesh']]['primitives']
    assert len(old) == len(new)
    for p, q in zip(old, new):
        pp, qq = positions(g0,b0,p), positions(g1,b1,q)
        assert len(pp) == len(qq)
        for a,b in zip(pp,qq):
            horizontal = max(abs(a[0]-b[0]),abs(a[2]-b[2]))
            delta_xz = max(delta_xz, horizontal)
            assert horizontal <= 2e-6, 'Horizontal coordinates drifted'
            if a[1] <= 2.90:
                assert max(abs(v-w) for v,w in zip(a,b)) <= 2e-6, 'Lower geometry drifted'
                lower += 1
            elif abs(a[1]-b[1]) > 1e-6:
                assert b[1] >= a[1], 'Upper roof moved down'
                upper += 1
                maximum = max(maximum,b[1]-a[1])
assert upper > 0
audit = json.loads((OUT / 'source-audit.json').read_text())
for name, expected in audit['original_inputs'].items():
    assert hashlib.sha256((SOURCE/name).read_bytes()).hexdigest() == expected
report = {'pass':True,'original_inputs_unchanged':True,'material_json_identical':True,
          'lower_vertices_unchanged':lower,'raised_upper_vertices':upper,
          'max_world_lift':maximum*.45,'max_horizontal_delta':delta_xz,'tolerance':2e-6}
(OUT/'asset-check.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
