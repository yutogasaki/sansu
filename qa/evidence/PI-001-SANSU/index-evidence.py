from pathlib import Path
import datetime, hashlib, json

out = Path(__file__).resolve().parent
root = out.parents[2]
sha = lambda data: hashlib.sha256(data).hexdigest()
paths = set()
for directory in ('screens-stable', 'library-stable', 'logs'):
    paths.update(path for path in (out / directory).rglob('*') if path.is_file())
for name in (
    'verification.md', 'verification.json', 'complete-parity.md', 'complete-parity.json',
    'parity.md', 'parity.json', 'start.json', 'start-file-hashes.json',
    'preservation-final.json', 'view-metrics.md', 'view-metrics.json',
    'independent-review.md', 'independent-review-verified.md',
    'file-browser-stable.json', 'file-browser-stable-meta.json', 'file-storage.json',
    'css-assets.json', 'recovery-stable.json', 'recovery-check.json',
    'hub-preflight.json', 'hub-preflight-20261016T045923.json',
    'restore-v5-diagnostic.json', 'library/audit.json',
):
    path = out / name
    if path.is_file():
        paths.add(path)
files = {}
for path in sorted(paths):
    digest = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            digest.update(chunk)
    files[str(path.relative_to(out))] = {'sha256': digest.hexdigest(), 'bytes': path.stat().st_size}
result = {
    'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'command': 'python3 qa/evidence/PI-001-SANSU/index-evidence.py',
    'candidate': json.loads((root / 'portal/data/integration.json').read_text())['currentCandidate'],
    'manifestSha256': sha((root / 'portal/data/unification-manifest.json').read_bytes()),
    'acceptance': 'HOLD / 未完了',
    'scope': '現候補の証拠と失敗履歴を固定する。全撮影画像の独立実見や全操作受入を意味しない。過去候補の撮影/試行も削除しない。',
    'files': files,
}
(out / 'evidence-manifest.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'candidate': result['candidate'], 'files': len(files), 'bytes': sum(x['bytes'] for x in files.values()), 'acceptance': result['acceptance']}))
