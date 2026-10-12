"""Exact GEOS union proof over actual current dry triangles for the full body sweep.
The source-triangle obstruction/actor-band route kernel remains in the JS probe.
"""
import json,hashlib,shapely
from pathlib import Path
from shapely.geometry import Polygon,box
from shapely.ops import unary_union
ROOT=Path(__file__).resolve().parent
context_path=Path('/private/tmp/sansu-authored-cove-entrance/actual-context.json')
context=json.loads(context_path.read_text())
patch_path=ROOT/'shared-apron-world-patch-v1.json';patch=json.loads(patch_path.read_text())
prior=json.loads((ROOT/'feasibility-v1.json').read_text());radius=prior['actorEnvelope']['radius']+.04
triangles=[];heights=[]
for floor in context['floors']:
    for i in range(0,len(floor['indices']),3):
        points=[floor['vertices'][j] for j in floor['indices'][i:i+3]]
        if not all(5.5<p[0]<10.5 and -.9<p[2]<2.3 and -.011<p[1]<.2 for p in points):continue
        p=Polygon([(p[0],p[2]) for p in points])
        if p.area>1e-12:triangles.append(p);heights.extend(p[1] for p in points)
support=unary_union(triangles)
routes=list(zip(patch['routePoints'],patch['routePoints'][1:]))+[([8,1.7],[8,1])]
results=[]
for a,b in routes:
    sweep=box(min(a[0],b[0])-radius,min(a[1],b[1])-radius,max(a[0],b[0])+radius,max(a[1],b[1])+radius)
    gap=sweep.difference(support)
    results.append({'from':a,'to':b,'radius':radius,'uncoveredArea':gap.area,'covered':gap.area<1e-8})
result={'candidate':patch['candidate'],'scope':'fixed P04 new route and play-entry full width dry support; not whole-island support proof',
 'method':'Exact planar union of actual low dry floor triangles and difference from edge AABBs expanded by maximum measured actor radius plus 40 mm; conservative for diagonal/circular sweeps',
 'library':{'shapely':shapely.__version__,'geos':shapely.geos_version_string},'triangle_count':len(triangles),'support_height_range':[min(heights),max(heights)],
 'patch_sha256':hashlib.sha256(patch_path.read_bytes()).hexdigest(),'context_sha256':hashlib.sha256(context_path.read_bytes()).hexdigest(),
 'world_sha256':hashlib.sha256((ROOT.parents[2]/'prototypes/place-qa/native05-world.json.gz').read_bytes()).hexdigest(),
 'results':results,'all_covered':all(r['covered'] for r in results)}
(ROOT/'full-width-support-v3.json').write_text(json.dumps(result,indent=2)+'\n')
assert result['all_covered'],result
print(json.dumps({'all_covered':result['all_covered'],'max_gap':max(r['uncoveredArea'] for r in results),'heights':result['support_height_range']}))
