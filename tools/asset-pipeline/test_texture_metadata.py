"""Exercise the pure GLB swap helpers without importing Blender's bpy module."""
import ast
import hashlib
import json
from pathlib import Path
import struct
import tempfile
import unittest

script = Path(__file__).with_name('optimize_textures.py')
tree = ast.parse(script.read_text())
helpers = ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in ['glb', 'preserve_geometry']], type_ignores=[])
namespace = {'Path': Path, 'json': json, 'struct': struct, 'hashlib': hashlib}
exec(compile(helpers, str(script), 'exec'), namespace)


def fixture(path, image, mime):
    geometry = b'original-geometry'
    doc = {'materials': [{'name': 'material', 'roughnessFactor': 1}],
           'images': [{'bufferView': 1, 'mimeType': mime}],
           'bufferViews': [{'byteOffset': 0, 'byteLength': len(geometry)},
                           {'byteOffset': len(geometry), 'byteLength': len(image)}],
           'buffers': [{'byteLength': len(geometry) + len(image)}]}
    metadata = json.dumps(doc).encode()
    metadata += b' ' * (-len(metadata) % 4)
    binary = geometry + image
    binary += b'\0' * (-len(binary) % 4)
    path.write_bytes(struct.pack('<IIIII', 0x46546c67, 2, 28 + len(metadata) + len(binary), len(metadata), 0x4e4f534a) + metadata + struct.pack('<II', len(binary), 0x004e4942) + binary)


class TextureMetadataTest(unittest.TestCase):
    def test_png_replacement_updates_jpeg_mime_and_keeps_geometry(self):
        with tempfile.TemporaryDirectory() as folder:
            original, resized, result = [Path(folder) / n for n in ['old.glb', 'new.glb', 'result.glb']]
            fixture(original, b'jpeg-data', 'image/jpeg')
            png = b'\x89PNG\r\n\x1a\nnew-pixels'
            fixture(resized, png, 'image/png')
            namespace['preserve_geometry'](original, resized, result)
            doc, binary = namespace['glb'](result)
            self.assertEqual(doc['images'][0]['mimeType'], 'image/png')
            self.assertEqual(binary[:len(b'original-geometry')], b'original-geometry')
            view = doc['bufferViews'][1]
            self.assertEqual(binary[view['byteOffset']:view['byteOffset'] + view['byteLength']], png)
            self.assertEqual(view['byteOffset'] % 4, 0)


if __name__ == '__main__':
    unittest.main()
