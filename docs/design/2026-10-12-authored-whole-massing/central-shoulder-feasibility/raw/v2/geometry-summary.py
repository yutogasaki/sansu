# TMP-only diagnostics from retained source triangles/world; no app/model edits.
import json,gzip,hashlib,math
from pathlib import Path
from shapely.geometry import Polygon,box,LineString
from shapely.ops import unary_union,nearest_points
p=Path('/private/tmp/sansu-whole-massing-c-terrain/v2'); repo=Path('/Users/yutogasaki/Projects/sansu')
paths=[p/'leaf-source-triangles.json',p/'candidate-world.json.gz',p.parent/'sections.json',repo/'prototypes/place-qa/native05-world.json.gz']
hashes=lambda:{str(q):hashlib.sha256(q.read_bytes()).hexdigest() for q in paths}; before=hashes()
leaves=json.loads(paths[0].read_text())['parts']; projections={}; partproof=[]
for part in leaves:
 tris=part['triangles']; pts=[v for t in tris for v in t]
 partproof.append({'part':part['part'],'triangles':len(tris),'min':[min(v[i] for v in pts) for i in range(3)],'max':[max(v[i] for v in pts) for i in range(3)]})
 for name,axes in [('topXZ',(0,2)),('frontXY',(0,1))]:
  polys=[Polygon([(v[axes[0]],v[axes[1]]) for v in t]) for t in tris]
  projections[(part['part'],name)]=unary_union([q for q in polys if q.area>1e-14])
pairs=[]
for a,b in [('willow','birch'),('birch','spire')]:
 row={'parts':[a,b]}
 for view in ['topXZ','frontXY']:
  q,r=projections[(a,view)],projections[(b,view)]
  row[view]={'distance':q.distance(r),'overlapArea':q.intersection(r).area,'closestPoints':[list(v.coords)[0] for v in nearest_points(q,r)]}
 pairs.append(row)
world=json.loads(gzip.decompress(paths[1].read_bytes()));sections=json.loads(paths[2].read_text());original=json.loads(gzip.decompress(paths[3].read_bytes()));cbox=box(6.5,-7.5,9.5,-5.9)
route=LineString([(5.25,-6.5),(5.25,-6.25),(10,-6.25)]);radius=.28406937059140585; swept=route.buffer(radius,cap_style=3,join_style=2); roi=swept.envelope
newpolys=[];oldpolys=[];newarea=0;oldinside=[];routepolys=[];boundary=[]
for d in world['districts']:
 for f in d['floors']:
  if f['kind'] not in ['ground','deck'] or f['id'].startswith('authored-water:pool-bed') or 'stream-bed' in f['id']:continue
  for j in range(0,len(f['indices']),3):
   vs=[f['vertices'][k] for k in f['indices'][j:j+3]]; q=Polygon([(v['cell']['x'],v['cell']['z']) for v in vs]);
   if q.area<=1e-14:continue
   if q.intersects(roi):routepolys.append(q)
   if d['id']=='diagnostic-central-shoulder-c-feasibility':newpolys.append(q);newarea+=q.area;boundary +=[v for v in vs if abs(v['cell']['x']-6.5)<1e-9 or abs(v['cell']['x']-9.5)<1e-9 or abs(v['cell']['z']+7.5)<1e-9 or abs(v['cell']['z']+5.9)<1e-9]
   elif f['id']=='Island / continuous sculpted mature terrain:1' and q.intersects(cbox):oldpolys.append(q)
newunion=unary_union(newpolys); oldunion=unary_union(oldpolys); floorunion=unary_union(routepolys)
# Existing owner supports are rectangles; prove no original grant footprint enters modified area.
grants=[s for d in original['districts'] for s in d['sites'] if s.get('placement',True)]
intersections=[{'site':s['id'],'area':box(s['cell']['x']-.46,s['cell']['z']-.46,s['cell']['x']+.46,s['cell']['z']+.46).intersection(cbox).area} for s in grants]
# Exact triangle barycentric source height at every numerical floor boundary vertex.
def height(tri,x,z):
 v=[p['point'] for p in tri['vertices']]; a,b,c=v; den=(b['z']-c['z'])*(a['x']-c['x'])+(c['x']-b['x'])*(a['z']-c['z'])
 if abs(den)<1e-14:return None
 u=((b['z']-c['z'])*(x-c['x'])+(c['x']-b['x'])*(z-c['z']))/den; vv=((c['z']-a['z'])*(x-c['x'])+(a['x']-c['x'])*(z-c['z']))/den;w=1-u-vv
 return u*a['y']+vv*b['y']+w*c['y'] if min(u,vv,w)>=-1e-8 else None
src=[t for t in sections['composedTriangles'] if t['kind']=='ground' and 'continuous sculpted mature terrain:1' in t['floorId']]
uniq={tuple(v['point'][k] for k in ['x','y','z']):v for v in boundary}; deviations=[]; missing=0
for v in uniq.values():
 heights=[h for t in src if (h:=height(t,v['point']['x'],v['point']['z'])) is not None]
 if heights: deviations.append(min(abs(h-v['point']['y']) for h in heights))
 else:missing+=1
result={'scope':'Numerical candidate v2, source-preserving feasibility only. Projection distance is not a 3D triangle intersection or beauty pass. Swept floor coverage proves XZ dry support, not acceptable walking animation/slope. Cap within support footprint is a local numerical design, not authored source asset.','inputs':before,'leaves':partproof,'leafProjectionPairs':pairs,'floor':{'newSumArea':newarea,'newUnionArea':newunion.area,'newInternalOverlapArea':newarea-newunion.area,'missingCRegionArea':cbox.difference(newunion).area,'outsideCRegionArea':newunion.difference(cbox).area,'newVsRetainedSourceFloorOverlap':newunion.intersection(oldunion).area,'sharedBoundaryVertices':len(uniq),'boundaryNoSourceHit':missing,'maxBoundaryHeightError':max(deviations),'routeCenterline':list(route.coords),'actorClearanceHalfWidth':radius,'sweptArea':swept.area,'uncoveredSweptArea':swept.difference(floorunion).area},'oldGrants':len(grants),'oldGrantWholeFootprintsOverlappingC':[x for x in intersections if x['area']>1e-12]}
result['finalInputs']=hashes();result['inputsUnchanged']=before==result['finalInputs'];(p/'geometry-summary.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
