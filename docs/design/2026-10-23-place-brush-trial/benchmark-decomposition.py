"""Read native-05 in a separate background Blender; render ablations, never save it."""
import bpy, json, hashlib, datetime
from pathlib import Path
ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / '2026-10-10-island-final-3d' / 'whole-island.blend'
OUT = ROOT / 'evidence'
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
before = sha(SOURCE)
scene = bpy.context.scene
assert Path(bpy.data.filepath).resolve() == SOURCE.resolve()
assert scene.get('visual_candidate') == 'whole-island-native-3d-05'
original = {obj.name: obj.hide_render for obj in scene.objects}
base = {obj.name for obj in scene.objects if obj.name.startswith(('Island /', 'Coast /')) or obj.name == 'Ocean / tide and reflected sky'}
water = {obj.name for obj in bpy.data.collections['02 Water and bridges'].all_objects}
structural_names = ('Hill / open water terrace', 'Hill / grown mineral headwater grotto', 'Hill / water garden contour walk', 'Garden / rounded flower terrace', 'Village / open shared route', 'Water town / shared frontage')
structures = {obj.name for obj in scene.objects if obj.name.startswith(structural_names)}
scene.cycles.device = 'CPU'
scene.render.threads_mode = 'FIXED'
scene.render.threads = 4
scene.cycles.samples = 48
report = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'candidate': scene['visual_candidate'],
 'source': str(SOURCE), 'sourceSHA256Before': before, 'blender': bpy.app.version_string,
 'scope': 'Benchmark decomposition only. Same native camera/material/light; visibility ablation. Not a game runtime, not same inventory/area as the trial.',
 'camera': {'matrixWorld': [list(row) for row in scene.camera.matrix_world], 'orthoScale': scene.camera.data.ortho_scale},
 'render': {'width': scene.render.resolution_x, 'height': scene.render.resolution_y, 'percentage': scene.render.resolution_percentage, 'samples': scene.cycles.samples, 'engine': scene.render.engine}, 'variants': []}
for name, keep in [('native05-terrain-only', base), ('native05-terrain-water-routes', base | water | structures)]:
 for obj in scene.objects:
  obj.hide_render = original[obj.name] or (obj.type not in {'CAMERA', 'LIGHT'} and obj.name not in keep)
 scene.render.filepath = str(OUT / (name + '.png'))
 bpy.ops.render.render(write_still=True)
 report['variants'].append({'name': name, 'visibleGeometry': sorted(obj.name for obj in scene.objects if obj.type in {'MESH','CURVE'} and not obj.hide_render), 'imageSHA256': sha(OUT / (name + '.png'))})
 report['sourceSHA256After'] = sha(SOURCE)
 assert report['sourceSHA256After'] == before
 (OUT / 'native05-decomposition.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
 print('ABLATION_COMPLETE', name, flush=True)
