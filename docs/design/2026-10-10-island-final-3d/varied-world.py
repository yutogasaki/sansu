"""Native-04: three different inhabited spaces, made from real geometry.

Loaded by build-final-scene.py on the explicitly preserved native-03 scene.
The original eight cottages and authored resident meshes are retained.
"""
terrain=bpy.data.objects['Island / continuous sculpted mature terrain']
M.update({
 'fan':material('grove / silver jade fan leaves','#80BFB6',.55),
 'fanlight':material('grove / blue silver leaf tips','#A6D2D9',.49),
 'fanvein':material('grove / pale raised leaf veins','#C2DFCF',.64),
 'terrace':material('garden / porcelain water terraces','#D7D6E8',.56),
 'terraceedge':material('garden / pearl terrace lip','#EBEAF4',.43),
 'terracewater':material('garden / clear blue terrace water','#83CADC',.14),
 'shell':material('harbor / translucent pearl shell','#C9DCEB',.19),
 'shellrib':material('harbor / coral shell ribs','#DFB4C3',.43),
 'shellbase':material('harbor / blue porcelain shell footing','#AFCCD7',.58),
 'cap':material('home / scalloped blue cap','#8AB9D8',.48),
 'leafroof':material('home / curled jade leaf roof','#9CCBC7',.47),
})
p=next(n for n in M['shell'].node_tree.nodes if n.type=='BSDF_PRINCIPLED')
p.inputs['Transmission Weight'].default_value=.72
p.inputs['IOR'].default_value=1.38
M['shell'].use_backface_culling=False

def native_mesh(name,verts,faces,mat,smooth=True):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    obj=bpy.data.objects.new(name,me);scene.collection.objects.link(obj)
    return finish(obj,name,mat,smooth)

def ground_at(x,y):
    ok,co,normal,index=terrain.ray_cast(Vector((x,y,30)),Vector((0,0,-1)))
    return co.z if ok else .79

def arch_prism(name,x,y,z,width,height,depth):
    r=width/2;spring=height-r
    profile=[(-r,0),(r,0),(r,spring)]
    profile += [(r*math.cos(j*math.pi/24),spring+r*math.sin(j*math.pi/24)) for j in range(1,25)]
    n=len(profile)
    verts=[(x+xx,y+yy,z+zz) for yy in (-depth/2,depth/2) for xx,zz in profile]
    faces=[tuple(range(n)),tuple(reversed(range(n,2*n)))]
    faces += [((i+1)%n,i,n+i,n+(i+1)%n) for i in range(n)]
    return native_mesh(name,verts,faces,M['wood'],False)

# FOREST: a genuine hollow trunk, a branch balcony, and a fan-leaf crown.
remove_where(lambda n:n.startswith(('Grove / great house apricot canopy','Grove / great house canopy bough','Grove / root house entry arch')))
tr=bpy.data.objects['Grove / great root house trunk']
tx,ty,tz=tr.data.splines[0].bezier_points[0].co
for obj in list(scene.objects):
    if obj.name.startswith('Grove / great house spreading root') and obj.data.splines[0].bezier_points[0].co.y<ty-.5:
        bpy.data.objects.remove(obj,do_unlink=True)
bpy.ops.object.select_all(action='DESELECT');tr.select_set(True);bpy.context.view_layer.objects.active=tr
bpy.ops.object.convert(target='MESH');tr=bpy.context.object
cutter=arch_prism('Temporary / root house interior cutter',tx-.1,ty-.90,tz+.025,1.38,2.15,2.9)
mod=tr.modifiers.new('actual habitable hollow','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
bpy.context.view_layer.objects.active=tr;bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cutter,do_unlink=True)
tr['habitable_cavity']=True;tr['cavity_width']=1.38;tr['cavity_height']=2.15
door=bpy.data.objects['Grove / root house cobalt entry'];door.location=(tx-.1,ty+.11,tz+.76)
floor=box('Grove / hollow dwelling floor',(tx-.1,ty-.32,tz+.08),(1.38,2.05,.12),M['wood'],.05)
floor['inside_hollow_trunk']=True
curve('Grove / hollow doorway grown edge',[(tx-.87,ty-1.12,tz+.08),(tx-.85,ty-1.12,tz+1.4),(tx-.1,ty-1.12,tz+2.24),(tx+.64,ty-1.12,tz+1.4),(tx+.66,ty-1.12,tz+.08)],.075,M['bark2'])
for j in range(3):
    yy=ty-1.23-j*.29
    box('Grove / hollow dwelling step',(tx-.1,yy,tz+.04-j*.045),(1.46,.35,.13),M['path'],.07)
for side in (-1,1):
    curve('Grove / grown doorway buttress',[(tx+side*1.73,ty-.73,ground_at(tx+side*1.73,ty-.73)+.03),(tx+side*1.08,ty-.65,tz+1.2),(tx+side*.90,ty-.24,tz+2.3)],.27,M['bark'],[.18,.7,1])

# An open crescent gallery is a continuous walk, visibly carried by branches.
verts=[];faces=[];gallery_points=[]
for j in range(61):
    a=-math.pi*.93+j/60*math.pi*1.75;zz=tz+2.48+j/60*.76
    for r in (1.32,2.03):verts.append((tx+r*math.cos(a),ty+r*math.sin(a),zz))
    gallery_points.append((tx+2.02*math.cos(a),ty+2.02*math.sin(a),zz+.61))
for j in range(60):faces.append((j*2,j*2+1,j*2+3,j*2+2))
gallery=native_mesh('Grove / continuous bough gallery',verts,faces,M['wood'])
mod=gallery.modifiers.new('walkable branch floor','SOLIDIFY');mod.thickness=.12
curve('Grove / crescent gallery handrail',gallery_points[::4]+[gallery_points[-1]],.035,M['bark2'])
for j in range(0,61,6):
    a=-math.pi*.93+j/60*math.pi*1.75;zz=tz+2.48+j/60*.76
    curve('Grove / gallery grown support',[(tx+1.35*math.cos(a),ty+1.35*math.sin(a),tz+1.2),(tx+1.55*math.cos(a),ty+1.55*math.sin(a),zz-.2),(tx+2.02*math.cos(a),ty+2.02*math.sin(a),zz+.60)],.075,M['bark2'],[1.3,1,.42])
# A stair curls around the trunk, linking the ground entry to the gallery.
for j in range(16):
    a=-math.pi*.60-j/15*math.pi*.34;r=1.84;zz=tz+.16+j/15*2.29
    obj=box('Grove / spiral bough stair',(tx+r*math.cos(a),ty+r*math.sin(a),zz),(.66,.36,.13),M['wood'],.04)
    obj.rotation_euler.z=a
curve('Grove / spiral stair outer rail',[(tx+2.14*math.cos(-math.pi*.60-j/15*math.pi*.34),ty+2.14*math.sin(-math.pi*.60-j/15*math.pi*.34),tz+.76+j/15*2.29) for j in range(16)],.035,M['bark2'])

for layer,count,length,width,z,drop in [(0,7,3.8,1.12,tz+6.7,.35),(1,5,3.15,.94,tz+5.45,.66)]:
    for j in range(count):
        a=j*math.tau/count+layer*.52
        dx,dy=-math.sin(a),math.cos(a)
        curve('Grove / fan crown grown bough',[(tx-.1,ty,tz+4.4),(tx+dx*.53,ty+dy*.53,z-.26),(tx+dx*2.15,ty+dy*2.15,z+.22)],.20,M['bark'],[1,.65,.12])
        leaf=lamina('Grove / broad silver fan leaf',(tx+dx*.45,ty+dy*.45,z),length,width,M['fan'] if (j+layer)%2 else M['fanlight'],a,drop,1.01)
        leaf['spatial_role']='wide layered crown above inhabited trunk'
        mid=[(tx+dx*(.45+length*t),ty+dy*(.45+length*t),z+1.01*math.sin(math.pi*t)-drop*t*t+.025) for t in [k/10 for k in range(11)]]
        curve('Grove / fan leaf raised midrib',mid,.034,M['fanvein'],[.5]+[1]*8+[.5,.08])

# HILL: actual three-level headwater basins with flowing sheets, not painted ponds.
remove_where(lambda n:n.startswith(('Ocean / connected hillside stream','Ocean / grown headwater pond','Ocean / grown lily leaf','Ocean / headwater flower','Coast / headwater rim','Inlet / upper stream crossing','Hill / headwater footpath')))
basins=[(4.35,18.2,1.48,1.42,5.42),(2.55,15.95,1.66,1.26,4.76),(.95,13.15,1.78,1.19,3.74)]
flows=[[(3.78,17.00,5.42),(3.44,16.66,5.41),(3.34,16.42,4.86),(3.13,16.32,4.76)],
       [(1.95,14.90,4.76),(1.60,14.57,4.74),(1.46,14.24,3.98),(1.33,14.05,3.74)],
       [(.60,12.04,3.74),(.18,11.58,3.71),(-.04,11.30,3.02),(-.40,10.50,2.74),(-.80,9.60,2.47),(-.60,8.60,2.35),(-.24,7.89,2.35)]]
# Refine only the water garden. Large old triangles otherwise interpolate dry land
# through the basin lip even when each sampled vertex has been carved correctly.
import bmesh
bm=bmesh.new();bm.from_mesh(terrain.data)
def near_water(x,y):
    return any(((x-cx)/rx)**2+((y-cy)/ry)**2<1.9**2 for cx,cy,rx,ry,h in basins) or any(distance_to_segment(x,y,a,b)<1.25 for pts in flows for a,b in zip(pts,pts[1:]))
edges=[e for e in bm.edges if any(near_water(v.co.x,v.co.y) for v in e.verts) or near_water(*tuple((e.verts[0].co+e.verts[1].co)/2)[:2])]
bmesh.ops.subdivide_edges(bm,edges=edges,cuts=2,use_grid_fill=True)
bm.to_mesh(terrain.data);bm.free();terrain.data.update()
def smooth01(t):
    t=min(1,max(0,t));return t*t*(3-2*t)
for v in terrain.data.vertices:
    x,y,z=v.co
    for cx,cy,rx,ry,h in basins:
        r=math.sqrt(((x-cx)/rx)**2+((y-cy)/ry)**2)
        if r<1.90:
            weight=1-smooth01((r-1.04)/.86)
            v.co.z=v.co.z*(1-weight)+(h-.25)*weight
    for pts in flows:
        for a,b in zip(pts,pts[1:]):
            dx=b[0]-a[0];dy=b[1]-a[1];sq=dx*dx+dy*dy
            t=max(0,min(1,((x-a[0])*dx+(y-a[1])*dy)/sq))
            dist=math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)
            if dist<.92:
                h=a[2]*(1-t)+b[2]*t
                weight=1-smooth01((dist-.38)/.54)
                v.co.z=v.co.z*(1-weight)+(h-.16)*weight
terrain.data.update();terrain['joined_water_terraces']=3
bpy.context.view_layer.update()

# Remove old grass triangles from the newly carved pools and stream beds.
meadow=bpy.data.objects['Ground / grown contour meadow']
vertices=[tuple(v.co) for v in meadow.data.vertices];faces=[]
for poly in meadow.data.polygons:
    x,y,z=poly.center
    in_pool=any(((x-cx)/rx)**2+((y-cy)/ry)**2<1.15**2 for cx,cy,rx,ry,h in basins)
    in_stream=any(distance_to_segment(x,y,a,b)<.48 for pts in flows for a,b in zip(pts,pts[1:]))
    if not (in_pool or in_stream):faces.append(tuple(poly.vertices))
me=bpy.data.meshes.new('Ground / dry contour meadow');me.from_pydata(vertices,[],faces);me.update()
for mat in meadow.data.materials:me.materials.append(mat)
meadow.data=me

# Open the hollow house and water-garden sightlines by moving two new birches.
for i,nx,ny in [(3,-9.3,17.5),(4,12.8,11.3)]:
    prefix='Grove / silver birch '+str(i)
    trunk=bpy.data.objects[prefix+' / white planted trunk']
    ox,oy,oz=trunk.data.splines[0].bezier_points[0].co
    delta=Vector((nx-ox,ny-oy,ground_at(nx,ny)-oz))
    for obj in scene.objects:
        if obj.name.startswith(prefix+' /'):obj.location+=delta

def basin_shape(a,cx,cy,rx,ry):
    swell=1+.055*math.cos(3*a)+.026*math.sin(5*a)
    return cx+rx*swell*math.cos(a),cy+ry*swell*math.sin(a)
for i,(cx,cy,rx,ry,h) in enumerate(basins):
    # Thick open bowls are grown into the sculpted land. The water is a separate thin surface.
    verts=[];faces=[];n=96
    rings=[(1.05,h-.51),(.99,h+.095),(.88,h+.07),(.83,h-.24)]
    for r,z in rings:
        for j in range(n):
            a=j*math.tau/n;x,y=basin_shape(a,cx,cy,rx*r,ry*r);verts.append((x,y,z))
    for layer in range(3):
        for j in range(n):faces.append((layer*n+j,layer*n+(j+1)%n,(layer+1)*n+(j+1)%n,(layer+1)*n+j))
    bowl=native_mesh('Hill / open water terrace '+str(i+1),verts,faces,M['terrace'])
    bowl.data.materials.append(M['terraceedge'])
    for poly in bowl.data.polygons:poly.material_index=1 if n<=poly.index<2*n else 0
    bowl['water_level']=h;bowl['open_retaining_bowl']=True
    ring=[basin_shape(j*math.tau/32,cx,cy,rx*.88,ry*.88) for j in range(32)]
    water=island_plate('Ocean / joined terrace pool '+str(i+1),ring,h,.018,M['terracewater'],.015)
    water['linked_terrace']=i+1
    # Broad layered banks provide somewhere to sit, without rings of loose props.
    for j in range(2):
        a=.35+j*.78
        x,y=basin_shape(a,cx,cy,rx*1.13,ry*1.13)
        o=box('Hill / terrace grown sitting ledge',(x,y,h-.17),(.75,.41,.18),M['terrace'],.09);o.rotation_euler.z=a
    # Only one local flower / lily mark per terrace, subordinate to the water shapes.
    lx,ly=cx+.26,cy+.23
    lamina('Ocean / terrace folded lily',(lx,ly,h+.035),.59,.25,M['willow'],.7,.03,.075)
    bell_flower('Ocean / terrace pearl lily',lx+.1,ly+.18,h+.04,.22)

def flowing_sheet(name,pts,width):
    samples=[];pts=list(map(Vector,pts))
    for i in range(len(pts)-1):
        a=pts[max(0,i-1)];b=pts[i];c=pts[i+1];d=pts[min(len(pts)-1,i+2)]
        for j in range(10):
            t=j/10
            co=.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)
            co.z=min(b.z,max(c.z,co.z));samples.append(co)
    samples.append(pts[-1]);verts=[];faces=[]
    for i,co in enumerate(samples):
        tangent=samples[min(i+1,len(samples)-1)]-samples[max(0,i-1)]
        side=Vector((-tangent.y,tangent.x,0)).normalized()*width
        for j in range(7):verts.append(tuple(co+side*(j/6-.5)+Vector((0,0,.008*math.sin(i*.7+j)))))
    for i in range(len(samples)-1):
        for j in range(6):a=i*7+j;faces.append((a,a+1,a+8,a+7))
    obj=native_mesh(name,verts,faces,M['waterfall'])
    obj['continuous_flow_sheet']=True
    for j in (1,3,5):
        curve(name+' / thin flow highlight',[verts[i*7+j] for i in range(0,len(samples),3)]+[verts[(len(samples)-1)*7+j]],.013,M['waterwhite'])
    return obj
for i,pts in enumerate(flows):flowing_sheet('Inlet / terrace connecting fall '+str(i+1),pts,.66 if i<2 else .62)
bridge('Inlet / terrace stream crossing',-.12,10.9,1.9,.76,3.12)

# Replace the old upper footpath, keeping an unobstructed way around the gardens.
path_strip('Hill / water garden contour walk',[(3.0,20.5,5.15),(1.0,18.8,5.13),(-.4,16.8,4.67),(-1.15,14.6,3.50),(-1.15,12.5,2.94),(-.9,11.4,2.87)],.68)
new_route_names={'Hill / winding village ascent','Grove / silver forest route','Grove / root house approach','Harbor / curving shared frontage','Harbor / headland route','Hill / water garden contour walk'}
for obj in scene.objects:
    if obj.name in new_route_names and obj.type=='MESH':
        for v in obj.data.vertices:
            world=obj.matrix_world@v.co;world.z=ground_at(world.x,world.y)+.056
            v.co=obj.matrix_world.inverted()@world
        obj.data.update();obj['projected_to_sculpted_ground']=True

# COVE: a continuous translucent shell vault, open to the shared waterside court.
remove_where(lambda n:n.startswith(('Harbor / joined petal shelter','Harbor / shelter grown support','Harbor / shelter front fascia')))
hx,hy,hz=13.9,-1.2,.79
def shell_point(a,t):
    rx=2.34*(1-.22*t);height=3.28*(1-.30*t)
    y=hy-1.58+3.32*t
    x=hx+rx*math.cos(a)
    z=hz+.10+height*math.sin(a)*(1+.026*math.cos(12*a))+.22*t*t
    return x,y,z
verts=[];faces=[];nt=28;na=72
for j in range(nt+1):
    for i in range(na+1):verts.append(shell_point(i*math.pi/na,j/nt))
for j in range(nt):
    for i in range(na):
        a=j*(na+1)+i;faces.append((a,a+1,a+na+2,a+na+1))
shell=native_mesh('Harbor / continuous translucent shell hall',verts,faces,M['shell'])
mod=shell.modifiers.new('real pearl shell thickness','SOLIDIFY');mod.thickness=.043
shell['shared_architecture']='one open waterside hall; translucent continuous ribbed vault'
shell['transmission_weight']=.72
for j in range(7):
    t=j/6
    curve('Harbor / curved shell structural rib',[shell_point(i*math.pi/24,t) for i in range(25)],.068 if j in (0,6) else .047,M['shellrib'])
for a in [i*math.pi/6 for i in range(7)]:
    curve('Harbor / shell longitudinal seam',[shell_point(a,j/8) for j in range(9)],.029,M['shellbase'])
for side in (-1,1):
    curve('Harbor / shell grown footing',[(hx+side*2.34,hy-1.58,hz+.12),(hx+side*2.15,hy,hz+.10),(hx+side*1.83,hy+1.74,hz+.32)],.13,M['shellbase'])
    box('Harbor / shell interior bench',(hx+side*1.63,hy-.15,hz+.34),(.37,1.5,.26),M['wood'],.08)
    curve('Harbor / shell interior bench back',[(hx+side*1.8,hy-.77,hz+.66),(hx+side*1.8,hy+.54,hz+.66)],.048,M['wood'])

# New districts use a shared vocabulary with two genuinely different home outlines.
def replace_home(name):
    old=bpy.data.objects[name+' / shared grounding'];at=tuple(old.location);rot=old.rotation_euler.z
    remove_where(lambda n:n.startswith(name+' /'))
    return at[0],at[1],at[2]-.05,rot

def round_home_body(name,x,y,z,rx,ry,h,rot):
    # A rounded vertical oval rather than an ellipsoid masquerading as a wall.
    verts=[];faces=[];n=64
    for height,r in [(0,.95),(.12,1),(h-.15,1),(h,.95)]:
        for j in range(n):
            a=j*math.tau/n;verts.append((rx*r*math.cos(a),ry*r*math.sin(a),height))
    faces.append(tuple(reversed(range(n))))
    for layer in range(3):
        for j in range(n):faces.append((layer*n+j,layer*n+(j+1)%n,(layer+1)*n+(j+1)%n,(layer+1)*n+j))
    faces.append(tuple(range(3*n,4*n)))
    body=native_mesh(name+' / rounded walls',verts,faces,M['wall']);body.location=(x,y,z);body.rotation_euler.z=rot
    return body

def round_home_details(name,x,y,z,rx,ry,rot):
    def local(a,b,c):return x+a*math.cos(rot)-b*math.sin(rot),y+a*math.sin(rot)+b*math.cos(rot),z+c
    door=arch_prism(name+' / cobalt entry',0,0,0,.60,1.08,.09)
    door.data.materials.clear();door.data.materials.append(M['door']);door.location=local(-.12,-ry-.04,.07);door.rotation_euler.z=rot
    curve(name+' / arched entry frame',[local(-.45,-ry-.10,.08),local(-.45,-ry-.10,.79),local(-.12,-ry-.10,1.18),local(.21,-ry-.10,.79),local(.21,-ry-.10,.08)],.038,M['wood'])
    for j in range(2):
        step=box(name+' / shared entrance step',local(-.12,-ry-.26-j*.21,.07-j*.04),(.92,.37,.12),M['path'],.07);step.rotation_euler.z=rot
    sphere(name+' / oval side window',local(rx*.74,-ry*.73,.91),(.21,.06,.29),M['glass'],24,14).rotation_euler.z=rot
    curve(name+' / oval window surround',[local(rx*.74+.22*math.cos(a*math.tau/24),-ry*.78,.91+.30*math.sin(a*math.tau/24)) for a in range(24)],.034,M['wood'],cyclic=True)

name='Hill / blue terrace home';x,y,z,rot=replace_home(name)
round_home_body(name,x,y,z,1.08,.94,1.60,rot)
verts=[];faces=[];rings=14;n=96
for j in range(rings+1):
    t=j/rings;r=1.74*math.sin(t*math.pi/2)
    for i in range(n):
        a=i*math.tau/n
        radius=r*(1+.025*t*t*math.cos(10*a))
        verts.append((radius*math.cos(a),radius*.90*math.sin(a),1.6+.86*math.cos(t*math.pi/2)+.10*math.cos(10*a)*t**4))
for j in range(rings):
    for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
cap=native_mesh(name+' / broad scalloped cap roof',verts,faces,M['cap']);cap.location=(x,y,z);cap.rotation_euler.z=rot
mod=cap.modifiers.new('thick rounded cap edge','SOLIDIFY');mod.thickness=.13
rim=[(x+verts[rings*n+i][0],y+verts[rings*n+i][1],z+verts[rings*n+i][2]) for i in range(0,n,3)]
curve(name+' / curled cap lip',rim,.055,M['fanlight'],cyclic=True)
round_home_details(name,x,y,z,1.08,.94,rot)

name='Harbor / peninsula home';x,y,z,rot=replace_home(name)
round_home_body(name,x,y,z,1.14,.95,1.65,rot)
# Two broad folded leaves form one habitable roof; long seams differ from gables and caps.
for j in (0,1):
    leaf=lamina(name+' / folded leaf roof',(x+(.14 if j else -.14),y-1.65,z+1.75),3.35,1.39,M['leafroof'] if j else M['fanlight'],.09 if j else -.09,-.05,.95)
    mod=leaf.modifiers.get('leaf thickness');mod.thickness=.08
    curve(name+' / grown roof midrib',[(x,y-1.65+3.35*t,z+1.75+.95*math.sin(math.pi*t)+.05*t*t+.04) for t in [k/16 for k in range(17)]],.042,M['fanvein'])
round_home_details(name,x,y,z,1.14,.95,rot)

scene['fantasy_spatial_variation']='hollow wood dwelling / flowing water terraces / translucent shell court'
scene['retained_original_homes']=8
print('SANSU_3D_VARIED_SPACES_CREATED',len(world_objects),flush=True)
