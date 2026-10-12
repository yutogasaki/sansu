"""Separate native-05 shell derivative. Never writes approved inputs or app assets.

Run with Blender --background --python this_file. One editable source blend,
one shell-only GLB and geometry/source identity manifest are written beside it.
The Boolean cuts the actual solidified shell; export never omits triangles.
"""
import bpy, bmesh, math, json, hashlib
from pathlib import Path
from mathutils import Vector, geometry

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
ORIGINAL = REPO / 'docs/design/2026-10-10-island-final-3d'
CANDIDATE = 'native05-authored-cove-corner-v2'
SOURCE = ORIGINAL / 'whole-island.blend'
SOURCE_FILES = ['whole-island.blend', 'whole-island.glb', 'whole-island-render.png', 'varied-world.py', 'build-final-scene.py']
hashes = {name: hashlib.sha256((ORIGINAL/name).read_bytes()).hexdigest() for name in SOURCE_FILES}
assert hashes['whole-island.blend'] == 'd1c7bb078b8f4fafad97862fcd1d691e63cfbcce9c378f21da47ccd167139c2a'
assert hashes['whole-island.glb'] == '8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
prefixes = ('Harbor / continuous translucent shell hall', 'Harbor / curved shell structural rib', 'Harbor / shell longitudinal seam', 'Harbor / shell grown footing')
for obj in list(bpy.data.objects):
    if not obj.name.startswith(prefixes): bpy.data.objects.remove(obj, do_unlink=True)
scene['visual_candidate'] = CANDIDATE
scene['scope'] = 'source geometry only; app integration and art acceptance pending'
shell = bpy.data.objects['Harbor / continuous translucent shell hall']
ribmat = bpy.data.materials['harbor / coral shell ribs']
basemat = bpy.data.materials['harbor / blue porcelain shell footing']

def source_to_world(p):
    return Vector((8+(p[0]-13.9)*.45, .0475+(p[2]-.89)*.45, .50+(-p[1]-1.2)*.45))
def world_to_source(p):
    return Vector((13.9+(p[0]-8)/.45, -1.2-(p[2]-.50)/.45, .89+(p[1]-.0475)/.45))
def shell_point(a,t):
    return Vector((13.9+2.34*(1-.22*t)*math.cos(a), -1.2-1.58+3.32*t,
        .89+3.28*(1-.30*t)*math.sin(a)*(1+.026*math.cos(12*a))+.22*t*t))
def shell_at_height(t, wy):
    low, high = math.pi/2, math.pi
    for _ in range(70):
        a=(low+high)/2
        if source_to_world(shell_point(a,t)).y > wy: low=a
        else: high=a
    return shell_point((low+high)/2,t)
def t_at_z(z): return (1.211-z)/1.494
def set_active(obj):
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
def curve(name, coords, radius, material, radii=None):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.resolution_u=12
    data.bevel_depth=radius;data.bevel_resolution=3;data.use_fill_caps=True
    s=data.splines.new('BEZIER');s.bezier_points.add(len(coords)-1)
    for i,(point,coord) in enumerate(zip(s.bezier_points,coords)):
        point.co=coord;point.handle_left_type='AUTO';point.handle_right_type='AUTO'
        if radii:point.radius=radii[i]
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);data.materials.append(material)
    obj['candidate']=CANDIDATE
    return obj

# Slightly oversize the Boolean, allowing a 26 mm round structural rim to sit
# against its real reveal while retaining approximately the initial .64 x .72 clear profile.
CENTER_Z=-.25; WIDTH=.70; R=WIDTH/2; FLOOR=.025666217; SPRING=FLOOR+.43
APEX=SPRING+R; FRONT_Z=CENTER_Z+R
def opening_y(z): return SPRING+math.sqrt(max(0,R*R-(z-CENTER_Z)**2))
profile=[(CENTER_Z-R,-.20),(CENTER_Z+R,-.20),(CENTER_Z+R,SPRING)]
profile += [(CENTER_Z+R*math.cos(j*math.pi/80),SPRING+R*math.sin(j*math.pi/80)) for j in range(1,81)]
verts=[tuple(world_to_source((x,y,z))) for x in (6.6,7.8) for z,y in profile]
n=len(profile);faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
mesh=bpy.data.meshes.new('Corner aperture closed cutter');mesh.from_pydata(verts,[],faces);mesh.update()
mesh.materials.append(shell.data.materials[0])
bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
cutter=bpy.data.objects.new('Authoring / closed corner aperture cutter',mesh);scene.collection.objects.link(cutter)
cutter.display_type='WIRE';cutter.hide_render=True
set_active(shell)
for mod in list(shell.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
before_faces=len(shell.data.polygons)
mod=shell.modifiers.new('Actual rounded corner aperture with closed reveal','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
bpy.ops.object.modifier_apply(modifier=mod.name)
cutter.hide_set(True)
shell['source_thickness']=.043;shell['construction']='EXACT difference of original solidified mesh; closed reveal retained'

# Preserve the native right runner. The left runner becomes one continuous
# rising jamb/rim/rear arch, terminating at the retained right grounded runner.
left=bpy.data.objects['Harbor / shell grown footing']
assert left.data.splines[0].bezier_points[0].co.x < 13.9
bpy.data.objects.remove(left,do_unlink=True)
rear=bpy.data.objects['Harbor / curved shell structural rib.006'];bpy.data.objects.remove(rear,do_unlink=True)
front_t=t_at_z(FRONT_Z)
runner=[Vector((11.56,-2.78,.91)),Vector((11.75,-1.2,.89))]
jamb_ground=shell_point(math.pi,front_t)
# Existing dry court at the jamb; bury lower runner cross-section 8 mm.
jamb_ground.z=world_to_source((7,-.00899999+.0505,FRONT_Z)).z
runner += [jamb_ground]
jamb_top=shell_at_height(front_t,SPRING)
runner += [jamb_ground.lerp(jamb_top,.45),jamb_top]
arc=[]
rear_z=source_to_world(shell_point(0,1)).z
theta_end=math.acos((rear_z-CENTER_Z)/R)
for i in range(1,25):
    theta=theta_end*i/24;z=CENTER_Z+R*math.cos(theta);arc.append(shell_at_height(t_at_z(z),SPRING+R*math.sin(theta)))
runner += arc
rear_join=runner[-1]
rear_angle=math.atan2((rear_join.z-.89-.22)/ (3.28*.70), (rear_join.x-13.9)/(2.34*.78))
# Solve the actual corrugated surface, not its plain ellipse approximation.
low,high=math.pi/2,math.pi
for _ in range(70):
    a=(low+high)/2
    if shell_point(a,1).z > rear_join.z:low=a
    else:high=a
rear_angle=(low+high)/2
runner += [shell_point(rear_angle*(1-i/36),1) for i in range(1,37)]
radii=[.0585/.058,.0585/.058,.0585/.058,.035/.058,.026/.058]+[.026/.058]*24+[.0306/.058]*36
frame=curve('Harbor / continuous entrance runner jamb rear arch',runner,.058/.45,basemat,radii)
frame['continuous_support']='left original runner -> rising jamb -> rounded corner rim -> original rear arch -> right original runner'
frame['jamb_world_floor']=FLOOR

# Affected transverse rib stops at, and physically intersects, the new rim.
rib=bpy.data.objects['Harbor / curved shell structural rib.005'];bpy.data.objects.remove(rib,do_unlink=True)
t=5/6;z=source_to_world(shell_point(0,t)).z;join=shell_at_height(t,opening_y(z))
low,high=math.pi/2,math.pi
for _ in range(70):
    a=(low+high)/2
    if shell_point(a,t).z > join.z:low=a
    else:high=a
end=(low+high)/2
rib=curve('Harbor / corner structural rib joined to rim',[shell_point(end*i/30,t) for i in range(31)],.047,ribmat)
rib['joined_at_source']=list(join)

# Lower left longitudinal seams terminate on the same continuous frame.
for index in (5,6):
    name='Harbor / shell longitudinal seam.'+str(index).zfill(3)
    obj=bpy.data.objects[name];bpy.data.objects.remove(obj,do_unlink=True)
    a=index*math.pi/6
    def inside(t):
        p=source_to_world(shell_point(a,t))
        return abs(p.z-CENTER_Z)<=R and p.y<opening_y(p.z)
    low,high=0,1
    for _ in range(70):
        t=(low+high)/2
        if inside(t):high=t
        else:low=t
    end=(low+high)/2
    obj=curve('Harbor / longitudinal seam joined to corner rim '+str(index),[shell_point(a,end*i/18) for i in range(19)],.029,basemat)
    obj['joined_at_source']=list(shell_point(a,end))

# Closed continuous sockets bridge the native gently rising runners into the
# exact existing ground. Their upper cross-section overlaps the original round
# runners; lower edges follow the real terrain, buried 6 mm. No posts or sill.
ground=json.loads((ROOT/'ground-input.json').read_text())
def floor_at(x,z):
    heights=[]
    for triangle in ground['triangles']:
        a,b,c=triangle['points'];den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2])
        if abs(den)<1e-12:continue
        u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den
        v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;w=1-u-v
        if min(u,v,w)>=-1e-7:heights.append(u*a[1]+v*b[1]+w*c[1])
    assert heights,('Missing real footing ground',x,z)
    return max(heights)
socket_proofs=[]
for label,obj,segment_count in [('left',frame,2),('right',bpy.data.objects['Harbor / shell grown footing.001'],2)]:
    controls=obj.data.splines[0].bezier_points;path=[]
    for i in range(segment_count):
        a,b=controls[i:i+2];segment=geometry.interpolate_bezier(a.co,a.handle_right,b.handle_left,b.co,25)
        path+=segment if i==0 else segment[1:]
    vertices=[];bottoms=[]
    for index,p in enumerate(path):
        wp=source_to_world(p);prev=source_to_world(path[max(0,index-1)]);nxt=source_to_world(path[min(len(path)-1,index+1)])
        tangent=nxt-prev;normal=Vector((-tangent.z,0,tangent.x)).normalized()
        for side,top in [(-1,False),(1,False),(1,True),(-1,True)]:
            point=wp+normal*(.071 if not top else .034)*side
            point.y=wp.y-.021 if top else floor_at(point.x,point.z)-.006
            if not top:bottoms.append([point.x,point.y,point.z])
            vertices.append(tuple(world_to_source(point)))
    faces=[(3,2,1,0),tuple(range(len(vertices)-4,len(vertices)))]
    for i in range(len(path)-1):
        for side in range(4):faces.append((i*4+side,i*4+(side+1)%4,(i+1)*4+(side+1)%4,(i+1)*4+side))
    me=bpy.data.meshes.new('Native runner terrain socket '+label);me.from_pydata(vertices,[],faces);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    socket=bpy.data.objects.new('Harbor / continuous grounded runner socket '+label,me);scene.collection.objects.link(socket);me.materials.append(basemat)
    for poly in me.polygons:poly.use_smooth=True
    socket['support']='native round runner overlaps this closed terrain-fitted socket along its full lower path'
    socket_proofs.append({'name':socket.name,'bottom_vertices_world':bottoms,'buried_depth':.006,'cross_sections':len(path)})

objects=[o for o in scene.objects if o.type in {'MESH','CURVE'} and o != cutter]
qa=[]
depsgraph=bpy.context.evaluated_depsgraph_get()
for obj in objects:
    evaluated=obj.evaluated_get(depsgraph);me=evaluated.to_mesh()
    bm=bmesh.new();bm.from_mesh(me)
    qa.append({'name':obj.name,'vertices':len(me.vertices),'polygons':len(me.polygons),
        'boundary_edges':sum(e.is_boundary for e in bm.edges),'nonmanifold_edges':sum(not e.is_manifold for e in bm.edges),
        'materials':[m.name if m else None for m in obj.data.materials]})
    bm.free();evaluated.to_mesh_clear()
assert qa[0] or objects
shellqa=next(v for v in qa if v['name']==shell.name)
assert shellqa['boundary_edges']==0 and shellqa['nonmanifold_edges']==0, shellqa
assert len(shell.data.polygons)!=before_faces, 'Boolean did not change shell'
# Keep the cutter for editing, hidden and excluded from export. The blend keeps
# every native unchanged curve and all newly authored curves editable.
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'cove-corner-v2.blend'))
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:obj.select_set(True)
bpy.context.view_layer.objects.active=shell
bpy.ops.object.convert(target='MESH')
bpy.ops.export_scene.gltf(filepath=str(ROOT/'cove-corner-v2.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_cameras=False,export_lights=False)
assert hashes=={name:hashlib.sha256((ORIGINAL/name).read_bytes()).hexdigest() for name in SOURCE_FILES}, 'Original input changed'
manifest={'candidate':CANDIDATE,'scope':'editable source only; not app acceptance',
    'original_hashes':hashes,'original_inputs_unchanged':True,'source_transform':{'pivot_gltf':[13.9,.89,1.2],'position':[8,.0475,.50],'uniform_scale':.45,'yaw':0},
    'opening':{'cut_width':WIDTH,'cut_spring_world_y':SPRING,'cut_apex_world_y':APEX,'center_world_z':CENTER_Z,'front_world_z':FRONT_Z,'rim_world_radius':.026,'requested_initial_clear':[.64,.72]},
    'construction':{'shell_thickness_source':.043,'boolean':'EXACT solid difference; manifold closed reveal','continuous_frame_points':len(runner),'curves_editable_in_blend':True,'original_skin_materials_preserved':True},
    'geometry_qa':qa,'ground_sockets':socket_proofs,'ground_input_sha256':hashlib.sha256((ROOT/'ground-input.json').read_bytes()).hexdigest(),'outputs':{name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in ['cove-corner-v2.blend','cove-corner-v2.glb']}}
(ROOT/'source-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('SANSU_COVE_SOURCE_SAVED',json.dumps({'candidate':CANDIDATE,'shell':shellqa,'originals_unchanged':True}),flush=True)
