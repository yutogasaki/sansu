#!/usr/bin/env python3
"""Preserve c4's four passing regressions and terminal flower timeout, without retry."""
import hashlib, json, shutil, time
from pathlib import Path
P=Path('/private/tmp/sansu-authored-cove-c4'); R=P/'regressions'
REPO=Path('/Users/yutogasaki/Projects/sansu')
D=REPO/'docs/design/2026-10-12-authored-cove-runtime/c4/regressions'
NAMES=['01-baseline27-editing','02-wide27-water','03-ordinary-growing-balance','04-classic-smoke','05-authored-flower-full-cove-off']
log=[]
def record(s): log.append(s); print(s,flush=True)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p): return json.loads(p.read_text())
def hashes(root,inputs): return {n:sha(root/n) for n in inputs}
def inv(root):
    assert not any(p.is_symlink() for p in root.rglob('*'))
    return {str(p.relative_to(root)):{'sha256':sha(p),'bytes':p.stat().st_size} for p in sorted(root.rglob('*')) if p.is_file()}
def diffs(inputs,actual): return [{'file':n,'core':h,'current':actual[n]} for n,h in inputs.items() if h!=actual[n]]
core=read(P/'core/report.json'); snap=read(P/'snapshot.json'); outer=read(R/'report.json'); expected=core['initialInputs']
assert core['pass'] and core['exitCode']==0 and core['sourceFixed'] and len(expected)==2137 and core['finalInputs']==expected
assert snap['changedDuringCopy']==[] and {k:snap['files'].get(k) for k in expected}==expected
assert outer['pass'] is False and outer['sourceFixed'] and outer['initialSources']==outer['finalSources']==expected
assert [s['name'] for s in outer['stages']]==NAMES and outer['finishedAtUnixSeconds']
assert outer['firstFailure']['name']==NAMES[-1] and outer['firstFailure']['failurePhase']=='outer-command-timeout'
assert outer['coreReportSha256']==sha(P/'core/report.json') and outer['snapshotSha256']==sha(P/'snapshot.json')
assert hashes(P/'candidate',expected)==expected
repo_before=diffs(expected,hashes(REPO,expected))
assert {d['file'] for d in repo_before}.issubset({'docs/ai/verification_matrix.md'})
record('PASS: fixed candidate, core before/after, snapshot and outer before/after all match 2137 inputs.')
record('Current repository differences outside candidate: '+json.dumps(repo_before))
summary=[]; previous_end=0
for i,name in enumerate(NAMES):
    sd=R/name; s=read(sd/'report.json'); raw=read(sd/s['reportRelative']); is_flower=i==4
    assert s['coreInputsMatch'] and s['sourceFixed'] and s['initialSources']==s['finalSources']==expected
    assert s['startedAtUnixSeconds']>=previous_end; previous_end=s['finishedAtUnixSeconds']
    assert s['coreReportSha256']==sha(P/'core/report.json') and s['snapshotSha256']==sha(P/'snapshot.json')
    assert s['pass'] is (not is_flower) and s['exitCode']==(1 if is_flower else 0) and raw['pass'] is (not is_flower)
    if not is_flower:
        assert not raw.get('error') and not raw.get('errors')
        assert all(x.get('pass') is True for x in raw.get('scenarios',[]))
        assert all(isinstance(x,str) or x.get('pass') is True for x in raw.get('steps',[]))
    row={'name':name,'pass':s['pass'],'exitCode':s['exitCode'],'failurePhase':s.get('failurePhase'),'timeoutSeconds':s['timeoutSeconds'],
         'rawReport':str((sd/s['reportRelative']).relative_to(R)),'rawReportSha256':sha(sd/s['reportRelative']),
         'command':s['command'],'commandPid':s['processId'],'candidateCwd':s['candidate'],'environmentOverrides':s['environmentOverrides'],
         'commonEnvironment':{'SANSU_BUILD_REVISION':'authored-cove-c4','VITE_ISLAND_ENABLED':'true','VITE_NATIVE_GROWING_ART':'false'},
         'startedAtUnixSeconds':s['startedAtUnixSeconds'],'finishedAtUnixSeconds':s['finishedAtUnixSeconds'],
         'processGroupCleanup':s['processGroupCleanup'],'all2137BeforeAfterMatchCore':True,
         'scenarioCount':len(raw.get('scenarios',[])),'stepCount':len(raw.get('steps',[])),'captureCount':len(raw.get('captures',[]))}
    if i==3:
        assert raw['harnessHash']==expected['tools/e2e-smoke.mjs'] and len(raw['scenarios'])==32
        execution=(sd/'execution.log.txt').read_text()
        assert raw['target']=='http://127.0.0.1:4173' and 'Starting dev server on http://127.0.0.1:4173...' in execution
        assert 'Dev server ready on http://127.0.0.1:4173.' in execution and 'All smoke-test ports are occupied; reusing ' not in execution
        row.update({'rawInputSubset':{'count':1,'pass':True,'scope':'Raw exposes harness hash only; complete source closure verified by outer runner.'},
                    'runtimeBuildStatus':'BUILD_VALUE_NOT_OBTAINED','runtimeBuildMatches':None,'target':raw['target'],'ownServerEvidence':s['dedicatedServerEvidence']})
    else:
        before=raw.get('initialInputs',raw.get('initialSources')); after=raw.get('finalInputs',raw.get('finalSources'))
        assert before and all(expected.get(n)==h for n,h in before.items())
        assert (after is None) if is_flower else (before==after)
        caps=raw['captures']; builds=sorted({c.get('build') or c.get('revision') or '' for c in caps})
        assert caps and builds==['authored-cove-c4'] and all((sd/'actual'/c['file']).is_file() for c in caps)
        row.update({'rawInputSubset':{'count':len(before),'initialSubsetMatches':True,'finalInputsPresent':after is not None,'beforeAfterEqual':False if is_flower else True,'pass':not is_flower,
                                      'limitation':'Driver finalInputs absent after outer timeout; missing final values are not observed byte drift.' if is_flower else None},
                    'runtimeBuildStatus':'CAPTURE_METADATA_MATCH','runtimeBuildMatches':True,'runtimeBuilds':builds})
    if is_flower:
        assert s['failurePhase']=='outer-command-timeout' and s['timeoutSeconds']==900
        assert len(raw['captures'])==4 and len(raw['canvasSelections'])==4 and len(raw['edits'])==4 and all(e['pass'] for e in raw['edits'])
        assert raw.get('sourceClosureUnchanged') is None and raw['shapeOnly'] is False and raw['rayOnly'] is False
        assert all(c['metadata']['authoredCoveEnabled']=='false' and c['metadata']['artCandidate']=='native05-authored-flower-garden-v3' and 'cove=false' in c['url'] for c in raw['captures'])
        row.update({'rawError':raw['error'],'canvasSelectionCount':4,'editCount':4,'selectionCount':len(raw['selections']),
                    'coveDisabledInAvailableCaptures':True,'referenceStages':sorted({c['referenceSource']['stage'] for c in raw['captures']}),
                    'sourceClosureUnchangedRecorded':False,'uncompleted':['rotate-whole completion','rotated whole/close captures','tablet whole/close','phone whole/close','young load and whole/close','driver final input check']})
    summary.append(row)
    record(f"{name}: {'PASS' if row['pass'] else 'FAIL/INCOMPLETE'}; exit {row['exitCode']}; raw subset {row['rawInputSubset']['count']}; captures {row['captureCount']}.")
assert not D.exists(), 'Refuse overwriting existing archive'
before=inv(R); shutil.copytree(R,D); after=inv(R); dest=inv(D); assert before==after==dest
record(f'Archive integrity PASS: {len(before)} files / {sum(x["bytes"] for x in before.values())} bytes; source-before/source-after/copy SHA256 all equal.')
assert hashes(P/'candidate',expected)==expected
repo_after=diffs(expected,hashes(REPO,expected)); assert {d['file'] for d in repo_after}.issubset({'docs/ai/verification_matrix.md'})
record('Post-archive fixed candidate: all 2137 inputs still match.')
record('Post-archive working repository differences: '+json.dumps(repo_after))
proof={'archiveIntegrityPass':True,'regressionPass':False,'completedPassCount':4,'failedIncompleteCount':1,'createdAtUnixSeconds':time.time(),
       'sourceDirectory':str(R),'destinationDirectory':str(D),'revision':'authored-cove-c4','runnerTerminal':{'execSession':71587,'observedExitCode':1,'flowerPid':68908,'flowerProcessObservedExited':True},
       'runnerScript':{'path':'/private/tmp/sansu-authored-cove-c4-prep/regressions.py','sha256':sha(Path('/private/tmp/sansu-authored-cove-c4-prep/regressions.py'))},
       'core':{'path':str(P/'core/report.json'),'sha256':sha(P/'core/report.json'),'inputCount':2137,'pass':True},
       'snapshot':{'path':str(P/'snapshot.json'),'sha256':sha(P/'snapshot.json'),'changedDuringCopy':[]},
       'sourceChecks':{'fixedCandidateAll2137Match':True,'coreBeforeAfter':True,'snapshotSubset':True,'outerBeforeAfter':True,'everyStageBeforeAfter':True,'postArchiveCandidate':True,
                       'currentRepositoryMatches':not repo_before,'currentRepositoryDifferences':repo_before,'postArchiveRepositoryDifferences':repo_after},
       'stagesStrictlySequential':True,'firstFailure':{'name':NAMES[-1],'phase':'outer-command-timeout','limitSeconds':900,'operation':'rotate-whole',
                'firstMeaningfulCause':'The external runner reached its configured command deadline and terminated its own process group.',
                'rawErrorInterpretation':'The raw scrollIntoViewIfNeeded browser-closed error occurred during the outer timeout termination. The raw does not establish a pre-timeout application assertion failure or successful completion.'},
       'stages':summary,'rawArchive':{'fileCount':len(before),'bytes':sum(x['bytes'] for x in before.values()),'sourceBeforeEqualsSourceAfterEqualsCopy':True,'files':before},
       'limits':['Five-regression PASS is not claimed; flower remains incomplete.', 'Classic actual screen build value not obtained.',
                 'Diagnostic timing values do not establish product performance acceptance.', 'No retries or new browser execution during archive.',
                 'No new acquisition, natural growth, personal-save, physical touch-device, independent art/understanding or complete M1 acceptance.']}
(D/'archive-proof.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')
(D/'README.md').write_text('''# c4 regression results and first failure

Four stages passed. The fifth full flower run is **FAIL / incomplete**, stopped at the fixed external 900-second deadline during `rotate-whole`. The runner terminated with exit code 1 (session 71587); flower PID 68908 was confirmed exited. No automatic retry or limit change occurred.

| Stage | Result | Recorded checks | Captures | Raw input evidence |
| --- | --- | --- | --- | --- |
| baseline27 editing | PASS | 6 steps | 7 | 1,581 before/after subset |
| wide27 water | PASS | 6 string steps | 14 | 1,585 before/after subset |
| ordinary Growing balance | PASS | 8 scenarios | 22 | 1,580 before/after subset |
| isolated classic smoke | PASS | 32 scenarios | not reported | matching harness SHA; outer closure |
| full flower, cove=false | FAIL / incomplete | 4 canvas selections, 4 passing edits, 6 selections | 4 | 1,899 initial subset only; final inputs absent |

## First failure and unfinished scope

The first meaningful failure is the outer runner's 900-second command deadline. Its process-group termination closed the browser during `whole()` / `rotate-whole`; the raw report records `locator.scrollIntoViewIfNeeded: Target page, context or browser has been closed`. The report does not establish a pre-timeout app assertion failure or a successful full flower run.

The flower raw records successful cancel, move/split, store and restore/reconnect edits, four canvas selections, and mature desktop captures. Rotation completion and rotated captures, tablet/phone whole and close views, young-reference load/captures, and the final driver input check remain unfinished. `sourceClosureUnchanged` and `finalInputs` were never recorded. The runner's raw-subset mismatch rows contain missing final values; they are preserved, but are not evidence of changed source bytes.

All 2,137 fixed candidate inputs match core before/after, snapshot, outer before/after and every stage before/after, and a further candidate hash read after copying. The current working repository has root's separately recorded next-work contract edit in `docs/ai/verification_matrix.md`; original bytes remain fixed in the c4 candidate. Current repository equality is not claimed. Exact working-repository differences are recorded in `archive-proof.json`. No app source difference was allowed.

## Build identity and classic limitation

Every available non-classic capture records build/revision `authored-cove-c4`. The four flower captures have cove=false, mature reference and `native05-authored-flower-garden-v3`; they do not establish young-reference coverage. Authored routes explicitly use native art although the fixed server default is native=false and Island=true.

Classic used `npm run e2e:smoke` from the fixed candidate cwd, command PID 68382, and its own server at `http://127.0.0.1:4173`. Its environment was Island=false, native=false, classic-v1, with runner-wide `SANSU_BUILD_REVISION=authored-cove-c4`. Its dedicated startup, fixed 2,137-input closure, harness SHA and 32 passing results support provenance. PID 68382 identifies the command process; a separate child Vite PID is not asserted.

The classic raw report has no captured screen build value: that value remains **not obtained**. Supplemental HTTP responses and the initial parser's false result are retained. The parser expected an inline value but received `__BUILD_REVISION__`. A later env-module read encountered connection refused after normal classic completion and server cleanup. This supplemental observation did not alter the regression result; no retry or extra browser was started.

## Archive and interpretation

All temporary regression files are copied byte-for-byte, including the first failure, captures, logs, supplemental observation, prepared success-only archive helper (not executed), and executed failure archive helper. The manifest proves source-before/source-after/destination SHA256 equality. This README, proof and archive execution log are additive; copied raw reports are unchanged. Prior c2/c3 failure evidence remains separate.

Timing/frame markers remain diagnostics and do not establish product performance acceptance. Synthetic authored fixtures do not establish fresh acquisition, natural growth, personal-save migration, physical touch hardware, independent art/understanding, general cove source applicability, complete M1 or release acceptance. Ordinary Growing uses disposable preview profiles and its driver-defined learning flow; late-save fixtures remain explicit. No source, core, build or browser was rerun for archive.
''')
(D/'archive-execution.log.txt').write_text('\n'.join(log)+'\n')
assert all(sha(D/n)==v['sha256'] for n,v in before.items())
print(json.dumps({'archiveIntegrityPass':True,'regressionPass':False,'archive':str(D),'rawFiles':len(before),'rawBytes':sum(x['bytes'] for x in before.values()),'proofSha256':sha(D/'archive-proof.json')},ensure_ascii=False))
