# Post-process retained exact native triangle samples; no runtime or source writes.
import json,math,hashlib
from pathlib import Path
p=Path('/private/tmp/sansu-whole-massing-c-terrain');raw=p/'sections.json';r=json.loads(raw.read_text());s={(x['cell']['x'],x['cell']['z']):x for x in r['samples']}
def h(x,z):return s[(x,z)]['composed']['point']['y']
results=[]
for x,target in [(7,1.4),(8,1.65),(9,1.6)]:
 # Boundary/probe pairs only .04 apart; exact original boundary must remain.
 fixed=[{'edge':'north','cell':[xx,-7.5],'height':h(xx,-7.5),'probe':[xx,-7.46],'distance':.04} for xx in [x-.46,x,x+.46]]
 if x==7:fixed +=[{'edge':'west','cell':[6.5,z],'height':h(6.5,z),'probe':[6.54,z],'distance':.04} for z in [-7.46,-7,-6.54]]
 if x==9:fixed +=[{'edge':'east','cell':[9.5,z],'height':h(9.5,z),'probe':[9.46,z],'distance':.04} for z in [-7.46,-7,-6.54]]
 minimumRequiredSlope=max(0,max((a['height']-b['height']-.56)/(a['distance']+b['distance']) for a in fixed for b in fixed))
 specificSlope=max(0,max((abs(f['height']-target)-.28)/f['distance'] for f in fixed))
 intervals=[{'diagnosticMaxGrade':L,'minCenter':max(f['height']-L*f['distance']-.28 for f in fixed),'maxCenter':min(f['height']+L*f['distance']+.28 for f in fixed)} for L in [.6,1,2,4]]
 for t in intervals:t['necessaryIntervalNonempty']=t['minCenter']<=t['maxCenter']
 results.append({'cell':[x,-7],'proposedHeight':target,'originalCenter':h(x,-7),'preservedBoundarySamples':fixed,'minimumGradeNeededForAnySupportedHeight':minimumRequiredSlope,'minimumGradeNeededForProposedHeight':specificSlope,'necessaryHeightIntervals':intervals})
# Triangle clipping identifies the cut area and any source triangles that also
# enter P04's local hash envelope, avoiding a bbox-only inference.
def clip(poly,axis,bound,greater):
 out=[]
 for a,b in zip(poly,poly[1:]+poly[:1]):
  da=(a[axis]-bound)*(1 if greater else -1);db=(b[axis]-bound)*(1 if greater else -1)
  if da>=0:out.append(a)
  if (da>=0)!=(db>=0):
   t=da/(da-db);out.append({k:a[k]+(b[k]-a[k])*t for k in a})
 return out
def clipped(t):
 poly=[v['cell'] for v in t['vertices']]
 for axis,bound,greater in [('x',6.5,True),('x',9.5,False),('z',-7.5,True),('z',-5.9,False)]:
  poly=clip(poly,axis,bound,greater)
  if not poly:return []
 return poly
def area(poly):return abs(sum(a['x']*b['z']-b['x']*a['z'] for a,b in zip(poly,poly[1:]+poly[:1]))/2) if len(poly)>2 else 0
changes=[]
for t in r['composedTriangles']:
 a=area(clipped(t))
 if a>1e-10:
  changes.append({'floorId':t['floorId'],'kind':t['kind'],'triangle':t['triangle'],'clippedArea':a,'alsoTouchesCoveHashEnvelope':max(v['cell']['z'] for v in t['vertices'])>=-3.5})
summary={'scope':'Necessary bounds only; no authored surface has been made. Grade caps .6/1/2/4 are explicit diagnostic design assumptions, not a new runtime rule. A closed retaining bank could satisfy support with steeper local grade, so an empty interval rejects a gentle transition at that cap, not every conceivable geometry.','sectionInputSha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'fixedBoundaryNecessaryConditions':results,'changedTrianglesByFloor':{f:sum(x['floorId']==f for x in changes) for f in set(x['floorId'] for x in changes)},'cutProjectedAreaByFloor':{f:sum(x['clippedArea'] for x in changes if x['floorId']==f) for f in set(x['floorId'] for x in changes)},'cutTrianglesAlsoTouchingCoveHashEnvelope':[x for x in changes if x['alsoTouchesCoveHashEnvelope']],'visibleStrip':{'centerZ':-6.25,'widths':[{'width':w,'north':-6.25-w/2,'south':-6.25+w/2,'pastCoreSouthBy':max(0,-6.25+w/2+5.9)} for w in [.7,.75,.8]],'ownerFront':-6.54,'actorClearanceRadius':.28406937059140585,'centerDistanceFromOwnerFront':.29,'clearanceRemainingBeyondNormalOwnerFootprint':.29-.28406937059140585}}
(p/'constraints.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary))
