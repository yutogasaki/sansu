"""Preserve the owner hierarchy in the full source GLB; components/profile/blend stay fixed."""
import bpy,hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
fixed=['geometry-profile.json.gz','central-shoulder-components.glb','central-shoulder-source.blend'];before={name:sha(ROOT/name)for name in fixed}
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'central-shoulder-source.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
 if o.type in {'MESH','EMPTY'}:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'central-shoulder-source.glb'),export_format='GLB',use_selection=True,export_apply=False,export_yup=True,export_cameras=False,export_lights=False,export_extras=True)
assert before=={name:sha(ROOT/name)for name in fixed}
report={'scope':'Preserve owner parents in full source export only','fixed':before,'firstFullSourceSHA256':sha(ROOT/'history/central-shoulder-source-first.glb'),'currentFullSourceSHA256':sha(ROOT/'central-shoulder-source.glb')};(ROOT/'context-reexport-qa.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)
