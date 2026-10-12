"""Author-side GLB parity and fixed source identity. No source edits or rendering."""
import json,gzip,struct,hashlib,collections
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
paths=[ROOT/n for n in ['geometry-profile.json.gz','central-shoulder-components.glb','central-shoulder-source.glb','source-context.glb','input/selected-v3-handoff.json.gz']];before={p.name:sha(p)for p in paths}
profile=json.loads(gzip.decompress(paths[0].read_bytes()))
class GLB:
 def __init__(self,path):
  raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];self.g=json.loads(raw[20:20+n]);self.b=raw[28+n:];self.matrices={}
  def visit(i,parent):
   node=self.g['nodes'][i]
   if 'matrix'in node:m=np.array(node['matrix']).reshape(4,4).T
   else:
    x,y,z,w=node.get('rotation',[0,0,0,1]);r=np.array([[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],[2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],[2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]]);m=np.eye(4);m[:3,:3]=r@np.diag(node.get('scale',[1,1,1]));m[:3,3]=node.get('translation',[0,0,0])
   m=parent@m;self.matrices[i]=m
   for c in node.get('children',[]):visit(c,m)
  for i in self.g['scenes'][self.g.get('scene',0)]['nodes']:visit(i,np.eye(4))
 def acc(self,i):
  a=self.g['accessors'][i];v=self.g['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC3':3,'VEC4':4,'VEC2':2}[a['type']];fmt={5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']];size=struct.calcsize(fmt);off=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',size*n)
  return np.array([struct.unpack_from('<'+fmt*n,self.b,off+j*stride)for j in range(a['count'])])
 def parts(self,i):
  n=self.g['nodes'][i];m=self.matrices[i];out=[]
  for p in self.g['meshes'][n['mesh']]['primitives']:
   pos=self.acc(p['attributes']['POSITION']);points=np.column_stack([pos,np.ones(len(pos))])@m.T;indices=self.acc(p['indices']).reshape(-1,3)
   normal=self.acc(p['attributes']['NORMAL'])@np.linalg.inv(m[:3,:3]);normal/=np.linalg.norm(normal,axis=1)[:,None]
   out.append({'points':points[:,:3],'indices':indices,'normals':normal,'material':self.g['materials'][p['material']]})
  return out
 def subtree(self,i):
  ids=[i]
  for c in self.g['nodes'][i].get('children',[]):ids+=self.subtree(c)
  return ids
 def owner(self,owner):
  roots=[i for i,n in enumerate(self.g['nodes'])if n.get('extras',{}).get('objectId')==owner and n.get('extras',{}).get('nativePart')in ['willow','birch','spire']]
  assert len(roots)==1,(owner,roots)
  parts=[p for i in self.subtree(roots[0])if 'mesh'in self.g['nodes'][i]for p in self.parts(i)]
  return np.vstack([p['points']for p in parts]),sum(len(p['indices'])for p in parts)
def tri_key(tri):
 # Cyclic orientation preserved, no geometric rounding beyond glTF Float32.
 v=[tuple(float(x)for x in p)for p in tri];return min(tuple(v[i:]+v[:i])for i in range(3))
def as_f32(p):return np.array(p,dtype=np.float32).astype(float)
def geometry_parity(expected,actual):
 points=as_f32(expected['positions']);indices=np.array(expected['indices']).reshape(-1,3)
 ref=collections.Counter(tri_key(t)for t in points[indices]);got=collections.Counter(tri_key(t)for p in actual for t in p['points'][p['indices']])
 assert ref==got,(len(ref-got),len(got-ref))
 return {'triangles':len(indices),'orientedTriangleMultisetExactFloat32':True,'signedVolume':float(np.einsum('ij,ij->i',points[indices][:,0],np.cross(points[indices][:,1],points[indices][:,2])).sum()/6)}
components=GLB(paths[1]);full=GLB(paths[2]);context=GLB(paths[3]);results=[]
soil=profile['soil'];ni=next(i for i,n in enumerate(components.g['nodes'])if n['name']==soil['name']);parts=components.parts(ni);assert len(parts)==3
parity=geometry_parity(soil,parts);assert parity['signedVolume']>0
normal_by_pos={tuple(p):np.array(n)for p,n in zip(soil['positions'],soil['topNormals'])};normal_errors=[];material_checks=[]
for mi in [0,1]:
 expected=soil['materials'][mi];actual=parts[mi]['material'];assert expected['pbrMetallicRoughness']==actual['pbrMetallicRoughness'];assert expected.get('doubleSided',False)==actual.get('doubleSided',False)
 expected_count=sum(x==mi for x in soil['topMaterialIndices']);assert len(parts[mi]['indices'])==expected_count
 for p,n in zip(parts[mi]['points'],parts[mi]['normals']):normal_errors.append(float(np.linalg.norm(n-normal_by_pos[tuple(p)])))
 material_checks.append({'material':mi,'triangles':expected_count,'rawPBRAndDoubleSidedExact':True})
assert max(normal_errors)<2e-4,max(normal_errors)
results.append({'name':soil['name'],**parity,'topMaterials':material_checks,'maxNormalL2ErrorAfterBlenderGLB':max(normal_errors),'normalLimit':2e-4,'normalNote':'Blender custom split normal encoding may quantize directions; geometry-profile contains full authored normals.'})
for root in profile['rootContinuations']:
 ni=next(i for i,n in enumerate(components.g['nodes'])if n['name']==root['name']);parts=components.parts(ni);parity=geometry_parity(root,parts);assert parity['signedVolume']>0
 assert parts[0]['material']['pbrMetallicRoughness']==root['material']['pbrMetallicRoughness']
 original,original_tris=context.owner(root['ownerId']);current,current_tris=full.owner(root['ownerId']);assert original_tris==current_tris
 cap=np.array(root['positions'][:len(root['topNormals'])]);cap_context=max(float(np.linalg.norm(original-p,axis=1).min())for p in cap);cap_current=max(float(np.linalg.norm(current-p,axis=1).min())for p in cap)
 assert cap_context<2e-6 and cap_current<2e-6,(root['ownerId'],cap_context,cap_current)
 results.append({'ownerId':root['ownerId'],**parity,'sourceMaterialPBRExact':True,'sourceTreeCount':1,'treeTrianglesBefore':original_tris,'treeTrianglesAfter':current_tris,'maxCapVertexDistanceToOriginalContext':cap_context,'maxCapVertexDistanceToFinalSourceTree':cap_current})
soil_nodes=[i for i,n in enumerate(full.g['nodes'])if n.get('name')==soil['name']];assert len(soil_nodes)==1
assert not any(n.get('name')=='authored-evaluated-floor'for n in full.g['nodes'])
assert {p.name:sha(p)for p in paths}==before
report={'scope':'Author-side source export audit, not browser/render or independent review.','inputs':before,'results':results,'fullSourceSingleSoilNode':True,'removedOldCommonFloorMesh':True,'fixedInputs':True};(ROOT/'export-parity.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
