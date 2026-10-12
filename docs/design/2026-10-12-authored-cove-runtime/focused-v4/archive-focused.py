#!/usr/bin/env python3
"""Archive an existing focused result; never executes tests or edits source."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import re
import shutil

ROOT = Path('/Users/yutogasaki/Projects/sansu')
FIXED = Path('/private/tmp/sansu-authored-cove-c2')
RAW = Path('/private/tmp/sansu-authored-cove-c2-prep/focused-v4.log')
OUT = ROOT / 'docs/design/2026-10-12-authored-cove-runtime/focused-v4'
TESTS = [
    'src/components/island/growing/native/nativeAuthoredCove.test.ts',
    'src/domain/growingIsland/authoredCoveWorld.test.ts',
    'src/domain/growingIsland/authoredWorldFrame.test.ts',
    'src/components/island/growing/native/authoredCoveIntegration.test.ts',
    'src/components/island/growing/authoredCoveLife.test.ts',
]
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()

snapshot = json.loads((FIXED / 'snapshot.json').read_text())
core = json.loads((FIXED / 'core/report.json').read_text())
candidate = Path(snapshot['dest'])
assert core['pass'] and core['exitCode'] == 0 and core['phase'] == 'complete' and core['sourceFixed']
assert not snapshot['changedDuringCopy']
text = RAW.read_text()
assert re.search(r'Test Files\s+5 passed \(5\)', text) and re.search(r'Tests\s+30 passed \(30\)', text)
log_tests = dict((name, int(count)) for name, count in re.findall(r'✓\s+(src/\S+\.test\.tsx?)\s+\((\d+) tests\)', text))
assert set(log_tests) == set(TESTS) and sum(log_tests.values()) == 30

# Include the build/test config's local imports too, not just its own hash.
queue = TESTS + ['vite.config.ts', 'package.json', 'package-lock.json']
files, unresolved, external = set(), [], set()
while queue:
    relative = queue.pop()
    if relative in files:
        continue
    files.add(relative)
    path = ROOT / relative
    if path.suffix not in ['.ts', '.tsx', '.js', '.mjs']:
        continue
    source = path.read_text()
    imports = re.findall(r'(?:from\s+|import\s*\(\s*|import\s+)([\'\"])([^\'\"\n]+)\1', source)
    imports += re.findall(r'new\s+URL\(\s*([\'\"])(\.[^\'\"\n]+)\1\s*,\s*import\.meta\.url', source)
    for _, reference in imports:
        if not reference.startswith('.'):
            external.add(reference)
            continue
        target = path.parent / reference.split('?')[0]
        choices = [target, *[Path(str(target) + extension) for extension in ['.ts', '.tsx', '.js', '.mjs', '.json']],
                   *[target / ('index' + extension) for extension in ['.ts', '.tsx', '.js']]]
        resolved = next((option.resolve() for option in choices if option.is_file()), None)
        if resolved:
            queue.append(str(resolved.relative_to(ROOT)))
        else:
            unresolved.append([relative, reference])
assert not unresolved, unresolved

manifest = json.loads((ROOT / 'docs/design/2026-10-12-authored-cove-entrance/cove-delivery-manifest.json').read_text())
files.update([
    'prototypes/place-qa/native05-world.json.gz',
    'prototypes/place-qa/authored-flower-reference-mature.json',
    'prototypes/place-qa/native-flower-support.json.gz',
    'docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz',
    manifest['artifact']['path'].lstrip('/'), manifest['source']['artifact'],
])
hashes = {relative: sha(ROOT / relative) for relative in sorted(files)}
differences = [relative for relative, digest in hashes.items()
               if snapshot['files'].get(relative) != digest or sha(candidate / relative) != digest
               or core['initialInputs'].get(relative) != digest or core['finalInputs'].get(relative) != digest]
assert not differences, differences
OUT.mkdir(exist_ok=True)
shutil.copy2(RAW, OUT / 'focused-v4.log.txt')
assert sha(RAW) == sha(OUT / 'focused-v4.log.txt')
core_log = (FIXED / 'core/execution.log').read_text()
core_tests = dict((name, int(count)) for name, count in re.findall(r'✓\s+(src/\S+\.test\.tsx?)\s+\((\d+) tests\)', core_log))
assert all(core_tests.get(test) == log_tests[test] for test in TESTS)
excerpt_lines = [line for line in core_log.splitlines() if re.match(r'\s*✓\s+src/', line)
                 and any((' ' + test + ' ') in line for test in TESTS)]
assert len(excerpt_lines) == 5
(OUT / 'core-focused-excerpt.txt').write_text(
    'EXCERPT, not full raw stdout. Selected unmodified file-result lines from terminal PASS c2 core.\n'
    'Source: /private/tmp/sansu-authored-cove-c2/core/execution.log\n'
    'Source SHA-256: ' + sha(FIXED / 'core/execution.log') + '\n\n' + '\n'.join(excerpt_lines) + '\n')
patch = json.loads((ROOT / 'docs/design/2026-10-12-authored-cove-entrance/shared-apron-world-patch-v1.json').read_text())
report = {
    'result': 'PASS', 'scope': 'Existing focused Node/Vitest result; actual native geometry, source-profile applicability and public life behavior. Not browser/art/real acquisition/save/offline/device acceptance. No fresh focused run was made for this archive.',
    'focused': {'files': 5, 'tests': 30, 'durationSeconds': 62.36, 'startedAtLocal': '2026-10-12 07:37:34 Asia/Tokyo',
                'log': 'focused-v4.log.txt', 'logSha256': sha(RAW), 'testCounts': log_tests},
    'visualCandidate': patch['candidate'], 'shellSourceId': manifest['source']['id'], 'shellSourceSha256': manifest['source']['sha256'],
    'sourceIdentity': {
        'method': 'Recursive relative static import/export, literal dynamic import and new URL graph for five tests plus Vite config local imports; explicit filesystem test inputs and source GLB; npm package and lock metadata.',
        'comparedTo': ['current root files', 'c2 snapshot manifest', 'fixed candidate files', 'core.initialInputs', 'core.finalInputs'],
        'fileCount': len(hashes), 'differences': differences, 'files': hashes,
        'externalModuleSpecifiers': sorted(external), 'unresolvedLocalImports': unresolved,
        'snapshotCreatedAt': snapshot['createdAt'], 'snapshotSha256': sha(FIXED / 'snapshot.json'),
        'snapshotFileCount': len(snapshot['files']), 'snapshotChangedDuringCopy': [],
        'timingLimit': 'The earlier focused run did not capture an input manifest at start/end. Post-run multi-way hash equality does not independently prove its historical inputs. Root reported that final localGround/clearCourt and test changes finished before starting focused, followed by PASS then snapshot, with no subsequent source/app edits. Terminal core independently reran all five files on the same frozen candidate.',
        'latestRootInputMtime': datetime.fromtimestamp(max((ROOT / name).stat().st_mtime for name in hashes), timezone.utc).isoformat(),
    },
    'independentCoreConfirmation': {'pass': True, 'exitCode': core['exitCode'], 'sourceFixed': core['sourceFixed'],
        'phase': core['phase'], 'revision': core['revision'], 'inputCount': len(core['initialInputs']),
        'reportSha256': sha(FIXED / 'core/report.json'), 'logSha256': sha(FIXED / 'core/execution.log'),
        'excerpt': 'core-focused-excerpt.txt', 'excerptSha256': sha(OUT / 'core-focused-excerpt.txt'),
        'testedFileCounts': {test: core_tests[test] for test in TESTS}},
    'archiveScriptSha256': sha(OUT / 'archive-focused.py'),
}
(OUT / 'report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
print(json.dumps({'result': report['result'], 'files': 5, 'tests': 30, 'inputCount': len(hashes),
                  'differences': differences, 'visualCandidate': patch['candidate'],
                  'focusedLogSha256': sha(RAW)}, indent=2))
