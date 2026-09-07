"""Editable toy park. Run in Blender (MCP or --background --python).

Only creates a uniquely named scene; never deletes an existing user's scene.
Coordinates: +X travel, +Y rear, +Z up. No external assets/add-ons required.
"""
import bpy
import math
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'art/park'
OUT.mkdir(parents=True, exist_ok=True)
# Rebuild only this generator's owned scene; unrelated Blender work is preserved.
for old in list(bpy.data.scenes):
    if old.get('candidate_id') == 'park-resin-blender-v1':
        for o in list(old.objects):bpy.data.objects.remove(o,do_unlink=True)
        for c in list(old.collection.children):bpy.data.collections.remove(c)
        bpy.data.scenes.remove(old)
for m in list(bpy.data.materials):
    if m.name.startswith('Park · '):
        m.use_fake_user=False
        if m.users == 0:bpy.data.materials.remove(m)
SCENE = bpy.data.scenes.new('Small Park · Resin v1')
bpy.context.window.scene = SCENE
SCENE.render.engine = 'CYCLES'
SCENE.cycles.samples = 32
SCENE.cycles.use_denoising = True
SCENE.render.film_transparent = True
SCENE.render.image_settings.file_format = 'PNG'
SCENE.render.image_settings.color_mode = 'RGBA'
SCENE.render.resolution_percentage = 100
SCENE.render.fps = 24
SCENE.view_settings.view_transform = 'AgX'
SCENE.view_settings.look = 'AgX - Medium High Contrast'
SCENE.view_settings.exposure = 0
SCENE.world = bpy.data.worlds.new('Park · soft studio')
SCENE.world.use_nodes = True
world_bg = next(n for n in SCENE.world.node_tree.nodes if n.type == 'BACKGROUND')
world_bg.inputs[0].default_value = (1, .95, .87, 1)
world_bg.inputs[1].default_value = .45

COLS = {}
def collection(name):
    c = bpy.data.collections.new('Park · ' + name)
    SCENE.collection.children.link(c)
    COLS[name] = c
    return c

def put(obj, name, col, mat=None):
    obj.name = name
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    COLS[col].objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    if obj.type == 'MESH':
        for face in obj.data.polygons:
            face.use_smooth = True
    return obj

def linear(v):
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4

def material(name, hex_color, rough=.27):
    m = bpy.data.materials.new('Park · ' + name)
    m.use_fake_user = True
    m.use_nodes = True
    color = tuple(linear(int(hex_color[i:i+2], 16)/255) for i in (0,2,4)) + (1,)
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Coat Weight'].default_value = .3
    bsdf.inputs['Coat Roughness'].default_value = .24
    m.diffuse_color = color
    return m

M = {k: material(k, c, r) for k,c,r in [
    ('coral','EE7964',.25),('teal','3B9F9A',.25),('yellow','EFC95A',.23),
    ('violet','777BC3',.27),('cream','F8EACA',.32),('ink','283B4B',.32),
    ('wood','D7B58D',.4),('mint','B2C77D',.36),('pink','EFA4B4',.27),
    ('fabric','F3E4C8',.72),('white','FFFAEE',.28),('clay','B8C7CA',.6)]}
# A restrained, directional wood grain only on supporting surfaces.
nodes = M['wood'].node_tree.nodes
links = M['wood'].node_tree.links
tex = nodes.new('ShaderNodeTexNoise'); tex.inputs['Scale'].default_value = 4
tex.inputs['Detail'].default_value = 2
coord = nodes.new('ShaderNodeTexCoord')
mapping = nodes.new('ShaderNodeVectorMath'); mapping.operation = 'MULTIPLY'
mapping.inputs[1].default_value = (1.5, 32, 35)
links.new(coord.outputs['Generated'], mapping.inputs[0]); links.new(mapping.outputs[0], tex.inputs[0])
ramp = nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].position = .18
ramp.color_ramp.elements[0].color = (.49,.29,.13,1)
ramp.color_ramp.elements[1].position = .84
ramp.color_ramp.elements[1].color = (.78,.58,.34,1)
links.new(tex.outputs['Fac'], ramp.inputs[0])
links.new(ramp.outputs[0], next(n for n in nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'])

def box(name, loc, size, mat, col, bevel=.06):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = put(bpy.context.object, name, col, mat)
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = o.modifiers.new('Soft moulded edges', 'BEVEL'); mod.width=bevel; mod.segments=5
    o.modifiers.new('Weighted surface normals','WEIGHTED_NORMAL')
    return o

def sphere(name, loc, size, mat, col):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=24, radius=1, location=loc)
    o = put(bpy.context.object, name, col, mat); o.scale=size
    return o

def tube(name, points, radius, mat, col):
    curve = bpy.data.curves.new(name, 'CURVE'); curve.dimensions='3D'
    curve.resolution_u=24; curve.bevel_depth=radius; curve.bevel_resolution=5; curve.use_fill_caps=True
    spline=curve.splines.new('POLY'); spline.points.add(len(points)-1)
    for p,co in zip(spline.points, points): p.co=(*co,1)
    obj=bpy.data.objects.new(name,curve); COLS[col].objects.link(obj); curve.materials.append(mat)
    return obj

def ellipsering(name, center, radii, radius, mat, col, start=0, end=math.tau, plane='XY'):
    pts=[]
    for i in range(97):
        a=start+(end-start)*i/96
        u,v=radii[0]*math.cos(a),radii[1]*math.sin(a)
        pts.append((center[0]+(u if plane=='XY' else 0),center[1]+(v if plane=='XY' else u),center[2]+(0 if plane=='XY' else v)))
    return tube(name,pts,radius,mat,col)

for c in ['Studio','Base','Slide.Back','Slide.Front','Trampoline','Bubble.Back','Bubble.Front','Mat','Bell','Paint.Back','Paint.Front','Actor','FX.Back','FX.Front']:
    collection(c)

# Rig-like editable hierarchy: app owns ROOT_PATH, local acting lives below ROOT_POSE.
ROOT_PATH=bpy.data.objects.new('ROOT_PATH · application translation',None); COLS['Actor'].objects.link(ROOT_PATH)
ROOT_POSE=bpy.data.objects.new('ROOT_POSE · local acting only',None); COLS['Actor'].objects.link(ROOT_POSE); ROOT_POSE.parent=ROOT_PATH
JOINTS={}
def joint(name, loc):
    o=bpy.data.objects.new(name,None); COLS['Actor'].objects.link(o)
    o.parent=ROOT_POSE; o.location=loc; JOINTS[name]=o
    return o

def attach(obj, parent):
    bpy.context.view_layer.update()
    world=obj.matrix_world.copy(); obj.parent=parent; obj.matrix_world=world
    return obj

F=Vector((.66,-.7513,0)); S=Vector((.7513,.66,0))
def local(side, forward, z): return tuple(S*side+F*forward+Vector((0,0,z)))
body=joint('Body', (0,0,.38)); head=joint('Head',(0,0,.75))
attach(sphere('One-piece rounded indigo body',(0,0,.38),(.175,.155,.24),M['violet'],'Actor'),body)
attach(sphere('Cream waist',(0,0,.225),(.16,.145,.09),M['cream'],'Actor'),body)
h=attach(sphere('Bean helmet',(0,0,.747),(.257,.235,.252),M['violet'],'Actor'),head)
mask=attach(sphere('Warm inset face',local(0,.227,.745),(.18,.060,.190),M['cream'],'Actor'),head)
# Local sphere Y axis points along the face normal.
mask.rotation_euler[2]=math.atan2(-F.x,F.y)
for s in [-1,1]:
    eye=attach(sphere('Eye L' if s<0 else 'Eye R',local(s*.067,.287,.775),(.023,.012,.038),M['ink'],'Actor'),head)
    eye.rotation_euler[2]=mask.rotation_euler[2]
    attach(sphere('Eye glint',local(s*.067-.006,.298,.789),(.006,.006,.008),M['white'],'Actor'),head)
mouth=[local(-.033+.066*i/24,.292,.714-.016*math.sin(math.pi*i/24)) for i in range(25)]
attach(tube('Small open smile',mouth,.008,M['ink'],'Actor'),head)
attach(sphere('Single off-center forehead nub',local(-.065,.16,.946),(.057,.053,.057),M['violet'],'Actor'),head)
for side in [-1,1]:
    label='L' if side<0 else 'R'
    arm=joint('Arm.'+label,local(side*.16,0,.47))
    attach(sphere('Soft shoulder.'+label,local(side*.16,0,.47),(.06,.06,.06),M['violet'],'Actor'),arm)
    attach(tube('Sleeve.'+label,[local(side*.16,0,.47),local(side*.235,.012,.41)],.055,M['violet'],'Actor'),arm)
    attach(sphere('Mitten.'+label,local(side*.265,.023,.375),(.068,.061,.069),M['cream'],'Actor'),arm)
    leg=joint('Leg.'+label,local(side*.083,0,.22))
    attach(tube('Legging.'+label,[local(side*.083,0,.22),local(side*.09,.01,.092)],.057,M['violet'],'Actor'),leg)
    shoe=attach(sphere('Round shoe.'+label,local(side*.091,.050,.056),(.080,.113,.056),M['cream'],'Actor'),leg)
    shoe.rotation_euler[2]=mask.rotation_euler[2]

# Slide: a real continuous trough, thick shell, separate near rail for occlusion.
def slide_z(x):
    t=max(0,min(1,(x+.48)/1.08))
    return .10+.63*(1-(3*t*t-2*t*t*t))
verts=[]; faces=[]
for i in range(49):
    x=-.58+1.22*i/48
    for j in range(17):
        y=-.30+.60*j/16
        verts.append((x,y,slide_z(x)+.085*(abs(y)/.30)**4))
for i in range(48):
    for j in range(16):
        a=i*17+j; faces.append((a,a+17,a+18,a+1))
mesh=bpy.data.meshes.new('Continuous slide trough'); mesh.from_pydata(verts,[],faces); mesh.update()
o=bpy.data.objects.new('Coral moulded slide',mesh); COLS['Slide.Back'].objects.link(o); mesh.materials.append(M['coral'])
for p in mesh.polygons:p.use_smooth=True
mod=o.modifiers.new('Resin wall thickness','SOLIDIFY'); mod.thickness=.06
mod=o.modifiers.new('Soft lip','BEVEL'); mod.width=.025; mod.segments=4
for y in [-.32,.32]:
    col='Slide.Front' if y<0 else 'Slide.Back'
    tube('Raised slide edge',[(x,y,slide_z(x)+.09) for x in [-.58+1.22*i/60 for i in range(61)]],.039,M['coral'],col)
    outline=[(-.76,.04),(-.74,.62),(-.68,.80),(-.54,.92),(-.38,.94),(-.23,.86),(-.12,.63),(-.03,.04),
        (-.18,.04),(-.26,.57),(-.32,.70),(-.43,.76),(-.51,.72),(-.56,.59),(-.60,.04)]
    panel=bpy.data.meshes.new('Moulded arch side panel')
    panel.from_pydata([(x,y,z) for x,z in outline],[],[tuple(range(len(outline)))]);panel.update()
    side_obj=bpy.data.objects.new('Thick teal arch support',panel);COLS[col].objects.link(side_obj);panel.materials.append(M['teal'])
    solid=side_obj.modifiers.new('Solid resin moulding','SOLIDIFY');solid.thickness=.10
    bevel=side_obj.modifiers.new('Rounded arch edges','BEVEL');bevel.width=.045;bevel.segments=6
    side_obj.modifiers.new('Arch weighted normals','WEIGHTED_NORMAL')
    sphere('Warm rail cap',(-.40,y,.984),(.063,.063,.063),M['yellow'],col)
    box('Wooden slide support',(-.31,y,.27),(.09,.09,.54),M['wood'],'Slide.Back',.03)
for i in range(3):
    box('Rounded ladder step',(-.66+i*.035,0,.15+i*.18),(.16,.59,.078),M['wood'],'Slide.Back',.035)

ellipsering('Thick teal padded frame',(0,0,.20),(.49,.39),.075,M['teal'],'Trampoline')
membrane=sphere('Soft fabric membrane',(0,0,.168),(.463,.365,.036),M['fabric'],'Trampoline')
membrane.shape_key_add(name='Rest');compression=membrane.shape_key_add(name='Compression')
for vertex in compression.data:
    r2=vertex.co.x**2+vertex.co.y**2
    vertex.co.z-=2.0*max(0,1-r2)**2
for x in [-.32,.32]:
    for y in [-.26,.26]:box('Short wooden foot',(x,y,.075),(.12,.12,.15),M['wood'],'Trampoline',.03)
# Gate plane tilted toward camera: n=(cos(-15°),sin(-15°),0).
G=Vector((math.sin(math.radians(15)),math.cos(math.radians(15)),0))
for kind,color in [('Bubble','yellow'),('Paint','pink')]:
    for side in [-1,1]:
        col=kind+('.Front' if side<0 else '.Back')
        pts=[]
        # Open at floor level: a closed oval would block a walking doll's feet.
        for z in [.075,.25,.5,.745]:pts.append(tuple(G*(side*.51)+Vector((0,0,z))))
        for i in range(65):
            a=math.pi/2*i/64
            v=G*(side*.51*math.cos(a))+Vector((0,0,.745+.615*math.sin(a)))
            pts.append(tuple(v))
        tube(kind+' solid open hoop',pts,.075,M[color],col)
        p=G*(side*.51)
        box(kind+' wooden socket',(p.x,p.y,.115),(.26,.21,.23),M['wood'],col,.065)
    if kind=='Paint':
        for z in [.5,.75,1]:
            p=G*(-.51*math.sqrt(max(0,1-((z-.745)/.615)**2)))
            sphere('Cream inlaid paint dot',(p.x+.048,p.y-.015,z),(.033,.033,.04),M['cream'],'Paint.Front')

box('Soft landing cushion',(0,0,.10),(.94,.73,.20),M['cream'],'Mat',.14)
ellipsering('Stitched cushion piping',(0,0,.075),(.43,.33),.008,M['wood'],'Mat')
box('Bell stand foot',(0,.30,.045),(.58,.36,.09),M['wood'],'Bell',.04)
tube('Teal bell frame',[(-.25,.30,.05),(-.25,.30,.94),(-.20,.30,1.04),(.12,.30,1.04)],.042,M['teal'],'Bell')
# Lathed bell: thick curved profile with open lower edge.
verts=[]; faces=[]
profile=[(.045,1.00),(.095,.965),(.14,.91),(.155,.80),(.21,.715),(.21,.685),(.18,.68),(.13,.79),(.115,.90),(.07,.93)]
for r,z in profile:
    for i in range(64):
        a=math.tau*i/64; verts.append((.06+r*math.cos(a),.30+r*math.sin(a),z))
for j in range(len(profile)-1):
    for i in range(64):a=j*64+i;b=j*64+(i+1)%64;faces.append((a,b,b+64,a+64))
mesh=bpy.data.meshes.new('Bell lathe');mesh.from_pydata(verts,[],faces);mesh.update()
o=bpy.data.objects.new('Butter yellow bell',mesh);COLS['Bell'].objects.link(o);mesh.materials.append(M['yellow'])
for p in mesh.polygons:p.use_smooth=True
sphere('Coral bell clapper',(.06,.30,.69),(.046,.046,.065),M['coral'],'Bell')

# Non-refractive soap rim: clear center, two transparent halves, sparse glints.
def soap_material(name,color,opacity):
    mat=material(name,color,.2);nodes=mat.node_tree.nodes;links=mat.node_tree.links
    out=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
    trans=nodes.new('ShaderNodeBsdfTransparent');em=nodes.new('ShaderNodeEmission')
    em.inputs[0].default_value=mat.diffuse_color
    mix=nodes.new('ShaderNodeMixShader');mix.inputs[0].default_value=opacity
    links.new(trans.outputs[0],mix.inputs[1]);links.new(em.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],out.inputs['Surface'])
    return mat
soap=soap_material('soap pearl','FBF2DA',.65)
soap_blue=soap_material('soap blue','ABDFE1',.48)
soap_pink=soap_material('soap pink','EED1DC',.48)
right=Vector((math.cos(math.radians(25)),math.sin(math.radians(25)),0))
up=Vector((-math.sin(math.radians(25))*math.sin(math.radians(15)),math.cos(math.radians(25))*math.sin(math.radians(15)),math.cos(math.radians(15))))
center=Vector((0,0,.54))
for name,start,end,mat in [('Back',0,math.pi,soap_blue),('Front',math.pi,math.tau,soap_pink)]:
    tube('Soap '+name+' rim',[tuple(center+.60*(right*math.cos(a)+up*math.sin(a))) for a in [start+(end-start)*i/96 for i in range(97)]],.008,mat,'FX.'+name)
for start,end,radius,thick in [(1.78,2.25,.552,.014),(.55,.70,.575,.006),(4.7,5.0,.574,.007)]:
    tube('Soft pearl reflection',[tuple(center+radius*(right*math.cos(a)+up*math.sin(a))) for a in [start+(end-start)*i/32 for i in range(33)]],thick,soap,'FX.Front')

# Base is regenerated at the requested course length by the export script.
def make_base(slots=3):
    for o in list(COLS['Base'].objects):bpy.data.objects.remove(o,do_unlink=True)
    length=(slots-1)*1.5+2.85; cx=(slots-1)*.75+.125
    box('Pale wooden plinth',(cx,0,-.135),(length,1.62,.22),M['wood'],'Base',.14)
    box('Soft green tabletop',(cx,0,-.028),(length-.035,1.59,.07),M['mint'],'Base',.14)

make_base()
cam_data=bpy.data.cameras.new('Fixed orthographic · 25° / 15°')
CAM=bpy.data.objects.new('Camera · never change per asset',cam_data);COLS['Studio'].objects.link(CAM)
CAM.data.type='ORTHO';SCENE.camera=CAM
def camera(target=(0,0,.65), width=384, height=384, ppu=120):
    target=Vector(target); yaw=math.radians(25); el=math.radians(15)
    CAM.location=target+Vector((math.sin(yaw)*math.cos(el),-math.cos(yaw)*math.cos(el),math.sin(el)))*12
    CAM.rotation_euler=(target-CAM.location).to_track_quat('-Z','Y').to_euler()
    CAM.data.ortho_scale=width/ppu
    SCENE.render.resolution_x=width;SCENE.render.resolution_y=height

camera()
for name,loc,power,size in [('Key',(-3,-4,7),650,5),('Fill',(2,-1,5),240,4),('Rim',(0,5,5),400,3)]:
    data=bpy.data.lights.new('Park '+name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new('Park '+name,data);COLS['Studio'].objects.link(obj);obj.location=loc
    obj.rotation_euler=(Vector((1,0,.4))-obj.location).to_track_quat('-Z','Y').to_euler()

# A small armature provides conventional editable bones in addition to named controls.
arm=bpy.data.armatures.new('Park doll rig'); rig=bpy.data.objects.new('Doll rig',arm);COLS['Actor'].objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for name,ctrl in JOINTS.items():
    bone=arm.edit_bones.new(name);bone.head=ctrl.location;bone.tail=ctrl.location+Vector((0,0,.12))
bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False);rig.hide_render=True
for name,ctrl in JOINTS.items():
    constraint=ctrl.constraints.new('COPY_ROTATION');constraint.target=rig;constraint.subtarget=name
    constraint.owner_space='LOCAL';constraint.target_space='LOCAL';constraint.mix_mode='ADD'

SCENE['candidate_id']='park-resin-blender-v1'
SCENE['reference']='//reference/ref-01.png'
SCENE['units']='actor height 1 U; slot spacing 1.5 U'
SCENE['pipeline']='ROOT_PATH stays zero in sprites; ROOT_POSE contains local acting'
SCENE['camera_yaw_degrees']=25;SCENE['camera_elevation_degrees']=15
SCENE['gate_normal_degrees']=-15
SCENE['export_ppu']=120
SCENE['jump_apex_units']=3.2
SCENE['source_fps']=24
SCENE['material_names']={name:mat.name for name,mat in M.items()}
for obj in SCENE.objects:
    if not obj.parent:obj['park_origin']=list(obj.location)
# Pack the working reference for a portable art handoff.
ref=bpy.data.images.load(str(OUT/'reference/ref-01.png'),check_existing=True);ref.pack();ref.use_fake_user=True
print('Park scene ready:',len(SCENE.objects),'objects. Original scene preserved.')
