import bpy
from pathlib import Path
out = Path(__file__).resolve().parent
scene = bpy.context.scene
for name, frame in [('ready',1),('notice',32),('shelter',80)]:
    scene.frame_set(frame)
    scene.render.filepath = str(out / (name + '.png'))
    bpy.ops.render.render(write_still=True)
