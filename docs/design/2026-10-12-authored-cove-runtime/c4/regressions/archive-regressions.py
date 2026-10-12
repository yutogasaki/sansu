#!/usr/bin/env python3
"""Archive completed c4 regression bytes without modifying raw reports."""
import argparse, hashlib, json, shutil, time
from pathlib import Path

P = Path('/private/tmp/sansu-authored-cove-c4')
R = P / 'regressions'
REPO = Path('/Users/yutogasaki/Projects/sansu')
DEST = REPO / 'docs/design/2026-10-12-authored-cove-runtime/c4/regressions'
NAMES = ['01-baseline27-editing','02-wide27-water','03-ordinary-growing-balance','04-classic-smoke','05-authored-flower-full-cove-off']
BUILD = 'authored-cove-c4'
parser = argparse.ArgumentParser()
parser.add_argument('--runner-exit-code', required=True, type=int)
args = parser.parse_args()
assert args.runner_exit_code == 0
log = []
def record(s):
    log.append(s)
    print(s, flush=True)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p): return json.loads(p.read_text())
def write(p, d): p.write_text(json.dumps(d, ensure_ascii=False, indent=2)+'\n')
def input_hashes(root, expected): return {name:sha(root/name) for name in expected}
def inventory(root):
    assert not any(p.is_symlink() for p in root.rglob('*')), 'Unexpected symlink in raw outputs'
    return {str(p.relative_to(root)):{'sha256':sha(p),'bytes':p.stat().st_size} for p in sorted(root.rglob('*')) if p.is_file()}

core = read(P/'core/report.json')
snapshot = read(P/'snapshot.json')
outer = read(R/'report.json')
expected = core['initialInputs']
assert core['pass'] is True and core['sourceFixed'] is True and core['exitCode']==0
assert len(expected)==2137 and expected==core['finalInputs']
assert snapshot['changedDuringCopy']==[]
assert {k:snapshot['files'].get(k) for k in expected}==expected
assert outer['pass'] is True and outer['sourceFixed'] is True and outer['firstFailure'] is None
assert outer['initialSources']==outer['finalSources']==expected
assert outer['finishedAtUnixSeconds'] and [s['name'] for s in outer['stages']]==NAMES
assert outer['coreReportSha256']==sha(P/'core/report.json')
assert outer['snapshotSha256']==sha(P/'snapshot.json')
current_candidate = input_hashes(P/'candidate', expected)
current_repository = input_hashes(REPO, expected)
assert current_candidate==expected
repository_differences = [{'file':k,'core':v,'current':current_repository[k]} for k,v in expected.items() if current_repository[k]!=v]
assert {d['file'] for d in repository_differences}.issubset({'docs/ai/verification_matrix.md'}), 'Unexpected current repository source drift'
record('PASS: all 2137 core initial/final, snapshot, outer initial/final and current candidate inputs agree.')
record('Current repository differences outside fixed candidate: '+json.dumps(repository_differences))

summaries=[]
previous_end=0
for name in NAMES:
    d=R/name
    stage=read(d/'report.json')
    raw=read(d/stage['reportRelative'])
    assert stage['pass'] is True and stage['exitCode']==0 and stage['sourceFixed'] is True and stage['coreInputsMatch'] is True
    assert stage['initialSources']==stage['finalSources']==expected
    assert stage['coreReportSha256']==sha(P/'core/report.json') and stage['snapshotSha256']==sha(P/'snapshot.json')
    assert stage['startedAtUnixSeconds']>=previous_end
    previous_end=stage['finishedAtUnixSeconds']
    assert previous_end>=stage['startedAtUnixSeconds']
    assert raw['pass'] is True and not raw.get('error') and not raw.get('errors')
    assert all(s.get('pass') is True for s in raw.get('scenarios',[]))
    assert all(isinstance(s,str) or s.get('pass') is True for s in raw.get('steps',[]))
    summary={'name':name,'pass':True,'exitCode':0,'rawReport':str((d/stage['reportRelative']).relative_to(R)),
      'rawReportSha256':sha(d/stage['reportRelative']),'stageReportSha256':sha(d/'report.json'),
      'command':stage['command'],'candidateCwd':stage['candidate'],'runnerCommandPid':stage['processId'],
      'environmentOverrides':stage['environmentOverrides'],'commonEnvironment':{'SANSU_BUILD_REVISION':BUILD,'VITE_ISLAND_ENABLED':'true','VITE_NATIVE_GROWING_ART':'false'},
      'startedAtUnixSeconds':stage['startedAtUnixSeconds'],'finishedAtUnixSeconds':stage['finishedAtUnixSeconds'],
      'processGroupCleanup':stage['processGroupCleanup'],'all2137BeforeAfterMatchCore':True,
      'scenarioCount':len(raw.get('scenarios',[])),'stepCount':len(raw.get('steps',[])),'captureCount':len(raw.get('captures',[]))}
    if name=='04-classic-smoke':
        assert len(raw['scenarios'])==32 and raw['harnessHash']==expected['tools/e2e-smoke.mjs']
        assert raw['target']=='http://127.0.0.1:4173'
        execution=(d/'execution.log.txt').read_text()
        assert 'Starting dev server on http://127.0.0.1:4173...' in execution
        assert 'Dev server ready on http://127.0.0.1:4173.' in execution
        assert 'All smoke-test ports are occupied; reusing ' not in execution
        assert stage['environmentOverrides']['VITE_ISLAND_ENABLED']=='false'
        assert stage['environmentOverrides']['VITE_NATIVE_GROWING_ART']=='false'
        summary.update({'rawInputSubset':{'count':1,'pass':True,'scope':'Raw exposes harness hash only; outer runner verifies 2137 full inputs before and after.'},
          'runtimeBuildStatus':'BUILD_VALUE_NOT_OBTAINED','runtimeBuildMatches':None,
          'target':raw['target'],'ownServerStartupEvidence':stage['dedicatedServerEvidence'],
          'identityLimitation':'Raw classic report has no captured screen build value. Evidence is fixed source and harness, startup command/environment, own command PID/candidate cwd/port, and 32 passing scenarios. Command PID is not asserted to be the child Vite PID.'})
    else:
        before=raw.get('initialInputs',raw.get('initialSources'))
        after=raw.get('finalInputs',raw.get('finalSources'))
        assert before and before==after and all(expected.get(k)==v for k,v in before.items())
        captures=raw['captures']
        builds=sorted({c.get('build') or c.get('revision') or '' for c in captures})
        assert captures and builds==[BUILD]
        assert all((d/'actual'/c['file']).is_file() for c in captures)
        summary.update({'rawInputSubset':{'count':len(before),'pass':True,'beforeAfterEqual':True,'missingFromCore':[],'differences':[]},
          'runtimeBuildStatus':'CAPTURE_METADATA_MATCH','runtimeBuilds':builds,'runtimeBuildMatches':True})
    if name=='05-authored-flower-full-cove-off':
        assert raw['shapeOnly'] is False and raw['rayOnly'] is False and raw['sourceClosureUnchanged'] is True and raw['expectedBuild']==BUILD
        assert len(raw['captures'])==12 and len(raw['canvasSelections'])==4 and len(raw['edits'])==4
        assert all(e['pass'] is True for e in raw['edits'])
        assert all(c['metadata']['authoredCoveEnabled']=='false' and c['metadata']['artCandidate']=='native05-authored-flower-garden-v3' and 'cove=false' in c['url'] for c in raw['captures'])
        assert {c['referenceSource']['stage'] for c in raw['captures']}=={'mature','young'}
        summary.update({'shapeOnly':False,'rayOnly':False,'sourceClosureUnchanged':True,'coveDisabledThroughout':True,
            'artCandidate':'native05-authored-flower-garden-v3','referenceStages':['mature','young'],
            'canvasSelectionCount':len(raw['canvasSelections']),'editCount':len(raw['edits']),'selectionCount':len(raw['selections'])})
    summaries.append(summary)
    record(f"PASS: {name}; raw subset {summary['rawInputSubset']['count']}, captures {summary['captureCount']}, scenarios {summary['scenarioCount']}, steps {summary['stepCount']}.")

assert not DEST.exists(), 'Refuse replacing an existing durable archive'
before=inventory(R)
shutil.copytree(R,DEST)
after=inventory(R)
copied=inventory(DEST)
assert before==after==copied
record(f'PASS: copied all {len(before)} raw files ({sum(v["bytes"] for v in before.values())} bytes); source-before/source-after/destination SHA256 and byte lengths all match.')
assert input_hashes(P/'candidate',expected)==expected
repository_after = input_hashes(REPO,expected)
repository_after_differences = [{'file':k,'core':v,'current':repository_after[k]} for k,v in expected.items() if repository_after[k]!=v]
assert {d['file'] for d in repository_after_differences}.issubset({'docs/ai/verification_matrix.md'})
record('PASS: post-archive candidate still matches all 2137 core inputs.')
record('Post-archive current repository differences outside fixed candidate: '+json.dumps(repository_after_differences))
proof={'pass':True,'createdAtUnixSeconds':time.time(),'scope':'Completed c4 five-stage sequential regression evidence; no new browser or test run during archive.',
 'sourceDirectory':str(R),'destinationDirectory':str(DEST),'revision':BUILD,
 'runnerTerminal':{'execSession':71587,'observedExitCode':args.runner_exit_code},
 'runnerScript':{'path':'/private/tmp/sansu-authored-cove-c4-prep/regressions.py','sha256':sha(Path('/private/tmp/sansu-authored-cove-c4-prep/regressions.py'))},
 'core':{'path':str(P/'core/report.json'),'sha256':sha(P/'core/report.json'),'inputCount':2137,'pass':True,'sourceFixed':True},
 'snapshot':{'path':str(P/'snapshot.json'),'sha256':sha(P/'snapshot.json'),'changedDuringCopy':[]},
 'sourceChecks':{'coreBeforeAfter':True,'snapshotSubset':True,'outerBeforeAfter':True,'everyStageBeforeAfter':True,'currentCandidate':True,'currentRepositoryMatches':not repository_differences,'currentRepositoryDifferences':repository_differences,'postArchiveCandidate':True,'postArchiveRepositoryMatches':not repository_after_differences,'postArchiveRepositoryDifferences':repository_after_differences,'inputCount':2137},
 'allFiveRawReportsPass':True,'allFiveExitCodesZero':True,'stagesStrictlySequential':True,'firstFailure':None,
 'stages':summaries,'rawArchive':{'fileCount':len(before),'bytes':sum(v['bytes'] for v in before.values()),'sourceBeforeEqualsSourceAfterEqualsCopy':True,'files':before},
 'limits':['Classic raw does not record a screen build value; fixed-source/harness and owned-server command/environment/PID/cwd/port are supporting provenance only.',
 'Recorded timing and frame markers remain diagnostics; no product performance acceptance.',
 'Authored synthetic fixtures do not establish fresh acquisition, natural growth, personal-save migration, or hardware touch behavior.',
 'Ordinary Growing evidence uses disposable preview profiles and its driver-defined learning flow; explicit late-save fixtures are separate.',
 'No independent art or silent-comprehension acceptance, general cove source applicability, complete M1 or release acceptance is claimed.']}
write(DEST/'archive-proof.json',proof)
rows=[]
for s in summaries:
    detail=f"{s['scenarioCount']} scenarios" if s['scenarioCount'] else f"{s['stepCount']} steps" if s['stepCount'] else f"{s.get('canvasSelectionCount',0)} canvas selections / {s.get('editCount',0)} edits"
    rows.append(f"| {s['name']} | PASS | {detail} | {s['captureCount']} | {s['rawInputSubset']['count']} |")
readme='''# c4 sequential regression archive

All five stages completed once, sequentially, after fixed c4 core and full cove browser completion. The regression runner terminated with exit code 0 (session 71587). No retry or new browser was used for this archive.

| Stage | Result | Raw checks | Reported captures | Raw source subset |
| --- | --- | --- | --- | --- |
'''+ '\n'.join(rows)+'''

All 2,137 fixed-candidate inputs match core before/after, snapshot, runner before/after and each stage before/after, including another candidate hash read after archive. The current working repository has a separately recorded docs/ai/verification_matrix.md contract edit by root for the next work item; its original bytes remain fixed in the c4 candidate. Current repository equality is not claimed. Exact before/after working-repository differences are in the proof; no app differences are permitted. The non-classic raw initial/final inputs equal exact subsets of core; classic exposes one harness hash and relies on the outer runner for full closure. The stage timestamps show no browser-stage overlap. `archive-proof.json` records hashes, per-stage checks, PIDs, environment, and every copied raw file.

Non-classic captures identify `authored-cove-c4` through their actual capture build/revision metadata. Authored routes use the native art path explicitly although the server default is `VITE_NATIVE_GROWING_ART=false`; the server's Island flag is true. The full flower run has cove=false throughout, mature and young references, 12 captures, four canvas selections and four passing edits; its candidate is `native05-authored-flower-garden-v3`.

## Classic identity limitation

Classic used `npm run e2e:smoke` from the fixed candidate cwd, runner command PID 68382, its own server at `http://127.0.0.1:4173`, and `VITE_ISLAND_ENABLED=false`, `VITE_NATIVE_GROWING_ART=false`, `VITE_EXPLORE_EXPERIENCE=classic-v1`, plus runner-wide `SANSU_BUILD_REVISION=authored-cove-c4`. The dedicated startup log, unchanged 2,137 inputs, matching smoke harness SHA and 32 results support provenance. PID 68382 identifies the command process, not a separately observed child Vite PID.

The classic raw report does not record a screen build value. That value remains **not obtained**, so this archive does not claim an actual classic capture build match. Supplemental read-only HTTP responses are retained. The first parser expected an inline build value but observed `__BUILD_REVISION__`; its false result is preserved in `supplemental-build-initial-parser.json`. A subsequent env-module request encountered connection refused after normal classic completion/server cleanup. This supplemental observation did not change the passing regression result. No retry or additional browser was started.

## Evidence scope

All files copied from the temporary regression directory are byte-identical, including reports, captures, command logs, the supplemental parser failure and observation, and this archive script. Archive proof, this README and archive execution log are additive and are not represented as raw tool output. Prior c2/c3 failures remain separate and were not rewritten.

Timing/frame markers in these reports are diagnostics, not product performance acceptance. Authored synthetic fixture coverage does not establish fresh acquisition, natural growth, personal-save migration, touch hardware, independent art/understanding acceptance, general cove profile applicability, complete M1 or release acceptance. Ordinary Growing uses disposable preview profiles and its driver-defined learning journey; late-save fixtures remain explicit fixtures. No source, core, build, or browser rerun occurred during archive.
'''
(DEST/'README.md').write_text(readme)
(DEST/'archive-execution.log.txt').write_text('\n'.join(log)+'\n')
assert all(sha(DEST/name)==entry['sha256'] for name,entry in before.items())
record('Archive complete: '+str(DEST))
print(json.dumps({'pass':True,'archive':str(DEST),'rawFiles':len(before),'rawBytes':sum(v['bytes'] for v in before.values()),'proofSha256':sha(DEST/'archive-proof.json')},ensure_ascii=False))
