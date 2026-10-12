"""Independent exported-context identity/ownership/geometry-bound screen. No render."""
import json,gzip,struct,hashlib,collections,ast
from pathlib import Path
import numpy as np
ROOT=Path('/Users/yutogasaki/Projects/sansu');ART=ROOT/'docs/design/2026-10-12-authored-central-shoulder';OUT=Path('/private/tmp/sansu-central-shoulder-source-audit');sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
s=(ART/'independent-source-audit/components-audit.py').read_text();fn=next(n for n in ast.parse(s).body if isinstance(n,ast.FunctionDef)and n.name=='glb');exec(ast.get_source_segment(s,fn))
paths=[ART/'source-context.glb',ART/'central-shoulder-source.glb',ART/'context-manifest.json',ART/'input/candidate-state.json',ART/'input/candidate-world.json.gz',ART/'input/candidate-frame-plans.json'];before={str(p):sha(p)for p in paths};assert before[str(paths[1])]=='16ff4e1a1b31a4dcb676dbc6283ec368902f08bfba2a895a436a93845a4907b8'
cg,cm=glb(paths[0]);fg,fm=glb(paths[1]);state=json.loads(paths[3].read_text())['state'];manifest=json.loads(paths[2].read_text());ids=sorted(o['id']for o in state['plots']+state['landmarks']if o.get('cell'))
def added(n):
 e=n.get('extras',{});return 'worldFloorId'in e or e.get('nativePart')=='authored-tree-root-continuation'or e.get('closed_support')==True
def meta(g):return collections.Counter(json.dumps(n['extras'],sort_keys=True)for n in g['nodes']if 'extras'in n and not added(n))
def aggregate(g,ms):
 parent={ch:i for i,n in enumerate(g['nodes'])for ch in n.get('children',[])};out={}
 for m in ms:
  if added(g['nodes'][m['node']]):continue
  own=set();i=m['node']
  while True:
   e=g['nodes'][i].get('extras',{});own.update([e[k]for k in ['objectId','ownerId']if k in e]);own.update(e.get('ownerIds',[]))
   if i not in parent:break
   i=parent[i]
  key=','.join(sorted(own))or'__shared__';v=out.setdefault(key,{'meshPrimitives':0,'triangles':0,'min':np.full(3,np.inf),'max':np.full(3,-np.inf)});v['meshPrimitives']+=1;v['triangles']+=len(m['indices']);v['min']=np.minimum(v['min'],m['positions'].min(axis=0));v['max']=np.maximum(v['max'],m['positions'].max(axis=0))
 return out
c,f=aggregate(cg,cm),aggregate(fg,fm);diff=[];maxdelta=0
for key in set(c)|set(f):
 if key not in c or key not in f:diff.append({'group':key,'missing':True});continue
 a,b=c[key],f[key];delta=max(np.max(np.abs(a['min']-b['min'])),np.max(np.abs(a['max']-b['max'])));maxdelta=max(maxdelta,delta)
 if a['triangles']!=b['triangles']or delta>2e-6:diff.append({'group':key,'trianglesBefore':a['triangles'],'trianglesAfter':b['triangles'],'boundsDelta':float(delta)})
rawdir=ROOT/'docs/design/2026-10-12-authored-whole-massing/central-shoulder-feasibility/raw/south-west-v3';rawParity={p.name:sha(p)==sha(rawdir/p.name)for p in paths[3:]};contextInputChanged=[p for p,d in manifest['initialInputs'].items()if not Path(p).exists()or sha(Path(p))!=d]
result={'scope':'Exported context metadata and per-owner/shared aggregate triangle counts and bounds. This is not exhaustive per-vertex context parity, skin lighting or app acceptance.','inputs':before,'metadataMultisetPreserved':meta(cg)==meta(fg),'metadataBeforeCount':sum(meta(cg).values()),'metadataAfterCount':sum(meta(fg).values()),'expectedOwnerCount':len(ids),'expectedOwnerIds':ids,'manifestOwnerIdsMatch':sorted(o['id']for o in manifest['owners'])==ids,'contextOwnerGroups':len(c),'fullOwnerGroups':len(f),'perOwnerAndSharedGeometryDifferences':diff,'maxContextBoundsDelta':float(maxdelta),'staticInputRawParity':rawParity,'contextManifestInputsStillMatch':not contextInputChanged,'changedContextInputs':contextInputChanged,'addedRootOwnerIds':[m['extras']['ownerId']for m in fm if m['extras'].get('nativePart')=='authored-tree-root-continuation'],'retainedFloorNodeCount':sum('worldFloorId'in n.get('extras',{})for n in fg['nodes']),'newSoilNodeCount':sum(n.get('extras',{}).get('closed_support')==True for n in fg['nodes'])};result['finalInputs']={str(p):sha(p)for p in paths};result['inputsUnchanged']=before==result['finalInputs'];(OUT/'context-audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
