import bpy,json,collections
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
root=Path('/Users/yutogasaki/Projects/sansu/docs/design/2026-10-12-authored-central-shoulder')
bpy.ops.wm.open_mainfile(filepath=str(root/'central-shoulder-source.blend'))
scene=bpy.context.scene;cam=scene.camera;view=json.loads((root/'source-render-manifest.json').read_text())['views']['source-whole']
cam.location=view['position'];cam.rotation_euler=(Vector(view['target'])-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=view['orthoScale'];bpy.context.view_layer.update()
im=bpy.data.images.load(str(root/'source-whole.png'));pixels=list(im.pixels[:]);w,h=im.size
pts=[]
for y in range(380,800,2):
 for x in range(110,810,2):
  p=((h-y-1)*w+x)*4
  if max(pixels[p:p+3])<.015:pts.append((x,y))
frame=cam.data.view_frame(scene=scene);xmin=min(v.x for v in frame);xmax=max(v.x for v in frame);ymin=min(v.y for v in frame);ymax=max(v.y for v in frame);direction=cam.matrix_world.to_3x3()@Vector((0,0,-1));counts=collections.Counter();samples=[]
for x,y in pts[::max(1,len(pts)//150)]:
 origin=cam.matrix_world@Vector((xmin+(x+.5)/w*(xmax-xmin),ymax-(y+.5)/h*(ymax-ymin),0))
 hit,loc,norm,idx,o,mat=scene.ray_cast(bpy.context.evaluated_depsgraph_get(),origin,direction)
 if hit:
  material=o.data.materials[o.data.polygons[idx].material_index].name if o.type=='MESH'else'none';parent=[];p=o
  while p:parent.append(p.name);p=p.parent
  key=(o.name,material);counts[key]+=1;samples.append({'pixel':[x,y],'world':list(loc),'name':o.name,'material':material,'parent':parent})
print(json.dumps({'pixels':len(pts),'counts':[(list(k),v)for k,v in counts.most_common()],'samples':samples[:15]},indent=2))
