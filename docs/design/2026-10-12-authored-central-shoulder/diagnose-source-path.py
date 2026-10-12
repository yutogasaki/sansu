"""Read-only diagnosis of existing path dark-dot artifacts in the source preview."""
import json, struct, hashlib
from pathlib import Path
import numpy as np
ROOT = Path(__file__).resolve().parent
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
results = []
for name in ['source-context.glb', 'central-shoulder-source-normal-v2.glb']:
    raw = (ROOT/name).read_bytes(); length = struct.unpack_from('<I', raw, 12)[0]
    g = json.loads(raw[20:20+length]); binary = raw[28+length:]
    def acc(i):
        a = g['accessors'][i]; b = g['bufferViews'][a['bufferView']]
        count = {'SCALAR': 1, 'VEC3': 3}[a['type']]; fmt = {5126: 'f', 5125: 'I', 5123: 'H'}[a['componentType']]
        offset = b.get('byteOffset', 0) + a.get('byteOffset', 0); stride = b.get('byteStride', count*struct.calcsize(fmt))
        return np.array([struct.unpack_from('<'+fmt*count, binary, offset+j*stride) for j in range(a['count'])])
    node = next(n for n in g['nodes'] if n.get('name') == 'growing-reachable-paths')
    p = g['meshes'][node['mesh']]['primitives'][0]
    points = acc(p['attributes']['POSITION']); faces = acc(p['indices']).reshape(-1, 3)
    triangles = points[faces]; normals = np.cross(triangles[:,1]-triangles[:,0], triangles[:,2]-triangles[:,0])
    # A measured black-pixel ray hit in authored world, changed back into the context's renderer coordinates.
    at = np.array([2.774590492248535-7.0026560305, -4.303323745727539-2])
    hits = []
    for index, tri in enumerate(triangles):
        a,b,c = tri; det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2])
        if abs(det)<1e-18: continue
        u=((b[2]-c[2])*(at[0]-c[0])+(c[0]-b[0])*(at[1]-c[2]))/det
        v=((c[2]-a[2])*(at[0]-c[0])+(a[0]-c[0])*(at[1]-c[2]))/det
        if min(u,v,1-u-v)>=-1e-6:
            hits.append({'triangle': index, 'height': float(u*a[1]+v*b[1]+(1-u-v)*c[1]), 'normalY': float(normals[index,1])})
    material = g['materials'][p['material']]
    results.append({'path': name, 'sha256': sha(ROOT/name), 'node': node['name'], 'triangles': len(faces),
                    'upwardFaces': int(sum(normals[:,1]>1e-12)), 'downwardFaces': int(sum(normals[:,1]<-1e-12)),
                    'material': material, 'sampledDarkPixelRayCoincidentFaces': hits})
report = {'scope': 'Existing path transport/render diagnosis only; no geometry, source, material or runtime edits.',
          'observed': 'Whole and rotated source previews have black oval dots on existing path strips. 171 sampled dark-pixel rays all hit growing-reachable-paths / Material_60, not the new shoulder or roots.',
          'results': results,
          'interpretation': 'The actual path contains upward joint discs and downward strips at coincident heights. Its runtime DoubleSide material uses polygonOffset; standard glTF does not encode that raster offset. Source and final GLB keep the pale path PBR, not black color. Coplanar opposite faces under Cycles are a likely cause of the source-only dark joints; this is not an isolated causal render experiment.',
          'action': 'Keep source images as HOLD evidence. Do not alter frozen geometry or infer that the c4 app has black dots. Actual app retains its existing path renderer.'}
(ROOT/'source-path-diagnostic.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report, indent=2))
