"""native-02: change the land / canopy / water, not the resident identities.

Executed inside build-scene.py with its native modeling helpers. Every leaf,
spring bank, waterfall, and water ripple is actual editable / portable geometry.
"""
from mathutils import geometry

def remove_where(test):
    for obj in list(scene.objects):
        if test(obj.name): bpy.data.objects.remove(obj, do_unlink=True)

def recolor(mat, color, rough=None):
    rgb = tuple(linear(int(color[i:i+2],16)/255) for i in (1,3,5))
    p = next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value=(*rgb,1);mat.diffuse_color=(*rgb,1)
    if rough is not None: p.inputs['Roughness'].default_value=rough

def luminous(name, color, strength):
    m=material(name,color,.36)
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Emission Color'].default_value=p.inputs['Base Color'].default_value
    p.inputs['Emission Strength'].default_value=strength
    return m

M.update({
 'willow':material('willow / pale blue jade leaves','#8acabb',.67),
 'willow2':material('willow / fresh mint tips','#b3dcb8',.70),
 'willow3':material('willow / cool shade leaves','#7cb9b2',.72),
 'lavender':material('flowers / soft lilac petals','#b7aee0',.6),
 'petal':material('flowers / warm pink upper petals','#edafbf',.56),
 'petal2':material('flowers / porcelain lower petals','#f4d0d4',.57),
 'springstone':material('spring / pale lilac limestone','#b6b6ce',.75),
 'grassblade':material('ground / tender grass blades','#9ebd78',.78),
 'grasslight':material('ground / fine sunlit grass','#c5d791',.8),
 'lamp':luminous('life / warm window light','#ffcf8d',1.6),
 'bell':luminous('willow / pearl flower light','#d0f4ed',1.4),
 'waterfall':material('water / falling jade water','#84d9dd',.16),
 'waterwhite':material('water / thin waterfall highlights','#c5f1ef',.2),
})
recolor(M['grass'],'#aed38c');recolor(M['hill'],'#98c39b')
recolor(M['bark'],'#a2826b');recolor(M['bark2'],'#be9b7c')
recolor(M['sand'],'#e2d7c9');recolor(M['wall'],'#f1f3ee')
recolor(M['path'],'#e4dfe0');recolor(M['path2'],'#c6bec3')
recolor(M['blue'],'#89bedf');recolor(M['red'],'#eb98ae')
recolor(M['yellow'],'#eac786');recolor(M['glass'],'#ffe0a5')
p=next(n for n in M['glass'].node_tree.nodes if n.type=='BSDF_PRINCIPLED')
p.inputs['Emission Color'].default_value=(1,.57,.20,1)
p.inputs['Emission Strength'].default_value=.5

def inside(pt, polygon):
    x,y=pt;result=False
    for a,b in zip(polygon,polygon[1:]+polygon[:1]):
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:result=not result
    return result

def distance_to_segment(x,y,a,b):
    dx=b[0]-a[0];dy=b[1]-a[1]
    t=max(0,min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)))
    return math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)

def lamina(name, at, length, width, mat, rotation=0, droop=0, curl=.18):
    # Broad tapered leaves / petals with a raised midrib, not hanging tubes.
    verts=[];n=12
    for i in range(n+1):
        t=i/n;half=width*math.sin(math.pi*t)**.72
        for side in (-1,0,1):
            verts.append((half*side,length*t,curl*math.sin(math.pi*t)*(1-.25*abs(side))-droop*t*t))
    faces=[]
    for i in range(n):
        for k in range(2):faces.append((i*3+k,i*3+k+1,(i+1)*3+k+1,(i+1)*3+k))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o);o.location=at;o.rotation_euler.z=rotation
    finish(o,name,mat)
    s=o.modifiers.new('leaf thickness','SOLIDIFY');s.thickness=.015
    return o

def soft_mass(name,at,scale,mat,phase=0):
    o=sphere(name,at,scale,mat,32,20)
    # Gentle lobes give each crown a silhouette rather than six uniform balloons.
    for v in o.data.vertices:
        p=v.co;az=math.atan2(p.y,p.x)
        f=1+.065*math.sin(az*5+phase)*math.sin(math.acos(max(-1,min(1,p.z))))**2
        p.x*=f;p.y*=f;p.z*=1+.035*math.cos(az*4+phase)
    return o

# One spring is grown into the back bank, with an actual cut-out in its grassy cap.
spring=[(-5.0,7.1),(-4.3,8.75),(-2.5,9.0),(-.5,8.60),(1.25,8.05),(2.4,6.8),(1.6,5.45),(-.8,5.65),(-2.5,6.1)]
pool=[(-2.3,7.0),(-1.5,8.0),(-.1,8.0),(.95,7.2),(.95,6.25),(.1,5.75),(-.65,6.3),(-1.8,6.3)]
island_plate('Island / spring limestone foundation',spring,1.42,1.6,M['springstone'],.23)
cap=island_plate('Island / living spring bank',[(x*.98,y) for x,y in spring],2.36,.03,M['hill'],.1)
hole=cap.data.splines.new('BEZIER');hole.bezier_points.add(len(pool)-1)
for point,co in zip(hole.bezier_points,reversed(pool)):
    point.co=(*co,0);point.handle_left_type=point.handle_right_type='AUTO'
hole.use_cyclic_u=True
island_plate('Ocean / actual sheltered spring',pool,2.34,.025,M['shallow'],.03)
# Relocate the existing yellow forest cottage onto solid spring land, with steps.
for obj in scene.objects:
    if obj.name.startswith('Forest / yellow home'):obj.location+=Vector((.4,1.2,1.18))
    if obj.name.startswith('Orchard / grown tree 1'):
        # The old flat-ground tree cannot remain planted below the new spring.
        obj.location+=Vector((2.9,.4,1.65))
for j in range(8):
    rise=(j+1)*1.18/8
    box('Grove / spring staircase',(-4.7,5.2+j*.23,1.25+rise/2),(.85,.25,rise),M['wood'],.028)
box('Grove / spring stair landing',(-4.15,6.98,2.435),(1.4,.48,.12),M['wood'],.06)
curve('Grove / spring stair handrail',[(-5.12,5.15,1.95),(-5.12,5.8,2.37),(-5.12,6.81,3.13)],.034,M['wood'])
for j in (0,3,7):
    rise=(j+1)*1.18/8
    box('Grove / spring stair rail post',(-5.12,5.2+j*.23,1.25+rise+.31),(.07,.07,.69),M['wood'],.025)
# Four broad stone layers turn the uniform edge into an eroded, stepped bank.
for i,(x,y,z,sx,sy) in enumerate([(-2.9,6.25,1.7,.9,.4),(1.65,6.1,1.55,.7,.4),(-3.95,7.3,1.05,.8,.6),(2.0,6.8,1.2,.55,.6),(-1.1,5.9,1.4,.6,.35)]):
    soft_mass('Coast / spring eroded ledge '+str(i),(x,y,z),(sx,sy,.34),M['springstone'],i)

# Water pours from this same upper pool into the inlet; the bridge goes below it.
flow=[Vector((.15,6.0,2.40)),Vector((.33,5.55,2.38)),Vector((.58,5.14,1.87)),Vector((.71,4.82,.87)),Vector((.70,4.5,.035))]
vs=[];fs=[]
for n in range(len(flow)-1):
    a=flow[max(0,n-1)];b=flow[n];c=flow[n+1];d=flow[min(len(flow)-1,n+2)]
    for j in range(10):
        t=j/10;center=.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)
        for k in range(7):
            u=k/6-.5
            vs.append(tuple(center+Vector((u*.80,.018*math.sin(k*1.7+t*4),.012*math.sin(k*2+t*5)))))
for k in range(7):vs.append(tuple(flow[-1]+Vector(((k/6-.5)*.8,0,0))))
for j in range(len(vs)//7-1):
    for k in range(6):
        a=j*7+k;fs.append((a,a+1,a+8,a+7))
mesh=bpy.data.meshes.new('Inlet / flowing spring sheet');mesh.from_pydata(vs,[],fs);mesh.update()
o=bpy.data.objects.new('Inlet / flowing spring sheet',mesh);scene.collection.objects.link(o);finish(o,o.name,M['waterfall'])
for i in range(7):
    x=.15+(i-3)*.105
    pts=[(x,6.0,2.40),(x+.18,5.55,2.38),(x+.43,5.14,1.87),(x+.56,4.82,.87),(x+.55,4.5,.035)]
    curve('Inlet / continuous spring waterfall '+str(i),pts,.017 if i%2 else .012,M['waterwhite'],[.7,1,1,.8,.5])
for i in range(4):
    # Elliptical broken ripples follow the impact; they do not form a glowing decal.
    r=.36+i*.16
    pts=[(.71+r*math.cos(a),4.5+r*.60*math.sin(a),.032) for a in [j*.10 for j in range(57)]]
    curve('Inlet / spring impact ripple',pts,.014,M['foam'])
for i in range(18):
    a=i*math.tau/18
    sphere('Inlet / soft spray foam',(.71+random.uniform(.12,.45)*math.cos(a),4.5+random.uniform(.08,.24)*math.sin(a),.04),(.065,.046,.03),M['foam'],10,6)

# A rounded, long-leaf canopy encloses a room instead of merely making taller trees.
remove_where(lambda n:'/ sculpted leaf mass' in n and not n.startswith('Orchard /'))
remove_where(lambda n:n.startswith('Whole island / joined arch ridge'))
arch=bpy.data.objects.get('Whole island / grown living arch')
arch.data.bevel_depth=.36
for p,co in zip(arch.data.splines[0].bezier_points,[(-3.5,5.9,4.55),(-2.5,5.8,6.5),(-.65,5.45,7.05),(1.2,5.2,6.85),(2.8,5.0,5.8),(3.75,4.4,3.8)]):p.co=co

def willow_crown(name,x,y,z,scale=1):
    cols=[M['willow'],M['willow2'],M['willow3']]
    lobes=[(0,0,.12,1.50,1.05,.73),(-.9,.12,-.06,1.06,.86,.62),(.95,.08,0,1.12,.9,.64),(-.15,.67,.05,1.12,.91,.68),(.2,-.65,-.10,1.15,.81,.59)]
    for i,(dx,dy,dz,sx,sy,sz) in enumerate(lobes):
        soft_mass(name+' / lobed canopy',(x+dx*scale,y+dy*scale,z+dz*scale),(sx*scale,sy*scale,sz*scale),cols[i%3],i+.2)
    # Unequal curtains leave views through the boughs into the village and court.
    for k in range(14):
        a=k*math.tau/14;dx=math.cos(a);dy=math.sin(a)
        length=scale*random.uniform(1.05,2.0)
        xx=x+dx*1.45*scale;yy=y+dy*.98*scale
        curve(name+' / hanging leaf stem',[(xx,yy,z-.02),(xx+dx*.10,yy+dy*.10,z-length*.45),(xx+dx*.06,yy+dy*.06,z-length)],.012*scale,M['willow3'],[1,.85,.08])
        for j in range(5):
            t=(j+.15)/5;zz=z-length*t
            angle=a+(.8 if j%2 else -.8)
            lamina(name+' / tapered hanging leaf',(xx,yy,zz),length*.47,.13*scale,cols[(j+k)%3],angle,length*.46,.045)

for i,(x,y,h,lean) in enumerate(grove_trees):
    willow_crown('Grove / living willow '+str(i+1),x+lean,y,1.24+h,.93 if i in (0,3) else 1.03)
willow_crown('Whole island / shared willow span',-.7,5.65,7.50,.98)
willow_crown('Whole island / flower meeting bough',1.35,5.3,7.16,.67)

# Pearl-like flowers actually hang from the joined branch, in one local grove.
def bell_flower(name,x,y,z,size=.22):
    sphere(name+' / pearl core',(x,y,z),(size*.26,)*3,M['bell'],12,8)
    for k in range(5):
        a=k*math.tau/5
        lamina(name+' / cupped petal',(x,y,z+.08*size),size*.92,size*.27,M['bell'],a,size*.50,size*.32)
for i,(x,y,z) in enumerate([(-6.2,2.9,4.9),(-5.1,5.9,5.9),(-2.1,5.6,6.6),(-.65,5.45,6.9),(1.0,5.25,6.5)]):
    curve('Grove / flowering vine',[(x-.2,y,z+.25),(x,y,z-.15),(x+.1,y,z-.85)],.016,M['fern'])
    bell_flower('Grove / hanging pearl flower '+str(i),x+.1,y,z-.9,.34)

# Five neighboring flowering stems share an airy petal roof. An open court stays below.
for i,(x,y,h) in enumerate(flower_trees):
    for a in range(3):
        angle=a*math.tau/3+i*.7
        lamina('Flowers / broad growing leaf',(x,y,2.6),1.30,.36,M['willow2'],angle,.24,.19)
    curve('Flowers / canopy-reaching stem',[(x,y,1.24+h*.75),(x+(6.1-x)*.55,y+(4.8-y)*.55,4.8),(6.1,4.8,5.4)],.085,M['bark2'],[1,.7,.42])
    soft_mass('Flowers / small peripheral bloom',(x,y,1.24+h+.12),(.70,.66,.35),M['petal'],i)
for k in range(7):
    angle=k*math.tau/7+.1
    lamina('Flowers / shared giant petal canopy',(6.1,4.8,5.0),2.65,.89,M['petal2'] if k%2 else M['petal'],angle,-.30,1.0)
    lamina('Flowers / scalloped upper petal',(6.1,4.8,5.1),2.0,.65,M['petal'] if k%2 else M['lavender'],angle+.30,-.38,1.03)
sphere('Flowers / joined blossom heart',(6.1,4.8,5.43),(.53,.53,.27),M['yellow'],24,14)
# A few clustered flowers below the canopy repeat its species and reveal its scale.
for x,y in [(5.1,2.3),(8.8,3.2),(4.1,4.25)]:
    curve('Flowers / grown cup stem',[(x,y,1.26),(x-.05,y,1.95),(x,y,2.5)],.052,M['fern'])
    for k in range(6):
        lamina('Flowers / grown cup petal',(x,y,2.50),.58,.24,M['petal2'] if k%2 else M['petal'],k*math.tau/6,-.10,.23)
    sphere('Flowers / grown cup center',(x,y,2.63),(.15,.15,.08),M['yellow'],12,8)

def surface_height(x,y):
    if not inside((x,y),outline):return None
    if inside((x,y),spring):
        if inside((x,y),pool):return None
        return 2.43
    if inside((x,y),grove) or inside((x,y),garden):return 1.25
    return .82

# Ground richness is grouped by habitat / contour, leaving the footpaths and doors open.
routes=[((-7,-5.8),(-2.2,-.5),.9),((-2.1,0),(-5.6,5),.7),((2,-.5),(7.2,3.1),.8),((3.1,-4.2),(8,-1),.8)]
homes=[(-7,-3.4),(-3.8,-3),(-5.1,-.5),(-7,4.6),(-4,6.6),(5.4,-3.5),(8.25,-1.9),(7.6,1.8)]
verts=[];faces=[];material_indices=[]
for i in range(500):
    x=random.uniform(-10.15,10.1);y=random.uniform(-6.7,8.35);z=surface_height(x,y)
    if z is None:continue
    if any(distance_to_segment(x,y,a,b)<w for a,b,w in routes):continue
    if any(math.hypot(x-a,y-b)<1.25 for a,b in homes):continue
    # Keep shared rooms empty enough to read / enter.
    if ((x+5.55)/1.8)**2+((y-3.4)/1.3)**2<1 or ((x-6.1)/1.8)**2+((y-3.55)/1.25)**2<1:continue
    for k in range(random.randint(3,6)):
        xx=x+random.uniform(-.18,.18);yy=y+random.uniform(-.18,.18);h=random.uniform(.10,.24);w=.025
        n=len(verts);verts.extend([(xx-w,yy,z),(xx+w,yy,z),(xx+random.uniform(-.10,.10),yy+.06,z+h)])
        faces.append((n,n+1,n+2));material_indices.append(i%2)
mesh=bpy.data.meshes.new('Ground / shared meadow grass mesh');mesh.from_pydata(verts,[],faces);mesh.update()
o=bpy.data.objects.new('Ground / clustered meadow grass',mesh);scene.collection.objects.link(o);finish(o,o.name,M['grassblade'],False)
mesh.materials.append(M['grasslight'])
for p,m in zip(mesh.polygons,material_indices):p.material_index=m

for x,y in [(-9.7,3.5),(-9,6),(-8.0,7.4),(-3.0,7.9),(-.2,8.65),(3.6,6.8),(8.1,6.4),(9.5,4),(3.2,-3.7),(6.3,-5.15),(-5.8,-6.65),(-9.4,-.1)]:
    z=surface_height(x,y)
    if z is None:continue
    for j in range(5):
        a=j*math.tau/5
        lamina('Ground / riverbank fern',(x,y,z),random.uniform(.42,.85),.16,M['willow3'] if j%2 else M['fern'],a,.17,.28)
    for j in range(4):
        xx=x+random.uniform(-.35,.35);yy=y+random.uniform(-.35,.35)
        flower('Garden / riverbank wildflower',xx,yy,z,random.uniform(.34,.56),M['lavender'] if j%2 else M['petal'])

# A low, layered stone edge makes the same courts part of the landscape.
for cx,cy,z,rx,ry in [(-5.55,3.4,1.24,2.4,1.72),(6.1,3.55,1.26,2.3,1.7)]:
    for j in range(9):
        a=j*math.pi/9
        soft_mass('Coast / garden court bank',(cx+rx*math.cos(a),cy+ry*math.sin(a),z-.07),(.31,.26,.13),M['springstone'],j)

# Existing houses are unchanged identities. Warm windows illuminate their actual entries.
for x,y,z in [(-7,-3.4,.81),(-3.8,-3,.81),(-5.1,-.5,.81),(-7,4.6,1.25),(-3.6,7.8,2.43),(5.4,-3.5,.81),(8.25,-1.9,.81),(7.6,1.8,1.25)]:
    data=bpy.data.lights.new('Life / window light','POINT');data.energy=9;data.color=(1,.63,.32);data.shadow_soft_size=.65
    o=bpy.data.objects.new('Life / window light',data);scene.collection.objects.link(o);o.location=(x,y-.92,z+1.1)

# A real subdivided, colored water surface: tide depth + broad pink sky reflection.
# Its plane stays under the true island, with no separate shallow-water cutout decal.
remove_where(lambda n:n=='Ocean / actual blue surface')
sea=material('sea / tide and sky water','#ffffff',.21)
p=next(n for n in sea.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
p.inputs['Metallic'].default_value=.22
col=sea.node_tree.nodes.new('ShaderNodeVertexColor');col.layer_name='Tide color'
sea.node_tree.links.new(col.outputs['Color'],p.inputs['Base Color'])
tex=sea.node_tree.nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=6;tex.inputs['Detail'].default_value=2.1;tex.inputs['Roughness'].default_value=.65
bump=sea.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.22;bump.inputs['Distance'].default_value=.022
sea.node_tree.links.new(tex.outputs['Fac'],bump.inputs['Height']);sea.node_tree.links.new(bump.outputs['Normal'],p.inputs['Normal'])
N=180;size=80;vs=[];fs=[];colors=[]
deep=(.32,.52,.72);near=(.39,.79,.82);dusk=(.66,.59,.75)
for j in range(N+1):
    y=(j/N-.5)*size
    for i in range(N+1):
        x=(i/N-.5)*size;d=min(distance_to_segment(x,y,a,b) for a,b in zip(outline,outline[1:]+outline[:1]))
        shore=math.exp(-d*.43)
        reflection=max(0,min(.62,(y+8)/37))
        wave=.014*math.sin(x*3.1+y*1.7)+.006*math.cos(x*6.1-y*3.2)
        vs.append((x,y,-.025+wave))
        ripple=.015*math.sin(x*4.2+y*5.1)+.012*math.cos(x*7.1-y*3.2)
        rgb=[deep[k]*(1-shore)+near[k]*shore for k in range(3)]
        rgb=[rgb[k]*(1-reflection)+dusk[k]*reflection+ripple for k in range(3)]
        colors.append(tuple(linear(max(0,min(1,v))) for v in rgb)+(1,))
for j in range(N):
    for i in range(N):
        a=j*(N+1)+i;fs.append((a,a+1,a+N+2,a+N+1))
mesh=bpy.data.meshes.new('Ocean / tide surface');mesh.from_pydata(vs,[],fs);mesh.update()
attribute=mesh.color_attributes.new(name='Tide color',type='FLOAT_COLOR',domain='POINT')
for point,rgba in zip(attribute.data,colors):point.color=rgba
mesh.color_attributes.active_color=attribute
o=bpy.data.objects.new('Ocean / tide and reflected sky',mesh);scene.collection.objects.link(o);finish(o,o.name,sea)

# The inlet has clear horizontal ripple arcs; the shoreline stays a genuine land edge.
for x,y,rx,ry in [(-.3,1.9,.60,.15),(.3,3.1,.48,.17),(.2,-2.5,1.05,.25),(2.0,-5.1,1.1,.24),(-8,-7.9,1.0,.16),(9.2,-5.9,1.0,.17)]:
    pts=[(x+rx*math.cos(a),y+ry*math.sin(a),.021) for a in [j*math.pi/22 for j in range(23)]]
    curve('Ocean / shore ripple',pts,.012,M['foam'])

# Lily leaves anchor a little resting place in the real upper spring.
for x,y,s in [(-1.6,7.5,.22),(-.2,7.35,.31),(-1.1,6.7,.25)]:
    sphere('Ocean / floating lily leaf',(x,y,2.378),(s,s*.88,.014),M['willow'],20,10)
bell_flower('Ocean / spring water blossom',-.2,7.35,2.40,.26)
scene['art_revision_reason']='native-01 rejected: reference is more fantastical; remake terrain, canopy, water and light as one place'
