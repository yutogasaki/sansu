import json,hashlib
from pathlib import Path
from shapely.geometry import Polygon
from shapely.ops import unary_union,nearest_points
p=Path('/private/tmp/sansu-whole-massing-c-terrain/south-west');q=p/'leaf-source-triangles.json';r=json.loads(q.read_text()); projections={}; bounds=[]
for part in r['parts']:
 vs=[v for t in part['triangles']for v in t];bounds.append({'part':part['part'],'triangles':len(part['triangles']),'min':[min(v[i]for v in vs)for i in range(3)],'max':[max(v[i]for v in vs)for i in range(3)]})
 for view,axes in [('topXZ',(0,2)),('frontXY',(0,1))]:
  qs=[Polygon([(v[axes[0]],v[axes[1]])for v in t])for t in part['triangles']];projections[(part['part'],view)]=unary_union([x for x in qs if x.area>1e-14])
pairs=[]
for a,b in [('willow','birch'),('birch','spire')]:
 pair={'parts':[a,b]}
 for view in ['topXZ','frontXY']:
  x,y=projections[(a,view)],projections[(b,view)];pair[view]={'distance':x.distance(y),'overlapArea':x.intersection(y).area}
 pairs.append(pair)
d={'scope':'Exact leaf triangle projected union at native .45 unchanged source: willow(6,-7)y1.20757, birch(7,-6)y1.585, spire(8,-6)y1.615. Projection overlap is not leaf triangle collision or visual acceptance.','inputSha256':hashlib.sha256(q.read_bytes()).hexdigest(),'bounds':bounds,'pairs':pairs};(p/'leaf-projection-summary.json').write_text(json.dumps(d,indent=2)+'\n');print(json.dumps(d,indent=2))
