"""Organize the native scene, keep every curve / bevel editable, and frame the island."""
import bpy
from mathutils import Vector

scene = bpy.context.scene
collections = {}
for title in ['01 Coast and ground', '02 Water and bridges', '03 Living grove', '04 Flower garden', '05 Homes and courts', '06 Original residents', '07 Camera and daylight']:
    collection = bpy.data.collections.get(title) or bpy.data.collections.new(title)
    if collection.name not in scene.collection.children:
        scene.collection.children.link(collection)
    collections[title] = collection
for obj in list(scene.objects):
    name = obj.name
    if obj.type in {'CAMERA', 'LIGHT'}: title = '07 Camera and daylight'
    elif name.startswith(('Original Pokomoko', 'Pokomoko /', 'Rabbit /', 'Fox /')): title = '06 Original residents'
    elif name.startswith(('Ocean /', 'Inlet /')): title = '02 Water and bridges'
    elif name.startswith(('Island /', 'Coast /', 'Ground /')): title = '01 Coast and ground'
    elif name.startswith(('Grove tree', 'Grove /', 'Orchard /', 'Whole island /')): title = '03 Living grove'
    elif name.startswith(('Flower tree', 'Flowers /', 'Garden / connected', 'Garden / riverbank')): title = '04 Flower garden'
    else: title = '05 Homes and courts'
    for collection in list(obj.users_collection): collection.objects.unlink(obj)
    collections[title].objects.link(obj)
bpy.ops.object.select_all(action='DESELECT')
for obj in scene.objects:
    if obj.name not in {'Village / open shared route', 'Grove / route through mature canopy', 'Garden / connected bank route', 'Water town / shared frontage'} or obj.get('solid_ramp_base'):
        continue
    # A sloping path has real filled sides down to the meadow, no hovering ribbon.
    verts=[tuple(v.co) for v in obj.data.vertices];count=len(verts)
    faces=[tuple(p.vertices) for p in obj.data.polygons]
    top_count=len(faces)
    verts += [(x,y,.785) for x,y,z in verts]
    for i in range(count//2-1):
        a=i*2;b=a+2
        faces += [(count+a,count+b,count+b+1,count+a+1),(a,b,count+b,count+a),(a+1,count+a+1,count+b+1,b+1)]
    faces += [(0,count,count+1,1),(count-2,count-1,count*2-1,count*2-2)]
    mesh=bpy.data.meshes.new(obj.name+' / supported surface');mesh.from_pydata(verts,[],faces);mesh.update()
    mesh.materials.append(obj.data.materials[0])
    mesh.materials.append(bpy.data.materials.get('path / warm stone variation'))
    for p in mesh.polygons:
        if p.index>=top_count:p.material_index=1
    obj.data=mesh
    for modifier in list(obj.modifiers):obj.modifiers.remove(modifier)
    obj['solid_ramp_base']=True
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            space = area.spaces.active
            space.shading.type = 'MATERIAL'
            space.shading.use_scene_lights = False
            space.shading.use_scene_world = False
            space.overlay.show_overlays = False
            space.region_3d.view_rotation = scene.camera.rotation_euler.to_quaternion()
            space.region_3d.view_location = Vector((3, 6.3, 2.5))
            space.region_3d.view_distance = 52
            space.region_3d.view_perspective = 'ORTHO'

if __name__ == '__main__':
    bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
