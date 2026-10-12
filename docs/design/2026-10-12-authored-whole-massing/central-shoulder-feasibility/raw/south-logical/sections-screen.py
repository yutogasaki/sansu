import json,hashlib
from pathlib import Path
p=Path('/private/tmp/sansu-whole-massing-c-terrain');src=p/'sections.json';d=json.loads(src.read_text())
def clip(poly,axis,bound,greater):
 out=[]
 for a,b in zip(poly,poly[1:]+poly[:1]):
  da=(a[axis]-bound)*(1 if greater else -1);db=(b[axis]-bound)*(1 if greater else -1)
  if da>=0:out.append(a)
  if (da>=0)!=(db>=0):
   t=da/(da-db);out.append({k:a[k]+(b[k]-a[k])*t for k in a})
 return out
out=[]
for x in [7,8,9]:
 levels={}
 for t in d['composedTriangles']:
  poly=[v['point'] for v in t['vertices']]
  for axis,bound,greater in [('x',x-.46,True),('x',x+.46,False),('z',-6.46,True),('z',-5.54,False)]:
   poly=clip(poly,axis,bound,greater)
   if not poly:break
  if len(poly)>2:levels.setdefault(t['floorId'],[]).extend(v['y'] for v in poly)
 out.append({'cell':[x,-6],'sourceFullFootprintByFloor':{k:{'min':min(h),'max':max(h),'span':max(h)-min(h),'possibleCenterWithoutRetopology':[max(h)-.28,min(h)+.28]} for k,h in levels.items()}})
r={'scope':'Exact clipped source/composed triangle footprint ranges; competing floors separated. No new geometry/placement authorization.', 'inputSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'results':out};(p/'south-logical/source-footprints.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,indent=2))
