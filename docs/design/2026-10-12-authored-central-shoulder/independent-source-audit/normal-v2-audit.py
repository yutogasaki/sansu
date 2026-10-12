"""Independently prove the normal-v2 changes only declared top NORMAL bytes."""
import ast,json,gzip,struct,hashlib,collections
from pathlib import Path
import numpy as np
ART=Path('/Users/yutogasaki/Projects/sansu/docs/design/2026-10-12-authored-central-shoulder');OUT=Path('/private/tmp/sansu-central-shoulder-source-audit');sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
s=(ART/'independent-source-audit/components-audit.py').read_text();exec(ast.get_source_segment(s,next(n for n in ast.parse(s).body if isinstance(n,ast.FunctionDef)and n.name=='glb')))
results=[]
for a,b in [('central-shoulder-components.glb','central-shoulder-components-normal-v2.glb'),('central-shoulder-source.glb','central-shoulder-source-normal-v2.glb')]:
 old=(ART/a).read_bytes();new=(ART/b).read_bytes();l=struct.unpack_from('<I',old,12)[0];g=json.loads(old[20:20+l]);ranges=[];normalids=[]
 for node in g['nodes']:
  if node.get('name')!='Central shoulder / continuous closed supporting soil':continue
  for p in g['meshes'][node['mesh']]['primitives'][:2]:
   ni=p['attributes']['NORMAL'];normalids.append(ni);acc=g['accessors'][ni];view=g['bufferViews'][acc['bufferView']];start=28+l+view.get('byteOffset',0)+acc.get('byteOffset',0);stride=view.get('byteStride',12);ranges.extend((start+i*stride,start+i*stride+12)for i in range(acc['count']))
 allowed=set(k for a,b in ranges for k in range(a,b));diff=[i for i,(a,b)in enumerate(zip(old,new))if a!=b];results.append({'old':a,'new':b,'oldSha256':sha(ART/a),'newSha256':sha(ART/b),'sameLength':len(old)==len(new),'identicalJsonChunk':old[20:20+l]==new[20:20+l],'changedBytes':len(diff),'changesOutsideTopNormal':len(set(diff)-allowed),'normalAccessorIds':normalids})
profile=json.loads(gzip.decompress((ART/'geometry-profile.json.gz').read_bytes()));g,meshes=glb(ART/'central-shoulder-components-normal-v2.glb');soil=[m for m in meshes if m['name'].startswith('Central shoulder')][:2];expected={tuple(np.array(p,dtype=np.float32).astype(float)):np.array(n)for p,n in zip(profile['soil']['positions'],profile['soil']['topNormals'])};errors=[float(np.linalg.norm(n-expected[tuple(p)]))for m in soil for p,n in zip(m['positions'],m['normals'])];r={'scope':'NORMAL-v2 independent byte-range audit; all original geometry/guard conclusions carry only because every non-top-NORMAL byte is unchanged. No rendered seam/app acceptance.','comparisons':results,'profileNormalSamples':len(errors),'maxUnitNormalDeltaVsProfile':max(errors),'profileSha256':sha(ART/'geometry-profile.json.gz')};(OUT/'normal-v2-audit.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,indent=2))
