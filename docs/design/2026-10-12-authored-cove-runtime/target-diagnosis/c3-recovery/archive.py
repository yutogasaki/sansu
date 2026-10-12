from pathlib import Path
import json,hashlib,re,shutil
src=Path('/private/tmp/sansu-authored-cove-c3/recovery-diagnosis')
dst=Path('/Users/yutogasaki/Projects/sansu/docs/design/2026-10-12-authored-cove-runtime/target-diagnosis/c3-recovery')
dst.mkdir(parents=True,exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
r=json.loads((src/'report.json').read_text())
c=r['comparisons']
assert c['storedMemorySerializesExactlyAsFailure'] and c['driverVsUIAllStateValuesEqual'] and c['uiRevisionMatchesActualMetadata']
assert not c['driverRevisionMatchesActualMetadata'] and not c['driverVsUIRevisionEqual']
assert all(c[k] for k in ['driverVsUIWaterPlansEqual','driverVsUIAssembliesEqual','driverVsUIFloorsEqual','driverVsUISitesEqual','actualUnstoreRevisionMatchesInitial'])
assert r['allInputsMatchBrowser']
files=['diagnose.mjs','report.json','execution.log.txt','exact-input.json','archive.py']
for f in files:shutil.copyfile(src/f,dst/f)
manifest={'result':'Confirmed deterministic driver expected-revision mismatch after JSON drops the undefined p9 cell key; not a missing preview or timeout-duration remedy.',
 'scope':'Read-only exact c3 failure diagnosis. Original browser run remains FAIL; pure unstore computation is not a completed browser restore.',
 'rawBytesPreserved':all((src/f).read_bytes()==(dst/f).read_bytes() for f in files),
 'files':{f:{'bytes':(dst/f).stat().st_size,'sha256':sha((dst/f).read_bytes())} for f in files}}
(dst/'archive-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
readme='''# c3 restoration preview revision diagnosis

The c3 full browser run failed while waiting for the restore preview's expected revision. The recorded UI already exposed the initial revision and one visible prospective cove shell. Pure computation from the exact recorded inputs confirms that the driver waited for a different, deterministic revision produced only by its JSON-round-tripped expected state. The original full run remains **FAIL**; no browser rerun occurred in this diagnosis.

| Input and operation | World revision |
| --- | --- |
| Initial browser baseline | `authored-world:72a57599a43ddca5` |
| Stored state, reconstructed through real move and store commands | `authored-world:063fdbf4bf1fb7e6` |
| Actual UI preview from in-memory stored state | `authored-world:72a57599a43ddca5` |
| Driver future: JSON-parsed stored state, then append `cell` | `authored-world:aa54694380b082d1` |
| Actual preview helper given that same JSON-parsed state | `authored-world:aa54694380b082d1` |
| Pure real unstore command on in-memory state | `authored-world:72a57599a43ddca5` |

The store command assigns `cell = undefined`, retaining its original property position in memory. The dataset's JSON serialization omits that key. When the driver parses the dataset and assigns `cell`, it appends the key after `stagedAt`. `deriveAuthoredCovePlan` fingerprints the complete plots array with `JSON.stringify`, so property insertion order changes the cove revision even though the plot values match. `previewGrowingState` preserves an existing cell key's position through object spread.

The real-command reconstructed stored state serializes **byte for byte identically** to the recorded failure state. UI future and driver future have equal values across **all state fields**, with no value-different fields. Their water plans, cove assemblies, floors and sites are also equal. Only the property order and resulting cove/world identity differ. The actual preview metadata matches the in-memory computation, while the driver's expected revision does not. More waiting cannot resolve this equality predicate.

The driver's preceding `protectedState(stored)` invariant already proves that every canonical value except p9's cell matches the baseline. Under this fixed journey, using `structuredClone(baseline)` as the restoration target preserves the original key order and initial-plan/revision assertion. No production fingerprint change is needed to correct this diagnostic expectation. This focused investigation found no evidence of an additional application failure; it did not audit all persistence or serialization flows.

## Evidence

- [Pure computation report](report.json): exact revisions, all-state/value and geometry comparisons, plus **90 local production/resource inputs** matching browser initial and final SHA-256.
- [Exact browser input](exact-input.json): recorded baseline, stored failure state and failure metadata, with source report SHA.
- [Executed diagnostic script](diagnose.mjs) and [raw output](execution.log.txt): actual `applyIntent`, `previewGrowingState` and `authoredWorldFrame` functions from the fixed c3 candidate.
- [Archive manifest](archive-manifest.json): raw byte-preserving copy and file hashes.

The scripts retain their executed `/private/tmp/sansu-authored-cove-c3` paths; the c3 candidate and deliberate path remapping are needed to reproduce them elsewhere. Generated temporary module bundles are rebuildable and omitted. No app, driver, candidate, previous evidence, browser, core or production build was changed or started by this diagnosis.
'''
(dst/'README.md').write_text(readme)
assert all(sha((dst/f).read_bytes())==v['sha256'] for f,v in manifest['files'].items())
assert all((dst/f).exists() for f in re.findall(r'\]\(([^)]+)\)',readme))
print(json.dumps({'archive':str(dst),'files':len(files)+2,'rawBytesPreserved':manifest['rawBytesPreserved'],'reportSha256':sha((dst/'report.json').read_bytes()),'hashAndLinks':'PASS'},indent=2))
