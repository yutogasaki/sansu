"""Offline attribution of saved run03 points to immutable GLB triangles. No bpy."""
import json,struct,hashlib,math,time,sys
from pathlib import Path
from collections import Counter,defaultdict
import numpy as np
ROOT=Path(__file__).resolve().parents[1];OUT=Path(__file__).resolve().parent
S=json.loads((ROOT/'east-v1/study.json').read_text());M=json.loads((ROOT/'east-v1/runs/01-east-survey/measurement.json').read_text())
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
assert sha(S['inputs']['context']['path'])==S['inputs']['context']['sha256']
start=time.monotonic()
def acc(i):
 a=G['accessors'][i];v=G['bufferViews'][a['bufferView']];dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];size=np.dtype(dtype).itemsize
 assert not a.get('sparse')
 return np.ndarray((a['count'],n),dtype=dtype,buffer=BIN,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',n*size),size)).copy()
def local(n):
 if 'matrix' in n:return np.array(n['matrix'],float).reshape(4,4,order='F')
 x,y,z,w=n.get('rotation',[0,0,0,1]);r=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
 mat=np.eye(4);mat[:3,:3]=r@np.diag(n.get('scale',[1,1,1]));mat[:3,3]=n.get('translation',[0,0,0]);return mat
objects=[];floors=[];alltris=[];owners=[]
def walk(index,parent,path,meta):
 n=G['nodes'][index];matrix=parent@local(n);name=n.get('name','node-'+str(index));meta={**meta,**n.get('extras',{})};chain=path+[name]
 if 'mesh' in n:
  for pi,p in enumerate(G['meshes'][n['mesh']]['primitives']):
   if p.get('mode',4)!=4:continue  # Lines/points have no Blender loop triangles.
   pos=acc(p['attributes']['POSITION']).astype(float);assert np.isfinite(pos).all() and np.isfinite(matrix).all();pos=np.einsum('ij,nj->ni',matrix[:3,:3],pos)+matrix[:3,3];ind=acc(p['indices']).reshape(-1) if 'indices' in p else np.arange(len(pos));tri=pos[ind.reshape(-1,3)]
   lo=tri.min(axis=1);hi=tri.max(axis=1);keep=(hi[:,0]>=1.6)&(lo[:,0]<=5.4)&(hi[:,2]>=-10.8)&(lo[:,2]<=-6.8);tri=tri[keep]
   if name.startswith('authored-evaluated-floor'):floors.append(tri)
   elif not n.get('extras',{}).get('placementHitOnly') and len(tri):
    oid=len(objects);objects.append({'source':sourcekey,'id':oid,'node':index,'primitive':pi,'name':name,'path':chain,'ownerId':meta.get('ownerId'),'objectId':meta.get('objectId'),'placeId':meta.get('placeId'),'nativePart':meta.get('nativePart'),'originalSourcePartNames':meta.get('sourceNative05Names'),'triangles':len(tri)})
    alltris.append(tri);owners.extend([oid]*len(tri))
 for child in n.get('children',[]):walk(child,matrix,chain,meta)
for sourcekey in ['context','leftTrees']:
 assert sha(S['inputs'][sourcekey]['path'])==S['inputs'][sourcekey]['sha256']
 with open(S['inputs'][sourcekey]['path'],'rb') as f:
  f.seek(12);length,kind=struct.unpack('<II',f.read(8));G=json.loads(f.read(length));length,kind=struct.unpack('<II',f.read(8));BIN=f.read(length)
 for index in G['scenes'][G.get('scene',0)]['nodes']:walk(index,np.eye(4),[],{})
T=np.concatenate(alltris);OID=np.array(owners);LO=T.min(axis=1);HI=T.max(axis=1);F=np.concatenate(floors);FLO=F.min(axis=1);FHI=F.max(axis=1)
def box_tri(at,radius,low,high):
 center=np.array([at[0],at[1]+(low+high)/2,at[2]]);half=np.array([radius,(high-low)/2,radius]);ids=np.flatnonzero(np.all(HI>=center-half,axis=1)&np.all(LO<=center+half,axis=1));v=T[ids]-center
 if not len(v):return ids,ids
 edges=[v[:,1]-v[:,0],v[:,2]-v[:,1],v[:,0]-v[:,2]];axes=[np.cross(edges[0],edges[1])]+[np.cross(edge,np.eye(3)[axis]) for edge in edges for axis in range(3)];hit=np.ones(len(v),bool)
 for axis in axes:
  p=np.einsum('nij,nj->ni',v,axis);rad=np.abs(axis)@half;hit&=(p.min(axis=1)<=rad)&(p.max(axis=1)>=-rad)
 inside=np.all(np.abs(v)<half,axis=(1,2));return ids[hit],ids[hit&~inside]
def clip_height(poly,y,lower):
 result=[]
 for a,b in zip(poly,poly[1:]+poly[:1]):
  ia=a[1]>=y if lower else a[1]<=y;ib=b[1]>=y if lower else b[1]<=y
  if ia:result.append(a)
  if ia!=ib:result.append(a+(b-a)*((y-a[1])/(b[1]-a[1])))
 return result
def band_hit(at,band,tri):
 # Same clip-height / XZ polygon-distance semantics as authoredFlowerObstructions cylinderHit.
 eps=1e-8;poly=clip_height(clip_height(list(tri),at[1]+band['minY']-eps,True),at[1]+band['maxY']+eps,False)
 if not poly:return False
 positive=False;negative=False;distance=math.inf;area=0
 for a,b in zip(poly,poly[1:]+poly[:1]):
  d=b-a;cross=d[0]*(at[2]-a[2])-d[2]*(at[0]-a[0]);positive|=cross>eps;negative|=cross< -eps;den=d[0]**2+d[2]**2;t=max(0,min(1,((at[0]-a[0])*d[0]+(at[2]-a[2])*d[2])/den)) if den else 0
  distance=min(distance,math.hypot(at[0]-a[0]-d[0]*t,at[2]-a[2]-d[2]*t));area+=a[0]*b[2]-b[0]*a[2]
 return (abs(area)>eps and not(positive and negative)) or distance<=band['radius']+eps
def floor_y(point):
 x,z=point[0],point[2];ids=np.flatnonzero((FLO[:,0]<=x)&(FHI[:,0]>=x)&(FLO[:,2]<=z)&(FHI[:,2]>=z));t=F[ids]
 if not len(t):return None
 a,b,c=t[:,0],t[:,1],t[:,2];den=(b[:,2]-c[:,2])*(a[:,0]-c[:,0])+(c[:,0]-b[:,0])*(a[:,2]-c[:,2]);valid=np.abs(den)>1e-14;t=t[valid];a,b,c=a[valid],b[valid],c[valid];den=den[valid]
 u=((b[:,2]-c[:,2])*(x-c[:,0])+(c[:,0]-b[:,0])*(z-c[:,2]))/den;v=((c[:,2]-a[:,2])*(x-c[:,0])+(a[:,0]-c[:,0])*(z-c[:,2]))/den;w=1-u-v;okay=(u>=-1e-8)&(v>=-1e-8)&(w>=-1e-8)
 return float(np.max(u[okay]*a[okay,1]+v[okay]*b[okay,1]+w[okay]*c[okay,1])) if okay.any() else None
# Arithmetic sanity only, actual indexed source geometry remains unchanged.
assert len(objects)>0 and len(F)>0
c=M['candidates'][0];route=np.array(c['route']);raw={x['sample']:x for x in c['collisionSamples']};labels=['']*len(route)
for seg in c['segments']:
 for i in range(seg['start'],seg['end']):labels[i]=seg['name']
labels[-1]=c['segments'][-1]['name'];distance=np.r_[0,np.cumsum(np.linalg.norm(np.diff(route,axis=0),axis=1))]
counts=defaultdict(Counter);samples=[];mismatch=[]
for si,at in enumerate(route):
 volume,surface=box_tri(at,S['design']['clearWidth']/2,.012,S['envelope']['height']+S['design']['headReserve'])
 if bool(len(surface))!=(si in raw):mismatch.append({'sample':si,'raw':si in raw,'offline':bool(len(surface))})
 boxobjects=sorted(set(map(int,OID[surface])));bandtri=[];banddetail={}
 candidate=np.flatnonzero((HI[:,0]>=at[0]-S['envelope']['radius'])&(LO[:,0]<=at[0]+S['envelope']['radius'])&(HI[:,2]>=at[2]-S['envelope']['radius'])&(LO[:,2]<=at[2]+S['envelope']['radius'])&(HI[:,1]>=at[1]+min(b['minY'] for b in S['envelope']['bands']))&(LO[:,1]<=at[1]+S['envelope']['height']))
 for ti in candidate:
  bands=[i for i,b in enumerate(S['envelope']['bands']) if band_hit(at,b,T[ti])]
  if bands:bandtri.append(int(ti));banddetail[int(ti)]=bands
 bandobjects=sorted(set(int(OID[x]) for x in bandtri));label=labels[si]
 if si in raw:counts[label]['rawSamples']+=1
 if bandobjects:counts[label]['motionBandSamples']+=1
 if si in raw and not bandobjects:counts[label]['rawBoxOnly']+=1
 for oid in boxobjects:counts[label]['boxObject:'+str(oid)]+=1
 for oid in bandobjects:counts[label]['bandObject:'+str(oid)]+=1
 if si not in raw and not bandobjects:continue
 details=[]
 for oid in sorted(set(boxobjects+bandobjects)):
  boxids=[int(i) for i in surface if OID[i]==oid];ids=[i for i in bandtri if OID[i]==oid]
  details.append({'object':oid,'boxTriangles':len(boxids),'motionBandTriangles':len(ids),'examples':[{'triangleIndex':i,'vertices':T[i].tolist(),'relativeYRange':[float(T[i,:,1].min()-at[1]),float(T[i,:,1].max()-at[1])],'bandIndices':banddetail.get(i,[])} for i in (ids or boxids)[:4]]})
 samples.append({'sample':si,'segment':label,'at':at.tolist(),'distance3D':float(distance[si]),'raw':raw.get(si),'boxObjects':boxobjects,'motionBandObjects':bandobjects,'objects':details})
report={'status':'OFFLINE_CLASSIFICATION_ONLY_RAW_HOLD_RETAINED','rawCount':len(raw),'routeSamples':len(route),'offlineDisagreements':mismatch,'actualEnvelopeDefinition':S['envelope'],'objects':objects,'segmentCounts':dict(counts),'samples':samples,'sourceInputsBefore':{k:S['inputs'][k]['sha256'] for k in ['context','leftTrees']},'sourceInputsAfter':{k:sha(S['inputs'][k]['path']) for k in ['context','leftTrees']},'measurementSha256':sha(ROOT/'east-v1/runs/01-east-survey/measurement.json'),'scriptSha256':sha(__file__),'limits':['Independent original indexed GLB triangles, no source geometry edit','Actual motion-band cylinders remain conservative, not exact body mesh animation','Only original context+exact restored left meshes; new rails/supports not authored','Floor inlay contact is retained separately; no blanket exclusions'],'seconds':time.monotonic()-start}
assert report['sourceInputsBefore']==report['sourceInputsAfter'];p=OUT/'report.json';assert not p.exists();p.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'raw':len(raw),'disagreements':len(mismatch),'bands':sum(bool(x['motionBandObjects']) for x in samples),'rawBand':sum(x['raw'] is not None and bool(x['motionBandObjects']) for x in samples),'bySegment':dict(counts),'sha256':sha(p),'seconds':report['seconds']}))
