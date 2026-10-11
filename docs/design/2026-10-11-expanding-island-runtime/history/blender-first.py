"""Keep the actual runtime floor/owners in one editable Blender source.

Run Blender --background --python this_file -- RAW_GLB_DIRECTORY OUTPUT_BLEND.
The exported models are diagnostic ownership, not newly acquired player data.
"""
import json
import sys
import bpy
from mathutils import Vector

raw_dir, output = sys.argv[sys.argv.index("--") + 1:]
with open(raw_dir + "/models.json", encoding="utf-8") as source:
    manifest = json.load(source)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for model in manifest["models"]:
    collection = bpy.data.collections.new(model["file"].removesuffix(".glb"))
    bpy.context.scene.collection.children.link(collection)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=raw_dir + "/" + model["file"])
    imported = set(bpy.data.objects) - before
    for obj in imported:
        for previous in list(obj.users_collection):
            previous.objects.unlink(obj)
        collection.objects.link(obj)
    collection["candidate"] = manifest["candidate"]
    collection["projection"] = manifest["projection"]
    collection["fixture_id"] = model["id"]
    collection["home_count"] = model["homes"]
    collection["glb_sha256"] = model["sha256"]
    collection["diagnostic"] = True
    collection.hide_viewport = model["file"] != "bay-16.glb"
    collection.hide_render = collection.hide_viewport

stage = bpy.data.collections.new("Review light and sea")
bpy.context.scene.collection.children.link(stage)
def move_to_stage(obj):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    stage.objects.link(obj)

bpy.ops.mesh.primitive_plane_add(size=280, location=(0, -0.4, 14))
sea = bpy.context.object
sea.name = "Review sea — runtime shader stays in the app"
move_to_stage(sea)
water = bpy.data.materials.new("Review sea blue")
water.diffuse_color = (0.07, 0.38, 0.55, 1)
sea.data.materials.append(water)
bpy.ops.object.camera_add(location=(30, 34, 40))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0.8, 9)) - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.type = "ORTHO"
camera.data.ortho_scale = 43
move_to_stage(camera)
bpy.context.scene.camera = camera
bpy.ops.object.light_add(type="AREA", location=(-10, 24, 18))
light = bpy.context.object
light.data.energy = 2500
light.data.shape = "DISK"
light.data.size = 18
move_to_stage(light)
scene = bpy.context.scene
scene.world.color = (0.4, 0.5, 0.65)
scene.render.engine = "BLENDER_EEVEE_NEXT"
scene.render.resolution_x = 1600
scene.render.resolution_y = 1200
scene.render.resolution_percentage = 100
scene["candidate"] = manifest["candidate"]
scene["source_hash"] = manifest["sourceHash"]
scene["kit_sha256"] = manifest["kit"]
scene["scope"] = manifest["scope"]
text = bpy.data.texts.new("Runtime ownership and source provenance.json")
text.write(json.dumps(manifest, ensure_ascii=False, indent=2))
bpy.ops.wm.save_as_mainfile(filepath=output, compress=True)
print(json.dumps({"collections": len(manifest["models"]), "objects": len(bpy.data.objects), "output": output}))
