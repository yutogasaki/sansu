"""Run process(state_path, asset_id) inside Blender, or use Blender --python ... -- STATE ASSET.
No generative or network calls. Source GLB is never modified. Rendering is inspection only.
"""
import json
import hashlib
import math
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector


def enum_value(owner, prop, value):
    values = [item.identifier for item in owner.bl_rna.properties[prop].enum_items]
    if value not in values:
        raise ValueError(f'{prop}: unsupported {value}; found {values}')
    return value


def mesh_stats(objects):
    result = {'meshes': len(objects), 'vertices': 0, 'triangles': 0}
    points = []
    for obj in objects:
        obj.data.calc_loop_triangles()
        result['vertices'] += len(obj.data.vertices)
        result['triangles'] += len(obj.data.loop_triangles)
        points.extend(obj.matrix_world @ vertex.co for vertex in obj.data.vertices)
    low = Vector([min(p[i] for p in points) for i in range(3)])
    high = Vector([max(p[i] for p in points) for i in range(3)])
    result.update(bounds_min=list(low), bounds_max=list(high), dimensions=list(high-low))
    return result


def process(state_path, asset_id):
    state = json.loads(Path(state_path).read_text())
    job = state['assets'][asset_id]
    if job['status'] not in ['DOWNLOADED', 'VERIFIED']:
        raise ValueError('Download must be recorded before Blender processing')
    base = Path(state['root']) / 'assets' / asset_id
    final = base / 'final'
    final.mkdir(parents=True, exist_ok=True)
    scene = bpy.data.scenes.new(asset_id + '-inspection')
    bpy.context.window.scene = scene
    bpy.ops.import_scene.gltf(filepath=str(base / 'meshy_raw/model.glb'))
    objects = [o for o in scene.objects if o.type == 'MESH']
    if not objects:
        raise ValueError('No mesh imported')
    before = mesh_stats(objects)
    yaw = float(job.get('yaw_degrees', 0))
    rotation = Matrix.Rotation(math.radians(yaw), 4, 'Z')
    for obj in objects:
        obj.matrix_world = rotation @ obj.matrix_world
    bpy.context.view_layer.update()
    oriented = mesh_stats(objects)
    if before['dimensions'][2] <= 0:
        raise ValueError('Invalid source height')
    low, high = Vector(oriented['bounds_min']), Vector(oriented['bounds_max'])
    anchor = Vector(((low.x+high.x)/2, (low.y+high.y)/2, low.z))
    scale = job['target_height'] / (high.z-low.z)
    # Bake the existing world transform and uniform scale into geometry, preserving UVs/materials.
    for i, obj in enumerate(objects):
        transform = Matrix.Scale(scale, 4) @ Matrix.Translation(-anchor) @ obj.matrix_world
        obj.parent = None
        obj.data.transform(transform)
        obj.matrix_world = Matrix.Identity(4)
        obj.name = f'{asset_id}-{i+1}'
        obj.data.name = obj.name + '-mesh'
        obj.data.update()
        for material in obj.data.materials:
            material.name = asset_id + '-PBR'
    bpy.context.view_layer.update()
    after = mesh_stats(objects)
    assert abs(after['bounds_min'][2]) < 1e-5
    assert abs(after['dimensions'][2] - job['target_height']) < 1e-5
    assert after['triangles'] == before['triangles']
    for obj in scene.objects:
        obj.select_set(obj in objects)
    bpy.context.view_layer.objects.active = objects[0]
    # Dynamic enum: RNA can return empty/default NONE on Blender 5.2.
    import io_scene_gltf2
    formats = [item[0] for item in io_scene_gltf2.get_format_items(None, bpy.context)]
    if 'GLB' not in formats:
        raise ValueError('Blender glTF exporter does not support GLB')
    bpy.ops.export_scene.gltf(filepath=str(final/'model.glb'), export_format='GLB',
                             use_selection=True, use_active_scene=True,
                             export_yup=True, export_apply=True)
    extent = max(after['dimensions'])
    target = Vector((0, 0, job['target_height']/2))
    camera_data = bpy.data.cameras.new(asset_id+'-camera')
    camera_data.type = enum_value(camera_data, 'type', 'ORTHO')
    camera_data.ortho_scale = extent * 1.55
    camera = bpy.data.objects.new(asset_id+'-camera', camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    # World/area lighting is fixed across every asset, scaled for equal exposure.
    world = bpy.data.worlds.new(asset_id+'-studio')
    scene.world = world
    world.use_nodes = True
    background = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
    color = next(s for s in background.inputs if s.type == 'RGBA')
    strength = next(s for s in background.inputs if s.type == 'VALUE')
    color.default_value = (0.6, 0.6, 0.6, 1)
    strength.default_value = 0.45
    for name, position, power in [('key',(1,-2,3),700), ('fill',(-2,-1,2),350), ('rim',(1,2,3),500)]:
        data = bpy.data.lights.new(asset_id+'-'+name, 'AREA')
        data.energy = power * (extent/3)**2
        data.size = extent * 1.6
        light = bpy.data.objects.new(asset_id+'-'+name, data)
        scene.collection.objects.link(light)
        light.location = target + Vector(position)*extent
        light.rotation_euler = (target-light.location).to_track_quat('-Z','Y').to_euler()
    scene.render.resolution_x = scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = enum_value(scene.render.image_settings, 'file_format', 'PNG')

    def render(name, direction):
        camera.location = target + Vector(direction)*extent
        camera.rotation_euler = (target-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath = str(final/(name+'.png'))
        bpy.ops.render.render(write_still=True)

    render('front', (1.4,-2.4,1.2))
    render('back', (-1.4,2.4,1.2))
    render('side', (2.5,0,0.6))
    render('bottom', (0,-0.3,-2.5))
    # Round trip in the same lighting; hide the source meshes only while validating.
    for obj in objects:
        obj.hide_render = True
    before_ids = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(final/'model.glb'))
    reimported = [o for o in scene.objects if o not in before_ids]
    check_meshes = [o for o in reimported if o.type=='MESH']
    check = mesh_stats(check_meshes)
    assert len(reimported) == len(objects), 'Unexpected non-mesh objects in GLB'
    assert check['triangles'] == after['triangles']
    assert all(abs(a-b)<1e-5 for a,b in zip(check['dimensions'],after['dimensions']))
    render('reimport', (1.4,-2.4,1.2))
    import numpy as np
    a = bpy.data.images.load(str(final/'front.png'), check_existing=False)
    b = bpy.data.images.load(str(final/'reimport.png'), check_existing=False)
    pixels_a = np.empty(len(a.pixels), dtype=np.float32); a.pixels.foreach_get(pixels_a)
    pixels_b = np.empty(len(b.pixels), dtype=np.float32); b.pixels.foreach_get(pixels_b)
    mean_error = float(np.abs(pixels_a-pixels_b).mean())
    bpy.data.images.remove(a); bpy.data.images.remove(b)
    assert mean_error < 0.002, f'Round-trip render changed: {mean_error}'
    for obj in reimported:
        bpy.data.objects.remove(obj, do_unlink=True)
    for obj in objects:
        obj.hide_render = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            space = area.spaces.active
            space.shading.type = enum_value(space.shading,'type','MATERIAL')
            space.overlay.show_overlays = False
            space.region_3d.view_location = target
            space.region_3d.view_distance = extent*2.7
            space.region_3d.view_rotation = Vector((1.4,-2.4,1.2)).to_track_quat('Z','Y')
    result = {'asset':asset_id, 'blender_version':bpy.app.version_string,
              'raw_sha256':hashlib.sha256((base/'meshy_raw/model.glb').read_bytes()).hexdigest(),
              'final_sha256':hashlib.sha256((final/'model.glb').read_bytes()).hexdigest(),
              'before':before,'after':after,'scale_factor':scale,'original_bottom_center':list(anchor),
              'reimport_pass':True,'render_mean_absolute_error_0_to_1':mean_error,
              'origin':'bounding-box bottom center','blender_up':'Z','glb_up':'Y',
              'yaw_degrees':yaw,
              'normals':'preserved','textures':'preserved','decimation':'none',
              'visual_review':'PENDING','in_game_validation':'NOT_RUN'}
    (final/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))
    return result


if __name__ == '__main__':
    state_arg, asset_arg = sys.argv[sys.argv.index('--')+1:]
    process(state_arg, asset_arg)
