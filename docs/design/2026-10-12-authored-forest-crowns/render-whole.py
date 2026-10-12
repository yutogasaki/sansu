"""Three bounded, source-only whole views; never run implicitly after generation."""
import os
assert os.environ.get('SANSU_FOREST_RENDER_APPROVED') == '1', 'Parent has not scheduled the render window'
import bpy
import hashlib
import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
STUDY = json.loads((HERE / 'study.json').read_text())
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
selected = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [variant['id'] for variant in STUDY['variants']]
assert selected and all(any(variant['id'] == name for variant in STUDY['variants']) for name in selected)
for name in selected:
    root = HERE / 'variants' / name
    inputs = {file: sha(root / file) for file in ['study.blend', 'study.glb', 'owned-tree-components.glb', 'manifest.json']}
    image_path = root / 'source-whole.png'
    assert not image_path.exists(), f'Preserve existing output {image_path}'
    bpy.ops.wm.open_mainfile(filepath=str(root / 'study.blend'))
    scene = bpy.context.scene
    assert scene['candidate'] == name and scene.camera and 'whole' in scene.camera.name
    scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 16; scene.cycles.use_denoising = True
    scene.render.image_settings.file_format = 'PNG'; scene.render.filepath = str(image_path)
    start = time.monotonic()
    bpy.ops.render.render(write_still=True)
    assert {file: sha(root / file) for file in inputs} == inputs
    manifest = {'candidate': name, 'evidenceType': 'offline source render; NOT an actual app screenshot',
        'fixedReferenceBuild': 'authored-shoulder-c1', 'cameraReferenceSha256': scene.camera['evidenceSha256'],
        'inputsBefore': inputs, 'inputsAfter': inputs, 'output': image_path.name, 'sha256': sha(image_path),
        'elapsedSeconds': time.monotonic() - start, 'settings': {'engine': 'Cycles CPU', 'samples': 16,
            'resolution': [scene.render.resolution_x, scene.render.resolution_y], 'viewTransform': scene.view_settings.view_transform},
        'limitations': scene['renderLimitations'], 'runtimeIntegrated': False, 'independentObservers': 0}
    (root / 'render-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print('FOREST_SOURCE_WHOLE_RENDERED', name, json.dumps(manifest), flush=True)
