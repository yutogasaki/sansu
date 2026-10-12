# TMP-only exact geometric diagnostics; no app/model edits.
import json,gzip,hashlib
from pathlib import Path
from shapely.geometry import Polygon,Point,box,LineString
from shapely.ops import unary_union,nearest_points
from shapely.strtree import STRtree
p=Path('/private/tmp/sansu-whole-massing-c-terrain/south-west');repo=Path('/Users/yutogasaki/Projects/sansu')
paths=[p/'candidate-proof.json',p/'candidate-world.json.gz',repo/'prototypes/place-qa/native05-world.json.gz']
hashes=lambda:{str(q):hashlib.sha256(q.read_bytes()).hexdigest() for q in paths};before=hashes();proof=json.loads(paths[0].read_text());world=json.loads(gzip.decompress(paths[1].read_bytes()));original=json.loads(gzip.decompress(paths[2].read_bytes()));region=Polygon([(v['x'],v['z'])for v in proof['boundary']]);route=LineString([(6,-5.25),(9,-5.25)]);radius=.28406937059140585;swept=route.buffer(radius,cap_style=3,join_style=2);roi=region.union(swept).envelope
newpolys=[];oldpolys=[];routepolys=[];boundary=[];newarea=0;currentTris=[];currentPolys=[]
for d in world['districts']:
 for f in d['floors']:
  if f['kind'] not in ['ground','deck'] or 'pool-bed' in f['id'] or 'stream-bed' in f['id']:continue
  for j in range(0,len(f['indices']),3):
   vs=[f['vertices'][k] for k in f['indices'][j:j+3]];q=Polygon([(v['cell']['x'],v['cell']['z']) for v in vs]);
   if q.area<=1e-14:continue
   if q.intersects(roi):routepolys.append(q);currentTris.append([v['point']for v in vs]);currentPolys.append(q)
   if d['id']=='diagnostic-central-shoulder-c-feasibility':
    newpolys.append(q);newarea+=q.area
    boundary.extend(v for v in vs if region.boundary.distance(Point(v['cell']['x'],v['cell']['z']))<1e-9)
   elif f['id']=='Island / continuous sculpted mature terrain:1' and q.intersects(region):oldpolys.append(q)
newunion=unary_union(newpolys);oldunion=unary_union(oldpolys);floorunion=unary_union(routepolys)
sourceTris=[];sourcePolys=[]
for d in original['districts']:
 for f in d['floors']:
  if f['id']!='Island / continuous sculpted mature terrain:1':continue
  for j in range(0,len(f['indices']),3):
   vs=[f['vertices'][k] for k in f['indices'][j:j+3]];q=Polygon([(v['cell']['x'],v['cell']['z']) for v in vs]);
   if q.area>1e-14 and q.intersects(roi):sourceTris.append([v['point']for v in vs]);sourcePolys.append(q)
st=STRtree(sourcePolys);ct=STRtree(currentPolys)
def height(tri,x,z):
 a,b,c=tri;den=(b['z']-c['z'])*(a['x']-c['x'])+(c['x']-b['x'])*(a['z']-c['z']);u=((b['z']-c['z'])*(x-c['x'])+(c['x']-b['x'])*(z-c['z']))/den;v=((c['z']-a['z'])*(x-c['x'])+(a['x']-c['x'])*(z-c['z']))/den;return u*a['y']+v*b['y']+(1-u-v)*c['y'] if min(u,v,1-u-v)>=-1e-8 else None
def sample(x,z,tree,tris):
 vals=[h for i in tree.query(Point(x,z).buffer(1e-8)) if (h:=height(tris[i],x,z)) is not None];return max(vals)if vals else None
uniq={tuple(v['point'][k]for k in ['x','y','z']):v for v in boundary};errors=[];missing=0
for v in uniq.values():
 h=sample(v['point']['x'],v['point']['z'],st,sourceTris)
 if h is None:missing+=1
 else:errors.append(abs(h-v['point']['y']))
grants=[s for d in original['districts']for s in d['sites']if s.get('placement')];overlaps=[]
for s in grants:
 footprint=box(s['cell']['x']-.46,s['cell']['z']-.46,s['cell']['x']+.46,s['cell']['z']+.46);q=footprint.intersection(region)
 if q.area>1e-12:overlaps.append({'id':s['id'],'area':q.area})
profiles=[]
for x in [6,6.5,7,7.5,8,8.5,9]:
 profiles.append({'x':x,'section':[{'z':z,'original':sample(x,z,st,sourceTris),'candidate':sample(x,z,ct,currentTris)}for z in [-7,-6.75,-6.46,-6.25,-6,-5.75,-5.54,-5.25,-5,-4.9]]})
result={'scope':'TMP numerical curved terrain feasibility only. New2 grant supports are real triangles in this diagnostic world, not implemented source/app. Full-width coverage proves projected dry floor, not gait/animation/art acceptance. Topology filters degenerate clip fans at world compiler threshold; retained area logged.','inputs':before,'floor':{'boundaryArea':region.area,'newSumArea':newarea,'newUnionArea':newunion.area,'newInternalOverlapArea':newarea-newunion.area,'missingRegionArea':region.difference(newunion).area,'outsideRegionArea':newunion.difference(region).area,'newVsRetainedSourceFloorOverlap':newunion.intersection(oldunion).area,'sharedBoundaryVertices':len(uniq),'boundaryNoSourceHit':missing,'maxBoundaryHeightError':max(errors),'clipSlivers':proof['clipSlivers'],'routeCenterline':list(route.coords),'actorClearanceHalfWidth':radius,'sweptArea':swept.area,'uncoveredSweptArea':swept.difference(floorunion).area},'oldGrants':len(grants),'oldGrantWholeFootprintsOverlappingC':overlaps,'profiles':profiles};result['finalInputs']=hashes();result['inputsUnchanged']=before==result['finalInputs'];(p/'geometry-summary.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
