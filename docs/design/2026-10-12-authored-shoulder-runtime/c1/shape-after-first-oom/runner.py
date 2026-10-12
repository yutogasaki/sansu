#!/usr/bin/env python3
"""Prepare/run one independent fixed-35 shape diagnosis; --start requires parent authorization."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import time
import traceback
from urllib.parse import parse_qs, urlparse

ROOT = Path('/private/tmp/sansu-authored-shoulder-c1')
REPO = ROOT / 'candidate'
OUTPUT = ROOT / 'shape-after-first-oom'
ACTUAL = OUTPUT / 'actual'
CORE = ROOT / 'core/report.json'
SNAPSHOT = ROOT / 'snapshot.json'
DRIVER = 'tools/e2e-authored-shoulder.mjs'
REVISION = 'authored-shoulder-c1'
DRIVER_SHA = 'c31ad10110bc641e3edffb12de36075ee2eb23885241c807203e8f4bf764f29d'
URL = 'http://127.0.0.1:5358/prototypes/place-qa/authored.html?water=wide&cove=corner&shoulder=central&ground=source'
TIMEOUT = 900
CAPTURES = ['fixed35-desktop-whole-day.png', 'fixed35-desktop-hill-close-day.png']
SCOPE = ('Independent fixed-35 desktop whole/close shape diagnosis after the first full-run Node OOM. '
         'Acquisition and editing are skipped. This cannot replace the failed full journey or establish '
         'art, child acceptance, performance, mobile, acquisition, edit, or whole-M1 acceptance.')
PROOF_FILES = {
    'core': CORE,
    'snapshot': SNAPSHOT,
    'driverInputs': ROOT / 'closure/shoulder-driver-inputs.json',
    'driverInputAudit': ROOT / 'closure/driver-input-audit.json',
    'installedManifest': ROOT / 'closure/installed-dependencies.json',
    'serverIdentity': ROOT / 'server-identity.json',
    'firstRegression': ROOT / 'regressions/report.json',
    'firstFailureLog': ROOT / 'regressions/02-shoulder-full/execution.log.txt',
    'driver': REPO / DRIVER,
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None


def read(path):
    return json.loads(path.read_text())


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def hashes(expected):
    return {name: sha(REPO / name) for name in expected}


def check_contract():
    text = (REPO / DRIVER).read_text()
    assert sha(REPO / DRIVER) == DRIVER_SHA, 'Original immutable driver required'
    required = [
        "const shapeOnly = process.env.SANSU_AUTHORED_SHOULDER_SHAPE_ONLY === '1';",
        'if (!shapeOnly) await acquisition();',
        'await fixedReference();',
        "await loadScope('fixed35', 'shoulder35', false);",
        "await capture('desktop-whole-day', baseline); await select('l34'); await capture('desktop-hill-close-day', baseline);",
        "if (!shapeOnly) {\n        await step('l34-cancel-move-store-restore', () => fixedEdits(baseline));",
    ]
    assert all(part in text for part in required), 'Known shape-only branch changed'
    return {'driverSha256': sha(REPO / DRIVER), 'shapeOnlySkipsAcquisition': True,
            'shapeOnlySkipsEditsRotationPhoneTablet': True,
            'fixedReference': 'shoulder35', 'growthDiagnostic': False, 'expectedCaptures': CAPTURES,
            'sourceLineEvidence': {'shapeFlag': 16, 'fixedReference': [362, 386], 'skipAcquisition': 463},
            'boundary': 'Selection of l34 changes camera focus for the close view; no placement command or acquisition is run.'}


def plan():
    return {'prepared': True, 'executionStarted': False, 'candidate': str(REPO), 'revision': REVISION,
            'command': ['node', DRIVER], 'output': str(OUTPUT), 'actualOutput': str(ACTUAL),
            'core': str(CORE), 'expectedLocalInputCount': 6398, 'expectedInstalledDependencyCount': 6,
            'expectedDriverInputCount': 2127, 'timeoutSeconds': TIMEOUT,
            'deadlineScope': 'Outer child-process termination only; not a performance pass',
            'environmentOverrides': {'SANSU_BUILD_REVISION': REVISION, 'VITE_ISLAND_ENABLED': 'true',
                'VITE_NATIVE_GROWING_ART': 'false', 'SANSU_AUTHORED_SHOULDER_OUTPUT': str(ACTUAL),
                'SANSU_AUTHORED_SHOULDER_URL': URL, 'SANSU_AUTHORED_SHOULDER_BUILD': REVISION,
                'SANSU_AUTHORED_SHOULDER_CORE_REPORT': str(CORE), 'SANSU_AUTHORED_SHOULDER_SHAPE_ONLY': '1',
                'SANSU_AUTHORED_SHOULDER_TIMEOUT_MS': '180000'},
            'diagnosticOnly': True, 'fullJourneyAccepted': False, 'scope': SCOPE,
            'requiresParentStart': True, 'contract': check_contract()}


def verify_frozen_metadata(core, snapshot, expected, installed, driver_inputs):
    assert core['pass'] is True and core['exitCode'] == 0 and core['sourceFixed'] is True
    assert core['revision'] == REVISION and Path(core['target']).resolve() == REPO.resolve()
    assert len(expected) == 6398 and expected == core['finalInputs']
    assert len(installed) == 6 and installed == core['finalInstalledDependencies']
    assert core['installedDependenciesFixed'] is True
    assert sha(SNAPSHOT) == core['snapshotSha256']
    assert snapshot['dest'] == str(REPO) and snapshot['changedDuringCopy'] == []
    assert snapshot['closureDifferences'] == []
    assert all(snapshot['files'].get(name) == value for name, value in expected.items())
    assert expected[DRIVER] == DRIVER_SHA
    audit = read(PROOF_FILES['driverInputAudit'])
    assert sha(PROOF_FILES['driverInputAudit']) == core['driverInputAuditSha256']
    assert audit['pass'] is True and audit['driverSha256'] == DRIVER_SHA and audit['inputCount'] == 2127
    assert len(driver_inputs) == 2127 and all(expected.get(name) == value for name, value in driver_inputs.items())
    assert sha(PROOF_FILES['installedManifest']) == core['installedDependenciesManifestSha256']
    assert read(PROOF_FILES['installedManifest']) == installed
    assert snapshot['installedDependenciesManifestSha256'] == core['installedDependenciesManifestSha256']
    previous = read(PROOF_FILES['firstRegression'])
    assert previous['pass'] is False and previous['firstFailure']['name'] == '02-shoulder-full'
    assert previous['sourceFixed'] is True and previous['installedDependenciesFixed'] is True


def check_server():
    identity = read(PROOF_FILES['serverIdentity'])
    assert identity['revision'] == REVISION and identity['port'] == 5358
    assert Path(identity['cwd']).resolve() == REPO.resolve()
    pid = int(identity['pid'])
    command = subprocess.check_output(['ps', '-p', str(pid), '-o', 'command='], text=True).strip()
    cwd = subprocess.check_output(['lsof', '-a', '-p', str(pid), '-d', 'cwd', '-Fn'], text=True)
    assert '--port 5358' in command and 'vite' in command and '--strictPort' in command
    assert f'n{REPO}\n' in cwd, 'Root server must still serve exact frozen candidate'
    return {'pid': pid, 'command': command, 'cwdObservation': cwd, 'action': 'read-only identity check; server is root-owned and retained'}


def clean_group(pid):
    try:
        os.killpg(pid, signal.SIGTERM)
    except ProcessLookupError:
        return 'runner-owned process group already exited'
    until = time.monotonic() + 5
    while time.monotonic() < until:
        try:
            os.killpg(pid, 0)
        except ProcessLookupError:
            return 'runner-owned process group exited after SIGTERM'
        time.sleep(.1)
    try:
        os.killpg(pid, signal.SIGKILL)
        return 'SIGKILL sent only to remaining runner-owned process group after 5 seconds'
    except ProcessLookupError:
        return 'runner-owned process group exited after SIGTERM'


def inspect_actual(actual, expected, installed, driver_inputs):
    captures = actual.get('captures', [])
    scopes = actual.get('scopes', {})
    fixed = scopes.get('fixed35', {})
    steps = actual.get('steps', [])
    errors = actual.get('errors', [])
    core_proof = actual.get('core', {})
    checks = {
        'driverPassed': actual.get('pass') is True,
        'shapeOnly': actual.get('shapeOnly') is True,
        'build': actual.get('expectedBuild') == REVISION,
        'exactTarget': actual.get('target') == URL,
        'noRuntimeErrorsOrFirstFailure': not errors and not actual.get('firstFailure'),
        'onlyFixed35Scope': set(scopes) == {'fixed35'},
        'fixedReference': fixed.get('reference') == 'shoulder35' and fixed.get('grow') is False,
        'fixed35Passed': fixed.get('pass') is True,
        'noEditsOrHistory': 'edits' not in fixed and 'history' not in fixed and not actual.get('pointers'),
        'expectedOnlySteps': steps == ['setup:compile-read-only-domain-projection', 'fixed35:load', 'fixed35:desktop-whole-and-close'],
        'exactTwoCaptures': [c.get('file') for c in captures] == CAPTURES,
        'captureScopeBuildViewport': len(captures) == 2 and all(c.get('scope') == 'fixed35' and c.get('build') == REVISION
            and c.get('viewport') == {'width': 1280, 'height': 900} for c in captures),
        'sameRuntimeAppVersion': len({c.get('appVersion') for c in captures}) == 1 and bool(captures)
            and all(str(c.get('appVersion', '')).startswith(REVISION + ':') for c in captures),
        'sourceClosureUnchanged': actual.get('sourceClosureUnchanged') is True,
        'exact2127ActualDriverInputs': actual.get('initialInputs') == driver_inputs == actual.get('finalInputs'),
        'actualDriverInputsCoreSubset': bool(actual.get('initialInputs')) and all(expected.get(name) == value
            for name, value in actual.get('initialInputs', {}).items()),
        'exactSixInstalledDependencies': actual.get('installedDependenciesUnchanged') is True
            and actual.get('initialInstalledDependencies') == installed == actual.get('finalInstalledDependencies'),
        'actualCoreProof': core_proof.get('sha256') == sha(CORE) and core_proof.get('path') == str(CORE)
            and core_proof.get('revision') == REVISION and core_proof.get('target') == str(REPO)
            and core_proof.get('inputSubsetCount') == 2127 and core_proof.get('sameFrozenInputs') is True,
        'successfulResourceResponses': bool(actual.get('resourceResponses')) and all(r.get('status') == 200 for r in actual.get('resourceResponses', [])),
    }
    files = []
    for capture in captures:
        filename = capture.get('file', '')
        path = ACTUAL / filename
        safe = filename in CAPTURES and path.parent == ACTUAL
        files.append({'file': filename, 'safeExpectedPath': safe, 'exists': safe and path.is_file(),
                      'sha256': sha(path) if safe else None, 'reportedSha256': capture.get('sha256')})
        target = urlparse(capture.get('url', ''))
        query = parse_qs(target.query)
        checks[f'url:{filename}'] = target.netloc == '127.0.0.1:5358' and target.path == '/prototypes/place-qa/authored.html' and all(
            query.get(k) == [v] for k, v in {'water':'wide','cove':'corner','shoulder':'central','ground':'source','reference':'shoulder35'}.items()) and 'grow' not in query
        checks[f'posesAndAccess:{filename}'] = capture.get('poses', {}).get('checked', 0) > 0 and capture.get('poses', {}).get('unplaced') == 0 and len(capture.get('physical', {}).get('ownerAccess', [])) == 35 and all(o.get('reachable') is True for o in capture.get('physical', {}).get('ownerAccess', []))
        checks[f'actualFlags:{filename}'] = all(capture.get('metadata', {}).get(k) == 'true' for k in ['nativeGrowingArt','authoredShoulderEnabled','authoredCoveEnabled']) and capture.get('host', {}).get('groundShading') == 'source'
    checks['captureFilesAndHashes'] = len(files) == 2 and all(f['exists'] and f['sha256'] == f['reportedSha256'] for f in files)
    return {'pass': all(checks.values()), 'checks': checks, 'failedChecks': [name for name, value in checks.items() if not value],
            'captureFiles': files, 'actualFirstFailure': actual.get('firstFailure'), 'errors': errors,
            'diagnosticOnly': True, 'fullJourneyAccepted': False}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--start', action='store_true', help='Run once only after explicit parent authorization')
    args = parser.parse_args()
    prepared = plan()
    if not args.start:
        print(json.dumps(prepared, ensure_ascii=False, indent=2))
        return 0
    assert not OUTPUT.exists(), 'First-failure evidence must not be overwritten; fresh output required'
    OUTPUT.mkdir()
    report = {**prepared, 'executionStarted': True, 'startedAtUnixSeconds': time.time(), 'runnerSha256': sha(Path(__file__)),
              'pass': False, 'exitCode': None, 'firstFailure': None, 'executionLog': 'execution.log.txt',
              'initialFrozenEvidence': {name: sha(path) for name, path in PROOF_FILES.items()}}
    process = None
    core = read(CORE)
    expected, installed = core['initialInputs'], core['initialInstalledDependencies']
    report['initialSources'] = hashes(expected)
    report['initialInstalledDependencies'] = hashes(installed)
    write(OUTPUT / 'report.json', report)
    try:
        verify_frozen_metadata(core, read(SNAPSHOT), expected, installed, read(PROOF_FILES['driverInputs']))
        assert report['initialSources'] == expected, 'Current candidate differs from core inputs'
        assert report['initialInstalledDependencies'] == installed, 'Installed dependencies differ from core'
        report['initialDriverInputs'] = hashes(read(PROOF_FILES['driverInputs']))
        assert report['initialDriverInputs'] == read(PROOF_FILES['driverInputs'])
        report['serverIdentityObserved'] = check_server()
        env = os.environ.copy()
        removed = [k for k in env if k.startswith(('SANSU_FLOOR_SHADING_', 'SANSU_E2E_', 'SANSU_AUTHORED_', 'SANSU_GROWING_', 'SANSU_VISUAL_AUDIT_'))]
        for key in removed: env.pop(key, None)
        report['removedInheritedTaskEnvironmentNames'] = sorted(removed)
        report['inheritedNodeOptions'] = env.get('NODE_OPTIONS')
        assert not env.get('NODE_OPTIONS'), 'Do not inherit a memory-diagnostic heap override for this original-driver shape run'
        env.update(prepared['environmentOverrides'])
        with (OUTPUT / 'execution.log.txt').open('x') as log:
            process = subprocess.Popen(prepared['command'], cwd=REPO, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
            report['processId'] = process.pid
            write(OUTPUT / 'report.json', report)
            try:
                report['exitCode'] = process.wait(timeout=TIMEOUT)
            except subprocess.TimeoutExpired:
                report['timeout'] = True
                report['processGroupTimeoutCleanup'] = clean_group(process.pid)
                process.wait(timeout=10)
                report['exitCode'] = process.returncode
                raise RuntimeError('Outer 900-second command deadline exceeded; not a performance finding')
        raw = ACTUAL / 'report.json'
        if not raw.is_file(): raise RuntimeError('missing-tool-report: original driver did not create actual/report.json')
        report['actualReportSha256'] = sha(raw)
        report['inspection'] = inspect_actual(read(raw), expected, installed, read(PROOF_FILES['driverInputs']))
        assert report['exitCode'] == 0 and report['inspection']['pass'], 'Driver or shape-only diagnostic contract failed'
        report['pass'] = True
    except Exception as error:
        report['firstFailure'] = {'error': str(error), 'traceback': traceback.format_exc(), 'diagnosticOnly': True}
    finally:
        if process:
            report['processGroupCleanup'] = clean_group(process.pid)
        report['finalSources'] = hashes(expected)
        report['finalInstalledDependencies'] = hashes(installed)
        report['sourceFixed'] = report['initialSources'] == expected == report['finalSources']
        report['installedDependenciesFixed'] = report['initialInstalledDependencies'] == installed == report['finalInstalledDependencies']
        report['finalFrozenEvidence'] = {name: sha(path) for name, path in PROOF_FILES.items()}
        report['frozenEvidenceFixed'] = report['initialFrozenEvidence'] == report['finalFrozenEvidence']
        report['pass'] = report['pass'] and report['sourceFixed'] and report['installedDependenciesFixed'] and report['frozenEvidenceFixed']
        if not report['pass'] and report['firstFailure'] is None:
            report['firstFailure'] = {'error': 'Frozen source, dependency, or evidence hash changed'}
        progress = ACTUAL / 'progress.json'
        report['lastToolProgress'] = read(progress) if progress.is_file() else None
        log = OUTPUT / 'execution.log.txt'
        report['executionLogSha256'] = sha(log)
        report['finishedAtUnixSeconds'] = time.time()
        write(OUTPUT / 'report.json', report)
    print(json.dumps({key: report.get(key) for key in ['pass','diagnosticOnly','fullJourneyAccepted','exitCode','sourceFixed','installedDependenciesFixed','firstFailure']}, ensure_ascii=False))
    return 0 if report['pass'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
