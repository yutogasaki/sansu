from pathlib import Path
import datetime, hashlib, json, shutil, subprocess

out = Path(__file__).resolve().parent
root = out.parents[3]
base = Path('/tmp/codex/PI-001-SANSU').resolve()
plan = []
for evidence in [root/'qa/evidence/PI-001-SANSU/hub-preflight-20261016T045923.json', root/'qa/evidence/PI-001-SANSU/hub-preflight.json', out/'hub-preflight.json']:
    record = json.loads(evidence.read_text())
    assert record['status'] == 'FAIL'
    path = Path(record['out'])
    assert path.resolve().parent == base and path.name.startswith('hub-copy-') and not path.is_symlink()
    plan.append({'path': str(path), 'kind': 'obsolete-partial-hub-copy', 'evidence': str(evidence), 'reason': 'Failed, unpublished partial copy. Current policy uses direct project entrances; canonical inputs, outputs and failure records remain.'})

git_base = base/out.name/'clean/git-base'
assert git_base.name == 'git-base' and git_base.resolve().is_relative_to(base)
plan.append({'path': str(git_base), 'kind': 'repeatable-temporary-git-extraction', 'commit': json.loads((out/'start.json').read_text())['head'], 'reason': 'Temporary full Git extraction already copied into the isolated verification workspace. Fixed Git source and recovery inputs remain.'})

diagnostic = json.loads((root/'qa/evidence/PI-001-SANSU/restore-v5-diagnostic.json').read_text())
history = out/'history/rejected-v5-diagnostic'
history.mkdir(parents=True, exist_ok=True)
script = Path(diagnostic['isolatedOutput'])/'build-landscape-art.py'
assert hashlib.sha256(script.read_bytes()).hexdigest() == diagnostic['stagedScriptSha256']
shutil.copy2(script, history/script.name)
for record in diagnostic['results']:
    assert record['exact'] is False and record['actual'] != record['expected']
    path = Path(diagnostic['isolatedOutput'])/record['file']
    assert path.resolve().is_relative_to(base/'rebuild-v5')
    if path.exists():
        assert hashlib.sha256(path.read_bytes()).hexdigest() == record['actual']
    plan.append({'path': str(path), 'kind': 'rejected-diagnostic-model-output', 'sha256': record['actual'], 'expectedOriginalSha256': record['expected'], 'reason': 'Explicitly NOT_EXACT, unadopted diagnostic output. Source models, staged script, metadata and failed diagnostic log remain.'})

for record in plan:
    path = Path(record['path'])
    files = [p for p in path.rglob('*') if p.is_file() and not p.is_symlink()] if path.is_dir() else [path] if path.exists() else []
    record.update({'existedBefore': path.exists(), 'files': len(files), 'logicalBytes': sum(p.stat().st_size for p in files)})
result = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'authorization': 'Verified human request in structure-policy.json; no deletion of unaccepted originals, engines, unique recovery data or other work.', 'plan': plan, 'preserved': ['all original portal URLs and HTML', 'current portal outputs', 'canonical docs and data', 'fixed vendors and state/verification/approval engines', 'all raw verification/approval history', 'both required recovery input caches and supplemental inputs', 'other tasks and repositories'], 'logicalByteNote': 'Logical file sizes only; APFS clones may share storage. No physical disk-reclaim claim.'}
(out/'cleanup-plan.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
for record in plan:
    path = Path(record['path'])
    if path.is_dir(): shutil.rmtree(path)
    elif path.exists(): path.unlink()
    record['absentAfter'] = not path.exists()
result['status'] = 'PASS' if all(r['absentAfter'] for r in plan) else 'FAIL'
result['deletedFiles'] = sum(r['files'] for r in plan)
result['deletedLogicalBytes'] = sum(r['logicalBytes'] for r in plan)
(out/'cleanup-result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({'status': result['status'], 'entries': len(plan), 'deletedFiles': result['deletedFiles'], 'deletedLogicalBytes': result['deletedLogicalBytes']}))
