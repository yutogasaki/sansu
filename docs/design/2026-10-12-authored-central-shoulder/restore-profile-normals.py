"""Restore only the handed-off soil top NORMAL values after Blender's split-normal encoding.
Writes separate v2 GLBs. Positions, indices, materials, nodes/transforms and all other bytes stay identical.
"""
import json,gzip,struct,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
profile=json.loads(gzip.decompress((ROOT/'geometry-profile.json.gz').read_bytes()));soil=profile['soil']
expected={tuple(p):n for p,n in zip(soil['positions'],soil['topNormals'])}
def accessor_bytes(raw,g,binstart,ai):
 a=g['accessors'][ai];v=g['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];width={5126:4,5125:4,5123:2,5121:1}[a['componentType']];offset=binstart+v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',n*width)
 return b''.join(raw[offset+i*stride:offset+i*stride+n*width]for i in range(a['count']))
reports=[]
for name in ['central-shoulder-components','central-shoulder-source']:
 source=ROOT/(name+'.glb');target=ROOT/(name+'-normal-v2.glb');raw=source.read_bytes();out=bytearray(raw);ln=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+ln]);binstart=28+ln
 mesh=next(m for m in g['meshes']if m['name']==soil['name']);modified=[];normal_ranges=set()
 fixed_accessors={i:sha(accessor_bytes(raw,g,binstart,i))for m in g['meshes']for p in m['primitives']for i in [p['indices']]+[v for k,v in p['attributes'].items()if k!='NORMAL']}
 for p in mesh['primitives']:
  mat=g['materials'][p['material']]
  if not any(mat['pbrMetallicRoughness']==soil['materials'][i]['pbrMetallicRoughness']for i in [0,1]):continue
  aid=p['attributes']['NORMAL'];a=g['accessors'][aid];v=g['bufferViews'][a['bufferView']];assert a['componentType']==5126 and a['type']=='VEC3';positions=accessor_bytes(raw,g,binstart,p['attributes']['POSITION']);assert len(positions)==a['count']*12
  offset=binstart+v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',12)
  for i in range(a['count']):
   point=struct.unpack_from('<fff',positions,i*12);normal=expected[point];struct.pack_into('<fff',out,offset+i*stride,*normal);normal_ranges.update(range(offset+i*stride,offset+i*stride+12))
  modified.append({'normalAccessor':aid,'vertices':a['count'],'material':mat['name']})
 assert len(modified)==2
 changed=[i for i,(a,b)in enumerate(zip(raw,out))if a!=b];assert all(i in normal_ranges for i in changed)
 assert raw[:binstart]==out[:binstart]
 assert fixed_accessors=={i:sha(accessor_bytes(out,g,binstart,i))for i in fixed_accessors}
 target.write_bytes(out)
 reports.append({'input':source.name,'inputSha256':sha(raw),'output':target.name,'outputSha256':sha(out),'normalAccessorsRestored':modified,'changedBytes':len(changed),'allChangesInsideSelectedNormalValues':True,'jsonChunkIncludingMaterialNodeTransformSha256':sha(raw[20:20+ln]),'jsonChunkUnchanged':True,'nonNormalAccessorSha256':fixed_accessors,'positionsIndicesMaterialsNodeTransformsUnchanged':True})
result={'scope':'Source delivery correction only; geometry audit reusable because only two soil-top NORMAL accessors differ. Editable Blender custom split normals retain their measured quantization; exact raw normals are in geometry-profile.','profileSha256':sha((ROOT/'geometry-profile.json.gz').read_bytes()),'exports':reports}
(ROOT/'normal-export-v2.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items()if k!='exports'},indent=2));print(json.dumps([{k:v for k,v in r.items()if k!='nonNormalAccessorSha256'}for r in reports],indent=2))
