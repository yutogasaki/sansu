"""Bounded source previews. Run only after parent releases concurrent browser regressions.
Does not save Blender or export any geometry. Ocean is a render-only non-support context plane.
"""
import bpy, json, hashlib, time, sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
inputs = [ROOT / n for n in ['central-shoulder-source.blend', 'central-shoulder-source-normal-v2.glb', 'central-shoulder-components-normal-v2.glb', 'geometry-profile.json.gz']]
before = {p.name: sha(p) for p in inputs}
bpy.ops.wm.open_mainfile(filepath=str(inputs[0]))
scene = bpy.context.scene
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.resolution_x = 1280
scene.render.resolution_y = 960
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
# No navigation/support geometry is inferred from this sea.
bpy.ops.mesh.primitive_plane_add(size=200, location=(7, 4, -.06))
ocean = bpy.context.object
ocean.name = 'Render context only / ocean / no support'
mat = bpy.data.materials.new('Render context sea')
mat.use_nodes = True
bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
bsdf.inputs['Base Color'].default_value = (.055, .25, .36, 1)
bsdf.inputs['Roughness'].default_value = .72
ocean.data.materials.append(mat)
views = {
    'source-whole': {'position': [20, -19, 20], 'target': [7, 4.5, 1.65], 'orthoScale': 19},
    'source-rotated': {'position': [-10, -16, 17], 'target': [7, 4.5, 1.65], 'orthoScale': 19},
    'source-close': {'position': [12, -3, 10], 'target': [7.3, 6.1, 1.65], 'orthoScale': 7.0},
}
selected = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else list(views)
assert all(v in views for v in selected)
report_path = ROOT / 'source-render-manifest.json'
report = json.loads(report_path.read_text()) if report_path.exists() else {'scope': 'Offline source-only rendering, not an actual app view or art acceptance.', 'inputs': before, 'views': {}}
assert report['inputs'] == before
report['settings'] = {'engine': 'Cycles CPU', 'samples': 24, 'resolution': [1280, 960], 'viewTransform': scene.view_settings.view_transform,
                      'coordinates': 'Blender (authored x, -authored z, authored y)', 'people': 'none; same 35-owner layer only',
                      'limitations': ['No resident life/pose rig', 'Blender roundtrip omits 3 water ripple line primitives', 'No browser lighting, ocean shader, camera or transmission guard parity', 'Editable Blender uses split-normal quantization; delivery v2 GLBs restore exact raw top normals'],
                      'ocean': {'renderOnly': True, 'support': False, 'authoredY': -.06}}
for name in selected:
    view = views[name]
    scene.camera.location = view['position']
    scene.camera.rotation_euler = (Vector(view['target']) - scene.camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera.data.ortho_scale = view['orthoScale']
    path = ROOT / (name + '.png')
    assert not path.exists(), f'Preserve previous render before changing {path.name}'
    scene.render.filepath = str(path)
    started = time.monotonic()
    bpy.ops.render.render(write_still=True)
    report['views'][name] = {**view, 'path': path.name, 'sha256': sha(path), 'elapsedSeconds': time.monotonic() - started}
    assert {p.name: sha(p) for p in inputs} == before
    report['sourceUnchanged'] = True
    report_path.write_text(json.dumps(report, indent=2) + '\n')
    print('SOURCE_RENDER_COMPLETE', name, json.dumps(report['views'][name]), flush=True)
