"""A single diagnostic roof edit; approved source and application stay intact."""
import bpy
import json
import hashlib
import gzip
import struct
from pathlib import Path

OUT = Path(__file__).resolve().parent
REPO = OUT.parents[2]
SOURCE = REPO / 'docs/design/2026-10-12-authored-cove-entrance'
names = ['cove-corner-v3.blend', 'cove-corner-v3.glb', 'source-manifest.json', 'cove-delivery-manifest.json', 'shared-apron-world-patch-v1.json']
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
original = {name: sha(SOURCE / name) for name in names}
delivery = json.loads((SOURCE / 'cove-delivery-manifest.json').read_text())
source = json.loads((SOURCE / 'source-manifest.json').read_text())
patch = json.loads((SOURCE / 'shared-apron-world-patch-v1.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(SOURCE / 'cove-corner-v3.blend'))
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene['visual_candidate'] = 'cove-mcp-roof-v1'
bpy.ops.object.select_all(action='DESELECT')
selected = []
for record in delivery['nodes']:
    obj = bpy.data.objects[record['name']]
    obj.hide_set(False)
    obj.select_set(True)
    selected.append(obj)
bpy.context.view_layer.objects.active = selected[0]
bpy.ops.object.convert(target='MESH')
audit = []
for obj in scene.objects:
    if not obj.select_get():
        continue
    if obj.type != 'MESH':
        continue
    inverse = obj.matrix_world.inverted()
    changed = 0
    lower_unchanged = 0
    max_lift = 0
    for vertex in obj.data.vertices:
        before = obj.matrix_world @ vertex.co
        if before.z <= 2.90:
            lower_unchanged += 1
            continue
        t = max(0, min(1, (before.z - 2.90) / 1.20))
        lift = .90 * t * t * (3 - 2 * t)
        after = before.copy()
        after.z += lift
        vertex.co = inverse @ after
        max_lift = max(max_lift, lift)
        changed += 1
    obj.data.update()
    audit.append({'name':obj.name, 'changed_upper_vertices':changed, 'unchanged_lower_vertices':lower_unchanged, 'max_lift_source':max_lift})
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'cove-roof-variant.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT / 'cove-roof-variant.glb'), export_format='GLB', use_selection=True, export_cameras=False, export_lights=False, export_animations=False)
raw = (OUT / 'cove-roof-variant.glb').read_bytes()
glb_sha = hashlib.sha256(raw).hexdigest()
packed = gzip.compress(raw, mtime=0)
(OUT / 'cove-roof-variant.glb.gz').write_bytes(packed)
size = struct.unpack_from('<I', raw, 12)[0]
g = json.loads(raw[20:20 + size])
nodes = []
triangles = 0
primitives = 0
for node in g['nodes']:
    if 'mesh' not in node:
        continue
    parts = []
    for primitive in g['meshes'][node['mesh']]['primitives']:
        count = g['accessors'][primitive['indices']]['count'] // 3
        parts.append({'material':g['materials'][primitive['material']]['name'], 'triangles':count})
        triangles += count
        primitives += 1
    nodes.append({'name':node['name'], 'primitives':parts})
delivery['source'] = {'id':'cove-mcp-roof-v1', 'sha256':glb_sha, 'artifact':str((OUT / 'cove-roof-variant.glb').relative_to(REPO))}
delivery['artifact'].update(sha256=hashlib.sha256(packed).hexdigest(), expandedSha256=glb_sha, expandedBytes=len(raw), gzipBytes=len(packed))
delivery['nodes'] = nodes
delivery['counts'] = {'nodes':len(nodes), 'primitives':primitives, 'triangles':triangles, 'materials':len(g['materials'])}
delivery['materialNames'] = [m['name'] for m in g['materials']]
source['candidate'] = 'cove-mcp-roof-v1'
source['outputs']['cove-corner-v3.glb'] = glb_sha
source['scope'] = 'MCP upper-roof A/B; source floor and entrance remain at baseline; not production'
patch['candidate'] += '+mcp-roof-v1'
for filename,value in [('delivery-variant.json',delivery),('source-variant.json',source),('patch-variant.json',patch)]:
    (OUT / filename).write_text(json.dumps(value, indent=2) + '\n')
assert original == {name:sha(SOURCE / name) for name in names}
(OUT / 'source-audit.json').write_text(json.dumps({'candidate':'cove-mcp-roof-v1', 'original_inputs':original, 'original_inputs_unchanged':True, 'warp':{'cutoff_source_z':2.90,'max_lift_source':.90,'world_scale':.45}, 'mesh_audit':audit, 'counts':delivery['counts'], 'derived_glb_sha256':glb_sha},indent=2)+'\n')
print('MCP_COVE_VARIANT_READY', delivery['counts'], glb_sha)
