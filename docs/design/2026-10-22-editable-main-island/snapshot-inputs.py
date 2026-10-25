from pathlib import Path
import datetime
import hashlib
import json
import sys

root = Path(__file__).resolve().parents[3]
files = []
for base in ['src', 'public']:
    files.extend(p for p in (root / base).rglob('*') if p.is_file())
files.extend(root / p for p in ['package.json', 'package-lock.json', 'vite.config.ts', 'index.html'])

def entries(paths):
    return [{'path': str(p.relative_to(root)), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
            for p in sorted(paths)]

source = entries(files)
dist = entries(p for p in (root / 'dist').rglob('*') if p.is_file())
manifest = {
    'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'app': 'Sansu normal Growing island', 'target': 'production build, local preview only',
    'delivery': 'snap-root-v1', 'candidate': 'editable-lived-island-v1',
    'projection': 'editable-common-floor-v1',
    'sourceHash': hashlib.sha256(json.dumps(source, sort_keys=True).encode()).hexdigest(), 'source': source,
    'distHash': hashlib.sha256(json.dumps(dist, sort_keys=True).encode()).hexdigest(), 'dist': dist,
    'publicDeployed': False, 'flags': {'island': True, 'natureTown': False},
}
destination = Path(__file__).parent / 'evidence' / (sys.argv[1] if len(sys.argv) > 1 else 'input-manifest.json')
destination.write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({key: manifest[key] for key in ['at', 'sourceHash', 'distHash']}))
