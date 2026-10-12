"""Exact selected-top triangle material lineage; does not alter geometry."""
import json,gzip,hashlib
from pathlib import Path
from shapely.geometry import Polygon
from shapely.strtree import STRtree
p=Path('/private/tmp/sansu-whole-massing-c-terrain/south-west-v3');repo=Path('/Users/yutogasaki/Projects/sansu')
files=[p/'candidate-world.json.gz',repo/'prototypes/place-qa/native05-world.json.gz'];sha=lambda q:hashlib.sha256(q.read_bytes()).hexdigest();before={str(q):sha(q)for q in files}
w,o=[json.loads(gzip.decompress(q.read_bytes()))for q in files];fs=[f for d in o['districts']for f in d['floors']if f['id']in ['Island / continuous sculpted mature terrain:0','Island / continuous sculpted mature terrain:1']];polys=[];ids=[]
for f in fs:
 for j in range(0,len(f['indices']),3):
  v=[f['vertices'][k]['point']for k in f['indices'][j:j+3]];poly=Polygon([(q['x'],q['z'])for q in v])
  if poly.area>1e-14:polys.append(poly);ids.append((f['id'],j//3,f['color']))
tree=STRtree(polys);d=next(d for d in w['districts']if d['id']=='diagnostic-central-shoulder-c-feasibility');f=d['floors'][0];mapping=[];errors=[];maxout=0
for j in range(0,len(f['indices']),3):
 v=[f['vertices'][k]['point']for k in f['indices'][j:j+3]];poly=Polygon([(q['x'],q['z'])for q in v]);hits=[int(i)for i in tree.query(poly.centroid.buffer(1e-9))if polys[i].buffer(1e-10).covers(poly.centroid)];mats={ids[i][0]for i in hits}
 if len(mats)!=1:errors.append({'triangle':j//3,'hits':[ids[i]for i in hits]});continue
 best=min(hits,key=lambda i:poly.difference(polys[i]).area);outside=poly.difference(polys[best]).area;maxout=max(maxout,outside);mapping.append({'triangle':j//3,'sourceFloorId':ids[best][0],'sourceTriangle':ids[best][1],'color':ids[best][2]})
r={'scope':'Derived material provenance only; final vertices/indices unchanged. Color is world-floor metadata, not a new source material decision.','inputs':before,'triangleCount':len(f['indices'])//3,'materialCounts':{f['id']:sum(x['sourceFloorId']==f['id']for x in mapping)for f in fs},'maxTriangleOutsideMappedOriginal':maxout,'errors':errors,'triangles':mapping,'finalInputs':{str(q):sha(q)for q in files}};r['inputsUnchanged']=r['inputs']==r['finalInputs'];(p/'material-provenance.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:v for k,v in r.items()if k!='triangles'},indent=2));assert not errors and maxout<1e-11
