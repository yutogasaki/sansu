#!/usr/bin/env python3
"""One independent full flower run; --start only after explicit render-ended authorization."""
import argparse, hashlib, json, os, signal, subprocess, sys, time
from pathlib import Path
ROOT=Path('/private/tmp/sansu-authored-cove-c4')
OUT=ROOT/'flower-full-retry-2400'
CANDIDATE=ROOT/'candidate'
CORE=ROOT/'core/report.json'
SNAPSHOT=ROOT/'snapshot.json'
FIRST=ROOT/'regressions/05-authored-flower-full-cove-off/report.json'
BUILD='authored-cove-c4'
LIMIT=2400
COMMAND=['node','tools/e2e-authored-flower.mjs']
ENV={'SANSU_BUILD_REVISION':BUILD,'VITE_ISLAND_ENABLED':'true','VITE_NATIVE_GROWING_ART':'false',
     'SANSU_AUTHORED_FLOWER_URL':'http://127.0.0.1:5357/prototypes/place-qa/authored.html?water=wide&reference=preflight32&cove=false',
     'SANSU_AUTHORED_FLOWER_OUTPUT':str(OUT/'actual'),'SANSU_AUTHORED_FLOWER_BUILD':BUILD,
     'SANSU_AUTHORED_FLOWER_SHAPE_ONLY':'0','SANSU_AUTHORED_FLOWER_RAY_ONLY':'0'}
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None
def read(p): return json.loads(p.read_text())
def write(p,data): p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
def inputs(expected): return {n:sha(CANDIDATE/n) for n in expected}
def differences(expected,actual): return [{'file':n,'core':v,'actual':actual.get(n)} for n,v in expected.items() if actual.get(n)!=v]
def cleanup(pid):
    try: os.killpg(pid,signal.SIGTERM); return 'SIGTERM sent to this runner-owned process group'
    except ProcessLookupError: return 'runner-owned process group already exited'
def inspect(raw,expected):
    before=raw.get('initialInputs',{}); after=raw.get('finalInputs')
    caps=raw.get('captures',[]); edits=raw.get('edits',[]); selections=raw.get('canvasSelections',[])
    before_diffs=differences({n:expected.get(n) for n in before},before)
    build_values=sorted({c.get('build') or c.get('revision') or '' for c in caps})
    checks={
      'rawPass':raw.get('pass') is True,
      'noRawErrors':not raw.get('error') and not raw.get('errors'),
      'fullScope':raw.get('shapeOnly') is False and raw.get('rayOnly') is False,
      'expectedBuild':raw.get('expectedBuild')==BUILD,
      'sourceClosureUnchanged':raw.get('sourceClosureUnchanged') is True,
      'rawInitialSubsetMatches':bool(before) and all(n in expected and expected[n]==v for n,v in before.items()),
      'rawBeforeAfterEqual':bool(before) and before==after,
      'twelveCaptures':len(caps)==12,
      'fourCanvasSelections':len(selections)==4 and all(s.get('pass') is True for s in selections),
      'fourEdits':len(edits)==4 and all(e.get('pass') is True for e in edits) and {e.get('action') for e in edits}=={'cancel','move-split','store','restore-reconnect'},
      'allCaptureBuildsMatch':bool(caps) and build_values==[BUILD],
      'coveDisabledThroughout':bool(caps) and all(c.get('metadata',{}).get('authoredCoveEnabled')=='false' and 'cove=false' in c.get('url','') for c in caps),
      'flowerCandidateThroughout':bool(caps) and all(c.get('metadata',{}).get('artCandidate')=='native05-authored-flower-garden-v3' for c in caps),
      'matureAndYoung':{c.get('referenceSource',{}).get('stage') for c in caps}=={'mature','young'},
      'captureFilesExist':bool(caps) and all((OUT/'actual'/c.get('file','')).is_file() for c in caps),
    }
    return {'pass':all(checks.values()),'checks':checks,'failedChecks':[k for k,v in checks.items() if not v],
      'rawError':raw.get('error'),'captureCount':len(caps),'canvasSelectionCount':len(selections),'editCount':len(edits),
      'runtimeBuilds':build_values,'rawInputCount':len(before),'finalInputsPresent':after is not None,
      'rawInitialDifferences':before_diffs,'rawInputsMissingFromCore':sorted(set(before)-set(expected)),
      'referenceStages':sorted({c.get('referenceSource',{}).get('stage','unknown') for c in caps})}
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--start',action='store_true');args=parser.parse_args()
    if not args.start:
        print(json.dumps({'prepared':True,'executionStarted':False,'candidate':str(CANDIDATE),'output':str(OUT),'command':COMMAND,
          'timeoutSeconds':LIMIT,'revision':BUILD,'environment':ENV,'priorAttempt':str(FIRST),
          'authorizationRequired':'Parent message explicitly stating render ended and retry may start.'},ensure_ascii=False,indent=2));return 0
    assert not (OUT/'actual').exists() and not (OUT/'report.json').exists(), 'Refuse to overwrite prior execution'
    with (OUT/'execution-started.json').open('x') as f: json.dump({'startedAtUnixSeconds':time.time(),'runnerPid':os.getpid()},f)
    report={'pass':False,'candidate':str(CANDIDATE),'revision':BUILD,'command':COMMAND,'timeoutSeconds':LIMIT,'environmentOverrides':ENV,
      'startedAtUnixSeconds':time.time(),'runnerPid':os.getpid(),'runnerScriptSha256':sha(Path(__file__)),
      'coreReport':str(CORE),'coreReportSha256':sha(CORE),'snapshot':str(SNAPSHOT),'snapshotSha256':sha(SNAPSHOT),
      'priorAttempt':{'report':str(FIRST),'sha256':sha(FIRST),'durable':'../regressions/05-authored-flower-full-cove-off/report.json','result':'outer-command-timeout at 900 seconds'},
      'scope':'Independent complete flower attempt on the same fixed c4 candidate/driver; only external command deadline increases from 900 to 2400 seconds. No automatic retry.',
      'exitCode':None,'failurePhase':None,'error':None}
    expected={}; process=None
    try:
        core=read(CORE);snap=read(SNAPSHOT);first=read(FIRST);expected=core['initialInputs']
        assert core.get('pass') is True and core.get('sourceFixed') is True and core.get('exitCode')==0
        assert core['target']==str(CANDIDATE) and core['revision']==BUILD
        assert len(expected)==2137 and expected==core['finalInputs']
        assert snap['dest']==str(CANDIDATE) and snap['changedDuringCopy']==[]
        assert all(snap['files'].get(n)==v for n,v in expected.items())
        assert first['failurePhase']=='outer-command-timeout' and first['timeoutSeconds']==900 and first['pass'] is False
        assert first['initialSources']==first['finalSources']==expected
        assert first['command']==COMMAND and all(first['environmentOverrides'][k]==v for k,v in ENV.items() if k.startswith('SANSU_AUTHORED_FLOWER_') and k!='SANSU_AUTHORED_FLOWER_OUTPUT')
        report['coreInputCount']=len(expected);report['initialSources']=inputs(expected)
        report['initialSourceDifferences']=differences(expected,report['initialSources'])
        report['driverSha256']=sha(CANDIDATE/'tools/e2e-authored-flower.mjs')
        assert report['initialSources']==expected and report['driverSha256']==expected['tools/e2e-authored-flower.mjs']
        env=os.environ.copy()
        removed=[k for k in env if k.startswith(('SANSU_E2E_','SANSU_AUTHORED_','SANSU_GROWING_','SANSU_VISUAL_AUDIT_')) or k in {'SANSU_RAPID_LOOP_BENCHMARK_RUNS','SANSU_WRITE_VISUAL_AUDIT'}]
        for k in removed: env.pop(k,None)
        env.update(ENV);report['removedInheritedTaskEnvironmentNames']=sorted(removed)
        write(OUT/'report.json',report)
        with (OUT/'execution.log.txt').open('x') as log:
            process=subprocess.Popen(COMMAND,cwd=CANDIDATE,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
            report['processId']=process.pid;write(OUT/'report.json',report)
            print(json.dumps({'started':True,'processId':process.pid,'timeoutSeconds':LIMIT,'candidate':str(CANDIDATE)}),flush=True)
            try: report['exitCode']=process.wait(timeout=LIMIT)
            except subprocess.TimeoutExpired:
                report['timeout']=True;report['failurePhase']='outer-command-timeout';report['timeoutCleanup']=cleanup(process.pid)
                try: process.wait(timeout=10)
                except subprocess.TimeoutExpired: os.killpg(process.pid,signal.SIGKILL);process.wait()
                report['exitCode']=process.returncode
        raw_path=OUT/'actual/report.json'
        if raw_path.is_file():
            raw=read(raw_path);report['rawReportSha256']=sha(raw_path);report['inspection']=inspect(raw,expected)
            if not report.get('timeout') and not report['inspection']['pass']:
                report['failurePhase']='raw-full-flower-verification';report['error']=raw.get('error') or ', '.join(report['inspection']['failedChecks'])
            report['pass']=not report.get('timeout') and report['exitCode']==0 and report['inspection']['pass']
        else: report['failurePhase']=report['failurePhase'] or 'missing-raw-report'
        if report['exitCode']!=0: report['failurePhase']=report['failurePhase'] or 'command-exit'
    except Exception as error:
        report['failurePhase']=report.get('failurePhase') or 'preflight-or-runner-error';report['error']=repr(error)
    finally:
        if process: report['processGroupCleanup']=cleanup(process.pid)
        if expected:
            report['finalSources']=inputs(expected);report['sourceFixed']=report.get('initialSources')==expected==report['finalSources']
            report['finalSourceDifferences']=differences(expected,report['finalSources'])
            if not report['sourceFixed']:
                report['pass']=False;report['priorFailurePhase']=report.get('failurePhase');report['failurePhase']='fixed-source-mismatch'
        report['finishedAtUnixSeconds']=time.time();write(OUT/'report.json',report)
    print(json.dumps({k:report.get(k) for k in ['pass','exitCode','failurePhase','error','sourceFixed','inspection']},ensure_ascii=False),flush=True)
    return 0 if report['pass'] else 1
if __name__=='__main__': sys.exit(main())
