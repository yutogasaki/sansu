"""Read-only source continuity and closed-mesh QA; no app/runtime claim."""
import bpy,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent
ORIGINAL=ROOT.parents[2]/'docs/design/2026-10-10-island-final-3d/whole-island.blend'
def world(v):return (8+(v.x-13.9)*.45,.0475+(v.z-.89)*.45,.5+(-v.y-1.2)*.45)
def signatures(obj,far_only=False):
    evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());me=evaluated.to_mesh();result=set()
    for poly in me.polygons:
        points=[obj.matrix_world@me.vertices[i].co for i in poly.vertices];wp=[world(p) for p in points]
        if far_only and not (all(p[0]>8 for p in wp) or all(p[2]>.15 for p in wp)):continue
        mat=me.materials[poly.material_index].name if me.materials[poly.material_index] else None
        result.add((tuple(sorted(tuple(round(c,6) for c in p) for p in points)),mat))
    evaluated.to_mesh_clear();return result
bpy.ops.wm.open_mainfile(filepath=str(ORIGINAL))
original=signatures(bpy.data.objects['Harbor / continuous translucent shell hall'],True)
names=['Harbor / curved shell structural rib']+['Harbor / curved shell structural rib.'+str(i).zfill(3) for i in range(1,5)]
names+=['Harbor / shell longitudinal seam']+['Harbor / shell longitudinal seam.'+str(i).zfill(3) for i in range(1,5)]+['Harbor / shell grown footing.001']
parts={name:signatures(bpy.data.objects[name]) for name in names}
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'cove-corner-v3.blend'))
candidate=signatures(bpy.data.objects['Harbor / continuous translucent shell hall'])
result={'candidate':'native05-authored-cove-corner-v3','scope':'read-only source continuity; excludes the intended corner aperture',
 'original_blend_sha256':hashlib.sha256(ORIGINAL.read_bytes()).hexdigest(),
 'candidate_blend_sha256':hashlib.sha256((ROOT/'cove-corner-v3.blend').read_bytes()).hexdigest(),
 'comparison':'evaluated solidified polygon vertex coordinates rounded to 1e-6 source units plus per-face material name; source far region authored X>8 or all Z>.15',
 'unchanged_shell_region':{'original_polygons':len(original),'missing_or_material_changed':len(original-candidate)},
 'rim_joins':[{'name':o.name,'point_blender_source':list(o['joined_at_source'])} for o in bpy.data.objects if 'joined_at_source' in o],
 'unchanged_native_parts':[{'name':name,'polygons':len(values),'identical':values==signatures(bpy.data.objects[name])} for name,values in parts.items()]}
assert not result['unchanged_shell_region']['missing_or_material_changed'], result
assert all(r['identical'] for r in result['unchanged_native_parts']),result
(ROOT/'source-continuity.json').write_text(json.dumps(result,indent=2)+'\n')
print('SANSU_COVE_SOURCE_CONTINUITY_PASS',flush=True)
