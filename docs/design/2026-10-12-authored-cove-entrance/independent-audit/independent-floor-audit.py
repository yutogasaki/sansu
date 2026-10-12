"""Independent exact planar check; no candidate or app writes."""
import json, math
from pathlib import Path
import shapely
from shapely.geometry import Polygon, box, Point
from shapely.ops import unary_union
from shapely.strtree import STRtree
root=Path('/private/tmp/sansu-authored-cove-plan')
data=json.loads((root/'independent-floor-input.json').read_text())
floor=data['patch']; tris=[[(floor['vertices'][j]['point']['x'],floor['vertices'][j]['point']['z']) for j in floor['indices'][i:i+3]] for i in range(0,len(floor['indices']),3)]
polys=[Polygon(t) for t in tris]; apron=unary_union(polys)
boundary=Polygon([(v['point']['x'],v['point']['z']) for v in floor['vertices']])
radius=data['envelope']['radius']+.04
region=box(5.5,-.9,10.5,2.3)
def low_floors(label):
    out=[]; points=[]
    for f in data[label]:
        for i in range(0,len(f['indices']),3):
            t=[f['vertices'][j] for j in f['indices'][i:i+3]]
            if not all(-.011<p[1]<.2 for p in t):continue
            p=Polygon([(v[0],v[2]) for v in t])
            if p.area>1e-14 and p.intersects(region):out.append(p);points.append(t)
    return out,points
def inspect(label):
    polygons,points=low_floors(label);ground=unary_union(polygons)
    gaps=[]
    for a,b in data['edges']:
        sweep=box(min(a['x'],b['x'])-radius,min(a['z'],b['z'])-radius,max(a['x'],b['x'])+radius,max(a['z'],b['z'])+radius)
        gap=sweep.difference(ground);gaps.append(gap.area)
    return {'triangles':len(polygons),'gapAreas':gaps,'maxGap':max(gaps)},ground,points
base_result,base_ground,base_points=inspect('base')
water_result,water_ground,_=inspect('water')
patched_result,patched_ground,_=inspect('patched')
wet_result,wet_ground,_=inspect('wetPatched')
base_polys=[Polygon([(v[0],v[2]) for v in t]) for t in base_points];tree=STRtree(base_polys)
seams=[]
def height(t,x,z):
    a,b,c=t;den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
    if abs(den)<1e-16:return None
    u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den
    v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den
    if min(u,v,1-u-v)<-1e-6:return None
    return u*a[1]+v*b[1]+(1-u-v)*c[1]
for v in floor['vertices']:
    p=v['point'];query=Point(p['x'],p['z'])
    if query.distance(base_ground.boundary)>1e-6:continue
    hs=[height(base_points[int(i)],p['x'],p['z']) for i in tree.query(query.buffer(1e-6))]
    hs=[h for h in hs if h is not None]
    if hs:seams.append(min(abs(h-p['y']) for h in hs))
support_polys,support_points=low_floors('wetPatched');support_tree=STRtree(support_polys)
socket_results=[]; actual_depth_samples=[]
def depth_region(poly,ground,bottom,minimum):
    values=[]
    for x,z in list(poly.exterior.coords)[:-1]:
        a=height(ground,x,z);b=height(bottom,x,z)
        if a is None or b is None:return Polygon()
        values.append((x,z,a-b-minimum))
    clipped=[]
    for i,p in enumerate(values):
        q=values[(i+1)%len(values)];inside=p[2]>=0;other=q[2]>=0
        if inside:clipped.append(p[:2])
        if inside!=other:
            t=p[2]/(p[2]-q[2]);clipped.append((p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])))
    return Polygon(clipped) if len(clipped)>=3 else Polygon()
for socket in data.get('socketBottomTriangles',[]):
    tri=socket['points'];polygon=Polygon([(v[0],v[2]) for v in tri])
    if polygon.area<1e-14:continue
    fragments=[];depths=[];buried=[];contact=[]
    for i in support_tree.query(polygon):
        intersection=polygon.intersection(support_polys[int(i)])
        if intersection.area<1e-16:continue
        fragments.append(intersection)
        for part in ([intersection] if intersection.geom_type=='Polygon' else intersection.geoms):
            if part.geom_type!='Polygon':continue
            buried.append(depth_region(part,support_points[int(i)],tri,.003))
            contact.append(depth_region(part,support_points[int(i)],tri,0))
            for x,z in part.exterior.coords:
                surface=height(support_points[int(i)],x,z);bottom=height(tri,x,z)
                if surface is not None and bottom is not None:
                    depths.append(surface-bottom)
                    q=Point(x,z)
                    actual_heights=[height(support_points[int(j)],x,z) for j in support_tree.query(q.buffer(1e-8))]
                    actual_heights=[h for h in actual_heights if h is not None]
                    if actual_heights:actual_depth_samples.append({'name':socket['name'],'x':x,'z':z,'bottom':bottom,'ground':max(actual_heights),'depth':max(actual_heights)-bottom})
    coverage=unary_union(fragments)
    gap=polygon.difference(unary_union(contact));representative=gap.representative_point()
    socket_results.append({'name':socket['name'],'area':polygon.area,'uncoveredArea':polygon.difference(coverage).area,'notBuriedAtLeast3mmArea':polygon.difference(unary_union(buried)).area,'notContactArea':gap.area,'gapPoint':[representative.x,representative.y] if not gap.is_empty else None,'points':tri,'depthMin':min(depths) if depths else None,'depthMax':max(depths) if depths else None})
socket_summary={'method':'Each actual GLB downward socket triangle intersected with actual water-composed dry-floor triangles; affine depth extrema at every intersection polygon vertex. Bound includes all overlapping low dry floors.','triangles':len(socket_results),
 'maxUncoveredTriangleArea':max((r['uncoveredArea'] for r in socket_results),default=None),
 'totalProjectedTriangleArea':sum(r['area'] for r in socket_results),'maximumNotBuriedAtLeast3mmTriangleArea':max((r['notBuriedAtLeast3mmArea'] for r in socket_results),default=None),
 'maximumNotContactTriangleArea':max((r['notContactArea'] for r in socket_results),default=None),'largestContactGap':max(socket_results,key=lambda r:r['notContactArea']) if socket_results else None,
 'minimumDepth':min((r['depthMin'] for r in socket_results if r['depthMin'] is not None),default=None),
 'maximumDepth':max((r['depthMax'] for r in socket_results if r['depthMax'] is not None),default=None),
 'highestFloorVertexSamples':{'count':len(actual_depth_samples),'minimum':min(actual_depth_samples,key=lambda s:s['depth']) if actual_depth_samples else None,'maximum':max(actual_depth_samples,key=lambda s:s['depth']) if actual_depth_samples else None}}
result={'scope':'Exact planar low-floor audit and seam-vertex height checks; not all rendered or runtime acceptance','library':{'shapely':shapely.__version__,'geos':shapely.geos_version_string},
'apron':{'valid':apron.is_valid,'geometryType':apron.geom_type,'triangles':len(polys),'area':apron.area,'triangleAreaSum':sum(p.area for p in polys),'selfOverlapArea':sum(p.area for p in polys)-apron.area,'boundaryFillDifferenceArea':apron.symmetric_difference(boundary).area,
'overlapWithOriginalArea':apron.intersection(base_ground).area,'overlapWithWaterComposedArea':apron.intersection(water_ground).area,'originalTouchBoundaryLength':apron.boundary.intersection(base_ground.boundary).length,'originalBoundaryDistance':apron.distance(base_ground),'seamVerticesChecked':len(seams),'maximumSeamVertexHeightDelta':max(seams) if seams else None},
'socketSupport':socket_summary,'sweep':{'halfWidth':radius,'edgeCount':len(data['edges']),'baseWithoutPatch':base_result,'waterWithoutPatch':water_result,'baseWithPatch':patched_result,'waterWithPatch':wet_result}}
(root/'independent-floor-audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
