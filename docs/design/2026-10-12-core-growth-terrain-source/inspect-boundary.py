"""Read the exact original ground boundary; no original positions are edited."""
from pathlib import Path
import json,gzip,collections,hashlib
from shapely.geometry import Polygon
from shapely.ops import unary_union
D=Path(__file__).resolve().parent; source=Path('prototypes/place-qa/native05-world-source-shading.json.gz')
raw=source.read_bytes();world=json.loads(gzip.decompress(raw));district=world['districts'][0]
edges=collections.Counter();direct={};points={};polygons=[]
for f in district['floors']:
 if not f['id'].startswith('Island / continuous sculpted mature terrain:'):continue
 ps=[tuple(v['point'][k]for k in ['x','y','z'])for v in f['vertices']]
 for i in range(0,len(f['indices']),3):
  tri=[ps[j]for j in f['indices'][i:i+3]]
  for a,b in zip(tri,tri[1:]+tri[:1]):
   ka=(a[0],a[2]);kb=(b[0],b[2]);k=tuple(sorted((ka,kb)));edges[k]+=1;direct[k]=(a,b);points[ka]=a;points[kb]=b
  if max(v[0]for v in tri)>10:polygons.append(Polygon([(v[0],v[2])for v in tri]))
boundary=[direct[k]for k,n in edges.items()if n==1]
selected=[(a,b)for a,b in boundary if min(a[0],b[0])>10.5 and -10.5<max(a[2],b[2]) and min(a[2],b[2])<-.5]
# The narrow analysis union is for reporting overlap/scope, not new floor data.
u=unary_union(polygons)
outer=list(u.exterior.coords)[:-1]
outer3=[points[tuple(p)]for p in outer if tuple(p) in points]
result={'outerBoundary':outer3,'unmappedOuterVertices':len(outer)-len(outer3),'source':str(source),'sha256':hashlib.sha256(raw).hexdigest(),'boundaryEdges':len(boundary),'selectedEdges':selected,'unionValid':u.is_valid,'unionType':u.geom_type,'boundaryPoints':sorted({p for e in selected for p in e},key=lambda p:p[2])}
(D/'original-boundary.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'boundaryEdges':len(boundary),'selectedEdges':len(selected),'unionValid':u.is_valid,'unionType':u.geom_type,'samples':result['boundaryPoints'][::max(1,len(result['boundaryPoints'])//20)]}))
