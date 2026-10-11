"""Whole-island art using the same diagnostic owners; never write a player save.

Run in a separate Blender process. The approved native-05 remains unchanged.
This is an editable spatial design proposal, not navigation/ownership parity.
"""
import ast, bpy, hashlib, json, math, os
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / '2026-10-10-island-final-3d'
INPUT = json.loads((ROOT/'owned-input.json').read_text())
MODULES = json.loads((ROOT.parent/'2026-10-10-native-art-transfer/module-manifest.json').read_text())
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
assert sha(SOURCE/'whole-island.glb') == INPUT['sourceSha256']
assert sha(ROOT/'owned-parts.glb') == INPUT['partsSha256']
source_blend_sha = sha(SOURCE/'whole-island.blend')
bpy.ops.wm.open_mainfile(filepath=str(SOURCE/'whole-island.blend'))
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene['visual_candidate'] = INPUT['candidate']
scene['art_only'] = True
scene['gameplay_mapped'] = False
scene['source_sha256'] = INPUT['sourceSha256']
scene['placed_owners'] = 27
scene['stored_owners'] = 2
world_objects = []
mat_cache = {m.name: m for m in bpy.data.materials}
for file in ['build-scene.py', 'varied-world.py']:
    for node in ast.parse((SOURCE/file).read_text()).body:
        if isinstance(node, ast.FunctionDef):
            exec(compile(ast.Module(body=[node], type_ignores=[]), file, 'exec'), globals())
        elif file == 'build-scene.py' and isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'M' for t in node.targets):
            exec(compile(ast.Module(body=[node], type_ignores=[]), file, 'exec'), globals())
terrain = bpy.data.objects['Island / continuous sculpted mature terrain']
ids = {n: m['id'] for m in MODULES['modules'] for n in m['sourceNames']}

# The native source also has real low terrace/court surfaces above its continuous
# terrain. Sample those actual polygons rather than burying a foot in a cap.
surface_names=['Island / continuous sculpted mature terrain','Grove / rounded living terrace',
    'Garden / rounded flower terrace','Village / shared sunny court','Grove / sheltered open room',
    'Flowers / open sky gathering court','Harbor / shared waterfront court','Water town / shared frontage court']
surfaces=[];depsgraph=bpy.context.evaluated_depsgraph_get()
for name in surface_names:
    obj=bpy.data.objects.get(name)
    if not obj:continue
    evaluated=obj.evaluated_get(depsgraph);mesh=evaluated.to_mesh()
    surfaces.append(BVHTree.FromPolygons([obj.matrix_world@v.co for v in mesh.vertices],[tuple(p.vertices) for p in mesh.polygons]))
    evaluated.to_mesh_clear()
def ground_at(x,y):
    hits=[hit[0].z for tree in surfaces if (hit:=tree.ray_cast(Vector((x,y,30)),Vector((0,0,-1))))[0] is not None]
    return max(hits) if hits else .79

def bbox(objects):
    bpy.context.view_layer.update()
    points = [o.matrix_world@Vector(p) for o in objects if o.type in {'MESH', 'CURVE'} for p in o.bound_box]
    return [min(p[k] for p in points) for k in range(3)], [max(p[k] for p in points) for k in range(3)]

def centre(o):
    low, high = bbox([o])
    return Vector([(a+b)/2 for a,b in zip(low,high)])

def tag(o, assembly, owner=None, owners=None):
    o['art_assembly'] = assembly
    o['source_native05_name'] = o.name
    if owner: o['owner_id'] = owner
    if owners: o['owner_ids'] = json.dumps(owners)

def suffix_index(name):
    return int(name.rsplit('.',1)[1]) if name.rsplit('.',1)[-1].isdigit() else 0

home_anchors = {'p5':[-1.0,16.0], 'p14':[10.8,-3.4], 'p15':[16.2,2.4], 'p23':[-4.3,-3.0],
    'p24':[7.7,17.2], 'p25':[-8.8,4.0], 'p26':[11.6,5.3], 'p27':[14.0,9.0]}
tree_anchors = {'l1':[-8.3,11.0], 'l2':[-8.2,16.4], 'l3':[-3.5,9.4], 'l4':[-1.0,18.2]}
anchors = {**home_anchors, **tree_anchors, 'l6':[-4.2,12.0], 'l13':[3.0,11.8], 'l22':[6.0,2.8],
    'l12':[1.0,11.0], 'l16':[13.1,-1.9], 'p17':[14.8,-2.6]}
flower_owners = ['l18','l19','l20','l21']
flower_stems = [bpy.data.objects['Flower tree '+str(i)+' / planted trunk'] for i in range(1,6)]
flower_roots = [Vector(o.data.splines[0].bezier_points[0].co) for o in flower_stems]
for owner, point in zip(flower_owners,flower_roots): anchors[owner]=[point.x,point.y]
anchors.update({'l7':[.95,13.15], 'l9':[2.55,15.95], 'l11':[4.35,18.2], 'l8':[1.6,14.6], 'l10':[3.4,16.7]})

kept_figures = {'figure:Original Pokomoko': [8.4,-3.6], 'figure:Rabbit / forest court':[-4.9,13.0],
    'figure:Fox / garden court':[5.8,3.3]}
figure_members = {id:[bpy.data.objects[n] for n in m['sourceNames']] for m in MODULES['modules'] if (id:=m['id']) in kept_figures}
removed, original_kept = [], []
for o in list(scene.objects):
    if o.type not in {'MESH','CURVE'}: continue
    name = o.name; module = ids.get(name)
    keep = False; owner = None; owners = None; assembly = 'landscape'
    if module == 'home:original':
        keep = True; owner = 'pokomoko-home'; assembly = 'home'
        o.location += Vector((-1.5,.1,0))
    elif module and module.startswith('home:'): keep = False
    elif module and module.startswith('figure:'):
        keep = module in kept_figures; assembly='figure'
    elif module in {'land','sea','connections'}:
        keep = True; assembly = module
        if name.startswith(('Whole island / grown living arch','Whole island / shared willow span','Grove / connected living arch')): keep=False
    elif module == 'great-tree':
        keep = True; assembly='great-tree'; owners=['l1','l2','l3','l4','p5']
    elif module == 'terraced-spring':
        keep = True; assembly='terraced-spring'; owners=['l7','l8','l9','l10','l11']
        if name.startswith(('Hill / open water terrace','Ocean / joined terrace pool')):
            i=int(name.rsplit(' ',1)[1]); owner=['l11','l9','l7'][i-1]
    elif module == 'shell-hall':
        keep = not name.startswith(('Harbor / shell interior bench','Harbor / grounded landing pile','Harbor / landing plank'))
        assembly='shell-hall'; owners=['p14','p15','l16','p17']
    elif module == 'forest':
        # Low ground vegetation is scenery, not extra mature purchased trees.
        keep = name.startswith(('Ground /','Grove / rounded living terrace','Grove / sheltered open room'))
        assembly='ground-vegetation'
    elif module == 'flower-garden':
        assembly='flower-garden'
        if name.startswith('Flower tree '):
            i=int(name.split(' / ')[0].split(' ')[-1]); keep=i<=4; owner=flower_owners[i-1] if keep else None
        elif name.startswith(('Flowers / shared giant petal canopy','Flowers / scalloped upper petal','Flowers / joined blossom heart',
            'Flowers / open sky gathering court','Flowers / joined lateral bough')):
            keep=True; owners=flower_owners
        elif name.startswith(('Flowers / canopy-reaching stem','Flowers / supporting grown branch','Flowers / broad growing leaf','Flowers / small peripheral bloom')):
            p=o.data.splines[0].bezier_points[0].co if o.type=='CURVE' else centre(o)
            closest=min(range(5),key=lambda i:(Vector(p)-flower_roots[i]).length)
            keep=closest<4; owner=flower_owners[closest] if keep else None
        elif name.startswith(('Garden / connected flower mass','Garden / riverbank wildflower','Flowers / grown habitat flowers',
            'Flowers / sheltered blue iris','Flowers / inlet iris leaf')):
            keep=True; assembly='ground-vegetation'
    if keep:
        tag(o,assembly,owner,owners); original_kept.append(name)
    else: removed.append(name); bpy.data.objects.remove(o,do_unlink=True)

# Move visible real characters by translation only: their face, UV and authored cloth stay intact.
figure_evidence=[]
for id, objects in figure_members.items():
    low,high=bbox(objects); x,y=kept_figures[id]
    delta=Vector((x-(low[0]+high[0])/2,y-(low[1]+high[1])/2,ground_at(x,y)+.02-low[2]))
    for o in objects:o.location+=delta
    figure_evidence.append({'sourceModule':id,'visibleSubsetOnly':True,'translation':list(delta)})

# Import each house/bench/plant from the current actual runtime geometry export.
before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'owned-parts.glb'))
imported=[o for o in bpy.data.objects if o not in before]
owner_evidence=[]
for o in imported:
    if not o.name.startswith('owned:'):continue
    owner=o.get('ownerId');assert owner in anchors
    if owner in flower_owners or owner in {'l7','l9','l11'}:
        # These keep identity in the larger derived native structures above.
        descendants=list(o.children_recursive)+[o]
        for child in reversed(descendants):bpy.data.objects.remove(child,do_unlink=True)
        continue
    matrix=o.matrix_world.copy();o.parent=None;o.matrix_world=matrix
    x,y=anchors[owner]
    # The full scene is the art sizing proposal. Keep every mesh proportional;
    # ordinary furniture is lower than the source figures, and trees open the
    # hollow entrance instead of competing with the shared fan crown.
    scale=3.0 if o.get('kind')=='home' else 2.2 if o.get('kind')=='sapling' else 1.3 if o.get('kind')=='bench' else 1.8
    stand_height=ground_at(x,y)+.02
    if o.get('kind')=='home':
        # A real closed footing meets sloped ground beneath the preserved house.
        # This remains proposed art geometry, never a granted navigation floor.
        local_low,local_high=bbox([o]+list(o.children_recursive))
        rx=(local_high[0]-local_low[0])*scale*.40
        ry=(local_high[1]-local_low[1])*scale*.40
        ring=[(x+rx*math.cos(k*math.tau/48),y+ry*math.sin(k*math.tau/48)) for k in range(48)]
        stand_height=max(ground_at(px,py) for px,py in ring)+.025
        vertices=[(px,py,ground_at(px,py)-.02) for px,py in ring]+[(px,py,stand_height) for px,py in ring]
        faces=[tuple(range(48,96))]+[(k,(k+1)%48,(k+1)%48+48,k+48) for k in range(48)]
        footing=native_mesh('Landscape / ground contact foundation '+owner,vertices,faces,M['path'])
        footing['owner_id']=owner;footing['art_assembly']='home-foundation';footing['gameplay_mapped']=False
    o.matrix_world=Matrix.Translation(Vector((x,y,stand_height)))@Matrix.Diagonal((scale,scale,scale,1))@o.matrix_world
    o['art_only_anchor']=True;o['owner_id']=owner;o['saved_cell']=json.dumps(next(v['cell'] for v in INPUT['owners'] if v['id']==owner))
    descendants=[o]+list(o.children_recursive)
    for child in descendants:
        child['owner_id']=owner;child['art_assembly']='home' if o.get('kind')=='home' else 'owned-part'
    owner_evidence.append({'id':owner,'anchor':[x,y,stand_height],'uniformArtUnitScale':scale,
        'bounds':bbox(descendants),'source':'actual runtime-owned-parts.glb'})

# Paths are newly drawn to actual proposed entrances, with every sample on the sculpted terrain.
def walk(name,xy,width):
    samples=[]
    for a,b in zip(xy,xy[1:]):
        for j in range(10):
            t=j/10;x=a[0]*(1-t)+b[0]*t;y=a[1]*(1-t)+b[1]*t
            samples.append((x,y,ground_at(x,y)+.08))
    x,y=xy[-1];samples.append((x,y,ground_at(x,y)+.08))
    o=path_strip('Landscape / '+name,samples,width)
    o['art_assembly']='connections';o['gameplay_mapped']=False
walk('forest entry loop',[(-7.5,-4.4),(-5.2,-4.0),(-3.5,-1.3),(-4.8,2.2),(-8.8,2.5)],.72)
walk('water garden home approach',[(4.0,11.6),(6.3,12.8),(7.7,15.8)],.66)
walk('bay houses contour walk',[(10.7,-4.6),(12.0,-3.5),(14.0,-1.0),(16.2,1.0)],.68)
walk('petal house approach',[(7.9,3.1),(9.8,3.8),(11.6,3.9),(12.4,6.4),(14.0,7.8)],.64)

scene.camera.location=(39,-46,43);target=Vector((3,6.3,3.2))
scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.camera.data.ortho_scale=46
scene.render.resolution_x=1600;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(ROOT/'whole-landscape-render.png')
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'whole-landscape.blend'))
bpy.ops.render.render(write_still=True)

# Convert only in the export process; editable curves stay in the saved blend.
bpy.ops.object.select_all(action='DESELECT')
curves=[o for o in scene.objects if o.type=='CURVE']
for o in curves:o.select_set(True)
if curves:bpy.context.view_layer.objects.active=curves[0];bpy.ops.object.convert(target='MESH')
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    if o.type in {'MESH','EMPTY'}:o.select_set(True)
temporary=ROOT/'.building-whole-landscape.glb'
bpy.ops.export_scene.gltf(filepath=str(temporary),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,
    export_cameras=False,export_lights=False,export_extras=True)
modelbytes=temporary.read_bytes();model=json.loads(modelbytes[20:20+int.from_bytes(modelbytes[12:16],'little')])
os.replace(temporary,ROOT/'whole-landscape.glb')
assert sha(SOURCE/'whole-island.glb')==INPUT['sourceSha256']
assert sha(SOURCE/'whole-island.blend')==source_blend_sha
owner_ids={o.get('owner_id') for o in scene.objects if o.get('owner_id') and o.get('owner_id')!='pokomoko-home'}
for o in scene.objects:
    if o.get('owner_ids'):owner_ids.update(json.loads(o['owner_ids']))
expected={o['id'] for o in INPUT['owners'] if o['cell'] is not None}
assert owner_ids==expected, (owner_ids-expected,expected-owner_ids)
manifest={'candidate':INPUT['candidate'],'artOnly':True,'gameplayMapped':False,'renderer':'Blender Cycles',
    'sourceGlbSha256':INPUT['sourceSha256'],'sourceBlendSha256':source_blend_sha,'sourceUnchanged':True,
    'sha256':hashlib.sha256(modelbytes).hexdigest(),'blendSha256':sha(ROOT/'whole-landscape.blend'),
    'renderSha256':sha(ROOT/'whole-landscape-render.png'),'bytes':len(modelbytes),'meshes':len(model['meshes']),
    'triangles':sum(model['accessors'][p['indices']]['count']//3 for m in model['meshes'] for p in m['primitives']),
    'materials':len(model['materials']),'homes':8,'cottage':1,'placedOwners':27,'storedOwners':2,'ownerIds':sorted(owner_ids),
    'ownerAnchors':anchors,'runtimeOwnedGeometry':owner_evidence,'visibleFigureSubset':figure_evidence,
    'originalRemovedNames':removed,'originalRetainedNames':original_kept,
    'court':'Original native hollow trunk / gallery, derived from four trees and one tree-home; no additional house',
    'landscapeVegetation':'Original low meadow/flower carpets only. No additional mature tree, house or resident purchase',
    'camera':{'position':[39,-46,43],'target':[3,6.3,3.2],'orthographicScale':46},
    'acceptance':{'visual':'review after rendering','independentChildren':0,'runtime':'not applicable: art proposal'}}
(ROOT/'art-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('SANSU_LANDSCAPE_ART_SAVED',json.dumps({k:manifest[k] for k in ['candidate','homes','placedOwners','meshes','triangles','bytes','sourceUnchanged']}),flush=True)
