"""Summarize and verify existing raw audit output; no application/source writes."""
import json, hashlib, math
from pathlib import Path
root=Path(__file__).resolve().parent
r=json.loads((root/'independent-audit.json').read_text())
f=json.loads((root/'independent-floor-audit.json').read_text())
b=json.loads((root/'bounds-audit.json').read_text())
a=r['apron']; shell=r['shell']; app=r['applicability']
slivers=[]
for t in a['nonUpwardTopTriangles']:
    side=max(math.dist(t['points'][i],t['points'][(i+1)%3]) for i in range(3))
    slivers.append({'area':t['area'],'minimumAltitude':2*t['area']/side,'longestSide':side})
checks={
'author_freeze_and_manifest_hashes':r['authorFreezeHashesAgree'] and r['manifestHashesAgree'],
'shell_identity_and_combined_material_geometry':all(shell[k] for k in ['sameAsFixedV3','transformSameAsFixedV3','sourceIdMatchesDelivery','matchesDelivery','compressedArtifactMatchesDelivery','expandedArtifactMatchesShell','combinedGeometryAndMaterialsPreserved']),
'actual_glb_closed_and_finite':r['glbTopology']['allFinite'] and r['glbTopology']['boundaryEdges']==0 and r['glbTopology']['nonManifoldEdges']==0,
'floor_bank_triangle_parity':a['triangleParity'] and a['bankTriangleParity'] and max(a['maxVertexError'],a['bankMaxVertexError'])<1e-6,
'floor_bank_material_colors':a['topMaterialsMatchPatch'] and a['bankMaterialsMatchPatch'],
'actual_domain_independent_patch_parity':r['frames']['dryMatchesIndependentPatch'] and r['frames']['waterMatchesIndependentPatch'],
'one_assembly_each_world':len(r['frames']['dry']['assemblies'])==1 and len(r['frames']['water']['assemblies'])==1,
'old_floors_sites_grants_support':all(all(r[label][key] for key in ['floorsUnchanged','anchorFloorsUnchanged','oldSitesUnchanged','oldEdgesUnchanged','definitionSourceUnchanged','grantsUnchanged']) and not r[label]['oldSiteSupportFailures'] and r[label]['grantsBefore']==73 and r[label]['grantsAfter']==73 and r[label]['addedRefs']==13 and r[label]['addedEdges']==15 for label in ['base','water']),
'local_profile_covers_source_and_actor_sweeps':app['localGroundCoversSourceAndSweeps'] and app['clearCourtCoversSourceAndSweeps'],
'local_ground_fingerprint_and_near_owner_rejection':app['currentLocalGround']['revision']==b['revisions']['base']==b['revisions']['water'] and all(x['currentFixture']==1 and x['nearOwnerNewBounds']==0 and x['nearOwnerOldBounds']==1 for x in b['results']),
'valid_nonoverlapping_patch':f['apron']['valid'] and abs(f['apron']['selfOverlapArea'])<1e-12,
'full_width_all_edges_supported':f['sweep']['edgeCount']==15 and all(f['sweep'][k]['maxGap']<1e-12 for k in ['baseWithPatch','waterWithPatch']),
'actual_socket_bottom_contact':f['socketSupport']['triangles']==192 and f['socketSupport']['maxUncoveredTriangleArea']<1e-12 and f['socketSupport']['maximumNotContactTriangleArea']<1e-12,
'seam_height_below_one_millimeter':f['apron']['maximumSeamVertexHeightDelta']<.001,
'float32_slivers_below_vertex_serialization_uncertainty':all(t['minimumAltitude']<a['maxVertexError'] for t in slivers) and all(x['material'].get('doubleSided') for x in a['materialInfo']),
'source_hashes_unchanged_during_run':r['inputHashesUnchanged'],
}
changed=[]
for path,expected in r['inputHashes'].items():
    current=hashlib.sha256(Path(path).read_bytes()).hexdigest()
    if current!=expected:changed.append({'path':path,'before':expected,'after':current})
checks['source_hashes_still_match_at_closeout']=not changed
result={'schema':'sansu-independent-cove-v4-summary-v1','status':'PASS' if all(checks.values()) else 'HOLD','scope':'Independent source/floor/domain applicability verification only. No browser, core suite, screenshot, art approval, or complete actor pose/lifecycle claim.',
'candidate':r['candidate'],'shellSourceId':r['shellSourceId'],'shellSha256':shell['sha256'],'checks':checks,'failures':[k for k,v in checks.items() if not v],'inputCount':len(r['inputHashes']),'closeoutInputChanges':changed,
'actorEnvelope':{'actors':len(r['envelope']['source']['actorIds']),'meshes':r['envelope']['source']['meshes'],'indexedVertices':r['envelope']['source']['vertices'],'radius':r['envelope']['radius'],'sweepHalfWidth':f['sweep']['halfWidth']},
'knownNumericalLimits':{'nonUpwardSourceGlbSlivers':slivers,'interpretation':'Three retained, nearly collinear triangles reverse or collapse under Float32 serialization; their minimum altitudes are below the measured source vertex serialization error. Both materials are double-sided; all triangle IDs and closed mesh edges remain. Recorded explicitly, not silently deleted or an art gate.',
'maxFullWidthPlanarGapArea':max(f['sweep']['baseWithPatch']['maxGap'],f['sweep']['waterWithPatch']['maxGap']),'maxSocketNonContactArea':f['socketSupport']['maximumNotContactTriangleArea'],'maxSeamHeightDelta':f['apron']['maximumSeamVertexHeightDelta']},
'resolvedFinding':'Root widened localGround and clearCourt from the old z=2.25 boundary to min(5,-3.5), max(11,3.5), revision b854fd9d1de0c4d9. Pre-fix evidence and custom-profile near-owner rejection remain preserved.',
'firstAttempt':'Audit harness initially used bank.color rather than bank.material.color. It failed before producing a result. The raw harness error and initial hashes are retained; the harness was repaired and rerun. No application/source failure is attributed to that error.'}
(root/'summary.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
raise SystemExit(0 if result['status']=='PASS' else 1)
