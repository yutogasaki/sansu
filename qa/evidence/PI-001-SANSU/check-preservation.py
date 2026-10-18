from pathlib import Path
import datetime, hashlib, json

out = Path(__file__).resolve().parent
root = out.parents[2]
initial = json.loads((out / 'start-file-hashes.json').read_text())
owned = {
    'README.md',
    'docs/portal/README.md', 'scripts/standard-portal.mjs',
    'tools/check-portal-integration.mjs', 'tools/integrated-portal-browser.js',
    'tools/integrated-portal.css', 'tools/integrated-portal.mjs',
    'tools/portal-flow.css', 'tools/portal-originals.mjs', 'tools/qa-integrated-portal.mjs',
}
missing, changed = [], []
for relative, before in initial.items():
    path = root / relative
    if not path.is_file():
        missing.append(relative)
        continue
    with path.open('rb') as f:
        digest = hashlib.sha256()
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            digest.update(chunk)
        after = digest.hexdigest()
    if before != after:
        scope = 'generated portal' if relative.startswith('portal/') else 'owned source' if relative in owned else 'outside owned sources'
        changed.append({'path': relative, 'scope': scope, 'before': before, 'after': after})
result = {
    'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'command': 'python3 qa/evidence/PI-001-SANSU/check-preservation.py',
    'initialFiles': len(initial), 'missing': missing, 'changed': changed,
    'outsideOwnedChanges': [row for row in changed if row['scope'] == 'outside owned sources'],
    'originalMissing': [name for name in missing if not name.startswith('portal/')],
}
(out / 'preservation-final.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'initialFiles': len(initial), 'missing': len(missing), 'outsideOwnedChanges': len(result['outsideOwnedChanges'])}))
