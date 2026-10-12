"""Author a shallow asymmetric shore arc outside existing dry ground.
Only the added low shore is exported; original triangles stay byte-identical.
"""
import json,hashlib,shapely
from pathlib import Path
from shapely.geometry import Polygon,box
from shapely.ops import unary_union
ROOT=Path(__file__).resolve().parent
context_path=Path('/private/tmp/sansu-authored-cove-entrance/actual-context.json')
context=json.loads(context_path.read_text())
# Native coast joins lie inside the old floor. The shallow arc bends outward
# through the full-width approach, instead of filleting a rectangular platform.
segments=[
 [(6.48,-.56),(6.34,-.54),(6.15,-.35),(6.10,-.03)],
 [(6.10,-.03),(6.03,.45),(6.02,1.24),(6.12,1.72)],
 [(6.12,1.72),(6.19,2.055),(6.42,2.12),(6.90,2.18)],
 [(6.90,2.18),(7.55,2.265),(8.35,2.28),(9.04,2.215)],
 [(9.04,2.215),(9.52,2.17),(9.95,2.17),(10.10,1.86)],
 [(10.10,1.86),(10.28,1.49),(10.24,.91),(10.02,.64)],
]
outline_points=[]
for control in segments:
 for i in range(32):
  t=i/32;s=1-t
  outline_points.append(tuple(s**3*control[0][k]+3*s*s*t*control[1][k]+3*s*t*t*control[2][k]+t**3*control[3][k] for k in (0,1)))
outline_points.append(tuple(segments[-1][-1]))
# Close through existing terrain; this chord is removed by the exact difference.
outline=Polygon(outline_points)
assert outline.is_valid
triangles=[]
for floor in context['floors']:
 if 'apron' in floor['id']:continue
 for i in range(0,len(floor['indices']),3):
  points=[floor['vertices'][j] for j in floor['indices'][i:i+3]]
  p=Polygon([(v[0],v[2]) for v in points])
  if p.area>1e-12 and p.intersects(outline):triangles.append(p)
existing=unary_union(triangles)
added=outline.difference(existing)
polygons=list(added.geoms) if added.geom_type=='MultiPolygon' else [added]
polygons=[p for p in polygons if p.area>1e-8]
assert len(polygons)==1 and not polygons[0].interiors,(len(polygons),added.geom_type)
prior=json.loads((ROOT/'history/v3-rectangular-apron/shared-apron-world-patch-v1.json').read_text())
radius=json.loads((ROOT/'feasibility-v1.json').read_text())['actorEnvelope']['radius']+.04
sweep=unary_union([box(min(a[0],b[0])-radius,min(a[1],b[1])-radius,max(a[0],b[0])+radius,max(a[1],b[1])+radius) for a,b in list(zip(prior['routePoints'],prior['routePoints'][1:]))+[([8,1.7],[8,1])]])
gap=sweep.difference(existing.union(added)).area
assert gap<1e-8,{'full_width_gap':gap}
result={'candidate':'native05-authored-cove-shore-v4','sourceId':'native05-authored-cove-corner-v3',
 'method':'Piecewise cubic sea-facing arc, exact GEOS difference from existing dry triangles; no original-floor changes',
 'library':{'shapely':shapely.__version__,'geos':shapely.geos_version_string},'bezier_control_points':segments,
 'source_world_sha256':hashlib.sha256((ROOT.parents[2]/'prototypes/place-qa/native05-world.json.gz').read_bytes()).hexdigest(),
 'original_outline_area':outline.area,'added_area':added.area,'overlap_area':added.intersection(existing).area,
 'protected_sweep_radius':radius,'full_width_sweep_uncovered_area':gap,'added_bounds':added.bounds,
 'prior_rectangle_bounds':[6.23,-.55,9.96,2],
 'polygons':[[{'x':round(x,9),'z':round(z,9)} for x,z in list(p.exterior.coords)[:-1]] for p in polygons],
 'original_triangle_count_in_clip':len(triangles)}
(ROOT/'apron-footprint-v1.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['polygons','bezier_control_points']},indent=2))
