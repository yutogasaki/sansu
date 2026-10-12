"""Source-only editable terrain family and fixed-camera comparisons; no app renderer."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=16
scene.render.threads_mode='FIXED'; scene.render.threads=2
scene.render.resolution_x=1280; scene.render.resolution_y=800; scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'; scene.render.film_transparent=False
scene.world=bpy.data.worlds.new('Source preview daylight'); scene.world.use_nodes=True
bg=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND')
bg.inputs['Color'].default_value=(.72,.81,.88,1); bg.inputs['Strength'].default_value=.7
collections={}
for name in ('baseline','parallel','seaward'):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/f'{name}-source.glb'))
    coll=bpy.data.collections.new(f'SOURCE ONLY / {name}'); scene.collection.children.link(coll)
    for obj in set(bpy.data.objects)-before:
        for old in list(obj.users_collection): old.objects.unlink(obj)
        coll.objects.link(obj)
    coll['catalogRevision']=json.loads((ROOT/'source-manifest.json').read_text())['revision']
    coll['evidence']='Source geometry only; HOLD; no owner runtime or acquisition evidence'
    collections[name]=coll
bpy.ops.mesh.primitive_plane_add(size=80,location=(0,0,-.04))
sea=bpy.context.object;sea.name='Preview ocean / not a support surface'
mat=bpy.data.materials.new('Preview ocean context');mat.diffuse_color=(.075,.31,.39,1);mat.use_nodes=True
bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bsdf.inputs['Base Color'].default_value=mat.diffuse_color;bsdf.inputs['Roughness'].default_value=.36
sea.data.materials.append(mat)
def area(name,at,power,size):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size
 o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=at;o.rotation_euler=(Vector((2,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
area('Source daylight key',(-3,-6,10),1200,8)
area('Source soft fill',(8,6,7),650,7)
data=bpy.data.cameras.new('Source fixed comparison camera');cam=bpy.data.objects.new(data.name,data);scene.collection.objects.link(cam);scene.camera=cam
cam.location=(11,-13,10);target=Vector((2.7,0,.45));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=11.5
for name,coll in collections.items():coll.hide_render=name!='baseline';coll.hide_viewport=name!='baseline'
scene['source_scope']='Fixed family comparison, no owned objects, no app camera/lighting or runtime score'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'growth-terrain-family.blend'))
for name in ('baseline','parallel','seaward'):
    for key,coll in collections.items():coll.hide_render=key!=name;coll.hide_viewport=key!=name
    scene.render.filepath=str(ROOT/f'{name}-source.png');bpy.ops.render.render(write_still=True)
print(json.dumps({'status':'SOURCE_PREVIEWS_COMPLETE','blender':bpy.app.version_string,'threads':scene.render.threads,'samples':scene.cycles.samples,'images':['baseline-source.png','parallel-source.png','seaward-source.png']}))
