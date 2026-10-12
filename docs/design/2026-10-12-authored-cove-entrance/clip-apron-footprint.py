"""Clip added ground to the outside of existing dry floor; preserve every old triangle.
Uses Shapely 2.0.7 in a temporary diagnostic venv; no repository dependency.
"""
import json,hashlib,shapely
from pathlib import Path
from shapely.geometry import Polygon,box
from shapely.ops import unary_union
ROOT=Path(__file__).resolve().parent
context=json.loads(Path('/private/tmp/sansu-authored-cove-entrance/actual-context.json').read_text())
outline=Polygon([(6.23,-.55),(6.87,-.55),(6.87,1.34),(9.34,1.34),(9.34,.70),(9.96,.70),(9.96,2),(6.23,2)])
triangles=[]
for floor in context['floors']:
    if 'apron' in floor['id']:continue
    for i in range(0,len(floor['indices']),3):
        points=[floor['vertices'][j] for j in floor['indices'][i:i+3]]
        p=Polygon([(p[0],p[2]) for p in points])
        if p.area>1e-12 and p.intersects(outline):triangles.append(p)
existing=unary_union(triangles)
added=outline.difference(existing)
polygons=list(added.geoms) if added.geom_type=='MultiPolygon' else [added]
assert all(not p.interiors for p in polygons),'A floor hole needs an explicit constrained triangulation'
result={'candidate':'native05-authored-cove-corner-v3','method':'Exact planar GEOS difference of the apron outline and union of current dry floor triangles; original floors unchanged',
 'library':{'shapely':shapely.__version__,'geos':shapely.geos_version_string},
 'source_world_sha256':hashlib.sha256((ROOT.parents[2]/'prototypes/place-qa/native05-world.json.gz').read_bytes()).hexdigest(),
 'original_outline_area':outline.area,'added_area':added.area,'overlap_area':added.intersection(existing).area,
 'polygons':[[{'x':round(x,9),'z':round(z,9)} for x,z in list(poly.exterior.coords)[:-1]] for poly in polygons if poly.area>1e-10],
 'original_triangle_count_in_clip':len(triangles)}
(ROOT/'apron-footprint-v1.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='polygons'},indent=2))
