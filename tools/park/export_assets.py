"""Re-export the saved park blend; modes: blockout, beauty, assets.

blender -b art/park/park-resin-v1.blend --python tools/park/export_assets.py -- assets
"""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector, Quaternion
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parents[2]; OUT=ROOT/'art/park/renders';OUT.mkdir(parents=True,exist_ok=True)
scene=max((s for s in bpy.data.scenes if s.name.startswith('Small Park')),key=lambda s:len(s.objects))
bpy.context.window.scene=scene
C={c.name.removeprefix('Park · '):c for c in scene.collection.children}
cam=scene.camera
M={name:bpy.data.materials[stored] for name,stored in scene['material_names'].items()}
actor=C['Actor']; path=next(o for o in actor.objects if o.name.startswith('ROOT_PATH'))
pose_root=next(o for o in actor.objects if o.name.startswith('ROOT_POSE'))
joints={n:next(o for o in actor.objects if o.name==n) for n in ['Body','Head','Arm.L','Arm.R','Leg.L','Leg.R']}
originals={o.name:tuple(o.get('park_origin',o.location)) for o in scene.objects}
for o in [pose_root,*joints.values()]:o.animation_data_clear()
S=Vector((.7513,.66,0)); F=Vector((.66,-.7513,0))

def camera(target=(0,0,.65),width=384,height=384,ppu=120):
    target=Vector(target);yaw=math.radians(25);el=math.radians(15)
    cam.location=target+Vector((math.sin(yaw)*math.cos(el),-math.cos(yaw)*math.cos(el),math.sin(el)))*12
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.ortho_scale=width/ppu
    scene.render.resolution_x=width;scene.render.resolution_y=height
    bpy.context.view_layer.update()

def visible(names):
    for name,col in C.items():
        col.hide_render=name not in names and name!='Studio'
        col.hide_viewport=col.hide_render

def move(name,x):
    for o in C[name].objects:
        if not o.parent:o.location=Vector(originals[o.name])+Vector((x,0,0))

def pose(name):
    pose_root.location=(0,0,0);pose_root.rotation_euler=(0,0,0)
    for o in joints.values():o.rotation_mode='QUATERNION';o.rotation_quaternion=Quaternion()
    def rot(n,angle,axis=S):joints[n].rotation_quaternion=Quaternion(axis,math.radians(angle))
    if name in ['walk-a','walk-b']:
        d=1 if name=='walk-a' else -1
        rot('Leg.L',22*d);rot('Leg.R',-22*d);rot('Arm.L',-18*d);rot('Arm.R',18*d)
        pose_root.location.z=.016
    elif name=='sit':
        rot('Leg.L',72);rot('Leg.R',72);rot('Arm.L',-25);rot('Arm.R',-25)
        pose_root.location.z=-.09
    elif name=='soar':
        rot('Leg.L',32);rot('Leg.R',-18);rot('Arm.L',-65,F);rot('Arm.R',65,F)
        rot('Head',-7)
    elif name in ['crouch','land']:
        pose_root.scale=(1.035,1.035,.92)
        rot('Leg.L',15);rot('Leg.R',15);rot('Body',12);rot('Head',-8)
    elif name=='wave':rot('Arm.R',125,F);rot('Head',-8,F)
    if name not in ['crouch','land']:pose_root.scale=(1,1,1)
    bpy.context.view_layer.update()

def render(name):
    scene.render.filepath=str(OUT/(name+'.png'))
    bpy.ops.render.render(write_still=True)
    print('PARK_RENDER',name,flush=True)

def pivot():
    p=world_to_camera_view(scene,cam,Vector((0,0,0)))
    return [round(p.x*scene.render.resolution_x,4),round((1-p.y)*scene.render.resolution_y,4)]

def layout(kinds):
    visible(['Base','Actor']+[c for i,k in enumerate(kinds) if k for c in groups[k]])
    for i,k in enumerate(kinds):
        if k:
            for c in groups[k]:move(c,i*1.5)
    camera((1.5,0,.9),900,620,148)

groups={'slide':['Slide.Back','Slide.Front'],'trampoline':['Trampoline'],'bubble':['Bubble.Back','Bubble.Front'],'mat':['Mat'],'bell':['Bell'],'paint':['Paint.Back','Paint.Front']}
mode=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'blockout'
scene.render.film_transparent=True
scene.cycles.samples=32
if mode=='portrait':
    visible(['Actor']);path.location=(0,0,0);pose('stand');camera((0,0,.52),512,512,430);render('portrait')
elif mode=='blockout':
    scene.view_layers[0].material_override=M['clay']
    for name,kinds,x,z,p in [
        ('a1-a-ready',['slide','trampoline',None],-1.0,0,'stand'),
        ('a1-b-clearance',['slide','trampoline','bubble'],3,3.28,'soar'),
        ('a1-c-gate',['slide','bubble','trampoline'],1.5,0,'stand')]:
        layout(kinds);camera((1.5,0,1.65),900,960,148);path.location=(x,0,z);pose(p);render(name)
    scene.view_layers[0].material_override=None
elif mode=='beauty':
    layout(['slide','bubble','trampoline']);camera((1.625,0,1),1000,740,148);path.location=(1.83,-.08,0);pose('walk-a');render('beauty-c')
elif mode=='assets':
    manifest={'candidate':'park-resin-blender-v1','ppu':120,'camera':{'yaw':25,'elevation':15,'projection':'orthographic'},'color':{'view':'AgX','look':'Medium High Contrast','exposure':0,'alpha':'straight'},'sprites':{},'markers':{'fps':24,'takeoff':.12,'apex':.5,'land':.85,'bubbleAttach':.55,'bubblePop':'land','settle':1}}
    camera()
    # Shadow catcher: invisible props still cast the exported contact shadow.
    bpy.ops.mesh.primitive_plane_add(size=4,location=(0,0,.002))
    catcher=bpy.context.object;catcher.name='Park export shadow catcher';catcher.is_shadow_catcher=True
    for c in list(catcher.users_collection):c.objects.unlink(catcher)
    shadow_col=bpy.data.collections.new('Park · Export.Shadow');scene.collection.children.link(shadow_col);shadow_col.objects.link(catcher);C['Export.Shadow']=shadow_col
    for layer in ['Back','Front']:
        visible(['FX.'+layer]);name='bubble-fx-'+layer.lower();render(name)
        manifest['sprites'][name]={'width':384,'height':384,'pivot':pivot(),'file':name+'.webp'}
    for k,cols in groups.items():
        for c in cols:move(c,0)
        visible(cols+['Export.Shadow'])
        for c in cols:
            for o in C[c].objects:o.visible_camera=False
        name=k+'-shadow';render(name)
        manifest['sprites'][name]={'width':384,'height':384,'pivot':pivot(),'file':name+'.webp'}
        for c in cols:
            for o in C[c].objects:o.visible_camera=True
        for suffix,selected in [('back',cols[:1]),('front',cols[1:])] if len(cols)>1 else [('back',cols)]:
            visible(selected);name=k+'-'+suffix;render(name)
            manifest['sprites'][name]={'width':384,'height':384,'pivot':pivot(),'file':name+'.webp'}
        visible(cols);render(k+'-icon')
        manifest['sprites'][k+'-icon']={'width':384,'height':384,'pivot':pivot(),'file':k+'-icon.webp'}
        if k=='trampoline':
            membrane=next(o for o in C['Trampoline'].objects if o.name=='Soft fabric membrane')
            membrane.data.shape_keys.key_blocks['Compression'].value=1
            name='trampoline-compressed';render(name)
            manifest['sprites'][name]={'width':384,'height':384,'pivot':pivot(),'file':name+'.webp'}
            membrane.data.shape_keys.key_blocks['Compression'].value=0
    path.location=(0,0,0);visible(['Actor'])
    violet=next(n for n in M['violet'].node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    orig=tuple(violet.inputs['Base Color'].default_value)
    for tint in ['violet','pink']:
        violet.inputs['Base Color'].default_value=orig if tint=='violet' else M['pink'].diffuse_color
        for p in ['stand','walk-a','walk-b','sit','soar','crouch','land','wave']:
            pose(p);name='actor-'+tint+'-'+p;render(name)
            manifest['sprites'][name]={'width':384,'height':384,'pivot':pivot(),'file':name+'.webp'}
    violet.inputs['Base Color'].default_value=orig
    # Constant PPU; canvas grows with the course. Same camera angles and light rig.
    for slots in [3,4,5,6]:
        length=(slots-1)*1.5+2.85;cx=(slots-1)*.75+.125
        for o in C['Base'].objects:
            o.location.x=cx
            o.dimensions.x=length if 'wooden' in o.name else length-.035
        visible(['Base']);camera((cx,0,.55),int(120*(length+1.0)),432,120)
        name='base-'+str(slots);render(name)
        manifest['sprites'][name]={'width':scene.render.resolution_x,'height':432,'pivot':pivot(),'file':name+'.webp'}
    (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))

# Restore a usable composed scene for Blender handoff and viewport inspection.
scene.view_layers[0].material_override=None
layout(['slide','bubble','trampoline']);path.location=(1.83,-.08,0);pose('stand')
scene.frame_start=1;scene.frame_end=24
for frame,name in [(1,'stand'),(4,'crouch'),(8,'soar'),(12,'soar'),(20,'land'),(24,'stand')]:
    pose(name)
    for o in [pose_root,*joints.values()]:
        o.keyframe_insert('location',frame=frame);o.keyframe_insert('scale',frame=frame)
        o.keyframe_insert('rotation_quaternion' if o in joints.values() else 'rotation_euler',frame=frame)
scene.frame_set(1)
for label,frame in [('contact',1),('takeoff',4),('apex',12),('land / bubble_pop',20),('settle',24)]:
    scene.timeline_markers.new(label,frame=frame)
if mode!='assets':bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/park/park-resin-v1.blend'))
