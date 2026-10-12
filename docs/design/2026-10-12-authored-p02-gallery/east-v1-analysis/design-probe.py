"""One bounded numeric design check. No Blender, source build, world compiler, or optimizer."""
from pathlib import Path
import json,hashlib,math,sys
P=Path(__file__).resolve().parent;source=P/'analyze.py'
s=source.read_text();env={'__file__':str(source),'__name__':'read_only_source_accessors'};exec(compile(s[:s.index("c=M['candidates'][0]")],str(source),'exec'),env)
np=env['np'];S=env['S'];M=env['M'];T=env['T'];F=env['F'];objects=env['objects'];OID=env['OID'];box_tri=env['box_tri'];band_hit=env['band_hit'];sha=env['sha']
sys.path.insert(0,str(P.parent/'east-v1'));from entry_geometry import Terrain,clip,polygon_area,plane_y,slope_report,EPS
terrain=Terrain(F.tolist());c=M['candidates'][0];R=1.24;D=S['design'];entry=np.array(c['entry']);front=np.array(c['nativeFront']);arrival=np.array(c['arrival']);joint=np.array(c['frontBoughJunction']);top=M['interiorTopY'];galleryY=M['galleryStartY'];cx,_,cz=S['transform']['authoredOrigin']
# Threshold→aligned front bough is the only ground-seamed corridor; source terrain untouched.
d=joint-entry;run=math.hypot(d[0],d[2]);tangent=np.array([d[0]/run,0,d[2]/run]);side=np.array([-d[2]/run,0,d[0]/run]);width=D['structuralWidth']
a=entry-side*width/2;b=entry+side*width/2;c1=joint+side*width/2;d1=joint-side*width/2
quad=[a.tolist(),b.tolist(),c1.tolist(),d1.tolist()];pieces=[];uncoveredArea=run*width;maxGround=-math.inf;minLift=math.inf;maxLift=-math.inf;negative=[]
for i in terrain.nearby(quad):
 ground=terrain.triangles[i];poly=clip(quad,ground);area=polygon_area(poly) if len(poly)>=3 else 0
 if area<=1e-12:continue
 uncoveredArea-=area;vs=[]
 for p in poly:
  g=plane_y(p,ground);u=max(0,min(1,((np.array(p)-entry)@tangent)/run));y=g+(top-g)*u;maxGround=max(maxGround,g);minLift=min(minLift,y-g);maxLift=max(maxLift,y-g);vs.append([p[0],y,p[2]])
  if y<g-EPS:negative.append({'triangle':i,'at':p,'gap':y-g,'u':u})
 pieces.append({'triangle':i,'area':area,'vertices':vs})
section=terrain.section(a.tolist(),b.tolist(),float(entry[1]));
# Raw box classification with a same-radius circular corridor: informative only, no rule override.
raw_reserved=[]
for hit in M['candidates'][0]['collisionSamples']:
 at=np.array(hit['point']);_,ids=box_tri(at,D['clearWidth']/2,.012,S['envelope']['height']+D['headReserve']);reserved=[int(i) for i in ids if band_hit(at,{'radius':D['clearWidth']/2,'minY':.012,'maxY':S['envelope']['height']+D['headReserve']},T[i])]
 raw_reserved.append({'sample':hit['sample'],'reservedCylinderObjects':sorted(set(int(OID[i]) for i in reserved))})
# Single proposed radius/aligned approach, no sweep over candidates.
steps=math.ceil((75+68)/360*144);ramp=[]
for i in range(steps+1):
 t=i/steps;ang=math.radians(-68+143*t);ramp.append(np.array([cx+R*math.cos(ang),top+(galleryY-top)*(3*t*t-2*t*t*t),cz-R*math.sin(ang)]))
gallery=[]
for item in M['galleryLocalTopProbes']:
 ang=math.radians(item['degrees']);r=D['shortGalleryCenterRadius'];gallery.append(np.array([cx+r*math.cos(ang),item['hit'][1],cz-r*math.sin(ang)]))
# Ground connector centre follows actual ground blend; no geometry artifact is constructed/exported.
connector=[]
for i in range(13):
 t=i/12;p=entry+(joint-entry)*t;g=terrain.top_y(p);assert g is not None;p[1]=g+(top-g)*t;connector.append(p)
legs=[('terrain-connector',connector),('aligned-opening',[joint,front]),('inside',[front,arrival]),('inside-return',[arrival,front]),('opening-return',[front,joint]),('front-bough',[joint,ramp[0]]),('east-ramp',ramp),('radial-join',[ramp[-1],gallery[0]]),('gallery',gallery)]
route=[];labels=[]
for label,pts in legs:
 for a,b in zip(pts,pts[1:]):
  n=max(1,math.ceil(np.linalg.norm(b-a)/D['probeStep']))
  for i in range(n):route.append(a+(b-a)*i/n);labels.append(label)
route.append(gallery[-1]);labels.append('gallery')
hits=[]
for si,(at,label) in enumerate(zip(route,labels)):
 _,indices=box_tri(at,D['clearWidth']/2,.012,S['envelope']['height']+D['headReserve'])
 if not len(indices):continue
 bandids=[int(i) for i in indices if any(band_hit(at,b,T[i]) for b in S['envelope']['bands'])]
 hits.append({'sample':si,'segment':label,'point':at.tolist(),'boxObjects':sorted(set(int(OID[i]) for i in indices)),'bandObjects':sorted(set(int(OID[i]) for i in bandids))})
report={'status':'SINGLE_NUMERIC_DESIGN_PROBE_NOT_SOURCE_BUILD','radiusProposal':R,'entry':entry.tolist(),'joint':joint.tolist(),'width':width,'connectorLengthXZ':run,'terrainSeam':section,'terrainDomainArea':run*width,'terrainClipPieces':len(pieces),'terrainUncoveredSignedArea':uncoveredArea,'maxGroundY':maxGround,'nativeInteriorTopY':top,'topMinusGroundRange':[minLift,maxLift],'negativeTopVertices':negative,'proposedCentreSlopes':slope_report([x.tolist() for x in connector]),'rampSlope':slope_report([x.tolist() for x in ramp]),'originalReservedCylinderClassifications':raw_reserved,'proposalSamples':len(route),'proposalHits':hits,'objects':objects,'inputSha256':{'measurement':sha(P.parent/'east-v1/runs/01-east-survey/measurement.json'),'context':sha(S['inputs']['context']['path']),'leftTrees':sha(S['inputs']['leftTrees']['path'])},'limits':['One candidate only, no source geometry built or saved','Full source-ground clipped topology/closed joints still pending build','Actual all-triangle motion bands not rerun for new non-box-hit samples','No runtime/art pass; raw east-v1 unchanged']}
out=P/'design-probe.json';assert not out.exists();out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'sha256':sha(out),'terrainCoveredSignedError':uncoveredArea,'negativeTopVertices':len(negative),'maxGroundY':maxGround,'nativeY':top,'rawOriginalReservedCylinderStructuralSamples':sum(any(i!=19 for i in h['reservedCylinderObjects']) for h in raw_reserved),'proposalBoxSamples':len(hits),'proposalStructuralSamples':[h for h in hits if any(i!=19 for i in h['boxObjects'])]}))
