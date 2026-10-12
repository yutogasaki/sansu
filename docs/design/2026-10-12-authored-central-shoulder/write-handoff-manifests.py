"""Compact source/runtime handoff identity; no geometry or application mutation."""
import json, gzip, hashlib
from pathlib import Path
ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
value_sha = lambda v: hashlib.sha256(json.dumps(v, separators=(',', ':'), sort_keys=True).encode()).hexdigest()
load = lambda p: json.loads(gzip.decompress(p.read_bytes())) if p.suffix == '.gz' else json.loads(p.read_text())
profile = load(ROOT / 'geometry-profile.json.gz')
handoff = load(ROOT / 'input/selected-v3-handoff.json.gz')
context = load(ROOT / 'context-manifest.json')
world = load(ROOT / 'input/candidate-world.json.gz')
assembly = load(ROOT / 'assembly-qa.json')
parity = load(ROOT / 'export-parity.json')
soil = profile['soil']
component = 'central-shoulder-components-normal-v2.glb'
roots = []
for r in profile['rootContinuations']:
    roots.append({'node': r['name'], 'diagnosticOwnerId': r['ownerId'], 'sourceNode': r['sourceNode'], 'binding': r['binding'],
                  'vertices': len(r['positions']), 'triangles': len(r['indices']) // 3,
                  'positionsSha256': value_sha(r['positions']), 'indicesSha256': value_sha(r['indices']),
                  'material': r['material'], 'renderOnce': True, 'countsAsNewOwner': False,
                  'attachment': 'Already authored-world geometry with identity node; attach under T(-layout.center,0,-2). Never apply the source .45 owner matrix a second time.'})
root_manifest = {'candidate': profile['candidate'], 'scope': 'Three conditional owner-specific native trunk extensions, not fixed background trees.',
                 'componentArtifact': {'path': component, 'sha256': sha(ROOT / component)},
                 'profile': {'path': 'geometry-profile.json.gz', 'sha256': sha(ROOT / 'geometry-profile.json.gz')},
                 'roots': roots,
                 'matchingPolicy': 'Match source kit identity/part, mature form and scale, source pivot, audited cell/full transform, and physical composed floor revision. IDs identify this diagnostic; matching an ID alone is insufficient. Any mismatch removes the extension until contact is recomputed. Preview move/storage/young form must never leave a root at the committed cell.',
                 'physicalGuard': 'Include actual 108 root triangles with the three original tree bodies in owner access/actor-band checks. Do not grant navigation or placement from root geometry.'}
(ROOT / 'root-continuations-manifest.json').write_text(json.dumps(root_manifest, indent=2) + '\n')
artifact_names = ['geometry-profile.json.gz', 'central-shoulder-components-normal-v2.glb', 'central-shoulder-source-normal-v2.glb',
                  'central-shoulder-source.blend', 'source-context.glb', 'root-continuations-manifest.json',
                  'normal-export-v2.json', 'export-parity.json', 'geometry-profile-qa.json', 'context-manifest.json',
                  'dimensioned-sections.json', 'dimensioned-sections.svg', 'source-path-diagnostic.json']
script_names = ['export-source-context.mjs', 'extract-trunk-bases.mjs', 'build-geometry-profile.py', 'assemble-source.py',
                'reexport-source-context.py', 'restore-profile-normals.py', 'audit-export.py', 'export-sections.py', 'render-source.py', 'diagnose-source-path.py', 'source-path-ray.py', 'write-handoff-manifests.py']
manifest = {'candidate': profile['candidate'], 'exportRevision': 'normal-v2', 'status': 'Frozen source geometry and normal delivery. Source/runtime/observer art acceptance is separate.',
            'originalSource': profile['source'], 'originalAssetsUnchanged': assembly['originalsUnchanged'], 'originalAssets': assembly['originalInputs'],
            'artifacts': {n: {'sha256': sha(ROOT/n), 'bytes': (ROOT/n).stat().st_size} for n in artifact_names},
            'authoringScripts': {n: sha(ROOT/n) for n in script_names},
            'selectedHandoff': {'path': 'input/selected-v3-handoff.json.gz', 'sha256': sha(ROOT/'input/selected-v3-handoff.json.gz')},
            'world': {'path': 'input/candidate-world.json.gz', 'sha256': sha(ROOT/'input/candidate-world.json.gz'), 'id': world['id'], 'revision': world['revision'],
                      'sourceDistrict': handoff['sourceDistrictId'], 'replacementDistrict': handoff['replacementDistrict']['id'],
                      'oldRights': 73, 'diagnosticRights': 2, 'totalRights': 75, 'oldOwners': 32, 'normalSaplingOwners': 3, 'totalOwners': 35,
                      'normalExpansionOrUserSaveImplemented': False},
            'coordinateContract': profile['coordinateContract'], 'sourceTransformProvenance': handoff['coordinateContract'],
            'fixedFrame': {'contextRendererToAuthored': context['rendererToAuthored'], 'dynamicRendererFromAuthored': 'translation [-layout.center, 0, -2]',
                           'planInputs': 'input/candidate-frame-plans.json', 'stateInputs': 'input/candidate-state.json',
                           'treeOwnerMatrices': 'root-continuations-manifest.json / roots[].binding.authoredMatrixWorld; column-major'},
            'terrain': {'node': soil['name'], 'regionAreaM2': handoff['boundaryProof']['boundaryArea'], 'boundaryVertices': len(handoff['boundary']),
                        'topRawVertices': len(soil['topOriginalPositions']), 'topTriangles': soil['topTriangleCount'],
                        'sourceClosedVertices': len(soil['positions']), 'sourceClosedTriangles': len(soil['indices'])//3,
                        'materialTriangles': {'0': 1722, '1': 4893}, 'closedSideAndBottomTriangles': 8569,
                        'clipBothOriginalFloors': handoff['clipSourceFloorIds'], 'rawTopPositionSha256': value_sha(soil['topOriginalPositions']),
                        'rawTopIndexSha256': value_sha(soil['topOriginalIndices']), 'triangleMaterialSha256': value_sha(soil['topMaterialIndices']),
                        'rawNormalPath': 'newFloorAttributes.normals; one unit XYZ normal per original raw vertex index',
                        'materialPath': 'newFloorAttributes.materials; exact source glTF PBR, including .7799999713897705 terrain roughness',
                        'normalPolicy': profile['normalPolicy'],
                        'renderOnce': 'Runtime adapter may split original indices into material 0/1 floors sharing raw positions/normals. In that mode do not also draw soil GLB top primitives 0/1; optional closed side/bottom primitive 2 is separate. Full-source GLB is a diagnostic composition, not an additional runtime background.',
                        'sitePolicy': 'Rebind a site to its actual supporting material-floor after any 2-floor split, preserve union triangles and all physical supports/edges; never create duplicate cell sites.'},
            'rootManifest': 'root-continuations-manifest.json',
            'normalDelivery': {'onlyTwoTopNormalAccessorsChanged': True, 'geometryAuditReusable': True,
                               'proof': 'normal-export-v2.json', 'finalMaxUnitNormalL2Error': parity['results'][0]['maxNormalL2ErrorAfterProfileRestore'],
                               'editableBlendFirstExportMaxNormalL2Error': .004525506827518773,
                               'restoreCommand': 'python3 docs/design/2026-10-12-authored-central-shoulder/restore-profile-normals.py'},
            'contextLimits': ['Fixed c4 objectLayer geometry with selected 35-owner diagnostic state/world; not the original 15-home composition.',
                              'No residents or life poses. No claim of person appeal or event anticipation from absent characters.',
                              'Three water ripple line primitives disappear through Blender import/export; actual app must retain its existing water renderer.',
                              'Offline lighting/camera/ocean and original transmission are source comparison only; not runtime parity.',
                              'Existing path coplanar joints render as dark dots in source previews; the app must keep its existing path renderer, not import this diagnostic full-scene mesh.',
                              'App integration, acquisition/save, final M1 acceptance and independent child observation remain unperformed.'],
            'sourceViews': 'source-render-manifest.json (separate render settings/hashes; does not alter frozen geometry)',
            'independentAudit': 'independent-source-audit/README.md',
            'logs': [{'path': str(p.relative_to(ROOT)), 'sha256': sha(p)} for p in sorted((ROOT/'execution').glob('*.log.txt')) if not p.name.startswith('render-') and p.name not in {'write-handoff-manifests.log.txt', 'verify-handoff.log.txt'}]}
(ROOT / 'scene-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'candidate': profile['candidate'], 'sceneManifestSha256': sha(ROOT/'scene-manifest.json'), 'rootManifestSha256': sha(ROOT/'root-continuations-manifest.json'), 'artifacts': len(artifact_names)}, indent=2))
