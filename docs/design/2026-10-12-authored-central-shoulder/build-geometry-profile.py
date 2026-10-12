"""Exact handed-off top, source normals/materials, closed soil and source-contour root continuations.
Run with the existing geometry venv. Does not change app, source GLB, floor positions or owner matrices.
"""
import json,gzip,struct,hashlib,math,collections
from pathlib import Path
import numpy as np
from shapely.geometry import Polygon,Point
from shapely.strtree import STRtree
ROOT=Path(__file__).resolve().parent;REPO=ROOT.parents[2]
load=lambda p:json.loads(gzip.decompress(p.read_bytes()))if p.suffix=='.gz' else json.loads(p.read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
source=REPO/'docs/design/2026-10-10-island-final-3d/whole-island.glb'
assert sha(source)=='8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d'
hand=load(ROOT/'input/selected-v3-handoff.json.gz'); floors=load(ROOT/'input/compiled-floors.json')['floors']; trunk=load(ROOT/'input/native-trunk-bases.json')
base=load(REPO/'prototypes/place-qa/native05-world.json.gz');basefloors={f['id']:f for d in base['districts']for f in d['floors']}
raw=source.read_bytes();ln=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+ln]);binary=raw[28+ln:]
inputs={str(p.relative_to(REPO)):sha(p)for p in [source,ROOT/'input/selected-v3-handoff.json.gz',ROOT/'input/compiled-floors.json',ROOT/'input/native-trunk-bases.json',REPO/'prototypes/place-qa/native05-world.json.gz']}
def accessor(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC3':3}[a['type']];fmt={5126:'f',5125:'I',5123:'H'}[a['componentType']];size=struct.calcsize(fmt);stride=v.get('byteStride',n*size);off=v.get('byteOffset',0)+a.get('byteOffset',0)
 return np.array([struct.unpack_from('<'+fmt*n,binary,off+j*stride)for j in range(a['count'])])
def unit(v):
 n=np.linalg.norm(v);return v/n if n>1e-30 else np.array([0.,1.,0.])
def bary(tri,x,z):
 a,b,c=tri;den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den;v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;return np.array([u,v,1-u-v])
def xyz(v):return [v['point'][k]for k in ['x','y','z']]
def f32(p):return tuple(float(x)for x in np.array(p,dtype=np.float32))
def floor_name(f):return json.loads(f['id'])[1]
# The named native floor nodes are active roots in the approved source.
sourceparts={}
for name,f in basefloors.items():
 name0,serial=name.rsplit(':',1);ni=next(i for i,n in enumerate(g['nodes'])if n['name']==name0);n=g['nodes'][ni]
 assert ni in g['scenes'][g.get('scene',0)]['nodes'] and not any(ni in p.get('children',[])for p in g['nodes'])
 if 'matrix' in n:linear=np.array(n['matrix']).reshape(4,4).T[:3,:3]
 else:
  x,y,z,w=n.get('rotation',[0,0,0,1]);rotation=np.array([[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],[2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],[2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]]);linear=rotation@np.diag(n.get('scale',[1,1,1]))
 p=g['meshes'][n['mesh']]['primitives'][int(serial)];normal_matrix=np.linalg.inv(linear).T;norms=np.array([unit(normal_matrix@v)for v in accessor(p['attributes']['NORMAL'])]);points=np.array([xyz(v)for v in f['vertices']]);indices=np.array(f['indices']).reshape(-1,3)
 assert len(points)==len(norms)
 triangles=points[indices];polys=[Polygon(t[:,[0,2]])for t in triangles];sourceparts[name]={'points':points,'indices':indices,'triangles':triangles,'normals':norms,'material':g['materials'][p['material']],'tree':STRtree(polys),'polys':polys}
def source_normal(part,point):
 q=Point(point[0],point[2]);best=None
 for ti in part['tree'].query(q.buffer(2e-7)):
  tri=part['triangles'][ti];b=bary(tri,point[0],point[2])
  if min(b)>=-2e-5:
   score=abs(float(b@tri[:,1])-point[1]);choice=(score,int(ti),b)
   if best is None or score<best[0]:best=choice
 if best is None:raise ValueError(('source normal point missing',point))
 _,ti,b=best;return unit(b@part['normals'][part['indices'][ti]])
region=Polygon([(p['x'],p['z'])for p in hand['boundary']]);new=hand['replacementDistrict']['floors'][0];rawpoints=np.array([xyz(v)for v in new['vertices']]);rawindices=np.array(new['indices']).reshape(-1,3)
# Only Float32-identical positions are shared in the editable mesh. The handoff top is retained separately, unmodified.
keys={};points=[];remap=[]
for p in rawpoints:
 k=f32(p)
 if k not in keys:keys[k]=len(points);points.append(k)
 remap.append(keys[k])
points=np.array(points);indices=np.array(remap)[rawindices];assert all(len(set(t))==3 for t in indices)
acc=np.zeros_like(points);edgecount=collections.Counter();edges={}
for tri in indices:
 a,b,c=points[tri];normal=np.cross(b-a,c-a)
 if normal[1]<0:normal=-normal
 for k in tri:acc[k]+=normal
 for a,b in zip(tri,np.roll(tri,-1)):
  edge=tuple(sorted((int(a),int(b))));edgecount[edge]+=1;edges[edge]=(int(a),int(b))
assert max(edgecount.values())==2
boundary=[edges[e]for e,count in edgecount.items()if count==1]
assert all(region.boundary.distance(Point(*(points[a][[0,2]]+points[b][[0,2]])/2))<1e-6 for a,b in boundary)
# Source-reference normals for each unique vertex, using the exact material/triangle lineage handed off.
refs=[[]for _ in points]
for ti,tri in enumerate(rawindices):
 lineage=hand['triangleMaterialLineage'][ti];part=sourceparts[lineage['sourceFloorId']];st=int(lineage['sourceTriangle']);srctri=part['triangles'][st]
 for rawid in tri:
  p=rawpoints[rawid];weights=bary(srctri,p[0],p[2]);refs[remap[rawid]].append(unit(weights@part['normals'][part['indices'][st]]))
norms=[];boundary_norm_error=0
for i,p in enumerate(points):
 authored=unit(acc[i]);ref=unit(np.mean(refs[i],axis=0));distance=region.boundary.distance(Point(p[0],p[2]));w=min(1,max(0,distance/.16));w=w*w*(3-2*w)
 normal=unit(ref*(1-w)+authored*w);norms.append(normal)
 if distance<1e-6:boundary_norm_error=max(boundary_norm_error,float(np.linalg.norm(normal-ref)))
norms=np.array(norms)
soil_min_y=float(points[:,1].min())-.30;bottom=points.copy();bottom[:,1]=soil_min_y;n=len(points)
faces=indices.tolist()+[[int(c+n),int(b+n),int(a+n)]for a,b,c in indices]
for a,b in boundary:faces.extend([[b,a,a+n],[b,a+n,b+n]])
counts=collections.Counter(tuple(sorted((a,b)))for face in faces for a,b in zip(face,face[1:]+face[:1]));assert set(counts.values())=={2}
# Top face corner normals are authored separately from buried sides/bottoms.
soil={'name':'Central shoulder / continuous closed supporting soil','positions':np.vstack([points,bottom]).tolist(),'indices':[i for f in faces for i in f],
 'topTriangleCount':len(indices),'topOriginalIndices':new['indices'],'topOriginalPositions':rawpoints.tolist(),'topRawToMeshVertex':remap,
 'topNormals':norms.tolist(),'topMaterialIndices':[0 if x['sourceFloorId'].endswith(':0')else 1 for x in hand['triangleMaterialLineage']],
 'materials':[sourceparts['Island / continuous sculpted mature terrain:'+str(i)]['material']for i in [0,1]]}
soilmat=next(m for m in g['materials']if m['name']=='shore / pale sand');soil['materials'].append(soilmat)
# Retained floor source normals are carried through at unchanged original vertices and interpolated on source triangles at clips.
prepared=[];floorqa=[]
for f in floors:
 name=floor_name(f)
 if name==new['id']:continue
 ps=np.array([xyz(v)for v in f['vertices']]);ids=np.array(f['indices']).reshape(-1,3)
 if name in sourceparts:
  part=sourceparts[name];ns=[];direct=0;interpolated=0
  for i,p in enumerate(ps):
   if i<len(part['points']) and np.max(np.abs(p-part['points'][i]))<1e-8:ns.append(part['normals'][i]);direct+=1
   else:ns.append(source_normal(part,p));interpolated+=1
  material=part['material']
 else:
  ns=np.zeros_like(ps)
  for tri in ids:
   a,b,c=ps[tri];nrm=np.cross(b-a,c-a)
   for i in tri:ns[i]+=nrm
  ns=np.array([unit(n)for n in ns]);hexcolor=f['color'];srgb=[int(hexcolor[i:i+2],16)/255 for i in [1,3,5]];linear=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in srgb]
  material={'name':'Existing evaluated floor / '+f['id'],'pbrMetallicRoughness':{'baseColorFactor':linear+[1],'roughnessFactor':.95,'metallicFactor':0},'doubleSided':True};direct=interpolated=0
 prepared.append({'name':'World floor / '+f['id'],'floorId':f['id'],'positions':ps.tolist(),'indices':f['indices'],'normals':np.asarray(ns).tolist(),'material':material})
 floorqa.append({'id':f['id'],'sourceNormalsDirect':direct,'sourceNormalsInterpolated':interpolated,'sourceMaterial':name in sourceparts})
# Exact final dry floor triangles for root underside contact, with no invented supporting ground.
actual=[];actualpolys=[]
for f in floors:
 if f['kind']!='ground':continue
 ps=np.array([xyz(v)for v in f['vertices']])
 for tri in np.array(f['indices']).reshape(-1,3):
  t=ps[tri];p=Polygon(t[:,[0,2]])
  if p.area>1e-14:actual.append(t);actualpolys.append(p)
atree=STRtree(actualpolys);roots=[];rootqa=[]
for owner in trunk['owners']:
 part=owner['parts'][0];ps=np.array(part['positions']);ns=np.array(part['normals']);cap=[x['indices']for x in part['capCandidates']]
 assert len(cap)==8
 unique={};top=[];capfaces=[]
 for tri in cap:
  face=[]
  for i in tri:
   k=f32(ps[i])
   if k not in unique:unique[k]=len(top);top.append(k)
   face.append(unique[k])
  capfaces.append(face)
 top=np.array(top);ec=collections.Counter();ed={}
 for face in capfaces:
  for a,b in zip(face,face[1:]+face[:1]):ec[tuple(sorted((a,b)))]+=1;ed[tuple(sorted((a,b)))]=(a,b)
 ring=[ed[e]for e,n in ec.items()if n==1];assert len(ring)==10
 next_vertex={b:a for a,b in ring};seq=[ring[0][0]]
 while next_vertex[seq[-1]]!=seq[0]:seq.append(next_vertex[seq[-1]])
 assert len(seq)==10;foot=Polygon(top[seq][:,[0,2]]);assert foot.is_valid
 # A small continuation of the actual decagonal source contour, gently splayed 4% into the soil.
 center=top[:,[0,2]].mean(axis=0);bottomxz=center+(top[:,[0,2]]-center)*1.04;foot_bottom=Polygon(bottomxz[seq]);coverage=[];heights=[]
 for ti in atree.query(foot_bottom):
  q=foot_bottom.intersection(actualpolys[ti])
  if q.area<=1e-16:continue
  coverage.append(q)
  for xy in q.exterior.coords:heights.append(float(bary(actual[ti],xy[0],xy[1])@actual[ti][:,1]))
 from shapely.ops import unary_union
 uncovered=foot_bottom.difference(unary_union(coverage)).area;assert uncovered<1e-12
 min_floor=min(heights);bottomy=min_floor-.006;bottom=np.column_stack([bottomxz[:,0],np.full(len(top),bottomy),bottomxz[:,1]])
 # Cap copied in reverse: original tree stays once and unmodified; these internal upper faces close the addition.
 rootfaces=[list(reversed(f))for f in capfaces]+[[i+len(top)for i in f]for f in capfaces]
 for a,b in ring:rootfaces.extend([[a,b,b+len(top)],[a,b+len(top),a+len(top)]])
 cc=collections.Counter(tuple(sorted((a,b)))for f in rootfaces for a,b in zip(f,f[1:]+f[:1]));assert set(cc.values())=={2}
 topnorm=[]
 for p in top:
  choices=[ns[i]for i,v in enumerate(ps)if np.linalg.norm(v-p)<2e-6 and ns[i][1]>-.5]
  topnorm.append(unit(np.mean(choices,axis=0)).tolist()if choices else unit(np.array([p[0]-center[0],0,p[2]-center[1]])).tolist())
 allp=np.vstack([top,bottom]);bounds=[allp.min(axis=0).tolist(),allp.max(axis=0).tolist()];cell=owner['cell'];inside=all(abs(p[0]-cell['x'])<=.46 and abs(p[2]-cell['z'])<=.46 for p in allp);assert inside
 roots.append({'name':owner['ownerId']+' / source-contour planted root continuation','ownerId':owner['ownerId'],'sourceNode':owner['sourceNode'],'positions':allp.tolist(),'indices':[i for f in rootfaces for i in f],'upperCapTriangles':len(capfaces),'topNormals':topnorm,'material':part['material'],'sourceCapTriangles':[p['triangle']for p in part['capCandidates']],'sourceToAuthoredMatrix':owner['sourceToAuthoredMatrix']})
 rootqa.append({'ownerId':owner['ownerId'],'closed':True,'nonmanifoldEdges':0,'contourVertices':len(top),'triangles':len(rootfaces),'bounds':bounds,'insideOwnerHalf46':inside,'uncoveredDryFloorArea':uncovered,'lowestFloorOverFullFootprint':min_floor,'bottomY':bottomy,'minimumFullFootprintEmbed':.006,'topCapCopiedFromOriginal':True,'originalTreeUnchanged':True})
# Normals and materials are visual attributes; physical top stays exactly the handed-off double-precision input.
profile={'candidate':'native05-central-shoulder-sw-v3-source-v1','scope':'Editable source candidate. Exact selected SW v3 top; closed support and owner-specific root continuations. Not app or acquisition acceptance.',
 'coordinateContract':{'positions':'authored world Y-up','gltf':'identity transform','blender':'(x,-z,y)','renderer':'(x-layout.center,y,z-2)'},'source':{'path':str(source.relative_to(REPO)),'sha256':sha(source)},'soil':soil,'retainedFloors':prepared,'rootContinuations':roots,
 'newFloorAttributes':{'floorId':new['id'],'normals':norms[np.array(remap)].tolist(),'triangleMaterialIndices':soil['topMaterialIndices'],'materials':soil['materials'][:2],'physicalPositionsAndIndices':'exact handoff replacementDistrict; attributes only'},
 'normalPolicy':{'boundary':'source NORMAL barycentrically interpolated from exact original triangle provenance','interior':'area-weighted actual new faces, shared across material0/1','boundaryBlendWidth':.16,'blend':'smoothstep distance / .16; coordinates unchanged'},'materialLineage':hand['triangleMaterialLineage']}
kit_path=REPO/'docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz';kit_manifest=load(REPO/'docs/design/2026-10-11-native-owned-island/kit-manifest.json');world_input=load(ROOT/'input/candidate-world.json.gz')
for root in profile['rootContinuations']:
 owner=next(o for o in hand['ownerTransforms']if o['id']==root['ownerId']);tree=owner['treeRoots'][0]
 root['binding']={'ownerRecord':owner['ownerRecord'],'sourcePart':tree['sourcePart'],'sourcePivot':tree['sourceOrigin'],'matureScale':tree['localScale'],'sourceId':kit_manifest['candidate'],'sourceSha256':kit_manifest['sourceSha256'],'kitExpandedSha256':kit_manifest['sha256'],'kitGzipSha256':sha(kit_path),'authoredMatrixWorld':tree['authoredMatrixWorld'],'floorWorldId':world_input['id'],'floorRevision':world_input.get('revision'),'coordinateSpace':'authored world Y-up; identity source node, renderer subtracts layout.center and z2','lifecycle':'Only while this source part, owner record maturity, cell, full owner transform and composed floor revision match this audited case. Remove on move, storage, young form, source change or floor revision mismatch. Recompute contact before reuse elsewhere. No additional owner or right.'}
encoded=json.dumps(profile,separators=(',',':')).encode();(ROOT/'geometry-profile.json.gz').write_bytes(gzip.compress(encoded,compresslevel=9,mtime=0))
originalsign=[];f32sign=[]
for a,b,c in rawpoints[rawindices]:originalsign.append(float(np.cross(b-a,c-a)[1]))
for a,b,c in points[indices]:f32sign.append(float(np.cross(b-a,c-a)[1]))
slivers=[{'triangle':i,'sourceSignedY':a,'float32SignedY':b}for i,(a,b)in enumerate(zip(originalsign,f32sign))if a*b<=0]
qa={'inputs':inputs,'closedSoil':{'topTriangles':len(indices),'topUniqueFloat32Vertices':n,'outsideBoundaryEdges':len(boundary),'internalBoundaryEdges':0,'collapsedTriangles':0,'nonmanifoldEdges':0,'sideTriangles':len(boundary)*2,'bottomTriangles':len(indices),'bottomY':soil_min_y,'minThickness':.30,'topFloat32MaxAbsError':float(np.max(np.abs(np.array([points[i]for i in remap])-rawpoints))),'boundaryNormalDifferenceMaxL2':boundary_norm_error,'float32OrientationSlivers':slivers},'retainedFloorNormals':floorqa,'rootContinuations':rootqa,'sourceUnchanged':sha(source)==inputs[str(source.relative_to(REPO))]}
(ROOT/'geometry-profile-qa.json').write_text(json.dumps(qa,indent=2)+'\n');print(json.dumps({'candidate':profile['candidate'],'closedSoil':qa['closedSoil'],'roots':rootqa,'profileBytes':len(encoded),'profileGzipBytes':(ROOT/'geometry-profile.json.gz').stat().st_size},indent=2))
