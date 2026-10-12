"""Pure Python verification of the new export oracle, no Blender imports/runs."""
import copy
import json
import struct
import tempfile
import unittest
from pathlib import Path
from export_check import compare_triangles, read_glb


def triangle():
    return {'positions': [[0., 0., 0.], [1., 0., 0.], [0., 1., 0.]],
            'normals': [[.6, 0., .8], [0., .6, .8], [0., 0., 1.]]}


class ExportOracleTests(unittest.TestCase):
    def test_cyclic_reordering_and_duplicates_keep_authored_normals(self):
        a = triangle()
        b = {key: values[1:] + values[:1] for key, values in a.items()}
        report = compare_triangles([a, b], [b, a])
        self.assertTrue(report['physicalTriangleMultisetExact'])
        self.assertEqual(report['normalMaxL2'], 0)
        self.assertEqual(report['duplicateGeometryGroups'], 1)

    def test_physical_winding_and_coordinate_changes_are_not_welded(self):
        a = triangle()
        reversed_triangle = {key: list(reversed(values)) for key, values in a.items()}
        self.assertFalse(compare_triangles([a], [reversed_triangle])['physicalTriangleMultisetExact'])
        shifted = copy.deepcopy(a)
        shifted['positions'][0][0] = 1e-12
        self.assertFalse(compare_triangles([a], [shifted])['physicalTriangleMultisetExact'])

    def test_flat_geometric_normals_do_not_pass_as_source_normals(self):
        a = triangle()
        flat = copy.deepcopy(a)
        flat['normals'] = [[0., 0., 1.]] * 3
        report = compare_triangles([flat], [a])
        self.assertTrue(report['physicalTriangleMultisetExact'])
        self.assertGreater(report['normalMaxL2'], .002)
        self.assertEqual(report['normalsOver002'], 2)

    def test_missing_duplicate_and_zero_edge_are_rejected(self):
        a = triangle()
        self.assertFalse(compare_triangles([a], [a, a])['physicalTriangleMultisetExact'])
        a['positions'][1] = a['positions'][0]
        with self.assertRaises(AssertionError):
            compare_triangles([a], [a])

    def test_glb_accessor_reader_handles_strides_and_indices(self):
        blob = b''.join(struct.pack('<6f', *p, *n) for p, n in zip(triangle()['positions'], triangle()['normals']))
        blob += struct.pack('<3H', 2, 0, 1) + b'\0\0'
        doc = {'asset': {'version': '2.0'}, 'nodes': [{'mesh': 0}],
            'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1}, 'indices': 2}]}],
            'buffers': [{'byteLength': len(blob)}],
            'bufferViews': [{'buffer': 0, 'byteOffset': 0, 'byteLength': 72, 'byteStride': 24},
                            {'buffer': 0, 'byteOffset': 72, 'byteLength': 6}],
            'accessors': [{'bufferView': 0, 'byteOffset': 0, 'componentType': 5126, 'type': 'VEC3', 'count': 3},
                          {'bufferView': 0, 'byteOffset': 12, 'componentType': 5126, 'type': 'VEC3', 'count': 3},
                          {'bufferView': 1, 'componentType': 5123, 'type': 'SCALAR', 'count': 3}]}
        encoded = json.dumps(doc).encode()
        encoded += b' ' * (-len(encoded) % 4)
        data = b'glTF' + struct.pack('<II', 2, 12 + 8 + len(encoded) + 8 + len(blob))
        data += struct.pack('<II', len(encoded), 0x4E4F534A) + encoded
        data += struct.pack('<II', len(blob), 0x004E4942) + blob
        with tempfile.TemporaryDirectory(prefix='oracle-test-', dir=Path(__file__).parent) as temp:
            path = Path(temp) / 'fixture.glb'
            path.write_bytes(data)
            _, _, triangles, attributes = read_glb(path)
        self.assertEqual(attributes[0]['indices'], [2, 0, 1])
        result = compare_triangles(triangles, [triangle()])
        self.assertTrue(result['physicalTriangleMultisetExact'])
        self.assertLess(result['normalMaxL2'], 1e-7)


if __name__ == '__main__':
    unittest.main(verbosity=2)
