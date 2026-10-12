"""Read-only analysis of the first aborted probe's saved raw/GLB. No Blender."""
from pathlib import Path
import sys
sys.dont_write_bytecode=True
import gzip, hashlib, json, math, subprocess
import geometry as g
from export_check import read_glb, compare_triangles

HERE=Path(__file__).resolve().parent
OUT=HERE/'postmortem-01'
assert not OUT.exists()
OUT.mkdir()
STAGE=HERE.parent.parent
sys.path.insert(0,str(STAGE))
import source_checks as checks

def read(path):
    data=path.read_bytes()
    return json.loads(gzip.decompress(data) if path.suffix=='.gz' else data)
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def yup(p):return [p[0],p[2],-p[1]]
def material(raw):
    x=checks.material_spec(raw)
    return dict(x,alphaCutoff=raw.get('alphaCutoff',.5),extensions=raw.get('extensions',{}))
def matrix(node):
    if 'matrix' in node:return [[node['matrix'][j*4+i] for j in range(4)] for i in range(4)]
    x,y,z,w=node.get('rotation',[0,0,0,1]);s=node.get('scale',[1,1,1]);t=node.get('translation',[0,0,0])
    r=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
       [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
       [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]
    return [[r[i][j]*s[j] for j in range(3)]+[t[i]] for i in range(3)]+[[0,0,0,1]]

attempt=HERE/'attempt-01'
profile=read(attempt/'float64-profile.json.gz')
old=read(attempt/'variants-so-far.json.gz')[0]
source=read(HERE.parent/'attempt-01/source-role-accessors.json.gz')['extracted']
faces=[source['indices'][i:i+3] for i in range(0,len(source['indices']),3)]
keep=old['originalSourceFaceMap'];retained=[faces[i] for i in keep]
coords=profile['tipRelative32'];desired=profile['desiredNormalsByVertex64']
expected=[{'positions':[yup(coords[i]) for i in face], 'normals':[yup(desired[i]) for i in face]} for face in retained]
glb=attempt/'six-incident-sharp-tip-recenter-first.glb'
doc,node,actual,attrs=read_glb(glb)
comparison=compare_triangles(actual,expected)
assert len(doc['nodes'])==1, 'Do not infer a missing parent transform'
mt=matrix(node)
exported_world=[g.point(mt,yup(p)) for p in coords]
world_errors=[math.dist(p,t) for p,t in zip(exported_world,profile['targets64'])]
zeros=g.exact_zero_faces(coords,retained)
world32=[[g.f32(x) for x in p] for p in exported_world]
world32_zeros=g.exact_zero_faces(world32,retained)
source_doc=checks.glb_json(STAGE.parent/'extraction-attempt02/role-separated-originals.glb')
source_node=next(n for n in source_doc['nodes'] if n.get('extras',{}).get('ownerId')=='l14' and n.get('extras',{}).get('sourceNodeIndex')==2239)
source_mat=source_doc['materials'][source_doc['meshes'][source_node['mesh']]['primitives'][0]['material']]
output_mat=doc['materials'][doc['meshes'][node['mesh']]['primitives'][0]['material']]
execution=read(HERE/'execution-01/result.json')
inputs=[HERE/'readiness.json',HERE/'probe.py',HERE/'execution-01/result.json',attempt/'diagnostic-failure.json',attempt/'float64-profile.json.gz',attempt/'variants-so-far.json.gz',glb]
ps=subprocess.run(['ps','-axo','pid=,pgid=,stat=,command='],capture_output=True,text=True,check=True)
members=[]
for row in ps.stdout.splitlines():
    parts=row.strip().split(None,3)
    if len(parts)>=3 and (parts[0]=='46573' or parts[1]=='46573'):members.append(row)
result={
 'status':'INCOMPLETE / HOLD; one failed execution, no rerun',
 'sourceInputNormalMaxL2':old['inputSourceNormalOracle']['maxL2'],
 'oldPivotControl':{k:old[k] for k in ['desiredSourceNormalOracle','nonzeroLocalRetainedTriangles','zeroLocalSourceFaces','maxWorldError']},
 'tipPreExport':{
   'exactBlenderReadbackMetricsSaved':False,
   'controlFlowProvesEligible':True,
   'eligibleConditions':{'inputNormalMaxL2':.002,'desiredNormalMaxL2':.002,'localNonzeroTriangles':148,'maxWorldErrorBound':1e-6},
   'reason':'record appended only after roundtrip; export assertion raised before append; do not invent lost metrics'},
 'tipSavedGLB':{
   'sha256':sha(glb),'bytes':glb.stat().st_size,
   'accessorComparisonAgainstSavedFloat64Profile':comparison,
   'localNonzeroTriangles':148-len(zeros),'zeroLocalSourceFaces':[keep[i] for i in zeros],
   'worldCoordinateScope':'Float64 evaluation of actual saved GLB TRS against same-field Float64 target, all78 source vertices',
   'worldErrorPerVertex':world_errors,'maxWorldError':max(world_errors),
   'zeroAfterFloat32WorldCastSourceFaces':[keep[i] for i in world32_zeros],
   'matrix':mt,'plannedCompensatedMatrix':profile['compensatedTransform64'],
   'matrixMaxAbsDifferenceVsPlan':max(abs(a-b) for r,s in zip(mt,profile['compensatedTransform64']) for a,b in zip(r,s)),
   'materialPBRAndExtensionsMatch':checks.close_values(material(source_mat),material(output_mat)),
   'rawSourceMaterial':source_mat,'rawExportedMaterial':output_mat,
   'rawAttributes':attrs,'rawNodes':doc['nodes']},
 'exportAssertClassification':{
   'guard':'fixed_digest equality AND sharp flag equality',
   'fixedDigestIncludes':['vertex positions','loop vertex indices','corner normals','matrix_world'],
   'materialsIncludedInDigest':False,
   'changedComponentKnown':False,
   'limitation':'No pre/post digest values or component snapshots were written; the failed OR components cannot be separated offline. Exact GLB positions/normals constrain output, not Blender in-memory post-export mutation.'},
 'unreached':['Blender reimport','second GLB','all-sharp cases','final original442 mesh/flag/material/parent in-memory parity'],
 'preservation':{'bound79ExternalFilesBeforeAfterEqual':execution['boundBefore']['external']==execution['boundAfter']['external'],
    'allSealedBindingsBeforeAfterEqual':execution['boundBefore']==execution['boundAfter'],
    'originalSourceFilesChanged':False,'ownerInMemoryFinalParityVerified':False},
 'process':{k:execution[k] for k in ['startedAtUtc','finishedAtUtc','elapsedSeconds','exitCode','ownedPid','ownedProcessExited','effectiveThreads','peakObservedRssBytes']},
 'ownedProcessGroupMembersAtPostmortem':members,
 'inputs':{str(p):sha(p) for p in inputs},
 'sourceCorrectionAdopted':False,'blenderRunDuringPostmortem':False}
(OUT/'result.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['tipSavedGLB','inputs']},indent=2))
print(json.dumps({k:v for k,v in result['tipSavedGLB'].items() if k not in ['rawAttributes','rawNodes','worldErrorPerVertex','matrix','plannedCompensatedMatrix','rawSourceMaterial','rawExportedMaterial']},indent=2))
print('POSTMORTEM_SHA',sha(OUT/'result.json'))
