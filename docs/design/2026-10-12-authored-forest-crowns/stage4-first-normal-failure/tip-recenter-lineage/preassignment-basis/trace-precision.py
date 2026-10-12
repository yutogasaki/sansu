"""Pure saved-data replay and representation alternatives; no Blender or asset output."""
from pathlib import Path
from fractions import Fraction as F
from datetime import datetime, timezone
import gzip
import hashlib
import json
import math
import struct
import sys

HERE = Path(__file__).resolve().parent
DEBUG = HERE.parent
STAGE = DEBUG.parent
sys.dont_write_bytecode = True
sys.path.insert(0, str(STAGE))
import fields

sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
inputs = [DEBUG / 'attempt-01/failing-role-raw.json.gz', STAGE / 'fields.py', STAGE / 'deform.py', STAGE / 'proposal.json']
before = {str(path): sha(path) for path in inputs}
raw = json.loads(gzip.decompress(inputs[0].read_bytes()))
proposal = json.loads(inputs[3].read_text())
T = raw['localToWorld']
f32 = lambda value: struct.unpack('<f', struct.pack('<f', value))[0]


def matrix_vector_float_products(matrix, vector):
    records = []
    for row in matrix[:3]:
        products = [f32(a*b) for a,b in zip(row, list(vector)+[1.])]
        total = 0.
        partials = []
        for product in products:
            total += product
            partials.append(total)
        records.append({'floatProducts': products, 'doublePartialSums': partials,
                        'doubleSumBeforeVectorStore': total, 'floatVectorResult': f32(total)})
    return records


def vector_result(records):
    return [record['floatVectorResult'] for record in records]


def matrix_vector64(matrix, vector):
    values = []
    for row in matrix[:3]:
        total = 0.
        for a,b in zip(row, list(vector)+[1.]):
            total += a*b
        values.append(total)
    return values


def inverse64(matrix):
    # Invert the captured matrix's exact dyadic values, then convert coefficients
    # to float64. This is a counterfactual, not a claim to replay Blender inverse().
    rows = [[F(x) for x in row]+[F(int(i==j)) for j in range(4)] for i,row in enumerate(matrix)]
    for k in range(4):
        pivot = next(i for i in range(k,4) if rows[i][k])
        rows[k],rows[pivot] = rows[pivot],rows[k]
        value = rows[k][k]
        rows[k] = [x/value for x in rows[k]]
        for i in range(4):
            if i != k:
                value = rows[i][k]
                rows[i] = [x-value*y for x,y in zip(rows[i],rows[k])]
    return [[float(x) for x in row[4:]] for row in rows]


def cross(a,b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]


def exact_zero(positions, indices):
    a,b,c = [[F(x) for x in positions[i]] for i in indices]
    return cross([y-x for x,y in zip(a,b)],[y-x for x,y in zip(a,c)]) == [0,0,0]


owner = proposal['owners']['l14']
replay = []
for vertex in [36,37,38]:
    local = raw['inputLocalPositions'][vertex]
    calculation = matrix_vector_float_products(T,local)
    point = vector_result(calculation)
    target64 = list(fields.willow(tuple(point),owner))
    replay.append({'vertex': vertex, 'inputLocal': local, 'matrix': T,
        'matrixVectorOperations': calculation, 'pointVector32': point,
        'fieldPython64': target64, 'targetVector32': [f32(x) for x in target64],
        'finalLocalCapturedFromBlender': raw['deformedLocalPositions'][vertex]})
assert len({tuple(record['pointVector32']) for record in replay}) == 1
assert len({tuple(record['targetVector32']) for record in replay}) == 1
assert len({tuple(record['finalLocalCapturedFromBlender']) for record in replay}) == 1
examples = []
for sample in raw['largestResidualExamples']:
    point = vector_result(matrix_vector_float_products(T,sample['inputLocalPosition']))
    target = [f32(x) for x in fields.willow(tuple(point),owner)]
    examples.append({'vertex': sample['vertex'], 'loop': sample['loop'],
                     'pointMatchesCapturedExactly': point == sample['worldPoint'],
                     'targetMatchesCapturedExactly': target == sample['worldTarget']})
assert all(e['pointMatchesCapturedExactly'] and e['targetMatchesCapturedExactly'] for e in examples)

I = inverse64(T)
double_world = [matrix_vector64(T, p) for p in raw['inputLocalPositions']]
double_targets = [list(fields.willow(tuple(p),owner)) for p in double_world]
double_local = [matrix_vector64(I,p) for p in double_targets]
old_pivot32 = [[f32(x) for x in p] for p in double_local]
center = double_local[37]
tip_rebased32 = [[f32(x-c) for x,c in zip(p,center)] for p in double_local]
retained = [i for i in range(len(raw['polygons'])) if i not in [0,2,98,100]]
source_faces = [raw['polygons'][i]['vertices'] for i in retained]
source_zero = [i for i in retained if exact_zero(raw['inputLocalPositions'],raw['polygons'][i]['vertices'])]
old_zero = [i for i in retained if exact_zero(old_pivot32,raw['polygons'][i]['vertices'])]
rebase_zero = [i for i in retained if exact_zero(tip_rebased32,raw['polygons'][i]['vertices'])]
reconstruct = [[x+c for x,c in zip(p,center)] for p in tip_rebased32]
reconstructed_world = [matrix_vector64(T,p) for p in reconstruct]
assert source_zero == [] and old_zero == [45,47,146,150] and rebase_zero == []
after = {str(path): sha(path) for path in inputs}
assert before == after
report = {'createdAtUtc': datetime.now(timezone.utc).isoformat(),
    'status': 'OFFLINE precision/representation preparation only; no mesh asset or Blender execution',
    'firstLoss': 'point = transform @ vertex.co: float Vector result storage, before nonlinear field',
    'primaryImplementation': {
        'buildHash': '9e2066aef7ef',
        'url': 'https://github.com/blender/blender/blob/9e2066aef7ef/source/blender/python/mathutils/mathutils_Vector.cc#L2059',
        'routine': 'column_vector_multiplication',
        'arithmetic': 'Each float*float product is accumulated in double; each row result stored as float.'},
    'currentPathReplay': replay, 'existingCapturedPointTargetChecks': examples,
    'replayBoundary': 'The 24 already-captured worldPoint/worldTarget samples match exactly. No new engine sample was taken at36/37/38. Their first-loss result is arithmetic replay of the same build source and captured matrix; final stored coordinates are actual prior Blender data.',
    'counterfactual64': {'meaning': 'Same authored field, all-coordinate Python float64 math; exact captured affine inverse converted to float64. Not the old Blender inverse operation.',
        'inverse': I, 'newZeroFacesAtFinalOldPivotFloat32': old_zero,
        'newZeroFacesAfterTipRelativeFloat32': rebase_zero, 'retainedTriangles':len(retained),
        'tipRecenterLocal64': center,
        'sampleVertices': [{'vertex': i, 'world64': double_world[i], 'target64':double_targets[i],
            'local64':double_local[i], 'oldPivotFinal32':old_pivot32[i], 'tipRelativeFinal32':tip_rebased32[i]} for i in [36,37,38]],
        'tipRebaseReconstructionMaxLocalError':max(math.dist(a,b) for a,b in zip(reconstruct,double_local)),
        'tipRebaseReconstructionMaxWorldError':max(math.dist(a,b) for a,b in zip(reconstructed_world,double_targets)),
        'float64FieldVsOldCapturedWorldMaxDistance':max(math.dist(matrix_vector64(T,a),b) for a,b in zip(raw['deformedLocalPositions'],double_targets)),
        'originalLocalMeshVerticesAndTopologyUnchangedAlternative':'Keep literal source local vertices/NORMAL and put a rigid/affine pose in a child object transform; this changes the nonlinear field recipe and needs endpoint/art comparison, not silently equivalent.'},
    'arrays':{'retainedOriginalFaceIndices':retained,'retainedOriginalFaces':source_faces,
              'hypotheticalLocal64':double_local,'hypotheticalOldPivot32':old_pivot32,
              'hypotheticalTipRelative32':tip_rebased32},
    'inputsBefore':before,'inputsAfter':after,'sourceInputsUnchanged':True,
    'meshFilesWritten':False,'clearProbeExecuted':False,'blenderExecuted':False,
    'limitations':['Tip-relative coordinates only prove local face noncollapse numerically, not custom-normal roundtrip.',
                   'A new child/object translation and its Float32 storage, parent transforms and export still require bounded validation.',
                   'World/GPU Float32 may collapse sub-ULP surfaces even when local authoring topology remains nondegenerate.',
                   'No tiny face is removed or enlarged; no workaround is adopted.']}
(HERE/'precision-trace.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'reportSHA':sha(HERE/'precision-trace.json'),'firstLoss':report['firstLoss'],
    'exactCapturedPointTargetMatches':len(examples),'oldPivotZeroFaces':old_zero,'tipRebasedZeroFaces':rebase_zero,
    'rebaseMaxWorldError':report['counterfactual64']['tipRebaseReconstructionMaxWorldError']},indent=2))
