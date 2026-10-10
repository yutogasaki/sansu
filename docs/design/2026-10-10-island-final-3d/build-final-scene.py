"""Build native-05 from the preserved, actually shown native-04 geometry.

The input .blend is explicit and hashed. Import modeling helpers as functions,
not the superseded full scene program. No user Blender session is edited.
"""
import bpy, math, json, random, ast, hashlib
from pathlib import Path
from mathutils import Vector, geometry

ROOT=Path(__file__).resolve().parent
base=ROOT/'history/native-04/whole-island.blend'
bpy.ops.wm.open_mainfile(filepath=str(base))
scene=bpy.context.scene
scene['visual_candidate']='whole-island-native-3d-05'
bpy.context.preferences.filepaths.save_version=0
world_objects=[];mat_cache={m.name:m for m in bpy.data.materials}
for filename in ['build-scene.py','fantasy-landscape.py','varied-world.py']:
    source=(ROOT/filename).read_text();tree=ast.parse(source)
    for node in tree.body:
        if isinstance(node,ast.FunctionDef):exec(compile(ast.Module(body=[node],type_ignores=[]),filename,'exec'),globals())
    for node in tree.body:
        if isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id in {'M','outline','grove','garden'} for t in node.targets):
            exec(compile(ast.Module(body=[node],type_ignores=[]),filename,'exec'),globals())
        if isinstance(node,ast.Expr) and isinstance(node.value,ast.Call) and isinstance(node.value.func,ast.Attribute) and isinstance(node.value.func.value,ast.Name) and node.value.func.value.id=='M' and node.value.func.attr=='update':
            exec(compile(ast.Module(body=[node],type_ignores=[]),filename,'exec'),globals())
random.seed(41010)
exec(compile((ROOT/'fantasy-colour-world.py').read_text(),str(ROOT/'fantasy-colour-world.py'),'exec'),globals())
camera_target=Vector((3,6.3,3.2))
scene.camera.rotation_euler=(camera_target-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.camera.data.ortho_scale=46
scene['art_revision_reason']='native-04 rejected: fantasy looks only white; preserve colour and material depth in daylight, grown mineral spring and coloured living canopy'
exec(compile((ROOT/'editor-layout.py').read_text(),str(ROOT/'editor-layout.py'),'exec'),{'__name__':'editor_layout'})
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'whole-island.blend'))
print('SANSU_3D_NATIVE_05_SAVED',flush=True)
scene_objects=[o for o in scene.objects if o.type in {'MESH','CURVE'}]
bpy.ops.object.select_all(action='DESELECT')
curves=[o for o in scene_objects if o.type=='CURVE']
for o in curves:o.select_set(True)
if curves:
    bpy.context.view_layer.objects.active=curves[0];bpy.ops.object.convert(target='MESH')
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    if o.type=='MESH':o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'whole-island.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_cameras=False,export_lights=False)
glb=(ROOT/'whole-island.glb').read_bytes();model=json.loads(glb[20:20+int.from_bytes(glb[12:16],'little')])
triangles=sum(model['accessors'][p['indices']]['count']//3 for m in model['meshes'] for p in m['primitives'])
manifest=json.loads((ROOT/'history/native-04/scene-manifest.json').read_text())
manifest.update(candidate=scene['visual_candidate'],objects=len(scene_objects),triangles=triangles,
    districts=['original willow court and village','hollow tree dwelling and bough gallery','tiered headwater garden','sheltered inlet shell hall','round cap and leaf-roof homes'],
    landscape='coloured living canopy and amber hollow trunk / mineral headwater grotto and blue tiered springs / tinted translucent shell court / distinct grown-home shapes',
    base_art_input={'path':'history/native-04/whole-island.blend','sha256':hashlib.sha256(base.read_bytes()).hexdigest()},
    camera={'location':list(scene.camera.location),'target':list(camera_target),'orthographic_scale':scene.camera.data.ortho_scale},
    houses=len([o for o in scene.objects if o.name.endswith('/ rounded walls')]))
manifest['growth_comparison']['terrain_height_range']=[min(v.co.z for v in terrain.data.vertices),max(v.co.z for v in terrain.data.vertices)]
(ROOT/'scene-manifest.json').write_text(json.dumps(manifest,indent=2))
print('SANSU_3D_MODEL_05_SAVED',triangles,flush=True)
scene.render.filepath=str(ROOT/'whole-island-render.png')
bpy.ops.render.render(write_still=True)
print('SANSU_3D_RENDER_05_SAVED',flush=True)
