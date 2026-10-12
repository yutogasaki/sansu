"""Build a separate editable shell + actual shared apron from the world patch.
All exported parts use original native source coordinates and one common pivot.
The original world and model inputs are read-only.
"""
import bpy,bmesh,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'cove-corner-v3.blend'))
scene=bpy.context.scene
bpy.context.preferences.filepaths.save_version=0
patch_path=ROOT/'shared-apron-world-patch-v1.json'
patch=json.loads(patch_path.read_text());floor=patch['district']['floors'][0];bank=patch['district']['surfaces'][0]
def source(p):return (13.9+(p['x']-8)/.45,-1.2-(p['z']-.5)/.45,.89+(p['y']-.0475)/.45)
points=[v['point'] for v in floor['vertices']];n=len(points)
points+=bank['vertices'][n:]
indices=floor['indices'];faces=[tuple(indices[i:i+3]) for i in range(0,len(indices),3)]
faces += [tuple(reversed([j+n for j in indices[i:i+3]])) for i in range(0,len(indices),3)]
faces += [tuple(bank['indices'][i:i+3]) for i in range(0,len(bank['indices']),3)]
me=bpy.data.meshes.new('Exact shared apron floor and solid bank');me.from_pydata([source(p) for p in points],[],faces);me.update()
bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me)
qa={'vertices':len(bm.verts),'faces':len(bm.faces),'boundary_edges':sum(e.is_boundary for e in bm.edges),'nonmanifold_edges':sum(not e.is_manifold for e in bm.edges)}
bm.free();assert qa['nonmanifold_edges']==0,qa
obj=bpy.data.objects.new('P04 candidate / shared apron exact world floor and bank',me);scene.collection.objects.link(obj)
def patch_material(name,color):
    values=[int(color[i:i+2],16)/255 for i in (1,3,5)]
    linear=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in values]
    material=bpy.data.materials.new(name);material.use_nodes=True
    node=next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    node.inputs['Base Color'].default_value=(*linear,1);node.inputs['Roughness'].default_value=.95 if color==floor['color'] else .78
    material.diffuse_color=(*linear,1)
    return material
me.materials.append(patch_material('P04 candidate / shared court ground '+floor['color'],floor['color']))
me.materials.append(patch_material('P04 candidate / shared court bank '+bank['material']['color'],bank['material']['color']))
for i,poly in enumerate(me.polygons):poly.material_index=0 if i<len(indices)//3 else 1
obj['world_patch']=patch_path.name;obj['floor_id']=floor['id'];obj['candidate']=patch['candidate'];obj['no_owner_grants']=True
obj['coordinate_contract']='source GLTF pivot 13.9,.89,1.2 -> authored 8,.0475,.50; uniform .45; yaw0; same as shell'
objects=[o for o in scene.objects if o.type in {'MESH','CURVE'} and not o.name.startswith('Authoring /')]
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'cove-corner-with-shore-v4.blend'))
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:obj.select_set(True)
bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.convert(target='MESH')
bpy.ops.export_scene.gltf(filepath=str(ROOT/'cove-corner-with-shore-v4.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_cameras=False,export_lights=False)
manifest={'candidate':patch['candidate'],'visualCandidate':patch['candidate'],'shellSource':{'id':'native05-authored-cove-corner-v3','sha256':hashlib.sha256((ROOT/'cove-corner-v3.glb').read_bytes()).hexdigest()},'scope':'unintegrated fixed p6/p7/p9 source geometry; not general moving place or M1 acceptance',
 'common_transform':{'source_gltf_pivot':[13.9,.89,1.2],'authored_position':[8,.0475,.50],'scale':[.45,.45,.45],'yaw':0,'blender_to_gltf':'(X,Z,-Y)','renderer_from_authored':'subtract layout.center from X and 2 from Z; Y unchanged'},
 'source_parts':{'shell':'cove-corner-v3.glb','shell_and_apron':'cove-corner-with-shore-v4.glb','editable':'cove-corner-with-shore-v4.blend','world_patch':patch_path.name},
 'apron':{'name':'P04 candidate / shared apron exact world floor and bank','floor_id':floor['id'],'top_vertices':n,'top_triangles':len(indices)//3,'bank_triangles':len(bank['indices'])//3,'bottom_triangles':len(indices)//3,'closed_mesh_qa':qa,'authoring_coordinates':'inverse common transform from the same world patch vertices/indices; GLB Float32 serialization must be audited'},
 'apron_materials':{'top_srgb':floor['color'],'bank_srgb':bank['material']['color'],'conversion':'sRGB hex converted to linear RGB for Blender Principled/glTF baseColorFactor, matching Three Color(hex)','native_shell_materials_unchanged':True},
 'lifecycle':'Fixed p9 feasibility only. Not installed, no runtime lifecycle. Integration must derive shell and apron together from active P04 ownership/formation and remove or recompute both on separation/move/storage, preserving existing base floors, sites, edges, and grants.',
 'outputs':{name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in ['cove-corner-v3.blend','cove-corner-v3.glb','cove-corner-with-shore-v4.blend','cove-corner-with-shore-v4.glb','shared-apron-world-patch-v1.json','ground-input.json']}}
(ROOT/'assembly-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('SANSU_COVE_ASSEMBLY_SAVED',json.dumps(qa),flush=True)
