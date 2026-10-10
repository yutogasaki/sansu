"""Read-only native scene check; run against the saved .blend, not builder memory."""
import bpy, json, hashlib
from pathlib import Path

root=Path(__file__).resolve().parent
scene=bpy.context.scene
assert scene.get('visual_candidate')=='whole-island-native-3d-01'
assert scene.render.engine=='CYCLES'
assert scene.camera is not None
curves=[o for o in scene.objects if o.type=='CURVE']
walls=[o for o in scene.objects if o.name.endswith('/ rounded walls')]
assert len(curves)>100, 'The native model must retain editable curves.'
assert len(walls)==8
assert bpy.data.objects.get('Whole island / grown living arch').type=='CURVE'
assert len([c for c in scene.collection.children if c.name[:2].isdigit()])==7
textures=[im for im in bpy.data.images if im.name.startswith('resident-texture-')]
assert len(textures)==2 and all(im.packed_file for im in textures), 'Original fabric must travel with the native file.'
report={
 'result':'PASS', 'candidate':scene['visual_candidate'],
 'evidence':'reopened saved native .blend; not builder memory',
 'blender_version':bpy.app.version_string, 'objects':len(scene.objects),
 'editable_curves':len(curves), 'houses':len(walls),
 'collections':[c.name for c in scene.collection.children if c.name[:2].isdigit()],
 'packed_resident_textures':len(textures),
 'native_sha256':hashlib.sha256((root/'whole-island.blend').read_bytes()).hexdigest(),
 'game_runtime':'NOT_EVALUATED', 'visual_adoption':'NOT_APPROVED_BY_USER'
}
(root/'native-check.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report),flush=True)
