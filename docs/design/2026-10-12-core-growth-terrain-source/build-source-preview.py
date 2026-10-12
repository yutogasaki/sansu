"""One rough source comparison. Original native05 scene, not latest app fixture."""
import bpy, json
from pathlib import Path
from mathutils import Vector
D=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=8
scene.render.threads_mode='FIXED';scene.render.threads=2
scene.render.resolution_x=960;scene.render.resolution_y=600;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
scene.world=bpy.data.worlds.new('Source preview daylight');scene.world.use_nodes=True
bg=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND')
bg.inputs['Color'].default_value=(.72,.81,.88,1);bg.inputs['Strength'].default_value=.7
# Import original context once; new whole GLB contains original bytes and the north part.
bpy.ops.import_scene.gltf(filepath=str(D/'north-whole.glb'))
collections={}
for name in ('north','east','loop'):
    coll=bpy.data.collections.new('SOURCE ONLY / '+name);scene.collection.children.link(coll)
    if name=='north':objects=[o for o in scene.objects if o.name.startswith('north/')]
    else:
        before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(D/f'{name}-parts.glb'));objects=list(set(bpy.data.objects)-before)
    assert objects
    for obj in objects:
        for old in list(obj.users_collection):old.objects.unlink(obj)
        coll.objects.link(obj)
    collections[name]=coll
bpy.ops.mesh.primitive_plane_add(size=150,location=(8,5,-.04))
sea=bpy.context.object;sea.name='Preview ocean / not ground or support'
mat=bpy.data.materials.new('Preview ocean');mat.diffuse_color=(.075,.31,.39,1);mat.use_nodes=True
bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bsdf.inputs['Base Color'].default_value=mat.diffuse_color;bsdf.inputs['Roughness'].default_value=.36
sea.data.materials.append(mat)
def area(name,at,power,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=at;obj.rotation_euler=(Vector((8,4,0))-obj.location).to_track_quat('-Z','Y').to_euler()
area('Source key',(-3,-6,20),2200,10);area('Source fill',(20,15,15),1500,10)
data=bpy.data.cameras.new('Fixed source whole camera');cam=bpy.data.objects.new(data.name,data);scene.collection.objects.link(cam);scene.camera=cam
cam.location=(26,-25,22);target=Vector((8.6,4.2,.5));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=25
scene['evidence']='Source rough HOLD, original native05 scene; NOT current 35-owner app, no current tree placement evidence'
for name,coll in collections.items():coll.hide_render=name!='north';coll.hide_viewport=name!='north'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(D/'core-growth-family.blend'))
for name in ('north','east','loop'):
    for key,coll in collections.items():coll.hide_render=key!=name;coll.hide_viewport=key!=name
    scene.render.filepath=str(D/f'source-{name}-whole.png');bpy.ops.render.render(write_still=True)
    print(json.dumps({'image':scene.render.filepath,'status':'SOURCE_ROUGH_HOLD'}),flush=True)
