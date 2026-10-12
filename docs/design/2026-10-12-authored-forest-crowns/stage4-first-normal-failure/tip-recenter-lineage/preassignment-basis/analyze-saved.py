"""Offline exact-float rational face/fan audit. No Blender, updates or new geometry."""
from pathlib import Path
from fractions import Fraction
import gzip
import hashlib
import json
import math
import struct

HERE = Path(__file__).resolve().parent
DEBUG = HERE.parent
FILES = [DEBUG / 'attempt-01/failing-role-raw.json.gz',
         DEBUG / 'sharp-fan-comparison/attempt-01/comparison-raw.json.gz',
         DEBUG / 'sharp-fan-comparison/attempt-01/result.json']
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
before = {str(path): sha(path) for path in FILES}
original = json.loads(gzip.decompress(FILES[0].read_bytes()))
raw = json.loads(gzip.decompress(FILES[1].read_bytes()))
result = json.loads(FILES[2].read_text())


def cross(a, b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]


def sub(a, b):
    return [x-y for x, y in zip(a, b)]


def unit(value):
    length = math.sqrt(sum(x*x for x in value))
    return [x/length for x in value] if length else None


def dot(a, b):
    return sum(x*y for x, y in zip(a, b)) if b is not None else None


def metrics(positions, indices):
    p = [[Fraction(x) for x in positions[i]] for i in indices]
    c = cross(sub(p[1], p[0]), sub(p[2], p[0]))
    vector = [float(x) for x in c]
    length = math.sqrt(sum(x*x for x in vector))
    edges = [math.dist(positions[indices[i]], positions[indices[(i+1) % 3]]) for i in range(3)]
    return {'area': length/2, 'exactRationalCrossIsZero': all(x == 0 for x in c),
            'cross': vector, 'unitFaceNormal': unit(vector), 'edgeLengths': edges,
            'twiceAreaOverLongestEdgeSquared': length/max(edges)**2 if max(edges) else 0,
            'coincidentVertexPairs': [[indices[i], indices[j]] for i in range(3) for j in range(i+1, 3)
                                      if positions[indices[i]] == positions[indices[j]]]}


def fan(vertex, start_face, faces, flags):
    incident = [i for i, indices in faces.items() if vertex in indices]
    seen = {start_face}
    pending = [start_face]
    while pending:
        face = pending.pop()
        for other in incident:
            shared = set(faces[face]) & set(faces[other])
            if other in seen or len(shared) != 2 or vertex not in shared:
                continue
            key = ','.join(map(str, sorted(shared)))
            if not flags[key]:
                seen.add(other)
                pending.append(other)
    return sorted(seen)


out = []
for data, report in zip(raw, result['variants']):
    assert data['variant'] == report['variant']
    faces = {original['loops'][source_loop]['polygon']: original['polygons'][original['loops'][source_loop]['polygon']]['vertices']
             for source_loop in data['sourceLoopIndices']}
    face_metrics = {face: {'vertices': indices, 'before': metrics(original['inputLocalPositions'], indices),
                           'after': metrics(data['positionsAfterField'], indices)} for face, indices in faces.items()}
    collapsed = [face for face, record in face_metrics.items() if not record['before']['exactRationalCrossIsZero']
                 and record['after']['exactRationalCrossIsZero']]
    failures = []
    for loop, (expected, actual) in enumerate(zip(data['expectedByOriginalMethod'], data['storedAfterField'])):
        residual = math.dist(expected, actual)
        if residual <= .002:
            continue
        source_loop = data['sourceLoopIndices'][loop]
        face = original['loops'][source_loop]['polygon']
        vertex = data['loopVertexIndices'][loop]
        component = fan(vertex, face, faces, report['sharpFlags']['afterFieldSetter'])
        fan_before = [sum(face_metrics[f]['before']['cross'][i] for f in component) for i in range(3)]
        fan_after = [sum(face_metrics[f]['after']['cross'][i] for f in component) for i in range(3)]
        failures.append({'retainedLoop': loop, 'sourceLoop': source_loop, 'sourceFace': face, 'sourceVertex': vertex,
            'sourceFaceGeometry': face_metrics[face], 'expectedStoredResidualL2': residual,
            'expected': expected, 'stored': actual, 'rawSourceDesired': data['desiredFromRawSourceSameJ'][loop],
            'expectedLength': math.sqrt(dot(expected, expected)), 'storedLength': math.sqrt(dot(actual, actual)),
            'fanSourceFaces': component,
            'fanBeforeCrossSum': fan_before, 'fanAfterCrossSum': fan_after,
            'fanBeforeAreaSum': sum(face_metrics[f]['before']['area'] for f in component),
            'fanAfterAreaSum': sum(face_metrics[f]['after']['area'] for f in component),
            'expectedDotAfterFaceNormal': dot(expected, face_metrics[face]['after']['unitFaceNormal']),
            'expectedDotAfterAreaWeightedFanNormal': dot(expected, unit(fan_after)),
            'storedDotAfterAreaWeightedFanNormal': dot(actual, unit(fan_after))})
    out.append({'variant': data['variant'], 'retainedFaces': len(faces), 'newExactZeroFaces': collapsed,
        'exactZeroBefore': [f for f, record in face_metrics.items() if record['before']['exactRationalCrossIsZero']],
        'exactZeroAfter': [f for f, record in face_metrics.items() if record['after']['exactRationalCrossIsZero']],
        'smallestInputAreaFaces': sorted(face_metrics, key=lambda f: face_metrics[f]['before']['area'])[:12],
        'faceMetrics': face_metrics, 'failedCorners': failures})

precision = []
for a, b in [(36, 37), (37, 38), (36, 38)]:
    input_delta = sub(original['inputLocalPositions'][a], original['inputLocalPositions'][b])
    post_a, post_b = raw[0]['positionsAfterField'][a], raw[0]['positionsAfterField'][b]
    ulps = []
    for value in post_a:
        bits = struct.unpack('<I', struct.pack('<f', abs(value)))[0]
        ulps.append(struct.unpack('<f', struct.pack('<I', bits+1))[0] - abs(value))
    precision.append({'vertices': [a,b], 'inputCoordinates': [original['inputLocalPositions'][a], original['inputLocalPositions'][b]],
                      'inputDelta': input_delta, 'inputDistance': math.dist(original['inputLocalPositions'][a], original['inputLocalPositions'][b]),
                      'storedCoordinates': [post_a, post_b], 'storedDistance': math.dist(post_a, post_b), 'storedF32ComponentUlps': ulps})
after = {str(path): sha(path) for path in FILES}
assert before == after
report = {'status': 'OFFLINE OBSERVATION; no Blender or correction selected',
    'sourceNodeIndex': 2239, 'ownerId': 'l14', 'guardUnchanged': .002,
    'arithmetic': 'Fraction from exact binary float input; exact zero uses rational cross product equality, not epsilon. Areas/angles reported as float64.',
    'nearZeroPolicy': 'No removal/classification threshold: smallest12 areas, edge lengths and dimensionless quality are reported.',
    'variants': out, 'collapsedVertexPrecision': precision,
    'finding': 'Retained source faces45/47/146/150 are nonzero before and exactly zero after every variant. Vertices36/37/38 become identical. All-sharp four failures occur on these four faces. Targeted sharp additionally spreads mismatch through the remaining vertex37 fan. This is observed geometry collapse; the precise operation causing it and a preassignment-cache contribution are not isolated by saved arrays.',
    'inputsBefore': before, 'inputsAfter': after, 'inputsUnchanged': True,
    'blenderExecuted': False, 'sourceOrGeometryChanged': False}
(HERE / 'saved-face-fan-analysis.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'reportSHA': sha(HERE / 'saved-face-fan-analysis.json'), 'variants': [
    {'name': record['variant'], 'newExactZeroFaces': record['newExactZeroFaces'],
     'failedCorners': [{key: fail[key] for key in ['retainedLoop','sourceLoop','sourceFace','sourceVertex','fanSourceFaces','expectedStoredResidualL2']} for fail in record['failedCorners']]}
    for record in out], 'precision': precision}, indent=2))
