"""Render two real 3D silhouettes; source files remain unchanged."""
import bpy,hashlib,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
SOURCE=ROOT.parent/'2026-10-10-island-final-3d'
manifest=json.loads((ROOT/'art-manifest.json').read_text())
modules=json.loads((ROOT.parent/'2026-10-10-native-art-transfer/module-manifest.json').read_text())
sea={n for m in modules['modules'] if m['id']=='sea' for n in m['sourceNames']}
evidence=[]
for label,path in [('proposal',ROOT/'whole-landscape.blend'),('source',SOURCE/'whole-island.blend')]:
    original=hashlib.sha256(path.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(path))
    scene=bpy.context.scene
    for obj in scene.objects:
        if obj.name in sea:obj.hide_render=True
    mat=bpy.data.materials.new('Silhouette / black emission');mat.use_nodes=True
    nodes=mat.node_tree.nodes;nodes.clear()
    out=nodes.new('ShaderNodeOutputMaterial');emission=nodes.new('ShaderNodeEmission')
    emission.inputs['Color'].default_value=(0,0,0,1);mat.node_tree.links.new(emission.outputs[0],out.inputs['Surface'])
    scene.view_layers[0].material_override=mat
    scene.world.use_nodes=True
    background=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND')
    background.inputs['Color'].default_value=(1,1,1,1);background.inputs['Strength'].default_value=1
    scene.camera.location=(39,-46,43);target=Vector((3,6.3,3.2))
    scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    scene.camera.data.ortho_scale=46
    scene.render.resolution_x=64;scene.render.resolution_y=64;scene.render.resolution_percentage=100
    scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=False
    scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='Standard'
    scene.render.filepath=str(ROOT/(label+'-silhouette-64.png'))
    bpy.ops.render.render(write_still=True)
    assert hashlib.sha256(path.read_bytes()).hexdigest()==original
    evidence.append({'label':label,'blendSha256':original,'image':label+'-silhouette-64.png'})
(ROOT/'silhouette-proof.json').write_text(json.dumps({'evidenceType':'3D silhouette render, not a retouched screenshot','candidate':manifest['candidate'],'sameCamera':True,'resolution':[64,64],'evidence':evidence},indent=2)+'\n')
print('SILHOUETTES_SAVED')
