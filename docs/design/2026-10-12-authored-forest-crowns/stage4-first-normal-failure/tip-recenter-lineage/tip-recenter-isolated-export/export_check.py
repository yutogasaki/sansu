"""Read exported GLB accessors; match oriented physical triangles without welding.

Only cyclic triangle rotations and reordering are allowed. No coordinate tolerance,
normal repair, matrix baking, or source-index claim across exporter duplication.
"""
import itertools
import json
import math
import struct
from collections import defaultdict


def read_glb(path):
    data = path.read_bytes()
    assert data[:4] == b'glTF'
    version, total = struct.unpack_from('<II', data, 4)
    assert version == 2 and total == len(data)
    offset = 12
    document = None
    blob = None
    while offset < total:
        length, kind = struct.unpack_from('<II', data, offset)
        chunk = data[offset + 8:offset + 8 + length]
        if kind == 0x4E4F534A:
            document = json.loads(chunk)
        elif kind == 0x004E4942:
            blob = chunk
        offset += 8 + length
    assert offset == total and document is not None and blob is not None

    def accessor(index):
        item = document['accessors'][index]
        assert 'sparse' not in item and not item.get('normalized', False)
        view = document['bufferViews'][item['bufferView']]
        assert view.get('buffer', 0) == 0
        width = {'VEC3': 3, 'SCALAR': 1}[item['type']]
        code = {5121: 'B', 5123: 'H', 5125: 'I', 5126: 'f'}[item['componentType']]
        fmt = '<' + code * width
        size = struct.calcsize(fmt)
        stride = view.get('byteStride', size)
        start = view.get('byteOffset', 0) + item.get('byteOffset', 0)
        return [tuple(struct.unpack_from(fmt, blob, start + i * stride)) for i in range(item['count'])]

    mesh_nodes = [node for node in document['nodes'] if 'mesh' in node]
    assert len(mesh_nodes) == 1, 'Export must contain only the throwaway leaf'
    node = mesh_nodes[0]
    triangles = []
    attributes = []
    for primitive in document['meshes'][node['mesh']]['primitives']:
        assert primitive.get('mode', 4) == 4
        assert 'NORMAL' in primitive['attributes']
        positions = accessor(primitive['attributes']['POSITION'])
        normals = accessor(primitive['attributes']['NORMAL'])
        indices = [row[0] for row in accessor(primitive['indices'])]
        assert len(positions) == len(normals) and len(indices) % 3 == 0
        for start in range(0, len(indices), 3):
            ids = indices[start:start + 3]
            triangles.append({'positions': [positions[i] for i in ids], 'normals': [normals[i] for i in ids]})
        attributes.append({'positions': positions, 'normals': normals, 'indices': indices,
                           'accessorIds': primitive['attributes'], 'materialIndex': primitive.get('material')})
    return document, node, triangles, attributes


def canonical(triangle):
    positions = tuple(tuple(v) for v in triangle['positions'])
    assert len(positions) == 3 and len(set(positions)) == 3, 'Zero-edge or degenerate mapping must HOLD'
    shift = min(range(3), key=lambda i: positions[i:] + positions[:i])
    return positions[shift:] + positions[:shift], triangle['normals'][shift:] + triangle['normals'][:shift]


def compare_triangles(actual, expected):
    groups = []
    for collection in (actual, expected):
        group = defaultdict(list)
        for item in collection:
            key, normals = canonical(item)
            group[key].append(normals)
        groups.append(group)
    a, b = groups
    if a.keys() != b.keys() or any(len(a[key]) != len(b[key]) for key in a):
        return {'physicalTriangleMultisetExact': False, 'normalMaxL2': None, 'normalsOver002': None,
                'actualTriangles': len(actual), 'expectedTriangles': len(expected)}
    errors = []
    duplicate_groups = 0
    for key in a:
        count = len(a[key])
        assert count <= 8, 'Ambiguous duplicate triangle group too large; HOLD, do not guess'
        duplicate_groups += count > 1
        def residuals(order):
            return [math.dist(x, y) for i, j in enumerate(order) for x, y in zip(a[key][i], b[key][j])]
        # Exact same physical triangles may repeat. Report a normal multiset match,
        # never claim an original vertex/accessor identity in that situation.
        best = min((residuals(order) for order in itertools.permutations(range(count))),
                   key=lambda values: (max(values), sum(values)))
        errors.extend(best)
    return {'physicalTriangleMultisetExact': True, 'normalMaxL2': max(errors, default=0),
            'normalsOver002': sum(error > .002 for error in errors), 'corners': len(errors),
            'duplicateGeometryGroups': duplicate_groups, 'orientedTriangleCount': len(actual),
            'mapping': 'exact local POSITION oriented triangle/corner multiset; cyclic rotation only; no weld or epsilon'}
