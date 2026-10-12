"""Lightweight workbench geometry views, never actual app or material acceptance."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'cove-corner-with-apron-v3.blend'))
scene=bpy.context.scene
def source(p):return (13.9+(p[0]-8)/.45,-1.2-(p[2]-.5)/.45,.89+(p[1]-.0475)/.45)
def mesh(name,points,indices,color):
    me=bpy.data.meshes.new(name);me.from_pydata([source(p) for p in points],[],[indices[i:i+3] for i in range(0,len(indices),3)]);me.update()
    obj=bpy.data.objects.new(name,me);scene.collection.objects.link(obj);obj.color=color
    mat=bpy.data.materials.new(name);mat.diffuse_color=color;me.materials.append(mat)
    for p in me.polygons:p.use_smooth=True
    return obj
for mat in bpy.data.materials:
    if mat and mat.use_nodes:
        node=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
        if node:mat.diffuse_color=tuple(node.inputs['Base Color'].default_value)
context=json.loads(Path('/private/tmp/sansu-authored-cove-entrance/actual-context.json').read_text())
for house in context['houses']:mesh('Context only / '+house['ownerId']+' / '+house['name'],house['points'],house['indices'],house['color'])
for floor in context['floors']:
    if 'apron' in floor['id']:continue
    points=floor['vertices'];idx=floor['indices'];selected=[]
    for i in range(0,len(idx),3):
        tri=[points[k] for k in idx[i:i+3]]
        if all(5.75<=p[0]<=10.5 and -2.5<=p[2]<=2.5 for p in tri):selected+=idx[i:i+3]
    if selected:mesh('Context only / actual shared dry floor',points,selected,(.76,.76,.82,1))
camera=bpy.data.objects.new('Source diagnostic camera',bpy.data.cameras.new('Source diagnostic camera'));scene.collection.objects.link(camera);scene.camera=camera
camera.data.type='ORTHO';camera.data.ortho_scale=10.1
scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.studio_light='paint.sl'
scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True;scene.display.shading.cavity_type='BOTH'
scene.display.shading.background_type='WORLD';scene.world.color=(.80,.82,.87)
scene.render.resolution_x=1000;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
target=Vector(source((8,.45,.05)))
for name,position in [('source-corner-v3',(4,1.9,.15)),('source-interior-v3',(11,3.1,4)),('source-overhead-v3',(8,5,.5))]:
    camera.location=source(position);camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(ROOT/(name+'.png'));bpy.ops.render.render(write_still=True)
