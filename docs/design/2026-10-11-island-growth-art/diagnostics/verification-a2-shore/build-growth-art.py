"""Author two whole-island states from the approved native-05, without editing it.

Run in a separate background Blender process. These are art studies, not saves.
The mature GLB/blend remain the exact approved files. New coasts, relief, walks,
young canopy, open shell and spring are genuine meshes with named assemblies.
"""
import ast, bpy, hashlib, json, math, os
from pathlib import Path
from mathutils import Vector, Matrix, geometry

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / '2026-10-10-island-final-3d'
MANIFEST = json.loads((ROOT.parent / '2026-10-10-native-art-transfer/module-manifest.json').read_text())
source_bytes = (SOURCE / 'whole-island.blend').read_bytes()
source_hash = hashlib.sha256(source_bytes).hexdigest()
# The real source hash is carried through the output; a pinned GLB guards lineage.
assert hashlib.sha256((SOURCE / 'whole-island.glb').read_bytes()).hexdigest() == MANIFEST['sourceSha256']

OUTLINES = {
 'small': [(-10.5,-4.6),(-7.7,-6.9),(-4.4,-7),(-2.1,-4.6),(-1.25,-2),(.18,-.6),
  (-.65,1.7),(-1.7,3.75),(-.85,5.35),(1.05,5.5),(2.05,4.0),(1.25,1.5),
  (2.9,-.9),(5.1,-2.25),(7.7,-1.3),(8.8,1.5),(8.3,4.7),(5.65,7.2),
  (2.6,8.7),(2.7,12.1),(1.5,15.4),(-.85,18.8),(-4.8,20),(-8.5,17.5),
  (-10.6,13.2),(-11.2,8),(-10.5,4.2),(-10.5,0)],
 'young': [(-10.5,-4.8),(-7.7,-7.4),(-4.2,-7.5),(-2,-5.2),(-1.25,-3),(.15,-.8),
  (-.7,1.2),(-1.7,3.7),(-.9,5.4),(.9,5.55),(1.9,4.1),(1.1,2),(.95,.1),
  (2.2,-1.7),(1.9,-4.2),(4.5,-6.1),(8.4,-5.5),(11.3,-4.95),
  (13.8,-5.8),(16.2,-4.2),(16.0,-1.8),(14.1,-.4),(12.4,2.4),
  (13.5,4.4),(15.8,4.0),(16.7,2.7),(17.55,.9),(18.2,3.8),(17.4,7.5),
  (15.3,10.5),(13.2,14.2),(9.0,17.5),(5.0,20.2),(.1,21.3),(-5.8,20),
  (-9.8,17.9),(-12.9,13),(-13.6,8.4),(-12.5,4.2),(-10.7,0)],
}

def area(poly):
    return abs(sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(poly,poly[1:]+poly[:1])))/2

def catmull(poly):
    out=[]
    for i,b in enumerate(poly):
        a,b,c,d=map(Vector,[poly[i-1],b,poly[(i+1)%len(poly)],poly[(i+2)%len(poly)]])
        for j in range(7):
            t=j/7;p=.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)
            out.append((p.x,p.y))
    return out

def centre(o):
    p=[o.matrix_world@Vector(c) for c in o.bound_box]
    return Vector(tuple((min(v[k] for v in p)+max(v[k] for v in p))/2 for k in range(3)))

def inside_growth_coast(x,y,poly):
    hit=False
    for a,b in zip(poly,poly[1:]+poly[:1]):
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:hit=not hit
    return hit

def move(o,delta):
    assert o.parent is None, 'The native art source must retain its flat transforms'
    # Keep authored Euler/scale bytes. Re-decomposing a matrix introduces drift.
    o.location+=Vector(delta)

def stretch(o,at,scale):
    o.matrix_world=Matrix.Translation(Vector(at))@Matrix.Diagonal((*scale,1))@Matrix.Translation(-Vector(at))@o.matrix_world

def color_tuple(code):
    return tuple(linear(int(code[i:i+2],16)/255) for i in (1,3,5))

def save_state(stage):
    global scene, terrain, M, world_objects, mat_cache
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE/'whole-island.blend'))
    scene=bpy.context.scene;bpy.context.preferences.filepaths.save_version=0
    scene['visual_candidate']='native05-growth-art-v2-'+stage
    scene['art_only']=True;scene['gameplay_mapped']=False
    scene['source_blend_sha256']=source_hash
    world_objects=[];mat_cache={m.name:m for m in bpy.data.materials}
    # Only import existing modeling functions and the material lookup, not a build.
    for file in ['build-scene.py','fantasy-landscape.py','varied-world.py']:
        for node in ast.parse((SOURCE/file).read_text()).body:
            if isinstance(node,ast.FunctionDef):
                exec(compile(ast.Module(body=[node],type_ignores=[]),file,'exec'),globals())
            elif file=='build-scene.py' and isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='M' for t in node.targets):
                exec(compile(ast.Module(body=[node],type_ignores=[]),file,'exec'),globals())
    terrain=bpy.data.objects['Island / continuous sculpted mature terrain']
    old_terrain=terrain
    def old_height(x,y):
        ok,p,normal,index=old_terrain.ray_cast(Vector((x,y,30)),Vector((0,0,-1)))
        return p.z if ok else .79
    factor=.43 if stage=='small' else .78
    spring_water=max(2.86,.79+(old_height(.95,13.15)-.79)*factor+.13)
    river=[(.95,13.15,spring_water),(.6,12.1,spring_water-.09),(.1,10.9,2.72),(-.45,9.2,2.51),(-.55,8.3,2.35)]
    def height(x,y):
        h=old_height(x,y)
        north=max(0,min(1,(y-8.6)/3.5))
        h=.79+(h-.79)*(1-(1-factor)*north)
        if stage=='small':
            d=math.hypot((x-.95)/1.95,(y-13.15)/1.65)
            w=math.exp(-d**6)
            h=h*(1-w)+(spring_water-.13)*w
        # The ribbon follows a real descending channel cut into the relief.
        for a,b in zip(river,river[1:]):
            dx=b[0]-a[0];dy=b[1]-a[1];t=max(0,min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)))
            d=math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)
            if d<.60:
                w=(1-d/.60)**2;z=a[2]*(1-t)+b[2]*t-.07
                h=h*(1-w)+z*w
        return h
    boundary=catmull(OUTLINES[stage])
    ids={n:m['id'] for m in MANIFEST['modules'] for n in m['sourceNames']}
    originals=[o for o in scene.objects if o.type in {'MESH','CURVE'}]
    homes={'home:original','home:Forest:blue home','home:Village:coral house'}
    if stage=='young':homes|={'home:Forest:yellow home','home:Garden:small home','home:Village:matured common house','home:Water town:blue home','home:Water town:coral home','home:Hill:blue terrace home'}
    unchanged_homes=[];kept=[];delete=[]
    for o in originals:
        name=o.name;id=ids.get(name,'unclassified');p=centre(o)
        o['source_native05_name']=name;o['art_assembly']=id
        keep=False
        if id.startswith('home:'):
            keep=id in homes
            if keep:
                module=next(m for m in MANIFEST['modules'] if m['id']==id)
                # Translation only: all cottage dimensions and identity are stable.
                c=sum((centre(bpy.data.objects[n]) for n in module['sourceNames']),Vector())/len(module['sourceNames'])
                move(o,(0,0,height(c.x,c.y)-old_height(c.x,c.y)))
                unchanged_homes.append(name)
        elif id.startswith('figure:'):
            keep=id in {'figure:Original Pokomoko','figure:Rabbit / forest court'} or stage=='young' and id=='figure:Pokomoko / bridge'
            # Author-provided figures retain exact geometry, UV and cloth.
        elif id=='sea':keep=name=='Ocean / tide and reflected sky'
        elif id=='land':
            keep=name in {'Island / living spring bank','Island / spring limestone foundation'} or stage=='young' and name=='Garden / rounded flower terrace'
            if 'softened rock' in name:keep=inside_growth_coast(p.x,p.y,boundary)
        elif id=='great-tree':
            if stage=='young':
                keep=not name.startswith(('Grove / spiral bough stair','Grove / spiral stair outer rail'))
                if keep:
                    stretch(o,(-4.8,17,old_height(-4.8,17)),(1,1,.76))
                    move(o,(0,0,height(-4.8,17)-old_height(-4.8,17)))
            elif name.startswith(('Grove / broad silver fan leaf','Grove / fan leaf raised midrib','Grove / fan crown grown bough')):
                keep=True
                # The same colored fan leaves cap a separately authored young stem.
                stretch(o,(-4.8,17,10.3),(.46,.46,.50))
                move(o,(0,0,height(-4.8,17)+3.1-10.3))
        elif id=='connections':
            keep=name.startswith(('Village / open shared route','Village / shared sunny court','Grove / route through mature canopy','Grove / spring stair','Inlet / forest garden bridge'))
            if stage=='young':keep|=name.startswith(('Inlet / neighborhood bridge','Garden / connected bank route','Water town / shared frontage','Whole island / grown living arch','Whole island / shared willow span'))
        elif id=='forest':
            keep=inside_growth_coast(p.x,p.y,boundary)
            if stage=='small' and name.startswith(('Grove / spire tree','Grove / silver birch')):
                keep=any(name.startswith(prefix) for prefix in ['Grove / spire tree 0 /','Grove / spire tree 2 /','Grove / silver birch 0 /','Grove / silver birch 2 /'])
            if name.startswith(('Grove / living willow 3','Grove / living willow 4')) and stage=='small':keep=False
            if keep:move(o,(0,0,height(p.x,p.y)-old_height(p.x,p.y)))
        elif id=='flower-garden':
            # The mature petal canopy is replaced by whole young flower plants.
            keep=inside_growth_coast(p.x,p.y,boundary) and name.startswith(('Garden / riverbank wildflower','Garden / connected flower mass','Flowers / grown habitat flowers'))
            if keep:move(o,(0,0,height(p.x,p.y)-old_height(p.x,p.y)))
        elif id=='terraced-spring':
            keep=name.startswith(('Ocean / actual sheltered spring','Ocean / floating lily leaf','Ocean / spring water blossom','Inlet / flowing spring sheet','Inlet / continuous spring waterfall','Inlet / soft spray foam','Inlet / spring impact ripple'))
        if keep:kept.append(o)
        else:delete.append(o)

    # Keep source terrain alive for height/raycast while the new top is authored.
    verts=[];faces=[];cache={}
    def vertex(p):
        key=(round(p.x,6),round(p.y,6))
        if key not in cache:cache[key]=len(verts);verts.append((p.x,p.y,height(p.x,p.y)))
        return cache[key]
    def subdivide(a,b,c,level):
        if level:
            ab=(a+b)/2;bc=(b+c)/2;ca=(c+a)/2
            for tri in [(a,ab,ca),(ab,b,bc),(ca,bc,c),(ab,bc,ca)]:subdivide(*tri,level-1)
        else:faces.append(tuple(vertex(p) for p in (a,b,c)))
    points=[Vector((x,y,0)) for x,y in boundary]
    for tri in geometry.tessellate_polygon([points]):subdivide(*(points[p] if isinstance(p,int) else p for p in tri),5)
    ground=bpy.data.materials['ground / fresh soft meadow'].copy();ground.name='growth / living meadow colour'
    bsdf=next(n for n in ground.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    attrnode=ground.node_tree.nodes.new('ShaderNodeVertexColor');attrnode.layer_name='Meadow colour'
    ground.node_tree.links.new(attrnode.outputs['Color'],bsdf.inputs['Base Color'])
    top=native_mesh('Growth / continuous sculpted '+stage+' island',verts,faces,ground)
    # A coast tessellation contains long, thin triangles. Their averaged face
    # normals made stripes across otherwise smooth hills. Derive shading from
    # the sampled relief instead, independent of each triangle's aspect ratio.
    normal_step=.24
    normals=[]
    for x,y,z in verts:
        dx=(height(x+normal_step,y)-height(x-normal_step,y))/(2*normal_step)
        dy=(height(x,y+normal_step)-height(x,y-normal_step))/(2*normal_step)
        normals.append(Vector((-dx,-dy,1)).normalized())
    top.data.normals_split_custom_set_from_vertices(normals)
    top['relief_normals']='height gradient / 0.24 world units'
    colors=top.data.color_attributes.new(name='Meadow colour',type='FLOAT_COLOR',domain='POINT')
    for v,pixel in zip(top.data.vertices,colors.data):
        x,y,z=v.co;w=max(0,min(1,(y-7)/12));a=color_tuple('#A4CB87');b=color_tuple('#82B9AD')
        d=.026*math.sin(x*.55+y*.32)+.018*math.cos(x*.8-y*.24)
        pixel.color=tuple(max(0,a[k]*(1-w)+b[k]*w+d) for k in range(3))+(1,)
    top.data.color_attributes.active_color=colors;top['art_assembly']='land';top['authored_coast_area']=area(boundary)
    coastverts=[];coastfaces=[]
    for x,y in boundary:
        h=height(x,y);coastverts.extend([(x,y,-.83),(x*1.002,y*1.002,-.03),(x,y,max(.16,h-.36)),(x*.998,y*.998,h-.014)])
    for i in range(len(boundary)):
        j=(i+1)%len(boundary)
        for k in range(3):coastfaces.append((i*4+k,j*4+k,j*4+k+1,i*4+k+1))
    shore=native_mesh('Growth / rounded layered '+stage+' coast',coastverts,coastfaces,M['sand'])
    for name in ['ridge / dusty violet limestone','ridge / light stratified stone']:shore.data.materials.append(bpy.data.materials[name])
    for p in shore.data.polygons:p.material_index=1 if p.center.y>9 and p.index%3==1 else 2 if p.center.y>9 and p.index%3==2 else 0
    bevel=shore.modifiers.new('weathered rounded shore','BEVEL');bevel.width=.055;bevel.segments=2
    shore['art_assembly']='land'

    # New paths lead to actual entries. They follow the authored ground as flat ribbons.
    def walk(name,xy,width):
        samples=[]
        for a,b in zip(xy,xy[1:]):
            for j in range(8):
                t=j/8;x=a[0]*(1-t)+b[0]*t;y=a[1]*(1-t)+b[1]*t
                samples.append((x,y,height(x,y)+.065))
        x,y=xy[-1];samples.append((x,y,height(x,y)+.065))
        o=path_strip('Growth / '+name,samples,width);o['art_assembly']='connections'
    walk('ridge approach',[(-8,7),(-8.7,10),(-7.7,12.5),(-5.6,14),(-4.8,15.45)],.74)
    walk('spring contour walk',[(-4.9,14),(-2.7,14.6),(-.5,14.0),(2.2,13.2),(2.3,11.5),(.1,9.5)],.62)
    if stage=='young':
        walk('hill village walk',[(4.2,7.5),(5.6,9.6),(6.5,11.7),(8.0,10.8),(9.4,11.8),(10.7,14.5)],.90)
        walk('cove landing walk',[(7.8,-2.0),(10,-2.4),(11.4,-3.8),(13.3,-3.5),(13.9,-2.5)],.78)

    if stage=='small':
        z=height(-4.8,17)
        curve('Growth / young fan tree living stem',[(-4.8,17,z),(-4.93,17,z+1.3),(-4.6,17,z+3.12)],.39,M['bark'],[1.45,.95,.38])
        for j in range(5):
            a=j*math.tau/5
            curve('Growth / young fan tree rooting',[(-4.8,17,z+.34),(-4.8+.6*math.cos(a),17+.6*math.sin(a),z+.08),(-4.8+.95*math.cos(a),17+.95*math.sin(a),height(-4.8+.95*math.cos(a),17+.95*math.sin(a))+.025)],.14,M['bark'],[1,.7,.06])

    # One/two real open mineral vessels become the original three-waterfall garden.
    spring_count=1 if stage=='small' else 2
    bowls=[(.95,13.15,1.42,1.05),(2.55,15.95,1.34,1.04)]
    spring_levels=[]
    springmat=bpy.data.materials['garden / porcelain water terraces']
    watermat=bpy.data.materials['water / mineral blue tiered springs']
    for i,(cx,cy,rx,ry) in enumerate(bowls[:spring_count]):
        waterz=spring_water if i==0 else height(cx,cy)+.13;spring_levels.append([cx,cy,waterz])
        vs=[];fs=[];n=64
        # Rounded bowl walls have a real open center, not a cap hiding the water.
        for radius,z in [(1.04,waterz-.23),(1.0,waterz+.14),(.87,waterz+.13),(.83,waterz-.16)]:
            for k in range(n):
                a=k*math.tau/n;r=radius*(1+.021*math.sin(a*7+i))
                vs.append((cx+rx*r*math.cos(a),cy+ry*r*math.sin(a),z))
        for band in range(3):
            for k in range(n):fs.append((band*n+k,band*n+(k+1)%n,(band+1)*n+(k+1)%n,(band+1)*n+k))
        o=native_mesh('Growth / open mineral spring '+str(i+1),vs,fs,springmat);o['art_assembly']='terraced-spring'
        ws=[(cx,cy,waterz)];wf=[];rgba=[color_tuple('#287CA6')+(1,)]
        for k in range(n):
            a=k*math.tau/n;ws.append((cx+rx*.855*math.cos(a),cy+ry*.855*math.sin(a),waterz));rgba.append(color_tuple('#69C9CD')+(1,))
        for k in range(n):wf.append((0,1+k,1+(k+1)%n))
        o=native_mesh('Growth / blue spring water '+str(i+1),ws,wf,watermat)
        ca=o.data.color_attributes.new(name='Spring depth colour',type='FLOAT_COLOR',domain='POINT')
        for pixel,c in zip(ca.data,rgba):pixel.color=c
        o.data.color_attributes.active_color=ca;o['art_assembly']='terraced-spring'
        curve('Growth / mineral spring lip '+str(i+1),[(cx+rx*1.015*math.cos(k*math.tau/48),cy+ry*1.015*math.sin(k*math.tau/48),waterz+.15) for k in range(48)],.046,bpy.data.materials['garden / pearl terrace lip'],cyclic=True)
    M['waterfall']=bpy.data.materials['water / falling jade water'];M['waterwhite']=bpy.data.materials['water / thin waterfall highlights']
    cx,cy,h=spring_levels[0]
    flowing_sheet('Growth / spring descending into original pool',river,.52)
    if stage=='young':
        x,y,z=spring_levels[1]
        flowing_sheet('Growth / two springs joined by water',[(x-.3,y-.55,z),(x-.65,y-1.1,z-.13),(1.75,14.4,height(1.75,14.4)+.06),(cx+.3,cy+.6,h)],.58)

    # Petals grow from planted trunks; a canopy is supported, never a floating icon.
    for i,(x,y,scale) in enumerate([(3.75,4.4,.80),(4.3,6.5,.55)] if stage=='small' else [(3.75,4.4,1.0),(4.3,6.5,.86),(6.55,6.9,.73)]):
        z=1.24 if stage=='young' else height(x,y)+.06;h=(2.6 if stage=='small' else 3.1)*scale
        curve('Growth / young flower trunk '+str(i),[(x,y,z),(x-.1,y,z+h*.65),(x+.14,y,z+h)],.31*scale,M['bark'],[1.3,.85,.28])
        for j in range(4):
            a=j*math.tau/4
            curve('Growth / young flower planted root '+str(i),[(x,y,z+.36),(x+.42*math.cos(a),y+.42*math.sin(a),z+.1),(x+.73*math.cos(a),y+.73*math.sin(a),z+.025)],.12*scale,M['bark'],[1,.8,.06])
        for j in range(6):
            a=j*math.tau/6
            mat=bpy.data.materials['flowers / warm pink upper petals' if j%2 else 'flowers / soft lilac petals']
            lamina('Growth / unfurling flower petal '+str(i),(x+.14,y,z+h),1.54*scale,.64*scale,mat,a,.22*scale,.68*scale)
        sphere('Growth / amber flower heart '+str(i),(x+.14,y,z+h+.09),(.23*scale,.23*scale,.14*scale),bpy.data.materials['house / warm yellow roof'],20,12)
        for j in range(3):
            a=j*math.tau/3
            curve('Growth / petal supporting branch '+str(i),[(x,y,z+h*.64),(x+.73*scale*math.cos(a),y+.73*scale*math.sin(a),z+h+.17)],.10*scale,M['bark2'],[1,.2])
        lamina('Growth / young flower leaf '+str(i),(x,y,z+.7),.94*scale,.25*scale,bpy.data.materials['willow / pale blue jade leaves'],i+.9,.11,.16)

    # The cove opens in the middle state. Its small shell is an open curved shelter.
    if stage=='young':
        cx,cy=13.9,-1.2;hz=height(cx,cy)
        vs=[];fs=[];na=40;nt=14
        for j in range(nt+1):
            t=j/nt
            for k in range(na+1):
                a=k*math.pi/na
                vs.append((cx+1.52*(1-.23*t)*math.cos(a),cy-.85+1.85*t,hz+.1+1.86*(1-.32*t)*math.sin(a)+.11*t*t))
        for j in range(nt):
            for k in range(na):a=j*(na+1)+k;fs.append((a,a+1,a+na+2,a+na+1))
        o=native_mesh('Growth / open young shell canopy',vs,fs,bpy.data.materials['harbor / translucent pearl shell']);o['art_assembly']='shell-hall'
        for j in [0,nt]:curve('Growth / young shell growing rib',[vs[j*(na+1)+k] for k in range(na+1)],.057,bpy.data.materials['harbor / coral shell ribs'])
        courtyard('Growth / small sheltered shell landing',cx,cy-.55,hz+.02,1.38,1.07)

    # Coast-dependent blue depth is re-painted on the true sea geometry.
    sea=bpy.data.objects['Ocean / tide and reflected sky']
    colors=sea.data.color_attributes['Tide color']
    deep=color_tuple('#388DAF');near=color_tuple('#79D4D0');far=color_tuple('#729CC2')
    for v,pixel in zip(sea.data.vertices,colors.data):
        x,y,z=v.co;d=min(distance_to_segment(x,y,a,b) for a,b in zip(boundary,boundary[1:]+boundary[:1]))
        w=math.exp(-d*.4);s=max(0,min(.4,(y+5)/120));r=.004*math.sin(x*4.2+y*5.1)+.003*math.cos(x*7.1-y*3.2)
        pixel.color=tuple(max(0,(deep[k]*(1-w)+near[k]*w)*(1-s)+far[k]*s+r) for k in range(3))+(1,)
    for o in delete:bpy.data.objects.remove(o,do_unlink=True)
    # Mark all added assemblies by real content, for later ownership/terrain mapping.
    for o in world_objects:
        if not o.get('art_assembly'):o['art_assembly']='flower-garden' if 'flower' in o.name or 'petal' in o.name else 'great-tree' if 'fan tree' in o.name else 'terraced-spring' if 'spring' in o.name else 'shell-hall'
    scene.camera.location=(39,-46,43);target=Vector((3,6.3,3.2))
    scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.camera.data.ortho_scale=46
    scene['comparison_camera']='native05 / unchanged 46-unit orthographic whole-island view'
    scene['authored_coast_area']=area(boundary);scene['illustrative_homes']=len(homes)
    bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/(stage+'-island.blend')))
    bpy.ops.object.select_all(action='DESELECT')
    curves=[o for o in scene.objects if o.type=='CURVE']
    for o in curves:o.select_set(True)
    if curves:bpy.context.view_layer.objects.active=curves[0];bpy.ops.object.convert(target='MESH')
    bpy.ops.object.select_all(action='DESELECT')
    for o in scene.objects:
        if o.type=='MESH':o.select_set(True)
    temporary=ROOT/('.building-'+stage+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(temporary),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_cameras=False,export_lights=False,export_extras=True)
    b=temporary.read_bytes();model=json.loads(b[20:20+int.from_bytes(b[12:16],'little')])
    os.replace(temporary,ROOT/(stage+'-island.glb'))
    result={'candidate':scene['visual_candidate'],'stage':stage,'sourceBlendSha256':source_hash,'sourceGlbSha256':MANIFEST['sourceSha256'],'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b),'meshes':len(model['meshes']),'rootNodes':len(model['scenes'][model.get('scene',0)]['nodes']),'triangles':sum(model['accessors'][p['indices']]['count']//3 for m in model['meshes'] for p in m['primitives']),'materials':len(model['materials']),'coastArea':round(area(boundary),3),'houses':len(homes),'springLevels':spring_levels,'riverCenterline':river,'landmarkAnchors':{'greatTree':[-4.8,17],'lowerSpring':[.95,13.15],'shellHall':[13.9,-1.2] if stage=='young' else None},'unchangedHouseGeometry':unchanged_homes,'illustrativeOnly':True}
    (ROOT/(stage+'-manifest.json')).write_text(json.dumps(result,indent=2))
    print('SANSU_GROWTH_ART_SAVED',stage,result['meshes'],result['triangles'],flush=True)
    return result

results=[save_state(s) for s in ['small','young']]
assert hashlib.sha256((SOURCE/'whole-island.blend').read_bytes()).hexdigest()==source_hash
assert hashlib.sha256((SOURCE/'whole-island.glb').read_bytes()).hexdigest()==MANIFEST['sourceSha256']
(ROOT/'art-manifest.json').write_text(json.dumps({'candidate':'native05-growth-art-v2','states':results,'mature':'../2026-10-10-island-final-3d/whole-island.glb','sourceUnchanged':True,'camera':'same native05 46-unit world scale','gameplayMapped':False},indent=2))
