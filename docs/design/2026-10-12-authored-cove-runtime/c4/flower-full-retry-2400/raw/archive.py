#!/usr/bin/env python3
"""Archive one terminal retry attempt; does not execute a browser or modify candidate."""
import argparse, hashlib, json, shutil, time
from pathlib import Path
ROOT=Path('/private/tmp/sansu-authored-cove-c4'); OUT=ROOT/'flower-full-retry-2400'
REPO=Path('/Users/yutogasaki/Projects/sansu')
DEST=REPO/'docs/design/2026-10-12-authored-cove-runtime/c4/flower-full-retry-2400'
def read(p): return json.loads(p.read_text())
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None
def inventory(p):
    assert not any(f.is_symlink() for f in p.rglob('*'))
    return {str(f.relative_to(p)):{'sha256':sha(f),'bytes':f.stat().st_size} for f in sorted(p.rglob('*')) if f.is_file()}
def hashes(root,expected): return {n:sha(root/n) for n in expected}
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--archive',action='store_true');parser.add_argument('--runner-exit-code',type=int,choices=[0,1]);args=parser.parse_args()
    if not args.archive:
        print(json.dumps({'prepared':True,'archiveStarted':False,'source':str(OUT),'destination':str(DEST),'requires':'Terminal report and observed runner exit code.'}));return
    assert args.runner_exit_code is not None
    report=read(OUT/'report.json');core=read(ROOT/'core/report.json');snapshot=read(ROOT/'snapshot.json');expected=core['initialInputs']
    assert report.get('finishedAtUnixSeconds') and report['pass']==(args.runner_exit_code==0)
    assert len(expected)==2137 and expected==core['finalInputs'] and core['pass'] and core['sourceFixed']
    assert snapshot['changedDuringCopy']==[] and all(snapshot['files'].get(n)==v for n,v in expected.items())
    assert report['coreReportSha256']==sha(ROOT/'core/report.json') and report['snapshotSha256']==sha(ROOT/'snapshot.json')
    assert report['timeoutSeconds']==2400 and report['command']==['node','tools/e2e-authored-flower.mjs']
    assert report['runnerScriptSha256']==sha(OUT/'runner.py')
    current=hashes(ROOT/'candidate',expected)
    source_fixed=(report.get('initialSources')==report.get('finalSources')==current==expected)
    assert bool(report.get('sourceFixed'))==(report.get('initialSources')==report.get('finalSources')==expected)
    raw_path=OUT/'actual/report.json';raw=read(raw_path) if raw_path.is_file() else None
    before=(raw or {}).get('initialInputs',{});after=(raw or {}).get('finalInputs')
    raw_initial_subset=bool(before) and all(expected.get(n)==v for n,v in before.items())
    if report['pass']:
        assert source_fixed and report['exitCode']==0 and report['inspection']['pass']
        assert raw and raw['pass'] and raw.get('sourceClosureUnchanged') is True and before==after and raw_initial_subset
        assert len(raw['captures'])==12 and len(raw['canvasSelections'])==4 and len(raw['edits'])==4
        assert all((c.get('build') or c.get('revision'))=='authored-cove-c4' and c['metadata']['authoredCoveEnabled']=='false' and 'cove=false' in c['url'] for c in raw['captures'])
        assert {c['referenceSource']['stage'] for c in raw['captures']}=={'mature','young'}
    assert not (DEST/'raw').exists(), 'Refuse overwriting an archived attempt'
    initial=inventory(OUT);shutil.copytree(OUT,DEST/'raw');final=inventory(OUT);copied=inventory(DEST/'raw');assert initial==final==copied
    candidate_after=hashes(ROOT/'candidate',expected);assert candidate_after==current
    repository_hashes=hashes(REPO,expected)
    repository_diffs=[{'file':n,'core':v,'current':repository_hashes[n]} for n,v in expected.items() if repository_hashes[n]!=v]
    proof={'archiveIntegrityPass':True,'regressionPass':report['pass'],'createdAtUnixSeconds':time.time(),'revision':'authored-cove-c4',
      'sourceDirectory':str(OUT),'destinationDirectory':str(DEST/'raw'),'observedRunnerExitCode':args.runner_exit_code,
      'firstAttempt':report['priorAttempt'],'outerLimitChangeOnly':{'originalSeconds':900,'retrySeconds':2400,'driverSha256':report.get('driverSha256'),'coreDriverSha256':expected['tools/e2e-authored-flower.mjs']},
      'sourceChecks':{'inputCount':2137,'fixedCandidateMatches':current==expected,'postArchiveCandidateMatches':candidate_after==expected,'beforeAfterFixed':source_fixed,
                      'coreReportSha256':sha(ROOT/'core/report.json'),'snapshotSha256':sha(ROOT/'snapshot.json'),
                      'rawInitialInputCount':len(before),'rawInitialSubsetMatches':raw_initial_subset,'rawFinalInputsPresent':after is not None,'rawBeforeAfterEqual':bool(before) and before==after},
      'currentWorkingRepository':{'informationalOnly':True,'differences':repository_diffs,'matchesFixedCandidate':not repository_diffs},
      'failurePhase':report.get('failurePhase'),'error':report.get('error'),'inspection':report.get('inspection'),
      'rawArchive':{'fileCount':len(initial),'bytes':sum(v['bytes'] for v in initial.values()),'sourceBeforeEqualsSourceAfterEqualsCopy':True,'files':initial},
      'limitations':['Independent retry; original 900-second failure remains retained and is not relabeled.','No product performance, fresh acquisition, personal-save, physical touch hardware, independent art or full M1 acceptance is inferred.']}
    (DEST/'archive-proof.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')
    status='PASS' if report['pass'] else 'FAIL / incomplete'
    (DEST/'README.md').write_text(f'''# c4 full flower retry: {status}

This is one independent complete flower attempt on the same fixed c4 candidate and driver. The external command limit alone changed from 900 to 2,400 seconds. The [initial 900-second timeout](../regressions/README.md) remains preserved and is not relabeled. No automatic retry occurred inside this run.

Candidate: `/private/tmp/sansu-authored-cove-c4/candidate`; build `authored-cove-c4`; existing server `http://127.0.0.1:5357`; authored route `water=wide&reference=preflight32&cove=false`. Driver, internal timeouts and assertions match the fixed core input hash. The initial/final 2,137 candidate hashes, core, snapshot, driver raw subset, capture build/cove metadata and full-scope counts are recorded in `archive-proof.json`. Working-repository differences are informational only, because that repository can advance separately from the fixed candidate.

Result: **{status}**. Observed runner exit code: {args.runner_exit_code}. Failure phase: `{report.get('failurePhase')}`. A passing run requires 12 captures, four canvas selections, four passing edits, both mature and young references, no raw errors and sourceClosureUnchanged=true. Partial evidence never substitutes for that full gate.

`raw/` contains byte-identical output, scripts and logs from this independent attempt; the proof verifies source-before/source-after/destination SHA256 and byte sizes. This README, archive proof and archive log are additive. No browser, core or build was run during archiving. Timing diagnostics do not establish product performance acceptance, and this result does not establish fresh acquisition, personal-save migration, physical touch hardware, independent art/understanding, or complete M1 acceptance.
''')
    (DEST/'archive-execution.log.txt').write_text(f'Archive integrity PASS: {len(initial)} files / {sum(v["bytes"] for v in initial.values())} bytes.\nRegression pass: {report["pass"]}.\nFixed candidate all 2137 match: {current==expected}.\nRaw initial subset: {raw_initial_subset}; raw before/after equal: {bool(before) and before==after}.\n')
    assert all(sha(DEST/'raw'/n)==v['sha256'] for n,v in initial.items())
    print(json.dumps({'archiveIntegrityPass':True,'regressionPass':report['pass'],'archive':str(DEST),'rawFiles':len(initial),'proofSha256':sha(DEST/'archive-proof.json')}))
if __name__=='__main__': main()
