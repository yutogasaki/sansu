"""Standalone authored trial. Run in Blender, including through MCP."""
import bpy
import math
import json
from pathlib import Path
from mathutils import Vector

OUT = Path(__file__).resolve().parent
scene = bpy.data.scenes.new('Sansu Crab Trial')
bpy.context.window.scene = scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.render.resolution_x = 960
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.fps = 24
scene.frame_start, scene.frame_end = 1, 120
scene.world = bpy.data.worlds.new('Crab daylight')
scene.world.use_nodes = True
background = next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND')
background.inputs[0].default_value = (.65, .78, .94, 1)
background.inputs[1].default_value = .65
scene.view_settings.view_transform = 'AgX'

def mat(name, color, rough=.65):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    return m

coral = mat('Crab coral shell', (.91, .21, .105), .4)
light = mat('Claw tips', (1, .49, .24), .45)
ivory = mat('Eye white', (.99, .94, .79), .4)
ink = mat('Eye navy', (.023, .043, .075), .25)
sand = mat('Warm sand', (.78, .65, .43))
stone = mat('Shelter blue stone', (.37, .52, .67))
water = mat('Shallow blue water', (.11, .57, .75), .3)
foam = mat('Shore foam', (.72, .91, .94))
rigged = []

def ball(name, loc, scale, material, bone=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    for p in o.data.polygons:
        p.use_smooth = True
    if bone:
        rigged.append((o, bone))
    return o

def link(name, a, b, radius, material, bone):
    mid = (Vector(a) + Vector(b)) / 2
    o = ball(name, mid, (radius, radius, (Vector(b)-Vector(a)).length/2 + radius), material, bone)
    o.rotation_euler = (Vector(b)-Vector(a)).to_track_quat('Z','Y').to_euler()
    return o

# Broad asymmetrical shell, small eyes, one larger claw: readable at island scale.
ball('Broad carapace', (0, 0, .53), (.56, .36, .29), coral, 'body')
ball('Lower shell', (0, -.06, .40), (.46, .30, .14), light, 'body')
for x in (-.23, .23):
    link('Eye stalk', (x,-.18,.64), (x,-.29,.91), .045, coral, 'body')
    ball('Eye', (x,-.29,.91), (.10,.085,.105), ivory, 'body')
    ball('Pupil', (x+.012,-.362,.923), (.043,.025,.051), ink, 'body')
    ball('Eye glint', (x+.004,-.383,.943), (.012,.008,.014), ivory, 'body')

bones = [('root',(0,0,0),(0,0,.2),None), ('body',(0,0,.45),(0,0,.75),'root')]
for side in (-1, 1):
    for i in range(4):
        name = f'leg_{side}_{i}'
        a = (side*.40, -.20+i*.15, .48)
        b = (side*(.68 + .06*math.sin(i)), -.30+i*.23, .29)
        c = (side*(.86 + .05*math.sin(i)), -.39+i*.26, .065)
        bones.append((name,a,b,'body'))
        link(name+' upper',a,b,.052,coral,name)
        link(name+' foot',b,c,.038,light,name)
    name = f'claw_{side}'
    a = (side*.37,-.24,.54)
    b = (side*.70,-.56,.62)
    bones.append((name,a,b,'body'))
    link(name+' arm',a,b,.075,coral,name)
    size = 1.18 if side == -1 else .88
    ball(name+' palm',(side*.78,-.65,.67),(.17*size,.20*size,.16*size),coral,name)
    for offset in (-1,1):
        o = ball(name+' rounded finger',(side*.78+offset*.085*size,-.85,.72),(.065*size,.15*size,.075*size),light,name)
        o.rotation_euler.z = offset*.30

bpy.ops.object.armature_add()
rig = bpy.context.object
rig.name = 'CrabRig'
bpy.ops.object.mode_set(mode='EDIT')
rig.data.edit_bones.remove(rig.data.edit_bones[0])
for name,head,tail,parent in bones:
    b = rig.data.edit_bones.new(name)
    b.head,b.tail = head,tail
    if parent:
        b.parent = rig.data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
for o,bone in rigged:
    group = o.vertex_groups.new(name=bone)
    group.add(list(range(len(o.data.vertices))),1,'REPLACE')
    modifier = o.modifiers.new('Rigid bone weights','ARMATURE')
    modifier.object = rig
    o.parent = rig

# One short, deliberately triggered sequence. No pursuit, harm, reward or learning coupling.
for f,x,z,lean in [(1,0,0,0),(20,0,.02,0),(32,0,.025,-.12),(44,0,0,0),(76,1.85,0,0),(91,1.85,0,0),(120,0,0,0)]:
    root = rig.pose.bones['root']
    root.location = (x,0,z)
    root.keyframe_insert('location',frame=f)
    body = rig.pose.bones['body']
    body.rotation_mode = 'XYZ'
    body.rotation_euler.x = lean
    body.keyframe_insert('rotation_euler',frame=f)
for f in range(1,121,3):
    moving = 44 <= f <= 76 or 94 <= f <= 118
    for side in (-1,1):
        for i in range(4):
            p = rig.pose.bones[f'leg_{side}_{i}']
            p.rotation_mode = 'XYZ'
            p.rotation_euler.y = .24*math.sin(f*.7+i*math.pi+side) if moving else 0
            p.rotation_euler.z = .13*math.cos(f*.7+i*math.pi) if moving else 0
            p.keyframe_insert('rotation_euler',frame=f)
        p = rig.pose.bones[f'claw_{side}']
        p.rotation_mode = 'XYZ'
        p.rotation_euler.z = side*(-.20 if 23<=f<=38 else .025*math.sin(f*.13))
        p.keyframe_insert('rotation_euler',frame=f)
rig.animation_data.action.name = 'Notice_Sidestep_Shelter_Return'

ball('Sandy bank',(0,.2,-.21),(3.8,2.8,.23),sand)
ball('Shallow water',(-.8,1.8,-.24),(5,2.5,.17),water)
for i in range(9):
    ball('Foam edge',(-3+i*.75, .95+.10*math.sin(i),-.04),(.40,.065,.018),foam)
# An open-front, above-ground shelter. The crab enters laterally rather than sinking.
ball('Shelter rear',(1.98,.58,.62),(.78,.25,.77),stone)
ball('Shelter far side',(2.76,.05,.60),(.20,.66,.65),stone)
ball('Shelter roof',(2.0,.05,1.32),(.96,.78,.22),stone)
for pos,size in [((-1.8,.25,.08),(.24,.17,.12)),((-1.5,.52,.08),(.16,.14,.1)),((.6,.90,.08),(.13,.1,.07))]:
    ball('Pebble',pos,size,stone)

bpy.ops.object.camera_add(location=(4.6,-7.6,6.0))
camera = bpy.context.object
camera.name = 'Island angle camera'
camera.rotation_euler = (Vector((.65,.05,.35))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 6.8
scene.camera = camera
bpy.ops.object.light_add(type='AREA',location=(-3,-4,7))
bpy.context.object.data.energy = 950
bpy.context.object.data.shape = 'DISK'
bpy.context.object.data.size = 5
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'crab-trial.blend'))
props = bpy.ops.export_scene.gltf.get_rna_type().properties
kwargs = dict(filepath=str(OUT/'crab-trial.glb'),export_format='GLB',export_animations=True,export_cameras=False,export_lights=False,use_active_scene=True)
if 'export_animation_mode' in props:
    modes = [e.identifier for e in props['export_animation_mode'].enum_items]
    if 'SCENE' in modes:
        kwargs['export_animation_mode'] = 'SCENE'
bpy.ops.export_scene.gltf(**kwargs)
triangles = 0
for o in scene.objects:
    if o.type == 'MESH':
        o.data.calc_loop_triangles()
        triangles += len(o.data.loop_triangles)
(OUT/'model-report.json').write_text(json.dumps({'candidate':'crab-mcp-trial-v1','bones':len(bones),'rigged_parts':len(rigged),'scene_triangles':triangles,'fps':24,'frames':120,'application_integration':False},indent=2)+'\n')
print('CRAB_TRIAL_READY', len(bones), 'bones', triangles, 'triangles')
