"""Native-05: living colour, mineral water and tinted light in actual 3D.

The previous white pastel version is an explicit preserved input. No resident
mesh, cloth atlas, original home geometry, or world scale is changed here.
"""
terrain=bpy.data.objects['Island / continuous sculpted mature terrain']
palette={
 'ground / fresh soft meadow':'#A4CB87','ground / higher garden':'#8DB79F',
 'hill / silvery meadow':'#91BBA9','harbor / light seaside meadow':'#B1C98C',
 'sculpted tree wood':'#AE7954','young branches':'#BD926E','house / honey wood':'#B98B62',
 'path / light sandstone':'#CCC9D4','path / warm stone variation':'#AFA9BA',
 'house / sky blue roof':'#629ACC','house / coral roof':'#DA83A4','house / warm yellow roof':'#DDB96B',
 'hill / lavender joined roof':'#9588C6',
 'willow / pale blue jade leaves':'#69B8AA','willow / fresh mint tips':'#9BCA8B','willow / cool shade leaves':'#60A89B',
 'grove / silver blue evergreen':'#589C9C','grove / light evergreen tips':'#89B8A4',
 'grove / airy golden birch leaves':'#D3BB73',
 'flowers / soft lilac petals':'#A091D4','flowers / warm pink upper petals':'#D391B8','flowers / porcelain lower petals':'#E5A9BA',
 'grove / pale raised leaf veins':'#D2B187','grove / blue silver leaf tips':'#89C0C9',
 'garden / porcelain water terraces':'#8295BA','garden / pearl terrace lip':'#AD9BC9',
 'water / falling jade water':'#50B5CA','water / thin waterfall highlights':'#A9E4DF',
 'harbor / translucent pearl shell':'#679DCB','harbor / coral shell ribs':'#BB84AE',
 'harbor / blue porcelain shell footing':'#7DACC2',
 'home / scalloped blue cap':'#6F9BC5','home / curled jade leaf roof':'#68B6A8',
}
for name,color in palette.items():
    if mat:=bpy.data.materials.get(name):recolor(mat,color)

def rgb_linear(hex_color):return tuple(linear(int(hex_color[i:i+2],16)/255) for i in (1,3,5))
def vertex_paint_material(name,layer,rough=.48):
    mat=material(name,'#FFFFFF',rough)
    bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    attr=mat.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name=layer
    mat.node_tree.links.new(attr.outputs['Color'],bsdf.inputs['Base Color'])
    return mat

# The wide leaves have a coloured lamina, not a white mass under coloured lamps.
leaf_material=vertex_paint_material('grove / living violet and jade lamina','Living leaf colour',.50)
for i,obj in enumerate(o for o in scene.objects if o.name.startswith('Grove / broad silver fan leaf')):
    obj.data.materials.clear();obj.data.materials.append(leaf_material)
    attr=obj.data.color_attributes.new(name='Living leaf colour',type='FLOAT_COLOR',domain='POINT')
    low=rgb_linear('#6B58A1' if i%3 else '#548AA7')
    high=rgb_linear('#85C8AF' if i%3 else '#CA91BB')
    ymin=min(v.co.y for v in obj.data.vertices);ymax=max(v.co.y for v in obj.data.vertices)
    for v,pixel in zip(obj.data.vertices,attr.data):
        t=(v.co.y-ymin)/(ymax-ymin);t=.15+.85*t
        shade=1-.08*min(1,abs(v.co.x))
        pixel.color=tuple((low[k]*(1-t)+high[k]*t)*shade for k in range(3))+(1,)
    obj.data.color_attributes.active_color=attr
    obj['colour_role']='violet / jade living canopy; visible in daylight'

# The headwater terraces are mineral pools, with actual coloured water geometry.
basins=[(4.35,18.2,1.48,1.42,5.42),(2.55,15.95,1.66,1.26,4.76),(.95,13.15,1.78,1.19,3.74)]
water_material=vertex_paint_material('water / mineral blue tiered springs','Spring depth colour',.13)
for i,(cx,cy,rx,ry,h) in enumerate(basins):
    bowl=bpy.data.objects['Hill / open water terrace '+str(i+1)]
    for vertex in bowl.data.vertices:
        x,y,z=vertex.co
        a=math.atan2((y-cy)/ry,(x-cx)/rx)
        rough=.018*math.sin(a*9+i*.8)+.012*math.cos(a*5)
        vertex.co.x+=(x-cx)*rough;vertex.co.y+=(y-cy)*rough
    bowl.data.update()
    remove_where(lambda n:n=='Ocean / joined terrace pool '+str(i+1))
    verts=[(cx,cy,h)];colours=[rgb_linear('#287CA6')+(1,)];faces=[];n=72;rings=12
    for j in range(1,rings+1):
        r=j/rings
        for k in range(n):
            a=k*math.tau/n;x,y=basin_shape(a,cx,cy,rx*.875*r,ry*.875*r)
            ripple=.004*math.sin(x*6.8+y*4.1)+.003*math.cos(x*4-y*6)
            verts.append((x,y,h+ripple))
            deep=rgb_linear('#287CA6');near=rgb_linear('#69C9CD');t=r*r
            colours.append(tuple(deep[l]*(1-t)+near[l]*t for l in range(3))+(1,))
    for k in range(n):faces.append((0,1+k,1+(k+1)%n))
    for j in range(rings-1):
        a=1+j*n;b=a+n
        for k in range(n):faces.append((a+k,b+k,b+(k+1)%n,a+(k+1)%n))
    obj=native_mesh('Ocean / joined terrace pool '+str(i+1),verts,faces,water_material)
    attr=obj.data.color_attributes.new(name='Spring depth colour',type='FLOAT_COLOR',domain='POINT')
    for pixel,rgba in zip(attr.data,colours):pixel.color=rgba
    obj.data.color_attributes.active_color=attr;obj['linked_terrace']=i+1

# One connected mineral grotto is the source of the garden, grown into its back bank.
amethyst=material('spring / mineral violet outer face','#8B78AF',.36)
mineral_blue=material('spring / mineral blue inner face','#6EABBF',.24)
mineral_light=material('spring / warm lilac seams','#B69ABD',.50)
cx,cy,z=4.35,19.18,5.26;n=14;verts=[];faces=[]
for yy in (cy-.36,cy+.62):
    for radius in (.83,1.36):
        for j in range(n+1):
            a=j*math.pi/n;r=radius*(1+.042*math.sin(j*2.3))
            verts.append((cx+r*math.cos(a),yy,z+r*math.sin(a)+.07*math.sin(j*1.4)))
for j in range(n):
    # Front/back annular faces, inner vault and weathered outside: a real opening.
    faces += [(j,j+1,n+2+j,n+1+j),
              (2*(n+1)+j,3*(n+1)+j,3*(n+1)+j+1,2*(n+1)+j+1),
              (j,2*(n+1)+j,2*(n+1)+j+1,j+1),
              (n+1+j,n+2+j,3*(n+1)+j+1,3*(n+1)+j)]
faces += [(0,n+1,3*(n+1),2*(n+1)),(n,2*(n+1)+n,3*(n+1)+n,n+1+n)]
grotto=native_mesh('Hill / grown mineral headwater grotto',verts,faces,amethyst,False)
grotto.data.materials.append(mineral_blue);grotto.data.materials.append(mineral_light)
for p in grotto.data.polygons:p.material_index=1 if p.index%4==2 else 2 if p.index%8==0 else 0
grotto['water_source_role']='an open mineral vault feeding the upper blue spring'
flowing_sheet('Inlet / mineral headwater feed',[(cx,cy+.02,5.68),(cx,cy-.27,5.66),(cx,cy-.46,5.43),(cx,cy-.72,5.42)],.36)

# Tinted shell panels retain their colour while transmitting the surroundings.
shell=bpy.data.objects['Harbor / continuous translucent shell hall']
violet_glass=material('harbor / translucent violet shell panels','#9B85BE',.19)
p=next(n for n in violet_glass.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
p.inputs['Transmission Weight'].default_value=.69;p.inputs['IOR'].default_value=1.38
shell.data.materials.append(violet_glass)
for poly in shell.data.polygons:
    x,y,z=poly.center
    poly.material_index=1 if z>2.85 and -.9<y<.55 else 0

# Colour the actual water against the actual grown coast, rather than whitening it.
ocean=bpy.data.objects['Ocean / tide and reflected sky'];attribute=ocean.data.color_attributes['Tide color']
coast=bpy.data.objects['Coast / continuous layered shore']
boundary=[(coast.data.vertices[i].co.x,coast.data.vertices[i].co.y) for i in range(0,len(coast.data.vertices),4)]
deep=rgb_linear('#388DAF');near=rgb_linear('#79D4D0');far=rgb_linear('#729CC2')
for vertex,pixel in zip(ocean.data.vertices,attribute.data):
    x,y,z=vertex.co;d=min(distance_to_segment(x,y,a,b) for a,b in zip(boundary,boundary[1:]+boundary[:1]))
    shallow=math.exp(-d*.40);sky_weight=max(0,min(.40,(y+5)/120))
    ripple=.004*math.sin(x*4.2+y*5.1)+.003*math.cos(x*7.1-y*3.2)
    colour=[deep[k]*(1-shallow)+near[k]*shallow for k in range(3)]
    pixel.color=tuple(max(0,colour[k]*(1-sky_weight)+far[k]*sky_weight+ripple) for k in range(3))+(1,)
scene.view_settings.exposure=0
scene['fantasy_colour_revision']='native-04 white pastel rejected; preserve violet / jade / blue / amber in daylight'
print('SANSU_3D_COLOURED_WORLD_CREATED',flush=True)
