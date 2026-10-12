"""Editable source assembly only. No rendering and no changes to the original native05 files."""
import bpy,bmesh,json,gzip,hashlib,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent;REPO=ROOT.parents[2]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
originals=[REPO/'docs/design/2026-10-10-island-final-3d'/name for name in ['whole-island.blend','whole-island.glb','whole-island-render.png']]
before={str(p.relative_to(REPO)):sha(p)for p in originals}
profile=json.loads(gzip.decompress((ROOT/'geometry-profile.json.gz').read_bytes()))
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
bpy.ops.import_scene.gltf(filepath=str(ROOT/'source-context.glb'))
scene=bpy.context.scene;context_objects=list(scene.objects)
context_collection=bpy.data.collections.new('Context / same c4 objectLayer / 35 owners');scene.collection.children.link(context_collection)
for o in context_objects:
 for collection in list(o.users_collection):collection.objects.unlink(o)
 context_collection.objects.link(o)
source_collection=bpy.data.collections.new('Authored central shoulder / exact top and closed soil');scene.collection.children.link(source_collection)
root_collection=bpy.data.collections.new('Owned source-contour root continuations');scene.collection.children.link(root_collection)
floor_collection=bpy.data.collections.new('Retained exact evaluated floors / source NORMAL and materials');scene.collection.children.link(floor_collection)
material_cache={}
def material(raw):
 key=json.dumps(raw,sort_keys=True)
 if key in material_cache:return material_cache[key]
 mat=bpy.data.materials.new(raw['name']);mat.use_nodes=True;p=raw.get('pbrMetallicRoughness',{});node=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 color=p.get('baseColorFactor',[1,1,1,1]);node.inputs['Base Color'].default_value=color;node.inputs['Roughness'].default_value=p.get('roughnessFactor',1);node.inputs['Metallic'].default_value=p.get('metallicFactor',1)
 mat.diffuse_color=color;mat.use_backface_culling=not raw.get('doubleSided',False);mat['raw_source_material']=json.dumps(raw,sort_keys=True);material_cache[key]=mat;return mat
axis=lambda p:(p[0],-p[2],p[1])
def make(name,positions,indices,collection,materials):
 me=bpy.data.meshes.new(name);me.from_pydata([axis(p)for p in positions],[],[indices[i:i+3]for i in range(0,len(indices),3)]);me.update()
 obj=bpy.data.objects.new(name,me);collection.objects.link(obj)
 for raw in materials:me.materials.append(material(raw))
 return obj
checks=[]
soil=profile['soil'];obj=make(soil['name'],soil['positions'],soil['indices'],source_collection,soil['materials']);me=obj.data;nt=soil['topTriangleCount'];custom=[]
for i,face in enumerate(me.polygons):
 face.material_index=soil['topMaterialIndices'][i]if i<nt else 2;face.use_smooth=i<nt
 for loop in face.loop_indices:custom.append(axis(soil['topNormals'][me.loops[loop].vertex_index])if i<nt else tuple(face.normal))
me.normals_split_custom_set(custom);obj['visual_candidate']=profile['candidate'];obj['top_physical_source']='selected-v3-handoff.json.gz / replacementDistrict';obj['closed_support']=True;obj['original_top_triangles']=nt
bm=bmesh.new();bm.from_mesh(me);check={'name':obj.name,'vertices':len(bm.verts),'faces':len(bm.faces),'nonmanifoldEdges':sum(not e.is_manifold for e in bm.edges),'boundaryEdges':sum(e.is_boundary for e in bm.edges)};bm.free();assert check['nonmanifoldEdges']==0;checks.append(check)
components=[obj]
for root in profile['rootContinuations']:
 obj=make(root['name'],root['positions'],root['indices'],root_collection,[root['material']]);me=obj.data;top_count=len(root['topNormals']);cap_triangles=root['upperCapTriangles'];custom=[]
 for i,face in enumerate(me.polygons):
  face.use_smooth=i>=cap_triangles*2
  for loop in face.loop_indices:
   vi=me.loops[loop].vertex_index
   custom.append(axis(root['topNormals'][vi%top_count])if i>=cap_triangles*2 else tuple(face.normal))
 me.normals_split_custom_set(custom);obj['ownerId']=root['ownerId'];obj['nativePart']='authored-tree-root-continuation';obj['sourceBinding']=json.dumps(root['binding'],sort_keys=True);obj['sourceCapTriangles']=root['sourceCapTriangles'];obj['noNewOwnerOrRights']=True
 bm=bmesh.new();bm.from_mesh(me);check={'name':obj.name,'ownerId':root['ownerId'],'vertices':len(bm.verts),'faces':len(bm.faces),'nonmanifoldEdges':sum(not e.is_manifold for e in bm.edges),'boundaryEdges':sum(e.is_boundary for e in bm.edges)};bm.free();assert check['nonmanifoldEdges']==0;checks.append(check);components.append(obj)
for floor in profile['retainedFloors']:
 obj=make(floor['name'],floor['positions'],floor['indices'],floor_collection,[floor['material']]);me=obj.data
 for face in me.polygons:face.use_smooth=True
 me.normals_split_custom_set([axis(floor['normals'][loop.vertex_index])for loop in me.loops]);obj['worldFloorId']=floor['floorId'];obj['sourceContextOnly']=True
# Editable cameras/lights, excluded from component exports. Heavy rendering runs separately after root allows it.
world=bpy.data.worlds.new('Source daylight');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.70,.80,.90,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.55;scene.world=world
for name,location,energy,size in [('Source / broad daylight',(-5,-10,18),1900,9),('Source / soft fill',(15,-2,11),950,8)]:
 data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=size;o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=location;o.rotation_euler=(Vector((7,4,1))-o.location).to_track_quat('-Z','Y').to_euler()
cam=bpy.data.objects.new('Source comparison camera',bpy.data.cameras.new('Source comparison camera'));scene.collection.objects.link(cam);cam.data.type='ORTHO';cam.data.ortho_scale=18;cam.location=(19,-17,18);target=Vector((7,4,1));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.render.resolution_x=1280;scene.render.resolution_y=960;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene['candidate']=profile['candidate'];scene['evidenceType']='Editable source only, not an app capture';scene['coordinateContract']=json.dumps(profile['coordinateContract']);scene['sourceGeometryProfileSHA256']=sha(ROOT/'geometry-profile.json.gz')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'central-shoulder-source.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in components:o.select_set(True)
bpy.context.view_layer.objects.active=components[0]
bpy.ops.export_scene.gltf(filepath=str(ROOT/'central-shoulder-components.glb'),export_format='GLB',use_selection=True,export_apply=False,export_yup=True,export_cameras=False,export_lights=False,export_extras=True)
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
 if o.type=='MESH':o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'central-shoulder-source.glb'),export_format='GLB',use_selection=True,export_apply=False,export_yup=True,export_cameras=False,export_lights=False,export_extras=True)
after={str(p.relative_to(REPO)):sha(p)for p in originals};assert after==before
report={'candidate':profile['candidate'],'scope':'Source assembly and exports only. Original source files unchanged; no app build/browser/render.','originalInputs':before,'finalOriginalInputs':after,'originalsUnchanged':before==after,'closedMeshChecks':checks,'sourceContextSHA256':sha(ROOT/'source-context.glb'),'profileSHA256':sha(ROOT/'geometry-profile.json.gz'),'outputs':{name:sha(ROOT/name)for name in ['central-shoulder-source.blend','central-shoulder-source.glb','central-shoulder-components.glb']}}
(ROOT/'assembly-qa.json').write_text(json.dumps(report,indent=2)+'\n');print('CENTRAL_SHOULDER_SOURCE_ASSEMBLED',json.dumps(report),flush=True)
