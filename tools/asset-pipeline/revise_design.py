"""Run in Blender: revise(root, asset). Local design edits, no network or generation."""
import hashlib
import json
import math
from pathlib import Path
import bpy
import bmesh
import numpy as np
from mathutils import Vector, Matrix


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def enum(owner, prop, value):
    assert value in [i.identifier for i in owner.bl_rna.properties[prop].enum_items]
    return value


def stats(objects):
    points = [o.matrix_world @ v.co for o in objects for v in o.data.vertices]
    for o in objects:
        o.data.calc_loop_triangles()
    return {'triangles': sum(len(o.data.loop_triangles) for o in objects),
            'min': [min(v[i] for v in points) for i in range(3)],
            'max': [max(v[i] for v in points) for i in range(3)]}


def recolor(objects, aid):
    mappings = {
        'fence': {'green': (.58, .34, .13), 'purple': (.23, .12, .055)},
        'watering-can': {'green': (.12, .40, .42), 'purple': (.55, .32, .085), 'yellow': (.65, .43, .12)},
        'planter': {'purple': (.59, .20, .095)},
    }[aid]
    processed = set()
    for o in objects:
        for material in o.data.materials:
            if material in processed:
                continue
            processed.add(material)
            shader = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
            color = shader.inputs['Base Color']
            image = color.links[0].from_node.image.copy()
            image.name = aid + '-design-v2-color'
            pixels = np.empty(len(image.pixels), dtype=np.float32)
            image.pixels.foreach_get(pixels)
            rgba = pixels.reshape(-1, 4)
            rgb = rgba[:, :3].copy()
            r, g, b = rgb.T
            masks = {'green': (g > r * 1.08) & (g > b * .99),
                     'purple': (b > g * 1.07) & (r > g * 1.02),
                     'yellow': (r > g * 1.08) & (g > b * 1.3)}
            coverage = {}
            for key, target in mappings.items():
                mask = masks[key]
                luminance = rgb[mask].mean(axis=1)
                # Retain wood variation; reduce baked grain on enamel and ceramic.
                variation = .65 if aid == 'fence' else .18
                shading = np.clip(1 + (luminance - np.median(luminance)) * variation * 3, .65, 1.25)
                rgba[mask, :3] = np.clip(np.array(target) * shading[:, None], 0, 1)
                coverage[key] = int(mask.sum())
            image.pixels.foreach_set(pixels)
            image.pack()
            color.links[0].from_node.image = image
            for name, value in [('Roughness', .8 if aid == 'fence' else .52 if aid == 'planter' else .4),
                                ('Metallic', .08 if aid == 'watering-can' else 0)]:
                socket = shader.inputs[name]
                for link in list(socket.links):
                    material.node_tree.links.remove(link)
                socket.default_value = value
            if aid in ['watering-can', 'planter']:
                for node in material.node_tree.nodes:
                    if node.type == 'NORMAL_MAP':
                        node.inputs['Strength'].default_value = .06 if aid == 'watering-can' else 1.0
            print(aid, coverage)


def solid(name, rgb, rough=.4, metal=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    s = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    s.inputs['Base Color'].default_value = (*rgb, 1)
    s.inputs['Roughness'].default_value = rough
    s.inputs['Metallic'].default_value = metal
    return m


def mesh(scene, name, verts, faces, material, bevel=0):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    o = bpy.data.objects.new(name, data)
    scene.collection.objects.link(o)
    o.data.materials.append(material)
    if bevel:
        mod = o.modifiers.new('soft-edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
    return o


def box(scene, name, center, size, material, bevel=.008):
    verts = [(center[0]+x*size[0]/2, center[1]+y*size[1]/2, center[2]+z*size[2]/2)
             for x,y,z in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    return mesh(scene,name,verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],material,bevel)


def arch(scene, name, width, bottom, shoulder, front, back, material, bevel):
    shape = [(-width/2,bottom),(width/2,bottom),(width/2,shoulder)]
    shape += [(math.cos(i*math.pi/24)*width/2, shoulder+math.sin(i*math.pi/24)*width/2) for i in range(1,25)]
    n = len(shape)
    verts = [(x,y,z) for y in [front,back] for x,z in shape]
    faces = [tuple(range(n)),tuple(range(2*n-1,n-1,-1))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(scene,name,verts,faces,material,bevel)


def mailbox(scene, objects):
    for o in objects:
        bm=bmesh.new();bm.from_mesh(o.data)
        bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.00001,
                              plane_co=Vector((0,0,.575)),plane_no=Vector((0,0,1)),clear_outer=True,clear_inner=False)
        edges=[e for e in bm.edges if e.is_boundary and all(abs(v.co.z-.575)<.0001 for v in e.verts)]
        if edges:bmesh.ops.holes_fill(bm,edges=edges,sides=0)
        bm.to_mesh(o.data);bm.free();o.data.update()
    red=solid('warm-red-enamel',(.34,.055,.035),.28,.25)
    cream=solid('ivory-enamel',(.77,.67,.43),.32,.15)
    dark=solid('slot-and-door-seam',(.027,.035,.032),.65)
    brass=solid('brass-hardware',(.64,.38,.08),.27,.75)
    objects += [arch(scene,'mailbox-housing',.50,.565,.95,-.24,.25,red,.009),
                arch(scene,'single-front-door-seam',.458,.584,.94,-.252,-.238,dark,.004),
                arch(scene,'single-ivory-door',.43,.6,.936,-.265,-.25,cream,.006),
                box(scene,'single-mail-slot',(0,-.272,.91),(.22,.012,.025),dark,.005),
                box(scene,'single-brass-knob',(.137,-.291,.735),(.048,.049,.048),brass,.021),
                box(scene,'left-door-hinge',(-.20,-.273,.72),(.02,.022,.075),brass,.004)]
    # Apply modifiers and correct outward normals only on the new hand-built housing.
    for o in objects[1:]:
        deps=bpy.context.evaluated_depsgraph_get()
        evaluated=o.evaluated_get(deps)
        data=bpy.data.meshes.new_from_object(evaluated)
        o.modifiers.clear();o.data=data
        bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
        if o.name.startswith('mailbox-housing'):
            for face in data.polygons:
                face.use_smooth = abs(face.normal.y) < .8
    return objects


def revise(root, aid):
    assert aid in ['fence','watering-can','planter','mailbox']
    base=Path(root)/'assets'/('island-'+aid+'-v1');out=base/'design-v2';out.mkdir(exist_ok=True)
    source=base/'final/model.glb';source_hash=digest(source)
    scene=bpy.data.scenes.new(aid+'-design-v2');bpy.context.window.scene=scene
    bpy.ops.import_scene.gltf(filepath=str(source))
    objects=[o for o in scene.objects if o.type=='MESH']
    before=stats(objects)
    if aid=='mailbox':objects=mailbox(scene,objects)
    else:recolor(objects,aid)
    # Ground and center the edited bounds, without changing the approved scale.
    bounds=stats(objects);anchor=Vector(((bounds['min'][0]+bounds['max'][0])/2,(bounds['min'][1]+bounds['max'][1])/2,bounds['min'][2]))
    for o in objects:
        o.data.transform(Matrix.Translation(-anchor)@o.matrix_world);o.matrix_world=Matrix.Identity(4)
        o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    import io_scene_gltf2
    assert 'GLB' in [i[0] for i in io_scene_gltf2.get_format_items(None,bpy.context)]
    bpy.ops.export_scene.gltf(filepath=str(out/'model.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_apply=True)
    after=stats(objects);extent=max(after['max'][i]-after['min'][i] for i in range(3));target=Vector((0,0,(after['max'][2]+after['min'][2])/2))
    world=bpy.data.worlds.new(aid+'-studio');scene.world=world;world.use_nodes=True
    bg=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs[0].default_value=(.6,.6,.6,1);bg.inputs[1].default_value=.45
    for label,pos,power in [('key',(1,-2,3),700),('fill',(-2,-1,2),350),('rim',(1,2,3),500)]:
        data=bpy.data.lights.new(label,'AREA');data.energy=power*(extent/3)**2;data.size=extent*1.6
        light=bpy.data.objects.new(label,data);scene.collection.objects.link(light);light.location=target+Vector(pos)*extent;light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new('camera');data.type=enum(data,'type','ORTHO');data.ortho_scale=extent*1.55
    camera=bpy.data.objects.new('camera',data);scene.collection.objects.link(camera);scene.camera=camera
    scene.render.resolution_x=scene.render.resolution_y=720;scene.render.resolution_percentage=100;scene.render.film_transparent=True
    scene.render.image_settings.file_format=enum(scene.render.image_settings,'file_format','PNG')
    def render(name,direction):
        camera.location=target+Vector(direction)*extent;camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
    for name,direction in [('front',(1.4,-2.4,1.2)),('back',(-1.4,2.4,1.2)),('side',(2.5,0,.6)),('bottom',(0,-.3,-2.5))]:render(name,direction)
    for o in objects:o.hide_render=True
    previous=set(scene.objects);bpy.ops.import_scene.gltf(filepath=str(out/'model.glb'))
    imported=[o for o in scene.objects if o not in previous];check=stats([o for o in imported if o.type=='MESH'])
    assert check['triangles']==after['triangles']
    assert all(abs(check[k][i]-after[k][i])<1e-5 for k in ['min','max'] for i in range(3))
    render('reimport',(1.4,-2.4,1.2))
    arrays=[]
    for file in ['front.png','reimport.png']:
        image=bpy.data.images.load(str(out/file),check_existing=False);a=np.empty(len(image.pixels),dtype=np.float32);image.pixels.foreach_get(a);arrays.append(a);bpy.data.images.remove(image)
    error=float(np.abs(arrays[0]-arrays[1]).mean());assert error<.002,error
    for o in imported:bpy.data.objects.remove(o,do_unlink=True)
    for o in objects:o.hide_render=False
    assert digest(source)==source_hash
    report={'asset':aid,'candidate':'island-design-v2','source_sha256':source_hash,'final_sha256':digest(out/'model.glb'),'before':before,'after':after,'bytes':(out/'model.glb').stat().st_size,'roundtrip_render_error':error,'roundtrip_pass':True,'meshy_credits':0,'production_adoption':'NOT_INTEGRATED'}
    (out/'verification.json').write_text(json.dumps(report,indent=2)+'\n')
    for area in bpy.context.screen.areas:
        if area.type=='VIEW_3D':
            space=area.spaces.active;space.shading.type=enum(space.shading,'type','MATERIAL');space.overlay.show_overlays=False;space.region_3d.view_location=target;space.region_3d.view_distance=extent*2.7
    bpy.data.libraries.write(str(out/'editable.blend'), {scene})
    print(json.dumps(report));return report


def pack(root, aid):
    base=Path(root)/'assets'/('island-'+aid+'-v1')/'design-v2'
    source=base/'model.glb';source_hash=digest(source)
    scene=bpy.data.scenes.new(aid+'-design-v2-light');bpy.context.window.scene=scene
    bpy.ops.import_scene.gltf(filepath=str(source))
    objects=[o for o in scene.objects if o.type=='MESH'];before=stats(objects)
    images={}
    for o in objects:
        for material in o.data.materials:
            for n in material.node_tree.nodes:
                if n.type=='TEX_IMAGE' and n.image:
                    original=n.image
                    if original not in images:
                        im=original.copy();ratio=min(1,1024/max(im.size));im.scale(max(1,round(im.size[0]*ratio)),max(1,round(im.size[1]*ratio)));im.pack();images[original]=im
                    n.image=images[original]
        o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    import io_scene_gltf2
    assert 'GLB' in [i[0] for i in io_scene_gltf2.get_format_items(None,bpy.context)]
    bpy.ops.export_scene.gltf(filepath=str(base/'model-1024.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_apply=True)
    import runpy
    runpy.run_path(str(Path(root)/'tools/asset-pipeline/optimize_textures.py'))['preserve_geometry'](source,base/'model-1024.glb',base/'model-1024.glb')
    assert digest(source)==source_hash
    print(json.dumps({'asset':aid,'master':source_hash,'light':digest(base/'model-1024.glb'),'triangles':before['triangles']}))
