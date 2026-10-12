"""Read exact delivered source GLB arrays against authoritative catalog geometry."""
from pathlib import Path
import json,gzip,struct,collections,math,hashlib
D=Path(__file__).resolve().parent;P=D
c=json.loads(gzip.decompress((P/'authored-growth-terrain-kit.json.gz').read_bytes()))
def f32(x):return struct.unpack('<f',struct.pack('<f',x))[0]
results={}
for shape in ['baseline','parallel','seaward']:
 path=D/f'{shape}-source.glb';raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);buf=raw[28+n:]
 def acc(i):
  a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];components={'VEC3':3,'SCALAR':1}[a['type']];fmt={5126:'f',5125:'I'}[a['componentType']];stride=v.get('byteStride',4*components)
  return [struct.unpack_from('<'+fmt*components,buf,v.get('byteOffset',0)+a.get('byteOffset',0)+j*stride)for j in range(a['count'])]
 coords=[];tris=[];topparity=[];materials=True
 for node in g['nodes']:
  prefix,part=node['name'].split('/',1);district=c['template']['district'] if prefix=='baseline' else next(v['district']for v in c['profile']['variants']if v['id']==prefix)
  primitive=g['meshes'][node['mesh']]['primitives'][0];p=acc(primitive['attributes']['POSITION']);ix=[j[0]for j in acc(primitive['indices'])];nr=acc(primitive['attributes']['NORMAL'])
  f=next((f for f in district['floors']if f['id']==part),None)
  if f:
   expected=[tuple(f32(v['point'][k])for k in ['x','y','z'])for v in f['vertices']]
   normals=[tuple(f32(v['normal'][k])for k in ['x','y','z'])for v in f['vertices']]
   assert p==expected and nr==normals and ix==f['indices'];topparity.append({'name':node['name'],'positionExact':True,'normalExact':True,'indicesExact':True,'triangles':len(ix)//3})
  else:
   s=next(s for s in district['surfaces']if s['id']==part);assert p==[tuple(f32(v[k])for k in ['x','y','z'])for v in s['vertices']] and ix==s['indices']
  trans=node.get('translation',[0,0,0]);world=[tuple(v[k]+trans[k]for k in range(3))for v in p]
  tris.extend([tuple(world[j]for j in ix[i:i+3])for i in range(0,len(ix),3)])
 edges=collections.Counter();orientation=collections.Counter();volume=0;zero=0
 for a,b,d in tris:
  ab=[b[k]-a[k]for k in range(3)];ad=[d[k]-a[k]for k in range(3)]
  cross=(ab[1]*ad[2]-ab[2]*ad[1],ab[2]*ad[0]-ab[0]*ad[2],ab[0]*ad[1]-ab[1]*ad[0])
  if sum(x*x for x in cross)==0:zero+=1
  volume+=(a[0]*(b[1]*d[2]-b[2]*d[1])+a[1]*(b[2]*d[0]-b[0]*d[2])+a[2]*(b[0]*d[1]-b[1]*d[0]))/6
  for x,y in [(a,b),(b,d),(d,a)]:
   key=tuple(sorted((x,y)));edges[key]+=1;orientation[key]+=1 if x<y else -1
 bad=[{'edge':key,'incidence':v,'orientationSum':orientation[key]}for key,v in edges.items()if v!=2 or orientation[key]!=0]
 results[shape]={'sha256':hashlib.sha256(raw).hexdigest(),'topParity':topparity,'allSurfacePositionsAndIndicesExact':True,'triangles':len(tris),'zeroAreaTriangles':zero,'closedOrientedEdgeFailures':len(bad),'firstEdgeFailures':bad[:4],'signedVolume':volume,'closed':not bad and zero==0 and volume>0}
report={'scope':'Source GLB vs catalog exact local arrays plus welded composed-solid closure; not runtime walking or visual acceptance','parts':results,'pass':all(r['closed']for r in results.values())}
(D/'source-glb-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));raise SystemExit(0 if report['pass']else 1)
