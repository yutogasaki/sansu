"""Editable native crown studies. PREPARED ONLY; run by scheduled Blender CLI.

No world floor, owner transform, trunk, root, bark, shoulder tree, or hero changes.
All old target trees are absent from context and appear once in role originals.
This script builds source studies, never app fixtures or a clearance PASS.
"""
import os
assert os.environ.get('SANSU_FOREST_RUN_APPROVED') == '1', 'Parent has not scheduled source generation'
import bpy
import hashlib
import json
import math
import struct
import sys
from pathlib import Path
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
STUDY = json.loads((HERE / 'study.json').read_text())
EXTRACT = HERE / 'extraction'
BINDINGS = json.loads((EXTRACT / 'bindings.json').read_text())['bindings']
EXTRACT_MANIFEST = json.loads((EXTRACT / 'manifest.json').read_text())
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
for name, digest in EXTRACT_MANIFEST['files'].items(): assert sha(EXTRACT / name) == digest
for path, data in STUDY['inputs'].items(): assert sha(Path(path)) == data['sha256']
# Y-up authored coordinates to Blender Z-up. Both are right-handed.
B = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
BI = B.inverted()
def mat(values): return Matrix(tuple(tuple(values[column * 4 + row] for column in range(4)) for row in range(4)))
def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)
def fixed_digest(obj):
    h = hashlib.sha256()
    for vertex in obj.data.vertices: h.update(struct.pack('<3f', *vertex.co))
    for loop in obj.data.loops: h.update(struct.pack('<I', loop.vertex_index))
    for normal in obj.data.corner_normals: h.update(struct.pack('<3f', *normal.vector))
    for row in obj.matrix_world: h.update(struct.pack('<4d', *row))
    return h.hexdigest()
def world_matrix(owner_id): return mat(BINDINGS[owner_id]['sourceToAuthoredMatrix'])
def source_anchor(owner_id):
    species = STUDY['owners'][owner_id]['species']
    if species == 'willow':
        return Vector(STUDY['anchors']['willow']['crownRecipeCenterGltf'])
    if species == 'birch':
        # Exactly the source recipe root of its three branches; not node origin.
        tip = STUDY['anchors']['birch']['crownOriginAndRecipeBranchTipAnchors'][0]['originGltf']
        return Vector((-7.5, tip[1] - 3.6 * .45, -10.9))
    return Vector((-11.3, STUDY['owners'][owner_id]['pivotSourceGltf'][1], -9.3))
def deformation(owner_id, settings):
    info = STUDY['owners'][owner_id]
    anchor = world_matrix(owner_id) @ source_anchor(owner_id)
    angle = math.radians(settings['yawDegrees'])
    rotation = Matrix.Rotation(angle, 3, 'Y')
    stretch = Vector(settings['stretch'])
    shift = Vector(settings['upperShiftWorld'])
    source_scale = info['expectedUniformScale']
    def field(point):
        delta = point - anchor
        if info['species'] == 'birch':
            # Keep branch starts and their existing contact region unmoved.
            weight = smooth((delta.y - .15 * source_scale) / (.80 * source_scale))
        elif info['species'] == 'willow':
            # Common field for all lobes/stems/leaves; pin the original tip core.
            weight = smooth((delta.length - .12 * source_scale) / (.42 * source_scale))
        else:
            # Keep all four tier levels and their central axes; widen outer leaf.
            weight = smooth((math.hypot(delta.x, delta.z) - .18 * source_scale) / (.45 * source_scale))
        desired = rotation @ Vector((delta.x * stretch.x, delta.y * stretch.y, delta.z * stretch.z)) + shift
        return point + (desired - delta) * weight
    return field
def jacobian(field, point):
    epsilon = 1e-5
    columns = []
    for axis in range(3):
        offset = Vector((0, 0, 0)); offset[axis] = epsilon
        columns.append((field(point + offset) - field(point - offset)) / (2 * epsilon))
    return Matrix(tuple(tuple(columns[column][row] for column in range(3)) for row in range(3)))
def deform_object(obj, field):
    # Preserve source topology and source split normals transformed by the field.
    local_to_world = BI @ obj.matrix_world
    inverse = local_to_world.inverted()
    normals_to_world = local_to_world.to_3x3().inverted().transposed()
    normals_to_local = local_to_world.to_3x3().transposed()
    old_corner_normals = [normal.vector.copy() for normal in obj.data.corner_normals]
    transforms = []; maximum = 0; min_determinant = float('inf')
    for vertex in obj.data.vertices:
        point = local_to_world @ vertex.co
        target = field(point)
        derivative = jacobian(field, point)
        determinant = derivative.determinant()
        assert determinant > .15, f'Folded field at {obj.name}: {determinant}'
        min_determinant = min(min_determinant, determinant)
        transforms.append(normals_to_local @ derivative.inverted().transposed() @ normals_to_world)
        maximum = max(maximum, (target - point).length)
        vertex.co = inverse @ target
    obj.data.update()
    normals = [(transforms[loop.vertex_index] @ normal).normalized() for loop, normal in zip(obj.data.loops, old_corner_normals)]
    obj.data.normals_split_custom_set(normals)
    return {'name': obj.name, 'ownerId': obj['ownerId'], 'role': obj['forestRole'],
            'maxWorldDisplacement': maximum, 'minimumSampledJacobianDeterminant': min_determinant,
            'vertices': len(obj.data.vertices), 'polygons': len(obj.data.polygons)}
def world_bvh(obj):
    matrix = BI @ obj.matrix_world
    vertices = [matrix @ vertex.co for vertex in obj.data.vertices]
    return BVHTree.FromPolygons(vertices, [list(poly.vertices) for poly in obj.data.polygons], all_triangles=False), vertices
def inside_closed(tree, point):
    # Two non-axis rays reject ambiguous parity instead of silently assuming
    # that a bounding-box/recipe center lies inside a real source volume.
    answers = []
    for raw in [(1, .371, .619), (.283, 1, .517)]:
        direction = Vector(raw).normalized(); origin = point.copy(); count = 0
        for _ in range(128):
            hit, _, _, _ = tree.ray_cast(origin, direction, 100)
            if hit is None: break
            count += 1; origin = hit + direction * 1e-5
        else: raise AssertionError('Ambiguous source volume parity')
        answers.append(count % 2 == 1)
    assert answers[0] == answers[1], 'Source volume ray parity disagrees; inspect the mesh before joining'
    return answers[0]
def bezier(a, b, c, d, t): return a * (1 - t) ** 3 + b * (3 * (1 - t) ** 2 * t) + c * (3 * (1 - t) * t * t) + d * t ** 3
def build_branch(owner_id, ordinal, start, end, root_normal, material, config, collection):
    up = Vector((0, 1, 0)); direction = (end - start).normalized()
    a, d = start, end
    b = a + root_normal * .12 + up * config['archRiseWorld']
    c = d - direction * .12 + up * config['archRiseWorld']
    count, sides = config['longitudinalSegments'], config['radialSegments']
    # This radius derives from the native willow trunk tip recipe, in world units.
    radius0 = .45 * .46 * STUDY['owners'][owner_id]['expectedUniformScale'] * config['rootRadiusFractionOfSourceTrunkTip']
    radius1 = config['tipRadiusWorld']
    vertices, faces = [], []
    for i in range(count + 1):
        t = i / count; center = bezier(a, b, c, d, t)
        tangent = (bezier(a, b, c, d, min(1, t + .001)) - bezier(a, b, c, d, max(0, t - .001))).normalized()
        side = tangent.cross(up if abs(tangent.dot(up)) < .95 else Vector((1, 0, 0))).normalized()
        across = tangent.cross(side).normalized()
        radius = radius0 * (1 - smooth(t)) + radius1 * smooth(t)
        for j in range(sides):
            theta = j * math.tau / sides
            # Slight ellipticity follows a bough, not a pedestal or substitute tree.
            point = center + side * (math.cos(theta) * radius) + across * (math.sin(theta) * radius * .9)
            vertices.append(tuple(B @ point))
    for i in range(count):
        for j in range(sides):
            k = (j + 1) % sides
            faces.append((i * sides + j, i * sides + k, (i + 1) * sides + k, (i + 1) * sides + j))
    faces.append(tuple(reversed(range(sides))))
    faces.append(tuple(count * sides + j for j in range(sides)))
    mesh = bpy.data.meshes.new(f'l14-native-junction-{ordinal}')
    mesh.from_pydata(vertices, [], faces); mesh.update()
    for polygon in mesh.polygons: polygon.use_smooth = len(polygon.vertices) == 4
    mesh.materials.append(material)
    obj = bpy.data.objects.new(f'forest-junction-{owner_id}-{ordinal}', mesh); collection.objects.link(obj)
    for key, value in {'ownerId': owner_id, 'sourceSha256': STUDY['sourceSha256'], 'forestRole': 'derived-upper-bough',
                       'sourceLobeOrdinal': ordinal, 'noNewOwnerOrRights': True, 'noCrossOwnerStructuralJoin': True,
                       'physicalAudit': 'pending', 'nativeTrunkRetained': True}.items(): obj[key] = value
    return obj
def willow_junctions(objects, variant, collection):
    owner_id = 'l14'
    trunk = next(obj for obj in objects if obj.get('ownerId') == owner_id and obj.get('forestRole') == 'trunk')
    lobes = sorted([obj for obj in objects if obj.get('ownerId') == owner_id and obj.get('forestRole') == 'crown-lobe'], key=lambda obj: obj['forestOrdinal'])
    assert len(lobes) == variant['willowJunction']['count'] == 5
    trunk_tree, _ = world_bvh(trunk)
    origin = world_matrix(owner_id) @ source_anchor(owner_id)
    origin.y -= .06
    assert inside_closed(trunk_tree, origin), 'Native trunk recipe probe is not inside its actual volume'
    config = variant['willowJunction']; result = []
    for lobe in lobes:
        lobe_tree, points = world_bvh(lobe)
        center = sum(points, Vector()) / len(points)
        direction = (center - origin).normalized()
        root_hit, root_normal, _, _ = trunk_tree.ray_cast(origin, direction, config['maxSpanWorld'])
        assert root_hit is not None, f'No actual upper-trunk ray contact: {lobe.name}'
        if inside_closed(lobe_tree, root_hit):
            result.append({'ownerId': owner_id, 'crownNode': lobe['sourceNodeIndex'],
                'actualTrunkRayHit': list(root_hit), 'generatedBranch': False,
                'status': 'Actual trunk surface already inside closed lobe; preserve overlap without an unnecessary extra branch'})
            continue
        direction = (center - root_hit).normalized()
        leaf_hit, _, _, _ = lobe_tree.ray_cast(root_hit + direction * .001, direction, config['maxSpanWorld'])
        assert leaf_hit is not None, f'No actual crown contact: {lobe.name}'
        start = root_hit - direction * config['surfacePenetrationWorld']
        end = leaf_hit + direction * config['surfacePenetrationWorld']
        assert .01 < (end - start).length <= config['maxSpanWorld']
        assert inside_closed(trunk_tree, start), 'Branch start is not inside unchanged source trunk'
        assert inside_closed(lobe_tree, end), 'Branch end is not inside its actual source crown'
        branch = build_branch(owner_id, lobe['forestOrdinal'], start, end, root_normal, trunk.data.materials[0], config, collection)
        branch['sourceTrunkNode'] = trunk['sourceNodeIndex']
        result.append({'object': branch.name, 'ownerId': owner_id, 'crownNode': lobe['sourceNodeIndex'],
            'actualTrunkRayHit': list(root_hit), 'actualCrownRayHit': list(leaf_hit),
            'start': list(start), 'end': list(end), 'spanWorld': (end - start).length,
            'status': 'Closed source candidate with ray-found overlap endpoints; full contact/guard audit pending'})
    return result
def add_views():
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 24; scene.cycles.device = 'CPU'; scene.cycles.use_denoising = True
    scene.world = bpy.data.worlds.new('Study source environment')
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get('Background'); background.inputs['Color'].default_value = (.055, .20, .26, 1); background.inputs['Strength'].default_value = .7
    for name, location, energy, size in [('key', (2, -6, 17), 1800, 10), ('fill', (15, 1, 11), 1000, 12)]:
        data = bpy.data.lights.new(name, 'AREA'); data.energy = energy; data.shape = 'DISK'; data.size = size
        obj = bpy.data.objects.new(name, data); scene.collection.objects.link(obj); obj.location = location
        obj.rotation_euler = (Vector((5, 4, 1)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
    for item in STUDY['evidence']:
        camera = item['camera']; data = bpy.data.cameras.new(item['file']); data.type = 'ORTHO'
        data.ortho_scale = 2 / camera['projectionMatrix'][0]
        obj = bpy.data.objects.new('SOURCE camera ' + item['file'], data); scene.collection.objects.link(obj)
        translate = Matrix.Translation(Vector((camera['center'], 0, 2)))
        obj.matrix_world = B @ translate @ mat(camera['matrixWorld'])
        obj['evidenceSha256'] = item['sha256']; obj['sourceOnly'] = True
        if 'whole' in item['file']:
            scene.camera = obj
            scene.render.resolution_x = 1280
            scene.render.resolution_y = round(1280 * camera['projectionMatrix'][0] / camera['projectionMatrix'][5])
    scene.render.resolution_percentage = 100
    scene['runtimeIntegrated'] = False; scene['independentObservers'] = 0
    scene['renderLimitations'] = 'Owner layer only/no residents; Blender lighting/transmission/ocean differ; ripple line roundtrip differs; no runtime or art acceptance'

selected = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [item['id'] for item in STUDY['variants']]
assert selected and all(any(item['id'] == name for item in STUDY['variants']) for name in selected)
for name in selected:
    variant = next(item for item in STUDY['variants'] if item['id'] == name)
    output = HERE / 'variants' / name
    assert not output.exists(), f'Preserve existing candidate {output}'
    output.mkdir(parents=True)
    try:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(EXTRACT / 'fixed-c1-context.glb'))
        context_objects = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(EXTRACT / 'role-separated-originals.glb'))
        role_objects = [obj for obj in bpy.data.objects if obj not in context_objects and obj.type == 'MESH']
        assert len(role_objects) == 128
        fixed_objects = [obj for obj in role_objects if obj.get('forestFixed')]
        assert len(fixed_objects) == 23
        before = {obj.name: fixed_digest(obj) for obj in fixed_objects}
        changed = []
        for owner_id in STUDY['owners']:
            field = deformation(owner_id, variant['owners'][owner_id])
            for obj in role_objects:
                if obj.get('ownerId') != owner_id or obj.get('forestFixed'): continue
                # Each owner has its own mesh data even for the two birches.
                obj.data = obj.data.copy()
                result = deform_object(obj, field)
                assert result['maxWorldDisplacement'] <= variant['maxChangedWorldVertexDisplacement'], result
                changed.append(result)
        junction_collection = bpy.data.collections.new(name + ' / owned native bough junctions')
        bpy.context.scene.collection.children.link(junction_collection)
        junctions = willow_junctions(role_objects, variant, junction_collection)
        after = {obj.name: fixed_digest(obj) for obj in fixed_objects}
        assert before == after, 'Fixed original trunk/root/bark geometry or transform changed'
        # The actual highest source hero remains an upper cap on candidate crowns.
        hero_roots = [obj for obj in context_objects if obj.get('nativePart') == 'fan-crown']
        hero_meshes = {child for obj in hero_roots for child in [obj, *obj.children_recursive] if child.type == 'MESH'}
        assert hero_meshes, 'Original compact hero must remain present'
        hero_top = max((obj.matrix_world @ vertex.co).z for obj in hero_meshes for vertex in obj.data.vertices)
        candidate_top = max((obj.matrix_world @ vertex.co).z for obj in role_objects for vertex in obj.data.vertices)
        assert candidate_top + variant['heroTopClearanceWorld'] < hero_top, 'Candidate creates a competing highest crown'
        bpy.context.scene['candidate'] = name
        add_views()
        bpy.ops.wm.save_as_mainfile(filepath=str(output / 'study.blend'))
        # Whole source and components remain separate; no source scene becomes an app asset.
        bpy.ops.export_scene.gltf(filepath=str(output / 'study.glb'), export_format='GLB', export_extras=True, export_cameras=False, export_lights=False)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in [*role_objects, *junction_collection.objects]: obj.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(output / 'owned-tree-components.glb'), export_format='GLB', use_selection=True, export_extras=True)
        result = {'candidate': name, 'parameters': variant, 'fixedOriginalRoleHashesBefore': before, 'fixedOriginalRoleHashesAfter': after,
            'changed': changed, 'junctions': junctions, 'heroTopWorld': hero_top, 'candidateTopWorld': candidate_top,
            'renderExecuted': False, 'runtimeIntegrated': False, 'independentObservers': 0,
            'geometryAuditStatus': 'PENDING: actual closed junction/overlap/actor-band/owner approach/source parity audits',
            'files': {file: sha(output / file) for file in ['study.blend', 'study.glb', 'owned-tree-components.glb']}}
        (output / 'manifest.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
        print('FOREST_SOURCE_BUILT', name, flush=True)
    except Exception as error:
        (output / 'first-failure.json').write_text(json.dumps({'candidate': name, 'error': repr(error), 'runtimeIntegrated': False, 'renderExecuted': False}, indent=2) + '\n')
        raise
