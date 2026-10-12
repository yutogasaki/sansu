from pathlib import Path
import hashlib,json,shutil
src=Path('/private/tmp/sansu-cove-distant-p9-diagnosis')
root=Path('/Users/yutogasaki/Projects/sansu')
dst=root/'docs/design/2026-10-12-authored-cove-runtime/target-diagnosis'
candidate=Path('/private/tmp/sansu-authored-cove-c2/candidate')
sha=lambda b:hashlib.sha256(b).hexdigest()
files=['domain.mjs','domain.log.txt','domain-report.json','physical.mjs','physical.log.txt','physical-report.json','exact-browser-input.json','verify-targeted.py','targeted-life.log.txt','targeted-eslint.log.txt','targeted-execution.log.txt','targeted-inputs-before.json','targeted-inputs-after.json','targeted-verification.json','archive-diagnosis.py']
for f in files: shutil.copyfile(src/f,dst/f)
verification=json.loads((src/'targeted-verification.json').read_text())
physical=json.loads((src/'physical-report.json').read_text())
before=json.loads((src/'targeted-inputs-before.json').read_text())
compared=[]
for p,h in before['files'].items():
 old=candidate/p
 compared.append({'file':p,'testedSha256':h,'candidateSha256':sha(old.read_bytes()) if old.is_file() else None,'matches':old.is_file() and sha(old.read_bytes())==h})
differences=[x for x in compared if not x['matches']]
report={'result':'Read-only c2 failure diagnosis confirmed a legal main-route blockage; requested alternate (12,-9) preserves actual guarded access; focused regression PASS.',
 'scope':'Exact c2 initial and failure states; one same-world occupancy control; one explicitly requested alternate target. No state search, browser, core or production build. Only the owned life test and this evidence directory changed.',
 'originalFailure':{'phase':'commit-distant-p9','p9From':{'x':8,'z':0},'p9To':{'x':4,'z':-4},'legalPlacement':True,'unreachableOwners':24,'rootCause':'The harness assumed canPlace implied every owner remains approachable; the legal play placement removes 19 walkable refs at an existing main-route neck.', 'cutPoint':{'x':3.5,'z':-4.5},'homeSideNeighbor':{'x':3.25,'z':-4.5},'farSideNeighbor':{'x':3.5,'z':-4.75},'sourceClosureUnchanged':True},
 'floorControl':{'waterComposedFloorsIdentical':True,'changedRetainedFloors':[],'onlyRemovedFloor':'native05-cove-corner-shared-apron-v1/shared-apron','baselineOccupancyOnFailedWorldReached':1477,'baselineOccupancyOnFailedWorldUnreachable':[],'l20Throughl23DryFloorFalseAlreadyPresentInPassingBaseline':True},
 'physicalReproduction':{'source':'physical-report.json','inputCount':len(physical['inputHashes']),'inputsMatchBrowserInitialAndFinal':physical['allInputsMatchBrowser'],'actualRigEnvelopeExactlyMatchesBrowser':physical['envelopeExactMatch'],'baselineAndFailedAllComparedProofFieldsAndAccessMatch':all(all(f['matches'] for f in row['proofFields']) and row['walkableMatches'] and row['reachedMatches'] and row['unreachableMatches'] for row in physical['comparisons']), 'states':[{'name':x['name'],'p9':x['p9'],'stockCount':x['proof']['stockCount'],'coveCount':x['proof']['coveCount'],'triangles':x['proof']['triangles'],'walkable':x['walkable'],'reached':x['reached'],'unreachable':x['unreachable'],'checkedOwnerRoutes':len(x['routes']),'allRoutesUseActualNeighborsAndClearGround':all(r['allNeighbors'] and r['allGroundClear'] for r in x['routes'])} for x in physical['results']]},
 'focusedVerification':{**verification,'testFiles':1,'tests':8,'durationSeconds':56.39,'manifestMethod':'Retained 284-file focused-v4 recursive import/newURL/config/raw-asset closure plus eslint.config.js. Exact byte SHA-256 before and after this single life+eslint run.','comparedToC2Candidate':{'count':len(compared),'differences':differences}},
 'archive':{f:{'bytes':(dst/f).stat().st_size,'sha256':sha((dst/f).read_bytes())} for f in files}}
(dst/'report.json').write_text(json.dumps(report,indent=2)+'\n')
readme='''# c2 distant-p9 target diagnosis

The failed browser edit moved p9 from `(8,0)` to `(4,-4)`. That is a legal play placement, but it closes an existing main-route neck. It does not delete existing composed terrain. The browser's all-owner assertion remains necessary for its safe edit journey; the destination must satisfy that journey's stronger accessibility assumption.

## Evidence

- [Exact recorded browser input](exact-browser-input.json) retains the baseline, failed state, metadata and source report SHA. The original browser run remains a FAIL.
- [Pure domain report](domain-report.json) isolates occupancy from floor composition: water floors are identical, only the expected cove apron disappears, and every retained floor is unchanged. Applying the original occupancy to the exact failed world reconnects all 32 owners. At `(3.5,-4.5)`, the removed walk ref had neighbors `(3.25,-4.5)` on the home side and `(3.5,-4.75)` on the far side. The p9 placement removes 19 walk refs around the neck. l20–l23 already reported `dryFloor: false` in successful baseline captures; those values are not a new floor loss.
- [Actual geometry report](physical-report.json) loads the fixed c2 GLB, native kit, flower support and 9 real character rigs. The measured envelope exactly matches the browser. All compared obstruction/access counts match both browser baseline and failed captures. All 103 loaded local production/resource inputs match the browser's initial and final hashes.

| State | Triangles | Walkable | Reachable | Owners unreachable |
| --- | ---: | ---: | ---: | ---: |
| Baseline p9 `(8,0)` | 115808 | 1410 | 1386 | 0 |
| Failed p9 `(4,-4)` | 27648 | 1438 | 181 | 24 |
| Requested alternate p9 `(12,-9)` | 36424 | 1432 | 1417 | 0 |

The one requested alternate was checked without searching other placements. All 32 owner routes use actual world neighbors and pass the real geometry guard's `clearGroundPath`. This is a grounded choice for the safe journey, not permission to weaken its owner-access assertion. Restoring p9 returns the expected cove assembly; the different triangle totals in separated states reflect the actual remaining flower composition.

## Regression verification

The owned [life test](../../../../src/components/island/growing/authoredCoveLife.test.ts) now covers the real move to `(12,-9)`, store, and unstore at `(8,0)`, checking all placed owners after every life sync. A second case checks the legal blocked destination, retained floor identity, the same-world occupancy control, and access recovery after moving back. No fabricated use receipt is introduced. Production behavior was not changed.

- [Single targeted life run](targeted-life.log.txt): 1 file / 8 tests PASS, 56.39 seconds.
- [Targeted ESLint raw output](targeted-eslint.log.txt): exit 0, empty output.
- [Invocation/exit evidence](targeted-execution.log.txt), [verification report](targeted-verification.json), [before hashes](targeted-inputs-before.json), [after hashes](targeted-inputs-after.json): 285 inputs, 0 changes during the run.
- Test SHA-256: `27cd7b4575e74d66b1386184c83a579b86708bdeb64ce027632b9a17211adab4`.

[Summary and file hashes](report.json) distinguish the fixed c2 diagnostic inputs from the new local regression test. No browser, full core, or production build was launched by this diagnosis. The scripts preserve their executed absolute c2 candidate and temporary paths; reproducing them requires the same candidate or deliberate path remapping. Raw `.log.txt` files were copied byte for byte, not transcribed. Temporary generated module bundles are rebuildable from the scripts and are omitted from this archive.
'''
(dst/'README.md').write_text(readme)
print(json.dumps({'archiveFiles':len(files)+2,'rawBytesPreserved':all((src/f).read_bytes()==(dst/f).read_bytes() for f in files),'candidateDifferences':differences,'testSha256':verification['testSha256'],'pass':verification['pass']},indent=2))
