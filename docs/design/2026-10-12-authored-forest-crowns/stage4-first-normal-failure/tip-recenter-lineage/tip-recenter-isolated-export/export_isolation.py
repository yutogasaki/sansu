"""Temporary export scene only. Exact original scene guard; never repair originals."""
from contextlib import contextmanager
import bpy


def snapshot(objects, materials, scene, native, checks):
    return {
        'scene': {'name': scene.name, 'frame': scene.frame_current,
                  'objects': sorted(o.name for o in scene.objects)},
        'objects': {o.name: {
            'matrixWorld': [list(row) for row in o.matrix_world],
            'matrixBasis': [list(row) for row in o.matrix_basis],
            'matrixParentInverse': [list(row) for row in o.matrix_parent_inverse],
            'parent': o.parent.name if o.parent else None,
            'meshDigest': native.fixed_digest(o) if o.type == 'MESH' else None,
            'sharp': [[list(e.vertices), e.use_edge_sharp] for e in o.data.edges] if o.type == 'MESH' else None,
        } for o in objects},
        'materials': {m.name: checks.material_digest(m) for m in materials},
    }


@contextmanager
def isolated_export_scene(author, save, native, checks):
    original_scene = bpy.context.window.scene
    original_objects = list(bpy.data.objects)
    original_materials = list(bpy.data.materials)
    original_meshes = set(bpy.data.meshes)
    before = snapshot(original_objects, original_materials, original_scene, native, checks)
    save('authoring-scene-before-isolation.json.gz', before)
    temporary_scene = bpy.data.scenes.new('TIP NORMAL DIAGNOSTIC EXPORT ONLY')
    copy = author.copy()
    copy.name = 'DISPOSABLE EXPORT / ' + author.name
    copy.data = author.data.copy()
    world = author.matrix_world.copy()
    copy.parent = None
    copy.matrix_parent_inverse.identity()
    temporary_scene.collection.objects.link(copy)
    copy.matrix_world = world
    try:
        bpy.context.window.scene = temporary_scene
        at_entry = snapshot(original_objects, original_materials, original_scene, native, checks)
        save('authoring-scene-after-export-scene-switch.json.gz', at_entry)
        assert at_entry == before, 'HOLD: scene switch changed original authoring state'
        yield copy
    finally:
        # Context restoration only. Do not assign any original mesh/matrix/normal/material.
        bpy.context.window.scene = original_scene
        after = snapshot(original_objects, original_materials, original_scene, native, checks)
        save('authoring-scene-after-isolation.json.gz', after)
        save('authoring-scene-exact-parity.json', {
            'equal': before == after,
            'guardedObjects': len(original_objects),
            'guardedMeshes': sum(o.type == 'MESH' for o in original_objects),
            'guardedMaterials': len(original_materials),
            'changedObjects': [name for name in before['objects'] if before['objects'][name] != after['objects'][name]],
            'changedMaterials': [name for name in before['materials'] if before['materials'][name] != after['materials'][name]],
            'sceneEqual': before['scene'] == after['scene'],
            'originalStateRestoredByAssignment': False,
        })
        for obj in list(bpy.data.objects):
            if obj not in original_objects:
                bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.scenes.remove(temporary_scene)
        for mesh in list(bpy.data.meshes):
            if mesh not in original_meshes and mesh.users == 0:
                bpy.data.meshes.remove(mesh)
        for mat in list(bpy.data.materials):
            if mat not in original_materials and mat.users == 0:
                bpy.data.materials.remove(mat)
        final = snapshot(original_objects, original_materials, original_scene, native, checks)
        save('authoring-scene-after-temporary-cleanup.json.gz', final)
        assert before == after == final, 'HOLD: original scene changed; no repair attempted'
