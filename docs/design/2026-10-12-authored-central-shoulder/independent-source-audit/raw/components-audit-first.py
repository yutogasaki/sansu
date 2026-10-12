"""Independent actual-GLB audit against frozen selected v3. Writes only audit TMP."""
import json,gzip,struct,hashlib,collections
from pathlib import Path
import numpy as np
from shapely.geometry import Polygon,Point,LineString,box
from shapely.ops import unary_union
from shapely.strtree import STRtree
ROOT=Path('/Users/yutogasaki/Projects/sansu');ART=ROOT/'docs/design/2026-10-12-authored-central-shoulder';RAW=ROOT/'docs/design/2026-10-12-authored-whole-massing/central-shoulder-feasibility/raw/south-west-v3';OUT=Path('/private/tmp/sansu-central-shoulder-source-audit')
load=lambda p:json.loads(gzip.decompress(p.read_bytes()))if p.suffix=='.gz'else json.loads(p.read_text());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
paths=[ART/'central-shoulder-components.glb',ART/'geometry-profile.json.gz',ART/'input/native-trunk-bases.json',RAW/'candidate-world.json.gz',RAW/'candidate-state.json',RAW/'assembly-extract.json',RAW/'candidate-proof.json',ROOT/'prototypes/place-qa/native05-world.json.gz',ROOT/'prototypes/place-qa/authored-flower-reference-mature.json',ROOT/'docs/design/2026-10-10-island-final-3d/whole-island.glb']
before={str(p):sha(p)for p in paths};assert before[str(paths[0])]=='24f32eed46efe18cd3411220771b2b4f5266449278f00499c0917550f1a7d998';assert before[str(paths[1])]=='7b4772489932b225d7b31ced5bd53c6835a47e8e63c71eeb43d7b59af1523d3b'
def glb(path):
 data=path.read_bytes();l=struct.unpack_from('<I',data,12)[0];g=json.loads(data[20:20+l]);binary=data[28+l:]
 def acc(i):
  a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];fmt={5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']];size=struct.calcsize(fmt);stride=v.get('byteStride',n*size);off=v.get('byteOffset',0)+a.get('byteOffset',0);return np.array([struct.unpack_from('<'+fmt*n,binary,off+j*stride)for j in range(a['count'])])
 meshes=[]
 def walk(i,parent):
  node=g['nodes'][i]
  if 'matrix'in node:m=np.array(node['matrix']).reshape(4,4).T
  else:
   x,y,z,w=node.get('rotation',[0,0,0,1]);m=np.eye(4);m[:3,:3]=np.array([[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],[2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],[2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]])@np.diag(node.get('scale',[1,1,1]));m[:3,3]=node.get('translation',[0,0,0])
  m=parent@m
  if 'mesh'in node:
   for pi,p in enumerate(g['meshes'][node['mesh']]['primitives']):
    pos=acc(p['attributes']['POSITION']);pts=(np.c_[pos,np.ones(len(pos))]@m.T)[:,:3];idx=acc(p['indices']).astype(int).reshape(-1,3)if 'indices'in p else np.arange(len(pos)).reshape(-1,3);ns=acc(p['attributes']['NORMAL'])@np.linalg.inv(m[:3,:3]);ns/=np.linalg.norm(ns,axis=1)[:,None];meshes.append({'node':i,'name':node['name'],'primitive':pi,'positions':pts,'indices':idx,'normals':ns,'material':g['materials'][p['material']],'extras':node.get('extras',{}),'matrix':m})
  for c in node.get('children',[]):walk(c,m)
 for i in g['scenes'][g.get('scene',0)]['nodes']:walk(i,np.eye(4))
 return g,meshes
G,M=glb(paths[0]);originalG,originalM=glb(paths[-1]);profile=load(paths[1]);world=load(paths[3]);state=load(paths[4])['state'];assembly=load(paths[5]);proof=load(paths[6]);base=load(paths[7]);oldstate=load(paths[8])['state'];region=Polygon([(p['x'],p['z'])for p in proof['boundary']]);new=next(d for d in world['districts']if d['id']=='diagnostic-central-shoulder-c-feasibility')['floors'][0]
def material_core(m):return {k:m.get(k,False if k=='doubleSided'else{})for k in ['doubleSided','pbrMetallicRoughness','extensions']}
def triangles(m):return m['positions'][m['indices']]
def topology(ms):
 ts=np.concatenate([triangles(m)for m in ms]);v={};faces=[]
 for t in ts:
  f=[]
  for p in t:
   k=tuple(p);v.setdefault(k,len(v));f.append(v[k])
  faces.append(f)
 ec=collections.Counter();orient=collections.Counter()
 for face in faces:
  for a,b in zip(face,face[1:]+face[:1]):ec[tuple(sorted((a,b)))]+=1;orient[tuple(sorted((a,b)))]+=1 if a<b else -1
 return {'triangles':len(ts),'positionWeldVertices':len(v),'nonTwoIncidentEdges':sum(n!=2 for n in ec.values()),'orientationMismatchedEdges':sum(n!=0 for n in orient.values()),'signedVolume':float(np.sum(np.einsum('ij,ij->i',ts[:,0],np.cross(ts[:,1],ts[:,2])))/6)}
def pol(t):return Polygon(t[:,[0,2]])
def floortris(w):
 for d in w['districts']:
  for f in d['floors']:
   if f['kind']not in ['ground','deck']or'pool-bed'in f['id']or'stream-bed'in f['id']:continue
   pts=np.array([[v['point'][k]for k in ['x','y','z']]for v in f['vertices']]);yield d['id'],f['id'],pts[np.array(f['indices']).reshape(-1,3)]
actual=[t for _,_,ts in floortris(world)for t in ts if pol(t).area>1e-14];ap=[pol(t)for t in actual];at=STRtree(ap)
def height(t,x,z):
 a,b,c=t;den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den;v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;return u*a[1]+v*b[1]+(1-u-v)*c[1]
soil=[m for m in M if m['name'].startswith('Central shoulder')];top=soil[:2];topts=np.concatenate([triangles(m)for m in top]);topunion=unary_union([pol(t)for t in topts if pol(t).area>1e-14]);expected=np.array([[v['point'][k]for k in ['x','y','z']]for v in new['vertices']])[np.array(new['indices']).reshape(-1,3)]
def trikey(t):return tuple(sorted(tuple(v)for v in t))
expected32=expected.astype(np.float32).astype(float);expectC=collections.Counter(trikey(t)for t in expected32);actualC=collections.Counter(trikey(t)for t in topts);topParity=expectC==actualC
materialExpected={trikey(t):profile['soil']['materials'][profile['soil']['topMaterialIndices'][i]]for i,t in enumerate(expected32)};matWrong=sum(material_core(m['material'])!=material_core(materialExpected[trikey(t)])for m in top for t in triangles(m))
retained=[pol(t)for d,f,ts in floortris(world)if d!='diagnostic-central-shoulder-c-feasibility'for t in ts if pol(t).area>1e-14 and pol(t).intersects(region)];retainedUnion=unary_union(retained)
# Independent source-normal provenance on the outer boundary, using source original primitive NORMAL.
basefs={f['id']:f for d in base['districts']for f in d['floors']};originalNamed={(m['name'],m['primitive']):m for m in originalM};normalErrors=[];lengthErrors=[];downward=[]
for m in top:
 for p,n in zip(m['positions'],m['normals']):
  lengthErrors.append(abs(np.linalg.norm(n)-1))
  if n[1]<0:downward.append(p.tolist())
  if region.boundary.distance(Point(p[0],p[2]))>1e-6:continue
  materialId=0 if m is top[0]else 1;fid='Island / continuous sculpted mature terrain:'+str(materialId);f=basefs[fid];sm=originalNamed[(fid.rsplit(':',1)[0],materialId)];pts=np.array([[v['point'][k]for k in ['x','y','z']]for v in f['vertices']]);best=None
  for tri in np.array(f['indices']).reshape(-1,3):
   q=pol(pts[tri])
   if q.area<1e-14 or not q.buffer(1e-6).covers(Point(p[0],p[2])):continue
   a,b,c=pts[tri];den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);u=((b[2]-c[2])*(p[0]-c[0])+(c[0]-b[0])*(p[2]-c[2]))/den;v=((c[2]-a[2])*(p[0]-c[0])+(a[0]-c[0])*(p[2]-c[2]))/den;ref=np.array([u,v,1-u-v])@sm['normals'][tri];ref/=np.linalg.norm(ref);err=np.linalg.norm(n-ref);best=err if best is None else min(best,err)
  if best is not None:normalErrors.append(float(best))
roots=[];originalByName={m['name']:m for m in originalM}
for r in profile['rootContinuations']:
 ms=[m for m in M if m['extras'].get('ownerId')==r['ownerId']];m=ms[0];ts=triangles(m);ps=m['positions'];cell=r['binding']['ownerRecord']['cell'];foot=unary_union([pol(t)for t in ts if pol(t).area>1e-14]);bottom=ps[:,1].min();ys=[];covered=[]
 for ti in at.query(foot):
  q=foot.intersection(ap[ti])
  if q.area<1e-15:continue
  covered.append(q)
  for xy in q.exterior.coords:ys.append(float(height(actual[ti],*xy)))
 source=originalByName[r['sourceNode']];st=triangles(source)[r['sourceCapTriangles']];mat=np.array(r['sourceToAuthoredMatrix']).reshape(4,4).T;st=(np.c_[st.reshape(-1,3),np.ones(st.size//3)]@mat.T)[:,:3].reshape(-1,3,3).astype(np.float32).astype(float);sourcecaps=collections.Counter(trikey(t)for t in st);actualtri=collections.Counter(trikey(t)for t in ts);missing=sourcecaps-actualtri
 owner=next(o for o in assembly['results'][0]['trees']if o['id']==r['ownerId']);tree=owner['treeRoots'][0];binding=json.loads(m['extras']['sourceBinding']);bind=all([binding==r['binding'],binding['ownerRecord']==owner['ownerRecord'],binding['sourcePart']==tree['sourcePart'],binding['sourcePivot']==tree['sourceOrigin'],binding['matureScale']==tree['localScale'],binding['authoredMatrixWorld']==tree['authoredMatrixWorld'],binding['floorRevision']==world['revision']])
 roots.append({'id':r['ownerId'],'topology':topology(ms),'actualSourceCapMissingTriangles':sum(missing.values()),'bindingMatchesActualOwner':bind,'materialMatchesOriginalTrunk':material_core(m['material'])==material_core(source['material']),'insideOwnerHalf46':bool(np.all(np.abs(ps[:,0]-cell['x'])<=.46)&np.all(np.abs(ps[:,2]-cell['z'])<=.46)),'uncoveredDryFloorArea':foot.difference(unary_union(covered)).area,'minEmbedOverFullProjectedFoot':min(ys)-bottom,'maxEmbedOverFullProjectedFoot':max(ys)-bottom,'bottomY':float(bottom)})
oldowners=oldstate['plots']+oldstate['landmarks'];newowners=state['plots']+state['landmarks'];oldgrants=[s for d in base['districts']for s in d['sites']if s.get('placement')];overlap=[s['id']for s in oldgrants if box(s['cell']['x']-.46,s['cell']['z']-.46,s['cell']['x']+.46,s['cell']['z']+.46).intersection(region).area>1e-12];route=LineString([(6,-5.25),(9,-5.25)]).buffer(.28406937059140585,cap_style=3,join_style=2);floorunion=unary_union([p for p in ap if p.intersects(route)])
report={'scope':'Independent actual components GLB plus immutable selected v3 world/source audit. No app/visual acceptance. Float32 top precision and source-normal interpolation are separate from exact double world floor.','inputs':before,'soil':{'topology':topology(soil),'topExactFloat32TriangleMultisetParity':topParity,'topMaterialWrongTriangles':matWrong,'float32VsExactMaxAbsError':float(np.max(np.abs(expected32-expected))),'float32TopMissingExactRegionArea':region.difference(topunion).area,'float32TopOutsideExactRegionArea':topunion.difference(region).area,'float32TopVsRetainedFloorOverlap':topunion.intersection(retainedUnion).area,'sourceBoundaryNormalSamples':len(normalErrors),'maxSourceBoundaryNormalErrorL2':max(normalErrors),'maxNormalLengthError':max(lengthErrors),'downwardTopNormals':len(downward),'minimumTopY':float(topts[:,:,1].min()),'bottomY':float(np.concatenate([m['positions']for m in soil])[:,1].min())},'roots':roots,'preservation':{'oldOwnerRecords':len(oldowners),'oldOwnerRecordsIdentical':all(o in newowners for o in oldowners),'newOwnerRecords':len(newowners),'oldGrantCount':len(oldgrants),'newGrantCount':sum(s.get('placement',False)for d in world['districts']for s in d['sites']),'oldGrantFullFootprintIntersections':overlap,'frontBandClearanceHalfWidth':.28406937059140585,'frontBandUncoveredDryFloorArea':route.difference(floorunion).area},'limitations':['Topology checks positional weld, not self-intersection of every buried triangle pair.','Soil side/bottom are new closed source decisions; burial below native body has not been proven by a full original volume Boolean.','Root cap equality proves exact copied contact contour within Float32; smooth visual seam needs rendered review.','No source-only result promotes app, acquisition, interaction or whole art acceptance.']};report['finalInputs']={str(p):sha(p)for p in paths};report['inputsUnchanged']=before==report['finalInputs'];(OUT/'components-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
