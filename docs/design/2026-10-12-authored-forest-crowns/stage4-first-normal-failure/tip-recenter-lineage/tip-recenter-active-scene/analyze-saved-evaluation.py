"""Offline raw evaluation-order/roundtrip analysis. Does not import Blender."""
from pathlib import Path
import sys
sys.dont_write_bytecode=True
import gzip,hashlib,json,math
import geometry as g
from export_check import read_glb,compare_triangles
from world_check import glb_world_report

HERE=Path(__file__).resolve().parent;ATTEMPT=HERE/'attempt-01'
def read(path):
    data=path.read_bytes()
    return json.loads(gzip.decompress(data) if path.suffix=='.gz' else data)
def yup(p):return [p[0],p[2],-p[1]]
def hash_file(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def product32(a,b):
    # Arithmetic replay model, not a claim about an uninstrumented C++ call site.
    return [[g.f32(sum(g.f32(x*y) for x,y in zip(row,col))) for col in zip(*b)] for row in a]

before=read(ATTEMPT/'authoring-scene-before-isolation.json.gz')
entry=read(ATTEMPT/'authoring-scene-after-export-scene-switch.json.gz')
after=read(ATTEMPT/'authoring-scene-after-isolation.json.gz')
models=[]
for name,old in before['objects'].items():
    if not name.startswith('TIP RECENTER DIAGNOSTIC /'):continue
    new=after['objects'][name];parent=before['objects'][old['parent']]['matrixWorld']
    predicted=product32(parent,product32(old['matrixParentInverse'],old['matrixBasis']))
    models.append({'object':name,'beforeWorld':old['matrixWorld'],'afterWorld':new['matrixWorld'],
        'matrixBasis':old['matrixBasis'],'matrixParentInverse':old['matrixParentInverse'],'parentWorld':parent,
        'basisAndParentInverseEqual':all(old[k]==new[k] for k in ['matrixBasis','matrixParentInverse']),
        'parentEqual':before['objects'][old['parent']]==after['objects'][old['parent']],
        'predictedFloat32ProductWorld':predicted,'predictionExactAfterWorld':predicted==new['matrixWorld'],
        'beforeEqualsPrediction':old['matrixWorld']==predicted,
        'translationDeltaBlender':[new['matrixWorld'][i][3]-old['matrixWorld'][i][3] for i in range(3)]})

profile=read(ATTEMPT/'float64-profile.json.gz')
source=read(HERE.parent/'attempt-01/source-role-accessors.json.gz')['extracted']
faces=[source['indices'][i:i+3] for i in range(0,len(source['indices']),3)]
faces=[f for i,f in enumerate(faces) if i not in [0,2,98,100]]
expected=[{'positions':[yup(profile['tipRelative32'][i]) for i in face],
           'normals':[yup(profile['desiredNormalsByVertex64'][i]) for i in face]} for face in faces]
exports=[]
for label in ['first','second']:
    path=ATTEMPT/f'six-incident-sharp-tip-recenter-{label}.glb'
    doc,node,triangles,attrs=read_glb(path)
    accessors=read(ATTEMPT/f'six-incident-sharp-tip-recenter-{label}-accessors.json.gz')
    raw_mat=accessors['materials'][0];source_mat=accessors['sourceMaterialCanonical']
    pbr=raw_mat.get('pbrMetallicRoughness',{})
    actual_mat={'baseColor':pbr.get('baseColorFactor',[1,1,1,1]),'roughness':pbr.get('roughnessFactor',1),
        'metalness':pbr.get('metallicFactor',1),'doubleSided':raw_mat.get('doubleSided',False),
        'alphaMode':raw_mat.get('alphaMode','OPAQUE'),'emissive':raw_mat.get('emissiveFactor',[0,0,0]),
        'alphaCutoff':raw_mat.get('alphaCutoff',.5),'extensions':raw_mat.get('extensions',{})}
    exports.append({'label':label,'sha256':hash_file(path),'bytes':path.stat().st_size,
        'comparison':compare_triangles(triangles,expected),
        'world':glb_world_report(doc,node,attrs,profile['tipRelative32'],profile['targets64']),
        'PBRAndExtensionsExactToSourceCanonical':actual_mat==source_mat})

# Second-export input raw is the actual reimported Blender mesh, before re-export.
reimport=read(ATTEMPT/'six-incident-sharp-tip-recenter-second-before-export.json.gz')['components']['raw']
actual=[];cursor=0
for face in reimport['polygonVertices']:
    actual.append({'positions':[yup(reimport['positions'][i]) for i in face],
                   'normals':[yup(v) for v in reimport['cornerNormals'][cursor:cursor+len(face)]]})
    cursor+=len(face)
BI=[[1,0,0,0],[0,0,1,0],[0,-1,0,0],[0,0,0,1]]
matrix=g.multiply(BI,reimport['matrixWorld'])
world=[g.point(matrix,p) for p in profile['tipRelative32']]
errors=[math.dist(a,b) for a,b in zip(world,profile['targets64'])]
result={'scope':'Offline saved raw only; active-scene execution remains HOLD; no new Blender run',
    'originalSceneAtEntryExact':before==entry,
    'firstMeaningfulFailure':'After two exports/reimport, final exact authoring-scene guard: newly created input/tip matrices reevaluated',
    'matrixReconstruction':models,
    'sourceReadOrder':[
        'probe.py clone: original.copy() retains original parent',
        'new mesh/from_pydata/materials/sharp -> link object -> obj.matrix_world=matrix',
        'normals_split_custom_set -> geometry assertions -> return; no view_layer.update/evaluated_get',
        'caller reads matrix_world/world-point oracle immediately',
        'export isolation snapshots original scene before any explicit evaluation',
        'temporary-scene switch entry snapshot still equals before',
        'export/import/export + return to original context eventually evaluates parent-composed matrices'],
    'inference':'The before matrix is a stale assigned world value relative to its already-stored parent/local basis. Both after matrices are exactly reproduced by the saved basis/parent data. Precise evaluation-trigger call was not instrumented.',
    'exports':exports,
    'blenderReimport':{'comparison':compare_triangles(actual,expected),
        'exactZeroLocalTriangles':g.exact_zero_faces(reimport['positions'],reimport['polygonVertices']),
        'worldMaxError':max(errors),'worldErrorPerSourceVertex':errors},
    'proposedNextDiagnosticOnly':[
        'After constructing/linking each new diagnostic clone and assigning its matrix, capture unevaluated state.',
        'Once explicitly update its view layer and query evaluated_get, capture evaluated state; verify original442/parents/materials exact throughout.',
        'Measure evaluated clone world points against the unchanged Float64 field target before accepting it as the authoring baseline.',
        'Freeze evaluated authoring state, then use active temporary-scene copy export and exact before/after guard without restore/repair.',
        'Keep .002 /1e-6 and all raw coordinate/topology limitations; no all101 generalization yet.'],
    'notVerified':['new evaluation order not executed','full101 roles','world-Float32 microscopic-face nondegeneracy','runtime/visual adoption']}
path=HERE/'saved-evaluation-analysis.json'
assert not path.exists()
path.write_text(json.dumps(result,indent=2)+'\n')
print('SHA',hash_file(path))
print('MATRIX',[(m['object'],m['predictionExactAfterWorld']) for m in models])
print('EXPORT',[(x['label'],x['comparison']['normalMaxL2'],x['world']['maxError'],x['PBRAndExtensionsExactToSourceCanonical']) for x in exports])
print('REIMPORT',result['blenderReimport']['comparison'],max(errors))
