"""Check exact lowest source trunk vertices against actual composed top; no transforms changed."""
import json,gzip,hashlib
from pathlib import Path
from shapely.geometry import Polygon,Point
from shapely.strtree import STRtree
p=Path('/private/tmp/sansu-whole-massing-c-terrain/south-west-v3');files=[p/'root-contact-source.json',p/'candidate-world.json.gz'];before={str(q):hashlib.sha256(q.read_bytes()).hexdigest()for q in files};r=json.loads(files[0].read_text());w=json.loads(gzip.decompress(files[1].read_bytes()));polys=[];tris=[]
for d in w['districts']:
 for f in d['floors']:
  if f['kind']not in ['ground','deck']:continue
  for j in range(0,len(f['indices']),3):
   v=[f['vertices'][k]['point']for k in f['indices'][j:j+3]];q=Polygon([(v['x'],v['z'])for v in v])
   if q.area>1e-14:polys.append(q);tris.append(v)
t=STRtree(polys)
def h(tri,x,z):
 a,b,c=tri;den=(b['z']-c['z'])*(a['x']-c['x'])+(c['x']-b['x'])*(a['z']-c['z']);u=((b['z']-c['z'])*(x-c['x'])+(c['x']-b['x'])*(z-c['z']))/den;v=((c['z']-a['z'])*(x-c['x'])+(a['x']-c['x'])*(z-c['z']))/den
 return u*a['y']+v*b['y']+(1-u-v)*c['y']if min(u,v,1-u-v)>=-1e-8 else None
for rec in r['records']:
 for v in rec['bottomVertices']:
  hs=[y for i in t.query(Point(v['x'],v['z']).buffer(1e-8))if(y:=h(tris[i],v['x'],v['z']))is not None];v['floorY']=max(hs)if hs else None;v['gap']=v['y']-v['floorY']if hs else None
 rec['gapMin']=min(v['gap']for v in rec['bottomVertices']);rec['gapMax']=max(v['gap']for v in rec['bottomVertices'])
r['scope']='Bottom vertex diagnostic only, not support acceptance. Positive is visible-source vertex above dry top; 0.04 owner placement offset is preserved; no source or terrain changed.';r['floorInputs']=before;r['floorInputsUnchanged']=before=={str(q):hashlib.sha256(q.read_bytes()).hexdigest()for q in files};(p/'root-contact-floor.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:v for k,v in r.items()if k!='records'},indent=2));print(json.dumps([{k:v for k,v in rec.items()if k!='names'}for rec in r['records']],indent=2))
