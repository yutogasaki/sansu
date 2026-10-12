#!/usr/bin/env python3
"""Sequential fixed-source regression evidence. No execution without --start."""
import argparse
import hashlib
import json
import os
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path('/private/tmp/sansu-authored-cove-c4')
REPO = ROOT / 'candidate'
CORE = ROOT / 'core/report.json'
SNAPSHOT = ROOT / 'snapshot.json'
OUTPUT = ROOT / 'regressions'
REVISION = 'authored-cove-c4'
BASE = 'http://127.0.0.1:5357'


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def sha(path):
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except FileNotFoundError:
        return None


def sources(expected):
    return {name: sha(REPO / name) for name in expected}


def differences(expected, actual):
    return [{'file': name, 'core': value, 'actual': actual.get(name)}
            for name, value in expected.items() if actual.get(name) != value]


def read_json(path):
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text())
    except (ValueError, OSError) as error:
        return {'readError': str(error)}


def occupied_ports():
    result = []
    for port in [4173, 4174, 4175]:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as connection:
            connection.settimeout(0.2)
            if connection.connect_ex(('127.0.0.1', port)) == 0:
                result.append(port)
    return result


def plan():
    return [
        {
            'name': '01-baseline27-editing',
            'command': ['node', 'tools/e2e-authored-island-editing.mjs'],
            'environmentOverrides': {
                'SANSU_AUTHORED_EDIT_URL': BASE + '/prototypes/place-qa/authored.html',
                'SANSU_AUTHORED_EDIT_OUTPUT': str(OUTPUT / '01-baseline27-editing' / 'actual'),
                'SANSU_AUTHORED_EDIT_HEADED': '0',
            },
            'scope': 'DEV authored baseline 27-owner synthetic fixture; real desktop pointer editing plus phone/tablet views. No player save, natural acquisition or art acceptance.',
            'requiredServerConfiguration': {'url': BASE, 'revision': REVISION, 'VITE_ISLAND_ENABLED': 'true', 'VITE_NATIVE_GROWING_ART': 'false'},
            'reportRelative': 'actual/report.json', 'timeoutSeconds': 600,
        },
        {
            'name': '02-wide27-water',
            'command': ['node', 'tools/e2e-authored-water.mjs'],
            'environmentOverrides': {
                'SANSU_AUTHORED_WATER_URL': BASE + '/prototypes/place-qa/authored.html?water=wide',
                'SANSU_AUTHORED_WATER_OUTPUT': str(OUTPUT / '02-wide27-water' / 'actual'),
            },
            'scope': 'DEV authored wide-water 27-owner/73-right synthetic fixture; real desktop pointer water edits plus phone/tablet views. No player save, natural acquisition, touch hardware or art acceptance.',
            'requiredServerConfiguration': {'url': BASE, 'revision': REVISION, 'VITE_ISLAND_ENABLED': 'true', 'VITE_NATIVE_GROWING_ART': 'false'},
            'reportRelative': 'actual/report.json', 'timeoutSeconds': 600,
        },
        {
            'name': '03-ordinary-growing-balance',
            'command': ['node', 'tools/e2e-growing-balance.mjs'],
            'environmentOverrides': {
                'SANSU_GROWING_URL': BASE,
                'SANSU_GROWING_OUTPUT': str(OUTPUT / '03-ordinary-growing-balance' / 'actual'),
            },
            'scope': 'Ordinary Growing Island on DEV island-enabled server; disposable SansuGrowingIslandPreviewV1 profiles, real learning UI, separate explicit late-save fixtures; 390x844 touch and 768x1024 reduced-motion touch.',
            'requiredServerConfiguration': {'url': BASE, 'revision': REVISION, 'VITE_ISLAND_ENABLED': 'true', 'VITE_NATIVE_GROWING_ART': 'false'},
            'reportRelative': 'actual/report.json', 'timeoutSeconds': 900,
        },
        {
            'name': '04-classic-smoke',
            'command': ['npm', 'run', 'e2e:smoke'],
            'environmentOverrides': {
                'VITE_ISLAND_ENABLED': 'false',
                'VITE_NATIVE_GROWING_ART': 'false',
                'VITE_EXPLORE_EXPERIENCE': 'classic-v1',
                'SANSU_E2E_DIAGNOSTIC_DIR': str(OUTPUT / '04-classic-smoke' / 'diagnostics'),
                'SANSU_E2E_CAPTURE_DIR': str(OUTPUT / '04-classic-smoke' / 'captures'),
            },
            'scope': 'Full classic npm e2e:smoke suite, own isolated dev server on an available port among 4173/4174/4175, VITE_ISLAND_ENABLED=false and VITE_NATIVE_GROWING_ART=false. Disposable browser contexts only; excludes new authored/world island acceptance.',
            'requiredServerConfiguration': {'ownServer': True, 'portCandidates': [4173, 4174, 4175], 'VITE_ISLAND_ENABLED': 'false', 'VITE_NATIVE_GROWING_ART': 'false'},
            'reportRelative': 'diagnostics/smoke-report.json', 'timeoutSeconds': 2700,
        },
        {
            'name': '05-authored-flower-full-cove-off',
            'command': ['node', 'tools/e2e-authored-flower.mjs'],
            'environmentOverrides': {
                'SANSU_AUTHORED_FLOWER_URL': BASE + '/prototypes/place-qa/authored.html?water=wide&reference=preflight32&cove=false',
                'SANSU_AUTHORED_FLOWER_OUTPUT': str(OUTPUT / '05-authored-flower-full-cove-off' / 'actual'),
                'SANSU_AUTHORED_FLOWER_BUILD': REVISION,
                'SANSU_AUTHORED_FLOWER_SHAPE_ONLY': '0',
                'SANSU_AUTHORED_FLOWER_RAY_ONLY': '0',
            },
            'scope': 'Full existing authored-flower driver, cove disabled: archived synthetic 32-owner/8-home mature and young references, all owner selections/canvas taps, pointer cancel/split/store/reconnect, desktop/phone/tablet views. No fresh acquisition, personal save, performance or independent art acceptance.',
            'requiredServerConfiguration': {'url': BASE, 'revision': REVISION, 'VITE_ISLAND_ENABLED': 'true', 'VITE_NATIVE_GROWING_ART': 'false', 'coveQuery': 'false'},
            'reportRelative': 'actual/report.json', 'timeoutSeconds': 900,
        },
    ]


def clean_group(pid):
    """Only descendants of this freshly spawned, isolated process group."""
    try:
        os.killpg(pid, signal.SIGTERM)
        return 'SIGTERM sent to this runner-owned process group'
    except ProcessLookupError:
        return 'runner-owned process group already exited'


def inspect_result(item, actual, log, expected):
    if actual is None:
        return {'pass': False, 'failurePhase': 'missing-tool-report', 'error': 'Tool report was not created'}
    if 'readError' in actual:
        return {'pass': False, 'failurePhase': 'unreadable-tool-report', 'error': actual['readError']}
    scenarios = actual.get('scenarios', [])
    failures = [scenario for scenario in scenarios if scenario.get('pass') is False]
    first = failures[0] if failures else None
    error = actual.get('error') or (first or {}).get('error')
    if item['name'] == '04-classic-smoke' and 'All smoke-test ports are occupied; reusing ' in log:
        return {'pass': False, 'failurePhase': 'classic-server-isolation', 'error': 'Smoke harness reused a preexisting server'}
    result = {
        'pass': actual.get('pass') is True and not failures and not error and not actual.get('errors'),
        'failurePhase': actual.get('phase') or (first or {}).get('name'),
        'error': error,
        'scenarioCount': len(scenarios),
        'stepCount': len(actual.get('steps', [])),
        'failedSteps': [step for step in actual.get('steps', []) if isinstance(step, dict) and step.get('pass') is False],
        'runtimeErrors': actual.get('errors', []),
        'failedScenarios': [{'name': scenario.get('name'), 'error': scenario.get('error')} for scenario in failures],
        'stepsPassed': sum((isinstance(step, dict) and step.get('pass') is True)
                           or (isinstance(step, str) and actual.get('pass') is True)
                           for step in actual.get('steps', [])),
        'captureCount': len(actual.get('captures', [])),
        'target': actual.get('target'),
        'lastCompletedScenario': scenarios[-1].get('name') if scenarios else None,
        'lastCapture': ({key: actual['captures'][-1].get(key) for key in ['file', 'viewport', 'url', 'build']}
                        if actual.get('captures') and isinstance(actual['captures'][-1], dict) else None),
    }
    if result['failedSteps']:
        result['pass'] = False
        result['failurePhase'] = 'failed-tool-step'
    if item['name'] in {'01-baseline27-editing', '02-wide27-water', '03-ordinary-growing-balance', '05-authored-flower-full-cove-off'}:
        captures = actual.get('captures', [])
        result['runtimeBuilds'] = sorted({capture.get('build') or capture.get('revision') or '' for capture in captures})
        result['runtimeBuildMatches'] = bool(captures) and result['runtimeBuilds'] == [REVISION]
        if not result['runtimeBuildMatches']:
            result['pass'] = False
            result['failurePhase'] = result['failurePhase'] or 'runtime-build-identity'
            result['error'] = result['error'] or 'Runtime captures do not all identify the fixed candidate build'
    # Tool evidence is a subset of the fixed core closure, not an independent
    # source lineage. Preserve missing entries and first/final differences.
    if item['name'] == '04-classic-smoke':
        harness_name = 'tools/e2e-smoke.mjs'
        subset = {'scope': 'Classic raw report exposes only its harness hash; outer runner covers the complete core closure',
                  'count': 1, 'beforeAfterEqual': None,
                  'pass': bool(expected.get(harness_name)) and actual.get('harnessHash') == expected[harness_name]}
    else:
        before = actual.get('initialInputs', actual.get('initialSources'))
        after = actual.get('finalInputs', actual.get('finalSources'))
        missing = sorted(set(before or {}) - set(expected))
        mismatch = [{'file': name, 'core': expected.get(name), 'toolBefore': value,
                     'toolAfter': (after or {}).get(name)} for name, value in (before or {}).items()
                    if value != expected.get(name) or (after or {}).get(name) != value]
        subset = {'scope': 'Raw tool initial/final source hashes must equal a subset of core initial/final inputs',
                  'count': len(before or {}), 'beforeAfterEqual': bool(before) and before == after,
                  'missingFromCore': missing, 'differences': mismatch,
                  'pass': bool(before) and before == after and not missing and not mismatch}
    result['rawInputSubset'] = subset
    if not subset['pass']:
        result['pass'] = False
        result['failurePhase'] = result['failurePhase'] or 'raw-input-subset'
        result['error'] = result['error'] or 'Raw tool hashes are absent or differ from the frozen core closure'
    if item['name'] == '05-authored-flower-full-cove-off':
        captures = actual.get('captures', [])
        result['fullFlowerScope'] = (actual.get('shapeOnly') is False and actual.get('rayOnly') is False
                                     and actual.get('expectedBuild') == REVISION
                                     and actual.get('sourceClosureUnchanged') is True)
        result['coveDisabledThroughout'] = bool(captures) and all(
            capture.get('metadata', {}).get('authoredCoveEnabled') == 'false'
            and capture.get('metadata', {}).get('artCandidate') == 'native05-authored-flower-garden-v3'
            and 'cove=false' in capture.get('url', '') for capture in captures)
        result['matureAndYoung'] = {capture.get('referenceSource', {}).get('stage') for capture in captures} == {'mature', 'young'}
        if not all(result[key] for key in ['fullFlowerScope', 'coveDisabledThroughout', 'matureAndYoung']):
            result['pass'] = False
            result['failurePhase'] = result['failurePhase'] or 'flower-full-cove-off-scope'
            result['error'] = result['error'] or 'Flower evidence must include the full mature/young cove-disabled driver'
    if result['pass']:
        result['failurePhase'] = None
    return result


def run_stage(item, expected):
    directory = OUTPUT / item['name']
    directory.mkdir(exist_ok=False)
    report = {**item, 'startedAtUnixSeconds': time.time(), 'initialSources': sources(expected),
              'coreReport': str(CORE), 'coreReportSha256': sha(CORE), 'coreInputCount': len(expected),
              'snapshot': str(SNAPSHOT), 'snapshotSha256': sha(SNAPSHOT), 'candidate': str(REPO), 'revision': REVISION,
              'pass': False, 'exitCode': None, 'executionLog': 'execution.log.txt'}
    report['coreInputsMatch'] = report['initialSources'] == expected
    report['initialSourceDifferences'] = differences(expected, report['initialSources'])
    write_json(directory / 'report.json', report)
    process = None
    try:
        if not report['coreInputsMatch']:
            report['failurePhase'] = 'core-inputs-before-command'
            report['error'] = 'Frozen core input bytes changed; command was not started'
            return report
        env = os.environ.copy()
        # Full regression scope must never inherit a narrowing selector or a
        # previous task's evidence directory. Only explicit overrides survive.
        removed = [key for key in env if key.startswith('SANSU_E2E_') or key.startswith('SANSU_AUTHORED_')
                   or key.startswith('SANSU_GROWING_') or key.startswith('SANSU_VISUAL_AUDIT_') or key in {'SANSU_RAPID_LOOP_BENCHMARK_RUNS', 'SANSU_WRITE_VISUAL_AUDIT'}]
        for key in removed:
            env.pop(key, None)
        report['removedInheritedTaskEnvironmentNames'] = sorted(removed)
        env.update({'SANSU_BUILD_REVISION': REVISION, 'VITE_ISLAND_ENABLED': 'true', 'VITE_NATIVE_GROWING_ART': 'false'})
        env.update(item['environmentOverrides'])
        if item['name'] == '04-classic-smoke':
            ports = occupied_ports()
            report['occupiedCandidatePortsBeforeStart'] = ports
            if len(ports) == 3:
                report['failurePhase'] = 'classic-server-isolation-before-command'
                report['error'] = 'All classic candidate ports are occupied; refusing server reuse'
                return report
        with (directory / 'execution.log.txt').open('w') as log:
            process = subprocess.Popen(item['command'], cwd=REPO, env=env, stdout=log,
                                       stderr=subprocess.STDOUT, start_new_session=True)
            report['processId'] = process.pid
            write_json(directory / 'report.json', report)
            try:
                report['exitCode'] = process.wait(timeout=item['timeoutSeconds'])
            except subprocess.TimeoutExpired:
                report['timeout'] = True
                report['failurePhase'] = 'outer-command-timeout'
                clean_group(process.pid)
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()
                report['exitCode'] = process.returncode
        text = (directory / 'execution.log.txt').read_text(errors='replace')
        actual = read_json(directory / item['reportRelative'])
        progress = read_json(directory / 'actual/progress.json')
        report['toolProgress'] = progress
        report['toolReportInspection'] = inspect_result(item, actual, text, expected)
        report['logTail'] = text[-12000:]
        if not report['toolReportInspection']['pass'] and not report['toolReportInspection']['failurePhase'] and progress:
            report['toolReportInspection']['failurePhase'] = progress.get('phase')
        if not report.get('timeout'):
            report['failurePhase'] = report['toolReportInspection']['failurePhase']
            report['error'] = report['toolReportInspection']['error']
        if report.get('timeout') or actual is None:
            report['lastToolPhase'] = (progress or {}).get('phase')
        if report['exitCode'] != 0 and not report.get('failurePhase'):
            report['failurePhase'] = 'command-exit'
        if item['name'] == '04-classic-smoke':
            report['dedicatedServerEvidence'] = [line for line in text.splitlines()
                                                 if 'Starting dev server on ' in line or 'Dev server ready on ' in line]
            if not report['dedicatedServerEvidence']:
                report['failurePhase'] = 'classic-server-isolation-evidence'
                report['error'] = 'No owned isolated dev server startup was recorded'
                report['toolReportInspection']['pass'] = False
        report['pass'] = report['exitCode'] == 0 and report['toolReportInspection']['pass']
        return report
    except Exception as error:
        report['failurePhase'] = report.get('failurePhase') or 'outer-runner-error'
        report['error'] = repr(error)
        return report
    finally:
        if process:
            report['processGroupCleanup'] = clean_group(process.pid)
        report['finalSources'] = sources(expected)
        report['sourceFixed'] = report['finalSources'] == expected
        report['finalSourceDifferences'] = differences(expected, report['finalSources'])
        if not report['sourceFixed']:
            report['pass'] = False
            report['priorFailurePhase'] = report.get('failurePhase')
            report['failurePhase'] = 'core-inputs-after-command'
        report['finishedAtUnixSeconds'] = time.time()
        write_json(directory / 'report.json', report)


def main():
    global OUTPUT
    parser = argparse.ArgumentParser()
    parser.add_argument('--start', action='store_true', help='Execute only after explicit parent START authorization')
    parser.add_argument('--output-root', type=Path, default=OUTPUT, help='Fresh evidence root outside the repository')
    args = parser.parse_args()
    OUTPUT = args.output_root
    core = read_json(CORE)
    if not args.start:
        print(json.dumps({'prepared': True, 'executionStarted': False, 'core': str(CORE),
                          'coreStatus': 'ready' if core and core.get('pass') is True else 'awaiting completed PASS report',
                          'coreInputCount': len((core or {}).get('initialInputs', {})),
                          'candidate': str(REPO), 'revision': REVISION,
                          'output': str(OUTPUT), 'plan': plan()}, ensure_ascii=False, indent=2))
        return 0
    assert core and core.get('pass') is True and core.get('sourceFixed') is True and core.get('exitCode') == 0, 'Fixed candidate core PASS is required'
    assert core.get('target') == str(REPO) and core.get('revision') == REVISION, 'Core must identify this fixed candidate'
    expected = core['initialInputs']
    assert expected and expected == core['finalInputs'], 'Core before/after input hashes must match'
    snapshot = read_json(SNAPSHOT)
    assert snapshot and snapshot.get('dest') == str(REPO) and snapshot.get('changedDuringCopy') == [], 'Snapshot must identify an unchanged fixed candidate'
    assert all(snapshot['files'].get(name) == value for name, value in expected.items()), 'Core inputs differ from fixed snapshot'
    OUTPUT.mkdir(exist_ok=False)
    summary = {'coreReport': str(CORE), 'coreReportSha256': sha(CORE), 'coreInputCount': len(expected),
               'candidate': str(REPO), 'revision': REVISION, 'snapshotSha256': sha(SNAPSHOT),
               'startedAtUnixSeconds': time.time(), 'initialSources': sources(expected), 'pass': False, 'stages': [], 'firstFailure': None,
               'scope': 'Sequential baseline27, wide27water, ordinaryGrowing, isolated flag-off classic, then full cove-disabled authoredFlower; no user servers 8230/5198, player profile or independent art acceptance'}
    write_json(OUTPUT / 'report.json', summary)
    for item in plan():
        print(json.dumps({'starting': item['name'], 'command': item['command']}, ensure_ascii=False), flush=True)
        report = run_stage(item, expected)
        compact = {key: report.get(key) for key in ['name', 'pass', 'exitCode', 'coreInputsMatch', 'sourceFixed', 'failurePhase', 'error', 'toolReportInspection']}
        compact['report'] = str(OUTPUT / item['name'] / 'report.json')
        summary['stages'].append(compact)
        print(json.dumps(compact, ensure_ascii=False), flush=True)
        if not report['pass']:
            summary['firstFailure'] = compact
            break
        write_json(OUTPUT / 'report.json', summary)
    summary['finalSources'] = sources(expected)
    summary['sourceFixed'] = summary['initialSources'] == expected == summary['finalSources']
    summary['pass'] = len(summary['stages']) == len(plan()) and all(stage['pass'] for stage in summary['stages']) and summary['sourceFixed']
    summary['finishedAtUnixSeconds'] = time.time()
    write_json(OUTPUT / 'report.json', summary)
    print(json.dumps({'pass': summary['pass'], 'stagesRun': len(summary['stages']), 'report': str(OUTPUT / 'report.json')}, ensure_ascii=False), flush=True)
    return 0 if summary['pass'] else 1


if __name__ == '__main__':
    sys.exit(main())
