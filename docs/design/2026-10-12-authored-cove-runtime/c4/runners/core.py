#!/usr/bin/env python3
"""Prepared c4 core runner. Does not collect source or execute without --start."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import subprocess
import time

BASE = Path('/private/tmp/sansu-authored-cove-c4')
REPO = BASE / 'candidate'
CLOSURE = BASE / 'closure/inputs.json'
SNAPSHOT = BASE / 'snapshot.json'
OUTPUT = BASE / 'core'
REVISION = 'authored-cove-c4'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--start', action='store_true', help='Run only after root confirms author freeze, snapshot and closure')
    args = parser.parse_args()
    if not args.start:
        print(json.dumps({'prepared': True, 'executionStarted': False, 'inventoryCollected': False,
                          'candidate': str(REPO), 'revision': REVISION, 'closure': str(CLOSURE),
                          'snapshot': str(SNAPSHOT), 'output': str(OUTPUT), 'command': 'npm run verify:core'}))
        return 0
    OUTPUT.mkdir(exist_ok=False)
    report = {'target': str(REPO), 'revision': REVISION, 'command': 'npm run verify:core',
              'startedAt': time.time(), 'pass': False, 'phase': 'fixed-source-preflight'}
    expected = None
    def hashes():
        # Strict reads: deleted or omitted inputs are failures, never dropped.
        return {name: sha(REPO / name) for name in sorted(expected)}
    try:
        expected = json.loads(CLOSURE.read_text())
        snapshot = json.loads(SNAPSHOT.read_text())
        assert expected, 'An independently prepared source closure is required'
        assert snapshot['dest'] == str(REPO) and snapshot['changedDuringCopy'] == [], 'Snapshot is not fixed'
        assert all(snapshot['files'].get(name) == value for name, value in expected.items()), 'Closure differs from snapshot'
        report.update(closureSha256=sha(CLOSURE), snapshotSha256=sha(SNAPSHOT), initialInputs=hashes())
        assert report['initialInputs'] == expected, 'Candidate differs from frozen source closure'
        report['phase'] = 'verify-core'
        env = {**os.environ, 'SANSU_BUILD_REVISION': REVISION, 'VITE_ISLAND_ENABLED': 'true', 'VITE_NATIVE_GROWING_ART': 'false'}
        with (OUTPUT / 'execution.log').open('xb') as log:
            process = subprocess.run(['npm', 'run', 'verify:core'], cwd=REPO, env=env, stdout=log, stderr=subprocess.STDOUT)
        report.update(exitCode=process.returncode, finalInputs=hashes())
        report['sourceFixed'] = report['initialInputs'] == expected == report['finalInputs']
        report['pass'] = process.returncode == 0 and report['sourceFixed']
        report['phase'] = 'complete' if report['pass'] else 'verify-core-failed'
    except Exception as error:
        report['error'] = str(error)
        if expected is not None:
            try: report['finalInputs'] = hashes()
            except Exception as final_error: report['finalHashError'] = str(final_error)
        report['sourceFixed'] = bool(report.get('initialInputs')) and report.get('initialInputs') == report.get('finalInputs') == expected
    report['finishedAt'] = time.time()
    (OUTPUT / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({key: report.get(key) for key in ['pass', 'exitCode', 'sourceFixed', 'revision', 'phase', 'error']}))
    return 0 if report['pass'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
