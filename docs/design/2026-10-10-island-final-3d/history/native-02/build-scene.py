import bpy, math, json, random, sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
random.seed(10410)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene['visual_candidate'] = 'whole-island-native-3d-02'
bpy.context.preferences.filepaths.save_version = 0
scene['evidence_type'] = 'native 3D art target; illustrative mature world'
world_objects = []
mat_cache = {}

def linear(v):
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4

def material(name, color, rough=.78):
    if name in mat_cache: return mat_cache[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    rgb = [linear(int(color[i:i+2], 16)/255) for i in (1,3,5)]
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Roughness'].default_value = rough
    m.diffuse_color = (*rgb, 1); mat_cache[name] = m
    return m

M = {
 'sand': material('shore / pale sand', '#e9d5ab'),
 'soil': material('soil / rounded exposed edges', '#b99c77'),
 'grass': material('ground / fresh soft meadow', '#b1d080'),
 'hill': material('ground / higher garden', '#a0c67a'),
 'path': material('path / light sandstone', '#e8dfc5'),
 'path2': material('path / warm stone variation', '#d8cdb2'),
 'rock': material('rounded shore rocks', '#adb8ba'),
 'bark': material('sculpted tree wood', '#9a7552'),
 'bark2': material('young branches', '#ad8b62'),
 'leaf': material('fresh canopy', '#8fc379'),
 'leaf2': material('sunlit canopy', '#a7d28b'),
 'leaf3': material('canopy shade', '#79b16f'),
 'coral': material('coral flowering canopy', '#eda4af'),
 'pink': material('rose flowering canopy', '#d77e96'),
 'ivory': material('ivory flower canopy', '#f1dfb3'),
 'wall': material('house / porcelain plaster', '#f6ecd8'),
 'wall2': material('house / shadow plaster', '#e9dbbd'),
 'wood': material('house / honey wood', '#b89971'),
 'blue': material('house / sky blue roof', '#79b4d4'),
 'red': material('house / coral roof', '#de909b'),
 'yellow': material('house / warm yellow roof', '#edcb77'),
 'door': material('house / cobalt door', '#4684b2'),
 'glass': material('window / pale blue glass', '#a7d5df', .27),
 'sea': material('sea / clean blue', '#4fb2d3', .24),
 'shallow': material('water / sheltered shallows', '#8bd3de', .32),
 'foam': material('water / small white wave crests', '#d8f3f5', .5),
 'fern': material('garden / broad leaves', '#68a594'),
}

def finish(o, name, mat=None, smooth=True):
    o.name = name
    if mat: o.data.materials.append(mat)
    if smooth and o.type == 'MESH':
        for p in o.data.polygons: p.use_smooth = True
    world_objects.append(o); return o

def sphere(name, at, scale, mat, segments=16, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=at)
    o=finish(bpy.context.object,name,mat);o.scale=scale;return o

def box(name, at, size, mat, bevel=.09):
    bpy.ops.mesh.primitive_cube_add(size=1,location=at)
    o=finish(bpy.context.object,name,mat,False);o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('soft handmade edges','BEVEL');mod.width=bevel;mod.segments=3
        mod=o.modifiers.new('weighted corner normals','WEIGHTED_NORMAL')
    return o

def curve(name, points, radius, mat, radii=None, cyclic=False):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.resolution_u=12
    data.bevel_depth=radius;data.bevel_resolution=3
    data.use_fill_caps=True
    sp=data.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
    for i,(p,co) in enumerate(zip(sp.bezier_points,points)):
        p.co=co;p.handle_left_type=p.handle_right_type='AUTO'
        if radii: p.radius=radii[i]
    sp.use_cyclic_u=cyclic
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);return finish(o,name,mat)

def island_plate(name, points, z, depth, mat, bevel=.1):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='2D';data.resolution_u=14
    data.fill_mode='BOTH';data.extrude=depth/2;data.bevel_depth=bevel;data.bevel_resolution=3
    sp=data.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
    for p,co in zip(sp.bezier_points,points):
        p.co=(*co,0);p.handle_left_type=p.handle_right_type='AUTO'
    sp.use_cyclic_u=True
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location.z=z
    return finish(o,name,mat)

outline=[(-10,-4.8),(-7.5,-7.4),(-4.2,-7.5),(-2,-5.2),(-1.25,-3),(.15,-.8),(-.7,1.2),(-1.7,3.7),(-.9,5.4),(.9,5.55),(1.9,4.1),(1.1,2),(.95,.1),(2.2,-1.7),(1.9,-4.2),(4.5,-6.1),(8.4,-5.5),(10.3,-2.2),(10.8,1),(10.7,5.5),(8.5,7.8),(5.5,8.7),(1.8,8.1),(-1.6,9.1),(-5.6,9.1),(-9.2,7.3),(-10.7,4.0),(-10.7,0)]
island_plate('Island / continuous organic earthen coast',outline,-.18,1.5,M['sand'],.20)
island_plate('Island / soft grassy cap',[(x*.975,y*.975) for x,y in outline],.69,.07,M['grass'],.12)
grove=[(-9.4,1.5),(-8.7,6.4),(-5.7,8),(-2.5,7.5),(-2.2,4.7),(-3.2,1.4),(-6.4,.5)]
garden=[(3.1,2.6),(3.9,6.9),(7.9,7.6),(9.4,5.6),(9.6,2),(7.0,.9),(4.5,1.3)]
island_plate('Grove / rounded living terrace',grove,.90,.47,M['hill'],.14)
island_plate('Garden / rounded flower terrace',garden,.92,.48,M['grass'],.14)

box('Ocean / actual blue surface',(0,0,-.05),(95,95,.08),M['sea'],0)
# Light blue floor occupies only the true inlet cut out of the island.
# The sea itself fills the true inlet. No separate water decal can cross the coast.
for i in range(44):
    x=random.uniform(-21,21);y=random.uniform(-18,18)
    if -12<x<12 and -8<y<10: continue
    length=random.uniform(.15,.6)
    curve('Ocean / short quiet wave',[(x,y,.005),(x+length*.5,y+.025,.005),(x+length,y,.005)],.012,M['foam'])
for x,y in [(-9.5,-5.8),(-7.3,-7.5),(-3.6,-6.5),(8.5,-5.7),(10.8,-2),(10.4,5.3),(-10.9,4.5),(-10.5,-1)]:
    for k in range(2):
        sphere('Coast / softened rock',(x+k*.37,y+k*.18,.07),(random.uniform(.35,.7),.43,random.uniform(.32,.5)),M['rock'],12,8)

def path_strip(name, points, width=.65, mat=None):
    # A genuinely flat walkable ribbon; not a cylindrical pipe laid across grass.
    original=[Vector(p) for p in points];points=[]
    for i in range(len(original)-1):
        a=original[max(0,i-1)];b=original[i];c=original[i+1];d=original[min(len(original)-1,i+2)]
        for j in range(10):
            t=j/10
            p=.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)
            p.z=max(.82,p.z);points.append(tuple(p))
    points.append(tuple(original[-1]))
    verts=[]
    for i,p in enumerate(points):
        before=Vector(points[max(0,i-1)]);after=Vector(points[min(len(points)-1,i+1)])
        tangent=after-before;tangent.z=0;tangent.normalize();side=Vector((-tangent.y,tangent.x,0))*width/2
        verts.extend([tuple(Vector(p)+side),tuple(Vector(p)-side)])
    faces=[(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(points)-1)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o);finish(o,name,mat or M['path'],False)
    solid=o.modifiers.new('a walkable stone surface','SOLIDIFY');solid.thickness=.055
    return o

path_strip('Village / open shared route',[(-7,-5.8,.82),(-5.8,-4.5,.82),(-4.6,-3,.82),(-3.2,-1.7,.82),(-2.2,-.5,.82)],1.1)
path_strip('Grove / route through mature canopy',[(-2.1,0,.82),(-3.2,1,1.08),(-4.4,2,1.23),(-5.7,3.5,1.23),(-5.6,5,1.23)],.85)
path_strip('Garden / connected bank route',[(2,-.5,.82),(3.4,.5,.82),(4.2,1.9,1.23),(5.8,2.7,1.25),(7.2,3.1,1.25)],1.0)
path_strip('Water town / shared frontage',[(3.1,-4.2,.82),(4.7,-3.2,.82),(6.5,-2.6,.82),(8,-1,.82)],1.0)

def courtyard(name,x,y,z,rx,ry):
    sphere(name,(x,y,z),(rx,ry,.075),M['path'],32,12)
    # Broad, irregular joints remain quiet enough to read a plaza rather than a tile grid.
    for k in range(11):
        a=k*math.tau/11
        sphere(name+' / edge stone',(x+rx*.92*math.cos(a),y+ry*.91*math.sin(a),z+.065),(.28,.19,.035),M['path2'],12,6)

courtyard('Village / shared sunny court',-5.3,-3.5,.80,2.6,2.15)
courtyard('Grove / sheltered open room',-5.55,3.4,1.22,2.45,1.75)
courtyard('Flowers / open sky gathering court',6.1,3.55,1.24,2.3,1.70)
courtyard('Water town / shared frontage court',6,-2,.80,2.0,1.55)

def bridge(name,x,y,length,width,z=.97):
    # x-axis span: shore-to-shore, up over the real inlet.
    for i in range(18):
        t=i/17;px=x+(t-.5)*length;h=z+.28*math.sin(math.pi*t)
        plank=box(name+' / arched plank',(px,y,h),(length/18*.93,width,.10),M['wood'],.035)
        plank.rotation_euler.y=-math.atan(.28*math.pi/length*math.cos(math.pi*t))
    for s in (-1,1):
        rail=[]
        for i in range(6):
            t=i/5;px=x+(t-.5)*length;h=z+.28*math.sin(math.pi*t)
            box(name+' / rounded post',(px,y+s*width*.44,h+.35),(.10,.10,.78),M['wood'],.04)
            rail.append((px,y+s*width*.44,h+.72))
        curve(name+' / curved handrail',rail,.045,M['wood'])
    curve(name+' / curved structural beam',[(x-length*.5,y,z-.08),(x,y,z+.16),(x+length*.5,y,z-.08)],.095,M['bark'])

bridge('Inlet / neighborhood bridge',.05,-.55,4.15,1.24,.82)
bridge('Inlet / forest garden bridge',.25,4.45,3.2,.98,1.0)

def trunk(name,x,y,z,height,lean=0):
    curve(name+' / planted trunk',[(x,y,z),(x-.18,y+.09,z+height*.30),(x+lean*.6,y+.15,z+height*.65),(x+lean,y,z+height)],.45,M['bark'],[1.3,1.1,.78,.46])
    for a in (0,1.7,3.25,4.7):
        curve(name+' / soft grounding root',[(x+math.cos(a)*.9,y+math.sin(a)*.75,z+.03),(x+math.cos(a)*.38,y+math.sin(a)*.28,z+.15),(x,y,z+.45)],.17,M['bark'],[.15,.8,1.5])
    # Thin, quiet ridges follow the actual trunk rather than applying one noisy texture.
    for a in (1.4,2.9,4.5):
        xx=math.cos(a)*.43;yy=math.sin(a)*.43
        curve(name+' / flowing bark ridge',[(x+xx,y+yy,z+.35),(x-.16+xx*.9,y+.09+yy*.9,z+height*.3),(x+lean*.6+xx*.6,y+.15+yy*.6,z+height*.65)],.025,M['bark2'],[.5,1,.15])

def crown(name,x,y,z,scale=1,colors=None):
    colors=colors or [M['leaf'],M['leaf2'],M['leaf3']]
    blobs=[(0,0,.05,1.3,.95,.85),(-.85,.08,-.02,1.05,.82,.68),(.80,.04,.06,1.1,.8,.72),(-.35,.60,.12,1.0,.83,.72),(.37,-.58,-.08,.94,.84,.72),(.20,.18,.58,.84,.7,.61)]
    for i,(a,b,c,sx,sy,sz) in enumerate(blobs):
        sphere(name+' / sculpted leaf mass',(x+a*scale,y+b*scale,z+c*scale),(sx*scale,sy*scale,sz*scale),colors[i%len(colors)],20,12)

# Four planted trunks support two connected living arches; no unearned background tree.
grove_trees=[(-8.0,2.7,5.0,.8),(-7.8,6.1,5.4,1.0),(-3.5,5.9,5.25,-.85),(-3.2,2.8,4.5,-.6)]
for i,(x,y,h,lean) in enumerate(grove_trees):
    trunk('Grove tree '+str(i+1),x,y,1.24,h,lean)
    crown('Grove tree '+str(i+1),x+lean,y,1.24+h,1.1)
for i,y in enumerate((2.9,5.9)):
    pts=[(-8.0,y,4.1),(-6.9,y,5.3),(-5.6,y,6.0),(-4.2,y,5.6),(-3.25,y,4.0)]
    curve('Grove / connected living arch '+str(i),pts,.34,M['bark'],[1.3,1,.85,.85,1.1])
    crown('Grove / shared arch canopy',-5.5,y,6.6,1.0)

# Branching, open crescent of flowers, no separate ornament scatter.
flower_trees=[(3.75,4.4,3.0),(4.3,6.5,3.4),(6.55,6.9,3.7),(8.7,5.4,3.15),(8.6,2.9,2.8)]
for i,(x,y,h) in enumerate(flower_trees):
    trunk('Flower tree '+str(i+1),x,y,1.24,h,.12 if i%2 else -.12)
    colors=[M['coral'],M['ivory'],M['pink']] if i%2 else [M['ivory'],M['coral']]
    crown('Flowers / connected rounded crown',x,y,1.24+h,.83,colors)
    for k in range(3):
        a=k*1.8;curve('Flowers / supporting grown branch',[(x,y,1.24+h*.65),(x+.45*math.cos(a),y+.4*math.sin(a),1.24+h*.86),(x+.75*math.cos(a),y+.65*math.sin(a),1.24+h)],.11,M['bark2'],[1,.8,.25])
for a,b in zip(flower_trees,flower_trees[1:]):
    curve('Flowers / joined lateral bough',[(a[0],a[1],3.65),((a[0]+b[0])/2,(a[1]+b[1])/2,4.5),(b[0],b[1],3.65)],.12,M['bark2'])

# The mature connected world has one impossible-but-grounded living span.
# Its ends visibly grow from existing grove / flower trunks, leaving air below.
curve('Whole island / grown living arch', [(-3.5,5.9,4.55),(-2.45,5.8,6.45),(-.65,5.45,7.30),(1.1,5.15,7.0),(2.6,4.75,5.7),(3.75,4.4,3.8)], .40, M['bark'], [1.35,1.12,.95,.85,.80,1.05])
curve('Whole island / joined arch ridge', [(-3.6,5.55,4.7),(-2.5,5.43,6.5),(-.65,5.1,7.35),(1.1,4.81,7.05),(2.6,4.46,5.75),(3.75,4.1,3.85)], .055, M['bark2'])
crown('Whole island / shared grown canopy',-.6,5.65,8.05,1.08)
crown('Whole island / meeting canopy',1.45,5.4,7.55,.94,[M['leaf2'],M['ivory'],M['coral']])

def little_tree(name,x,y,z,h=2.5):
    trunk(name,x,y,z,h,.14);crown(name,x+.14,y,z+h,.53)

for i,(x,y,z,h) in enumerate([(-9,-1,.79,2.1),(-1.8,7.3,.79,2.8),(9,-.5,.79,2.0),(-7.1,-5.8,.79,1.8),(7.8,-4.7,.79,1.85)]):
    little_tree('Orchard / grown tree '+str(i),x,y,z,h)

def roof_mesh(name,w,d,z,mat,rot=0,offset=(0,0,0)):
    # A swept, softly curled roof, built as actual curved geometry.
    profile=[(-w*.59,z-.50),(-w*.48,z-.50),(-w*.30,z+.0),(-w*.04,z+.44),(w*.08,z+.47),(w*.30,z+.02),(w*.48,z-.50),(w*.60,z-.44)]
    for side in (-1,1):
        row=profile[:5] if side<0 else profile[4:]
        verts=[]
        for zz in (-d*.56,d*.56):
            verts += [(px,zz,pz) for px,pz in row]
        n=len(row);faces=[(j,j+1,j+1+n,j+n) for j in range(n-1)]
        me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
        o=bpy.data.objects.new(name,me);scene.collection.objects.link(o);finish(o,name,mat,False)
        o.location=offset;o.rotation_euler.z=rot
        s=o.modifiers.new('thick toy roof','SOLIDIFY');s.thickness=.12
        b=o.modifiers.new('soft tile edges','BEVEL');b.width=.045;b.segments=3
        o.modifiers.new('weighted roof normals','WEIGHTED_NORMAL')
    return profile

def cottage(name,x,y,z,color,w=1.9,d=1.6,stories=1,rot=0,patch=False):
    def local(a,b,c):return (x+a*math.cos(rot)-b*math.sin(rot),y+a*math.sin(rot)+b*math.cos(rot),z+c)
    h=1.45 if stories==1 else 2.25
    plinth=box(name+' / shared grounding',local(0,0,.05),(w+.35,d+.36,.16),M['path2'],.1);plinth.rotation_euler.z=rot
    wall=box(name+' / rounded walls',local(0,0,h/2),(w,d,h),M['wall'],.18);wall.rotation_euler.z=rot
    # End gables, triangles above thick walls, material remains porcelain.
    verts=[(-w/2,-d/2,h-.1),(w/2,-d/2,h-.1),(0,-d/2,h+.65),(-w/2,d/2,h-.1),(w/2,d/2,h-.1),(0,d/2,h+.65)]
    me=bpy.data.meshes.new(name+' gable');me.from_pydata(verts,[],[(0,1,2),(5,4,3),(0,3,4,1),(1,4,5,2),(2,5,3,0)]);me.update()
    o=bpy.data.objects.new(name+' / storybook gable',me);scene.collection.objects.link(o);o.location=(x,y,z);o.rotation_euler.z=rot;finish(o,o.name,M['wall'],False)
    roof_mesh(name+' / curled roof',w,d,h+.29,color,rot,(x,y,z))
    if patch:
        # A few broad roof paint fields recall the original island, not a rainbow on everything.
        for k in range(5):
            xx=-.95+k*.40;roofz=h+.62-abs(xx)*.75
            tile=box(name+' / original color tile',local(xx,0,roofz),(.36,d*1.13,.09),[M['blue'],M['yellow'],M['red']][k%3],.03)
            tile.rotation_euler=(0,math.atan(.75)*(1 if xx>0 else -1),rot)
    # Rounded arched blue entry and trim, always visible from the front.
    door=box(name+' / cobalt entry',local(-.16,-d*.52,.49),(.53,.085,.90),M['door'],.15);door.rotation_euler.z=rot
    curve(name+' / doorway frame',[local(-.48,-d*.57,.11),local(-.48,-d*.57,.79),local(-.18,-d*.57,1.01),local(.15,-d*.57,.79),local(.15,-d*.57,.11)],.035,M['wood'])
    sphere(name+' / door knob',local(.01,-d*.60,.53),(.027,.027,.027),M['yellow'],12,8)
    for xx,zz in [(w*.33,.89),(0,h+.20)]:
        sphere(name+' / round window',local(xx,-d*.515,zz),(.23,.042,.23),M['glass'],20,12)
        curve(name+' / round window surround',[local(xx+.225*math.cos(a*math.tau/16),-d*.56,zz+.225*math.sin(a*math.tau/16)) for a in range(16)],.025,M['wood'],cyclic=True)
        for a in range(2):
            p=box(name+' / window frame',local(xx,-d*.56,zz),(.43,.052,.025) if a%2 else (.025,.052,.43),M['wood'],.01);p.rotation_euler.z=rot
    if stories>1:
        for xx in [-w*.28,w*.26]:
            p=box(name+' / upper story window',local(xx,-d*.52,1.80),(.35,.045,.36),M['glass'],.07);p.rotation_euler.z=rot
        aw=box(name+' / little balcony',local(.4,-d*.73,1.28),(.90,.52,.10),M['wood'],.04);aw.rotation_euler.z=rot
    chimney=box(name+' / chimney',local(w*.27,d*.12,h+.80),(.26,.27,.75),M['wall2'],.06);chimney.rotation_euler.z=rot
    for j in range(2):
        step=box(name+' / entrance step',local(-.16,-d*.62-j*.19,.06-j*.035),(.73,.30,.10),M['path'],.07);step.rotation_euler.z=rot

cottage('Original home',-7.0,-3.4,.81,M['blue'],patch=True,rot=-.07)
cottage('Village / coral house',-3.8,-3.0,.81,M['red'],w=1.65,d=1.48,rot=.14)
cottage('Village / matured common house',-5.1,-.5,.81,M['yellow'],w=2.1,d=1.8,stories=2,rot=.05)
cottage('Forest / blue home',-7.0,4.6,1.25,M['blue'],w=1.60,d=1.44,rot=.18)
cottage('Forest / yellow home',-4.0,6.6,1.25,M['yellow'],w=1.62,d=1.4,rot=-.20)
cottage('Water town / coral home',5.4,-3.5,.81,M['red'],w=1.8,d=1.6,stories=2,rot=-.17)
cottage('Water town / blue home',8.25,-1.9,.81,M['blue'],w=1.62,d=1.45,rot=.10)
cottage('Garden / small home',7.6,1.8,1.25,M['yellow'],w=1.55,d=1.35,rot=-.20)

def flower(name,x,y,z,size,color):
    curve(name+' / green stem',[(x,y,z),(x+.015,y,z+size*.7)],size*.065,M['fern'])
    for k in range(5):
        a=k*math.tau/5
        sphere(name+' / rounded petal',(x+size*.25*math.cos(a),y+size*.25*math.sin(a),z+size*.72),(size*.22,size*.17,size*.09),color,10,6)
    sphere(name+' / center',(x,y,z+size*.77),(size*.10,size*.10,size*.045),M['yellow'],10,6)

for center,rad,z,count in [((-6.0,-5.7),1.25,.82,24),((-8.7,-2),.68,.82,12),((4.2,2.1),.7,1.25,16),((8.5,4.3),.72,1.25,18),((6.7,6),.75,1.25,15),((4.3,-2),.65,.82,12)]:
    for k in range(count):
        a=random.random()*math.tau;r=math.sqrt(random.random())*rad;x=center[0]+math.cos(a)*r;y=center[1]+math.sin(a)*r
        flower('Garden / connected flower mass',x,y,z,random.uniform(.28,.50),[M['coral'],M['ivory'],M['yellow']][k%3])
for x,y,z in [(-9,1,1.24),(-3,6.8,1.24),(9,1.9,1.24),(8.2,-4.4,.82),(-8.6,-5,.82),(4.7,6.8,1.24)]:
    for i in range(5):
        a=i*math.tau/5
        leaf=sphere('Ground / grouped broad leaf',(x+.19*math.cos(a),y+.19*math.sin(a),z+.13),(.15,.33,.11),M['fern'],12,6);leaf.rotation_euler.z=a

# Import original project residents by mesh and UV, with their authored fabric atlas.
residents=json.loads((ROOT/'residents.json').read_text())
resident_materials=[]
for i,desc in enumerate(residents['materials']):
    m=bpy.data.materials.new('Resident / '+desc['name']);m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value=(*desc['color'],1);p.inputs['Roughness'].default_value=desc['roughness']
    if desc['map']:
        t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(ROOT/desc['map']),check_existing=True)
        m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color'])
    if desc['bumpMap']:
        t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(ROOT/desc['bumpMap']),check_existing=True);t.image.colorspace_settings.name='Non-Color'
        b=m.node_tree.nodes.new('ShaderNodeBump');b.inputs['Strength'].default_value=.18;b.inputs['Distance'].default_value=desc['bumpScale']
        m.node_tree.links.new(t.outputs['Color'],b.inputs['Height']);m.node_tree.links.new(b.outputs['Normal'],p.inputs['Normal'])
    resident_materials.append(m)

def resident(species,name,x,y,z,scale=.76,rotation=0):
    group=bpy.data.objects.new(name,None);scene.collection.objects.link(group);group.location=(x,y,z);group.scale=(scale,)*3;group.rotation_euler.z=rotation
    for part in residents['models'][species]:
        pos=part['position'];verts=[(pos[k],-pos[k+2],pos[k+1]) for k in range(0,len(pos),3)]
        idx=part['index'];faces=[tuple(idx[k:k+3]) for k in range(0,len(idx),3)]
        me=bpy.data.meshes.new(name+' / '+part['name']);me.from_pydata(verts,[],faces);me.update()
        if part['uv']:
            uv=me.uv_layers.new(name='Original project UV')
            for loop in me.loops: uv.data[loop.index].uv=part['uv'][loop.vertex_index*2:loop.vertex_index*2+2]
        o=bpy.data.objects.new(name+' / '+part['name'],me);scene.collection.objects.link(o);o.parent=group
        finish(o,o.name,resident_materials[part['material']])
    return group

resident('pokomoko','Original Pokomoko',-5.0,-4.8,.83,.76,-.05)
resident('rabbit','Rabbit / forest court',-5.7,2.6,1.27,.68,.35)
resident('fox','Fox / garden court',5.65,3.35,1.30,.65,-.3)
resident('pokomoko','Pokomoko / bridge',.30,-.5,1.19,.72,-.35)

# Sculpt the same whole island into a spring-fed, living garden before lighting it.
exec(compile((ROOT/'fantasy-landscape.py').read_text(), str(ROOT/'fantasy-landscape.py'), 'exec'), globals())
print('SANSU_3D_LANDSCAPE_BUILT', flush=True)

# Clear early-evening light: faces / paths remain bright and readable.
scene.world.use_nodes=True
bg=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND')
bg.inputs['Color'].default_value=(.60,.72,.92,1);bg.inputs['Strength'].default_value=.65
sky_coord=scene.world.node_tree.nodes.new('ShaderNodeTexCoord')
sky_xyz=scene.world.node_tree.nodes.new('ShaderNodeSeparateXYZ')
scene.world.node_tree.links.new(sky_coord.outputs['Normal'],sky_xyz.inputs['Vector'])
sky_range=scene.world.node_tree.nodes.new('ShaderNodeMapRange');sky_range.inputs['From Min'].default_value=-1;sky_range.inputs['From Max'].default_value=1
scene.world.node_tree.links.new(sky_xyz.outputs['Z'],sky_range.inputs['Value'])
sky_ramp=scene.world.node_tree.nodes.new('ShaderNodeValToRGB')
sky_ramp.color_ramp.elements.remove(sky_ramp.color_ramp.elements[1])
for i,(t,rgb) in enumerate([(0,(.38,.55,.74)),(.45,(.75,.64,.73)),(.58,(.60,.72,.88)),(1,(.37,.57,.82))]):
    e=sky_ramp.color_ramp.elements[0] if i==0 else sky_ramp.color_ramp.elements.new(t)
    e.position=t;e.color=(*rgb,1)
scene.world.node_tree.links.new(sky_range.outputs['Result'],sky_ramp.inputs['Fac'])
scene.world.node_tree.links.new(sky_ramp.outputs['Color'],bg.inputs['Color'])
def light(name,kind,at,power,size):
    data=bpy.data.lights.new(name,kind);data.energy=power
    if hasattr(data,'shape'): data.shape='DISK'
    if hasattr(data,'size'):data.size=size
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=at;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler();return o
key=light('Sunlit sky / key','AREA',(-14,-18,24),1800,14);key.data.color=(1,.80,.68)
fill=light('Soft blue sky / fill','AREA',(14,7,20),2000,16);fill.data.color=(.68,.81,1)
sun=light('Clear daylight / sun','SUN',(-12,-16,16),1.65,0);sun.data.color=(1,.82,.72)
sun.data.angle=.22
bpy.ops.object.camera_add(location=(24,-36,29))
camera=bpy.context.object;camera.name='Whole island / fixed art camera';camera.rotation_euler=(Vector((0,1.2,2.0))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=29.4
scene.camera=camera
scene.render.resolution_x=1600;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.render.engine='CYCLES'
scene.cycles.device='CPU'
scene.cycles.samples=48
scene.cycles.use_denoising=True
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
scene.view_settings.exposure=.35
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(ROOT/'whole-island-render.png')
scene.render.film_transparent=False
# Small local halos come from the actual luminous flowers / windows, after geometry.
comp=bpy.data.node_groups.new('Whole island / local flower halos','CompositorNodeTree')
comp.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
scene.compositing_node_group=comp
source=comp.nodes.new('CompositorNodeRLayers')
glare=comp.nodes.new('CompositorNodeGlare')
glare.inputs['Type'].default_value='Fog Glow';glare.inputs['Quality'].default_value='High'
glare.inputs['Threshold'].default_value=1.0;glare.inputs['Strength'].default_value=.12;glare.inputs['Size'].default_value=.20
comp.links.new(source.outputs['Image'],glare.inputs['Image'])
output=comp.nodes.new('NodeGroupOutput');comp.links.new(glare.outputs['Image'],output.inputs['Image'])

# Convert a copy for portable glTF, preserve the editable curves and modifiers in .blend.
exec(compile((ROOT/'editor-layout.py').read_text(), str(ROOT/'editor-layout.py'), 'exec'), {'__name__': 'editor_layout'})
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'whole-island.blend'))
print('SANSU_3D_NATIVE_SAVED', flush=True)
scene_objects=[o for o in scene.objects if o.type in {'MESH','CURVE'}]
# Convert all presentation curves at once; evaluate mesh modifiers in the exporter.
# Per-object selection / modifier application incurred quadratic scene updates.
bpy.ops.object.select_all(action='DESELECT')
curves=[o for o in scene_objects if o.type=='CURVE']
for o in curves:o.select_set(True)
if curves:
    bpy.context.view_layer.objects.active=curves[0];bpy.ops.object.convert(target='MESH')
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    if o.type=='MESH':o.select_set(True)
print('SANSU_3D_EXPORT_START',flush=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'whole-island.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_cameras=False,export_lights=False)
glb=(ROOT/'whole-island.glb').read_bytes()
model=json.loads(glb[20:20+int.from_bytes(glb[12:16],'little')])
triangles=sum(model['accessors'][p['indices']]['count']//3 for m in model['meshes'] for p in m['primitives'])
(ROOT/'scene-manifest.json').write_text(json.dumps({'candidate':'whole-island-native-3d-02','native':'whole-island.blend','portable':'whole-island.glb','renderer':scene.render.engine,'objects':len(scene_objects),'triangles':triangles,'houses':8,'districts':['willow court','spring and inlet','village','flower pavilion'],'residents':'existing project mesh + UV + authored fabric atlas','generation':'none; native geometry built in Blender','landscape':'stepped spring / connected waterfall / weeping foliage / shared flower pavilion / depth-colored rippling sea','camera':{'location':list(camera.location),'orthographic_scale':camera.data.ortho_scale}},indent=2))
print('SANSU_3D_MODEL_SAVED',triangles,flush=True)
bpy.ops.render.render(write_still=True)
print('SANSU_3D_RENDER_SAVED',flush=True)
