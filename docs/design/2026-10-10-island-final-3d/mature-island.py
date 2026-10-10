"""native-03: one larger, continuous island, at the existing resident/home scale.

This is art, not a new acquisition rule. The old eight homes stay in place.
Real sculpted terrain, connected paths/water and different collective silhouettes
make the extra area a journey instead of repeating another flat garden.
"""
random.seed(31010)
old_outline=outline[:]
outline=old_outline[:19]+[(11.6,-5.2),(14.5,-6.7),(17.6,-4.0),
 (16.8,-1.8),(14.3,-.4),(12.4,2.4),(13.5,4.4),(15.8,4.0),
 (16.8,1.5),(18.7,.6),(20,3.1),(19.3,7.3),(17.5,10.2),
 (18,13.7),(16.9,18.0),(13.1,21.2),(8.0,22.0),(3.0,21.0),
 (-1.4,21.8),(-5.8,20.0),(-9.8,17.9),(-12.9,13.0),
 (-14.0,8.4),(-12.5,4.2),(-10.7,0)]
def polygon_area(poly):
    return abs(sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(poly,poly[1:]+poly[:1])))/2
previous_area=polygon_area(old_outline);mature_area=polygon_area(outline)
M.update({
 'highgrass':material('hill / silvery meadow','#AFCDAD'),
 'limegrass':material('harbor / light seaside meadow','#BDCF8C'),
 'ridge':material('ridge / dusty violet limestone','#A3ADC1'),
 'ridge2':material('ridge / light stratified stone','#CDD0D8'),
 'pine':material('spire grove / blue teal foliage','#64A8AC'),
 'pine2':material('spire grove / bright jade foliage','#88C7B7'),
 'birch':material('silver birch / porcelain bark','#F0E8EC'),
 'birchmark':material('silver birch / bark markings','#8893A1'),
 'birchleaf':material('silver birch / pale gold leaves','#D6DBA0'),
 'roseleaf':material('hill / soft apricot foliage','#EDBCAC'),
 'lilacroof':material('house / lavender slate roof','#AFACD5'),
 'petaltile':material('harbor / overlapping petal roof','#F1B6BA'),
 'pond':material('water / clear sheltered jade','#7DBDCE',.17),
 'bluebell':material('water garden / blue iris petals','#8FAFDD',.58),
})

def smoothstep(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
river_points=[(-.55,8.1),(-.55,9.5),(.1,11.0),(1.5,12.7),
              (2.9,14.5),(3.7,16.0),(4.4,17.6)]
def raw_height(x,y):
    north=smoothstep(8.6,11.4,y)
    hill=5.05*math.exp(-((x-4.5)/8.8)**2-((y-15.7)/9.0)**2)
    silver=2.5*math.exp(-((x+7.5)/5.9)**2-((y-14.0)/6.8)**2)
    headland=1.65*smoothstep(9,13,x)*math.exp(-((x-16.7)/3.8)**2-((y-8.3)/5.8)**2)
    spring_link=1.72*smoothstep(8.0,9.0,y)*math.exp(-((x+.4)/3.0)**2-((y-9.8)/2.5)**2)
    return .79+north*(hill+silver)+headland+spring_link
hill_homes=[('Hill / blue terrace home',7.9,12.0,M['blue'],1.8,1.58,1,-.24),
            ('Hill / joined long home',9.6,15.2,M['lilacroof'],2.8,1.72,2,-.13),
            ('Hill / rose terrace home',6.8,18.9,M['red'],1.72,1.58,1,.18),
            ('Hill / upper yellow home',1.0,19.6,M['yellow'],1.8,1.64,2,.08),
            ('Harbor / corner blue home',12.0,-3.5,M['blue'],1.85,1.68,2,-.20),
            ('Harbor / coral porch home',14.6,-4.4,M['red'],1.92,1.68,1,.16),
            ('Harbor / peninsula home',17.4,3.2,M['lilacroof'],1.85,1.65,1,-.35)]
def terrain_height(x,y):
    h=raw_height(x,y)
    # Real, softly blended building pads rather than floating houses on a slope.
    for name,hx,hy,mat,w,d,stories,rot in hill_homes:
        r=math.hypot(x-hx,y-hy)
        h=h*(smoothstep(1.35,2.3,r))+raw_height(hx,hy)*(1-smoothstep(1.35,2.3,r))
    if y>8.4 and x<6:
        dist=min(distance_to_segment(x,y,a,b) for a,b in zip(river_points,river_points[1:]))
        h-=.40*math.exp(-(dist/.90)**2)*smoothstep(8.4,10.8,y)
    lake=((x-4.35)/1.45)**2+((y-18.2)/1.55)**2
    if lake<1.3:
        t=smoothstep(.65,1.3,lake);h=h*t+5.27*(1-t)
    return h

# Catmull boundary plus an actual subdivided top. No stacked flat expansion plates.
boundary=[]
for i in range(len(outline)):
    a=Vector(outline[i-1]);b=Vector(outline[i]);c=Vector(outline[(i+1)%len(outline)]);d=Vector(outline[(i+2)%len(outline)])
    for j in range(6):
        t=j/6;p=.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)
        boundary.append((p.x,p.y))
remove_where(lambda n:n in {'Island / continuous organic earthen coast','Island / soft grassy cap','Ocean / tide and reflected sky'})
topverts=[];topfaces=[];vertcache={}
def terrain_vertex(pt):
    key=(round(pt.x,6),round(pt.y,6))
    if key not in vertcache:
        vertcache[key]=len(topverts);topverts.append((pt.x,pt.y,terrain_height(pt.x,pt.y)))
    return vertcache[key]
def subdivide(a,b,c,level):
    if level:
        ab=(a+b)/2;bc=(b+c)/2;ca=(c+a)/2
        for v in [(a,ab,ca),(ab,b,bc),(ca,bc,c),(ab,bc,ca)]:subdivide(*v,level-1)
    else:topfaces.append(tuple(terrain_vertex(p) for p in (a,b,c)))
boundary_vectors=[Vector((x,y,0)) for x,y in boundary]
for tri in geometry.tessellate_polygon([boundary_vectors]):
    # Blender 5.2 returns indices; earlier mathutils returned Vector references.
    subdivide(*(boundary_vectors[p] if isinstance(p,int) else p for p in tri),5)
me=bpy.data.meshes.new('Island / continuous sculpted mature terrain');me.from_pydata(topverts,[],topfaces);me.update()
o=bpy.data.objects.new(me.name,me);scene.collection.objects.link(o);finish(o,o.name,M['grass'])
me.materials.append(M['highgrass']);me.materials.append(M['limegrass'])
for p in me.polygons:
    x,y,z=p.center
    p.material_index=1 if y>10 else 2 if x>11 else 0
o['existing_home_scale']='unchanged';o['growth_area_ratio']=mature_area/previous_area

# Coast layers follow the actual uneven top; the back is a hill, the front a beach.
vs=[];fs=[]
for x,y in boundary:
    h=terrain_height(x,y)
    vs.extend([(x,y,-.83),(x*1.002,y*1.002,-.03),(x,y,max(.16,h-.36)),(x*.998,y*.998,h-.012)])
for i in range(len(boundary)):
    j=(i+1)%len(boundary)
    for k in range(3):fs.append((i*4+k,j*4+k,j*4+k+1,i*4+k+1))
me=bpy.data.meshes.new('Coast / continuous layered shore');me.from_pydata(vs,[],fs);me.update()
o=bpy.data.objects.new(me.name,me);scene.collection.objects.link(o);finish(o,o.name,M['sand'])
me.materials.append(M['ridge']);me.materials.append(M['ridge2'])
for p in me.polygons:
    p.material_index=1 if p.center.y>9 and p.index%3==1 else 2 if p.center.y>9 and p.index%3==2 else 0
bev=o.modifiers.new('softened eroded coast','BEVEL');bev.width=.055;bev.segments=2

new_homes=[]
for name,x,y,mat,w,d,stories,rot in hill_homes:
    z=terrain_height(x,y)+.035
    cottage(name,x,y,z,mat,w=w,d=d,stories=stories,rot=rot);new_homes.append((x,y,z))
    # Joined gallery changes the long house's outline, rather than another color.
    if 'long' in name:
        box(name+' / common veranda',(x,y-1.04,z+.14),(3.10,.65,.18),M['wood'],.06)
        for xx in (-1.3,0,1.3):
            curve(name+' / veranda arch',[(x+xx-.28,y-1.12,z+.25),(x+xx-.28,y-1.12,z+1.65),(x+xx,y-1.12,z+1.94),(x+xx+.28,y-1.12,z+1.65)],.038,M['wood'])
        roof_mesh(name+' / connected gallery roof',3.0,.70,2.17,M['lilacroof'],0,(x,y-.96,z))

def contour_path(name,xy,width=.8):
    samples=[]
    for a,b in zip(xy,xy[1:]):
        for j in range(8):
            t=j/8;x=a[0]*(1-t)+b[0]*t;y=a[1]*(1-t)+b[1]*t
            samples.append((x,y,terrain_height(x,y)+.05))
    x,y=xy[-1];samples.append((x,y,terrain_height(x,y)+.05))
    return path_strip(name,samples,width)
contour_path('Hill / winding village ascent',[(5.2,8),(6.6,10),(7.8,10.8),(8,12.7),(10.9,13.4),(11.4,16.3),(9.4,17.7),(7.2,18),(5.8,19.8),(2.2,20.3)],1.0)
contour_path('Grove / silver forest route',[(-8,7),(-9.3,9),(-9.2,11.3),(-8,13),(-5.7,14.1),(-3.5,15.2),(-1.2,16.9),(1.0,18.2)],.8)
contour_path('Harbor / curving shared frontage',[(8,-2.0),(10.4,-2),(11.6,-4.6),(13.4,-5.45),(15.2,-4.9),(16.1,-3)],.95)
contour_path('Harbor / headland route',[(8.9,3.5),(10.7,4.8),(13.4,5.6),(16.1,5.9),(17.5,4.6)],.85)

# A river descends from the new headwater to the original spring, with real banks.
river_samples=[]
for a,b in zip(river_points,river_points[1:]):
    for j in range(8):
        t=j/8;x=a[0]*(1-t)+b[0]*t;y=a[1]*(1-t)+b[1]*t
        z=terrain_height(x,y)+.045 if y>9.3 else 2.34+(y-8.1)*.14
        river_samples.append((x,y,z))
river_samples.append((4.4,17.6,5.29))
path_strip('Ocean / connected hillside stream',river_samples,.70,M['pond'])
lake=[(4.35+1.25*math.cos(a*math.tau/18),18.2+1.33*math.sin(a*math.tau/18)) for a in range(18)]
island_plate('Ocean / grown headwater pond',lake,5.285,.024,M['pond'],.028)
for j in range(14):
    a=j*math.tau/14;x=4.35+1.47*math.cos(a);y=18.2+1.57*math.sin(a)
    soft_mass('Coast / headwater rim',(x,y,terrain_height(x,y)),(.31,.25,.22),M['ridge2'],j)
for a in range(6):
    t=a/5;x=4.1+.42*math.cos(a*2);y=18.1+.65*math.sin(a*2)
    sphere('Ocean / grown lily leaf',(x,y,5.327),(.16,.18,.018),M['fern'],16,8)
bell_flower('Ocean / headwater flower',4.6,18.3,5.36,.32)
contour_path('Hill / headwater footpath',[(2,20.2),(1.8,17.5),(2.9,16.6),(5.5,16.0),(7.7,15.7)],.7)
# A physically supported low arch carries the trail across the actual stream.
bridge('Inlet / upper stream crossing',2.8,14.25,2.2,.85,terrain_height(2.8,14.25)+.19)

def spire_tree(name,x,y,height):
    z=terrain_height(x,y)
    curve(name+' / slender grown trunk',[(x,y,z),(x-.08,y,z+height*.65),(x+.12,y,z+height)],.17,M['bark'],[1.25,.65,.10])
    # Curved scalloped tiers give a different species silhouette, not a sharp cone.
    for tier in range(4):
        zz=z+height*(.35+tier*.16);radius=height*(.28-tier*.047)
        vs=[];fs=[];segments=24
        for ring in range(5):
            t=ring/4;r=radius*(1-t)**.85
            for j in range(segments):
                a=j*math.tau/segments;rr=r*(1+.075*math.sin(a*6+tier))
                vs.append((x+rr*math.cos(a),y+rr*math.sin(a),zz+height*.30*t-.10*math.sin(a*6)**2*(1-t)))
        for ring in range(4):
            for j in range(segments):
                n=ring*segments+j;m=ring*segments+(j+1)%segments;fs.append((n,m,m+segments,n+segments))
        me=bpy.data.meshes.new(name+' / swept foliage tier');me.from_pydata(vs,[],fs);me.update()
        o=bpy.data.objects.new(me.name,me);scene.collection.objects.link(o);finish(o,o.name,M['pine'] if tier%2 else M['pine2'])

for i,(x,y,h) in enumerate([(-11.3,9.3,4.4),(-11.5,12.1,5.3),(-10.3,14.8,5.4),(-8.3,17.0,4.7),(-5.1,18.6,4.6),(-2.1,20.1,3.8),(-10.0,8.0,3.0)]):
    spire_tree('Grove / spire tree '+str(i),x,y,h)

def birch_tree(name,x,y,h,lean=.3):
    z=terrain_height(x,y)
    curve(name+' / white planted trunk',[(x,y,z),(x-.12,y,z+h*.45),(x+lean,y,z+h)],.16,M['birch'],[1.25,.88,.22])
    for j in range(6):
        zz=z+.45+j*h*.11
        curve(name+' / horizontal bark mark',[(x-.14,y-.105,zz),(x+.02,y-.14,zz+.015),(x+.11,y-.1,zz+.02)],.022,M['birchmark'])
    for j in range(3):
        angle=j*2.1+.3;xx=x+math.cos(angle)*.80;yy=y+math.sin(angle)*.65
        curve(name+' / white branching crown',[(x,y,z+h*.55),(xx,yy,z+h*.83),(xx+lean,yy,z+h)],.078,M['birch'],[1,.7,.12])
        soft_mass(name+' / airy golden crown',(xx+lean,yy,z+h),(.98,.70,.60),M['birchleaf'],j)
for i,(x,y,h) in enumerate([(-7.5,10.9,3.6),(-6.0,12.6,3.8),(-4.5,10.5,3.5),(-4.5,15.3,3.1),(-.5,13.3,3.4),(11.8,18.2,2.8)]):
    birch_tree('Grove / silver birch '+str(i),x,y,h,(-.4 if i%2 else .4))

# A single grown root-house is shared architecture on the ridge, visibly planted.
tx,ty=-4.8,17.0;tz=terrain_height(tx,ty)
curve('Grove / great root house trunk',[(tx,ty,tz),(tx-.5,ty+.15,tz+2.4),(tx-.1,ty,tz+5.1),(tx+.8,ty+.1,tz+7.0)],.88,M['bark'],[1.6,1.3,.85,.38])
for j in range(6):
    a=j*math.tau/6
    curve('Grove / great house spreading root',[(tx+math.cos(a)*2.1,ty+math.sin(a)*1.8,terrain_height(tx+math.cos(a)*2.1,ty+math.sin(a)*1.8)+.06),(tx+math.cos(a)*.8,ty+math.sin(a)*.7,tz+.65),(tx,ty,tz+1.55)],.32,M['bark'],[.14,.75,1.3])
# The entry/round windows are actual architecture within the grown trunk.
box('Grove / root house cobalt entry',(tx-.1,ty-1.06,tz+.81),(.87,.14,1.45),M['door'],.3)
curve('Grove / root house entry arch',[(tx-.63,ty-1.18,tz+.13),(tx-.61,ty-1.18,tz+1.35),(tx-.12,ty-1.18,tz+1.83),(tx+.42,ty-1.18,tz+1.35),(tx+.43,ty-1.18,tz+.13)],.075,M['wood'])
for x,z in [(tx+.52,tz+2.7),(tx-.18,tz+4.25)]:
    sphere('Grove / root house round window',(x,ty-.86,z),(.31,.075,.31),M['glass'],24,12)
    curve('Grove / root house window surround',[(x+.32*math.cos(a*math.tau/20),ty-.97,z+.32*math.sin(a*math.tau/20)) for a in range(20)],.04,M['wood'],cyclic=True)
for j,(dx,dy,dz,sx,sy,sz) in enumerate([(-1.8,.3,6.4,2.1,1.65,.95),(.7,.2,7.3,2.25,1.55,1.1),(2.3,.8,6.3,1.8,1.35,.9),(-.3,-.8,6.45,1.7,1.2,.85)]):
    curve('Grove / great house canopy bough',[(tx,ty,tz+4.5),(tx+dx*.5,ty+dy*.5,tz+5.8),(tx+dx,ty+dy,tz+dz)],.24,M['bark'],[1,.8,.18])
    soft_mass('Grove / great house apricot canopy',(tx+dx,ty+dy,tz+dz),(sx,sy,sz),M['roseleaf'] if j%2 else M['petal'],j)
contour_path('Grove / root house approach',[(-5.7,14.1),(-6.2,15.0),(-5.8,16.0),(-4.9,15.9)],.75)

# The harbor shares one folded shelter, open below its broad roof and beside water.
hx,hy=13.9,-1.2;hz=terrain_height(hx,hy)
courtyard('Harbor / shared waterfront court',hx,hy,hz+.035,2.0,1.35)
for x,y in [(12.3,-1.9),(15.4,-1.9),(12.3,-.5),(15.4,-.5)]:
    curve('Harbor / shelter grown support',[(x,y,terrain_height(x,y)),(x,y,hz+1.7),(hx+(x-hx)*.6,hy,hz+2.8)],.12,M['wood'],[1.5,1,.5])
for j in range(5):
    angle=(j-2)*.20
    petal=lamina('Harbor / joined petal shelter',(hx+(j-2)*.42,hy-1.40,hz+2.5),2.65,.47,M['petaltile'] if j%2 else M['petal2'],angle,-.06,.47)
    petal['collective_architecture']='five supports / one continuous open court'
curve('Harbor / shelter front fascia',[(12.1,-1.8,hz+2.3),(13.9,-2.0,hz+2.65),(15.8,-1.7,hz+2.3)],.08,M['wood'])
for i in range(14):
    h=.80-min(1,i/6)*.46
    box('Harbor / landing plank',(14.7,-1.45+i*.20,h),(1.22,.19,.12),M['wood'],.025)
for x in (14.18,15.22):
    for y in (-.95,1.1):box('Harbor / grounded landing pile',(x,y,.01),(.12,.12,1.1),M['wood'],.035)

# Two local blossom trees frame the new cove; they do not fill every empty view.
for i,(x,y,h) in enumerate([(16.0,7.4,3.3),(18.0,8.0,3.0),(12.2,7.1,2.7)]):
    z=terrain_height(x,y);trunk('Flowers / harbor blossom '+str(i),x,y,z,h,.25)
    for j in range(3):
        a=j*math.tau/3
        soft_mass('Flowers / harbor coral blossom',(x+.85*math.cos(a),y+.6*math.sin(a),z+h),(.93,.78,.55),M['petal2'] if j%2 else M['roseleaf'],j+i)
for x,y in [(10.9,4),(12.4,4.6),(15.8,3.7),(18.4,1.7)]:
    z=terrain_height(x,y)
    for j in range(4):
        a=j*math.tau/4;lamina('Flowers / inlet iris leaf',(x,y,z),.9,.12,M['fern'],a,.08,.25)
    for j in range(3):
        flower('Flowers / sheltered blue iris',x+.23*math.cos(j*2),y+.23*math.sin(j*2),z,.68,M['bluebell'])
for x,y in [(15.0,2.1),(15.6,2.7),(16.7,.6)]:
    sphere('Ocean / inlet lily leaf',(x,y,.045),(.32,.29,.02),M['willow'],20,10)
    bell_flower('Ocean / inlet lily flower',x,y,.08,.22)

# Ground plants are grouped along the new contours. Clear routes and doors stay.
additional_routes=[[(5.2,8),(8,12.7),(11.4,16.3),(7.2,18),(2.2,20.3)],
                   [(-8,7),(-9.2,11.3),(-5.7,14.1),(-1.2,16.9),(1,18.2)],
                   [(8,-2),(11.6,-4.6),(15.2,-4.9),(16.1,-3)],
                   [(8.9,3.5),(13.4,5.6),(17.5,4.6)]]
vs=[];fs=[]
for i in range(1700):
    x=random.uniform(-13,19.5);y=random.uniform(-5.8,21)
    if not inside((x,y),outline) or inside((x,y),old_outline):continue
    if any(math.hypot(x-a,y-b)<1.65 for a,b,c in new_homes):continue
    if any(distance_to_segment(x,y,a,b)<.75 for route in additional_routes for a,b in zip(route,route[1:])):continue
    if min(distance_to_segment(x,y,a,b) for a,b in zip(river_points,river_points[1:]))<.6:continue
    if ((x-4.35)/1.6)**2+((y-18.2)/1.7)**2<1:continue
    z=terrain_height(x,y)
    for j in range(4):
        xx=x+random.uniform(-.17,.17);yy=y+random.uniform(-.17,.17);h=random.uniform(.10,.24);n=len(vs)
        vs.extend([(xx-.025,yy,z),(xx+.025,yy,z),(xx+.05,yy+.045,z+h)]);fs.append((n,n+1,n+2))
me=bpy.data.meshes.new('Ground / grown contour meadow');me.from_pydata(vs,[],fs);me.update()
o=bpy.data.objects.new(me.name,me);scene.collection.objects.link(o);finish(o,o.name,M['grasslight'])
for i,(x,y) in enumerate([(-12,10),(-10.8,15),(-7.6,18.8),(-1.9,17.7),(2.9,20),(8,20.5),(11.7,14.1),(12.9,17.5),(17.1,10.5),(18.3,5.9),(10.2,-4.9),(16.4,-4.5)]):
    z=terrain_height(x,y)
    for j in range(5):
        a=j*math.tau/5
        lamina('Ground / grown fern patch',(x,y,z),random.uniform(.55,.90),.15,M['willow3'],a,.20,.3)
    for j in range(7):
        xx=x+random.uniform(-.6,.6);yy=y+random.uniform(-.5,.5)
        flower('Flowers / grown habitat flowers',xx,yy,terrain_height(xx,yy),random.uniform(.26,.48),M['lavender'] if i%2 else M['ivory'])

# Exact existing resident meshes/cloth at a few explicit illustrative positions.
resident('rabbit','Rabbit / hill path',8.6,12.9,terrain_height(8.6,12.9)+.05,.68,.35)
resident('fox','Fox / harbor court',13.4,-2,terrain_height(13.4,-2)+.05,.65,-.3)
resident('pokomoko','Pokomoko / silver forest',-5.9,13.8,terrain_height(-5.9,13.8)+.05,.76,.1)
for x,y,z in new_homes:
    data=bpy.data.lights.new('Life / grown window light','POINT');data.energy=9;data.color=(1,.63,.32);data.shadow_soft_size=.65
    o=bpy.data.objects.new(data.name,data);scene.collection.objects.link(o);o.location=(x,y-.92,z+1.1)

# Rebuild true water color against the enlarged shore, with ample extent for orbit.
sea=bpy.data.materials['sea / tide and sky water'];N=190;size=140;vs=[];fs=[];colors=[]
for j in range(N+1):
    y=(j/N-.5)*size
    for i in range(N+1):
        x=(i/N-.5)*size;d=min(distance_to_segment(x,y,a,b) for a,b in zip(outline,outline[1:]+outline[:1]));shore=math.exp(-d*.40)
        reflection=max(0,min(.52,(y+8)/65));wave=.014*math.sin(x*3.1+y*1.7)+.006*math.cos(x*6.1-y*3.2)
        vs.append((x,y,-.025+wave));ripple=.010*math.sin(x*4.2+y*5.1)+.008*math.cos(x*7.1-y*3.2)
        rgb=[deep[k]*(1-shore)+near[k]*shore for k in range(3)]
        rgb=[rgb[k]*(1-reflection)+dusk[k]*reflection+ripple for k in range(3)]
        colors.append(tuple(linear(max(0,min(1,v))) for v in rgb)+(1,))
for j in range(N):
    for i in range(N):
        a=j*(N+1)+i;fs.append((a,a+1,a+N+2,a+N+1))
me=bpy.data.meshes.new('Ocean / mature tide surface');me.from_pydata(vs,[],fs);me.update()
attr=me.color_attributes.new(name='Tide color',type='FLOAT_COLOR',domain='POINT')
for p,rgba in zip(attr.data,colors):p.color=rgba
me.color_attributes.active_color=attr
o=bpy.data.objects.new('Ocean / tide and reflected sky',me);scene.collection.objects.link(o);finish(o,o.name,sea)

# Read the actual triangulated surface, not just the analytic height function.
# Thin ribbons otherwise disappeared below a face interpolated across the slope.
terrain=bpy.data.objects['Island / continuous sculpted mature terrain']
for obj in scene.objects:
    is_stream=obj.name=='Ocean / connected hillside stream'
    is_route=obj.name in {'Hill / winding village ascent','Hill / headwater footpath',
        'Grove / silver forest route','Grove / root house approach',
        'Harbor / curving shared frontage','Harbor / headland route'}
    if not (is_stream or is_route):continue
    for v in obj.data.vertices:
        x,y,z=v.co
        if is_stream and y<9.1:continue
        hit,loc,normal,face=terrain.ray_cast(Vector((x,y,30)),Vector((0,0,-1)))
        if hit:v.co.z=loc.z+(.085 if is_stream else .055)
    obj.data.update();obj['surface_projected']=True
scene['art_revision_reason']='native-02 monotony question: preserve its homes and scale, sculpt one larger island with different connected landforms/habitats'
scene['growth_area_ratio']=mature_area/previous_area
print('SANSU_3D_MATURE_TERRAIN_BUILT',round(mature_area/previous_area,2),flush=True)
