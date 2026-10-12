"""Scoped source closeout: identity, raw top preservation, source-view dimensions, local links."""
import ast, gzip, hashlib, json, re, struct
from pathlib import Path
ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
m = json.loads((ROOT/'scene-manifest.json').read_text())
render = json.loads((ROOT/'source-render-manifest.json').read_text())
checks = []
for name, item in m['artifacts'].items():
    assert sha(ROOT/name) == item['sha256']
    assert (ROOT/name).stat().st_size == item['bytes']
    checks.append(name)
for name, expected in m['authoringScripts'].items():
    assert sha(ROOT/name) == expected
for name, expected in m['originalAssets'].items():
    assert sha(REPO/name) == expected
for log in m['logs']:
    assert sha(ROOT/log['path']) == log['sha256'], log['path']
for name, expected in render['inputs'].items():
    assert sha(ROOT/name) == expected
assert set(render['views']) == {'source-whole','source-rotated','source-close'}
for view in render['views'].values():
    p = ROOT/view['path']; assert sha(p) == view['sha256']
    assert struct.unpack_from('>II', p.read_bytes(), 16) == (1280, 960)
profile = json.loads(gzip.decompress((ROOT/'geometry-profile.json.gz').read_bytes()))
h = json.loads(gzip.decompress((ROOT/'input/selected-v3-handoff.json.gz').read_bytes()))
floor = h['replacementDistrict']['floors'][0]
assert profile['soil']['topOriginalIndices'] == floor['indices']
assert profile['soil']['topOriginalPositions'] == [[v['point'][k] for k in ['x','y','z']] for v in floor['vertices']]
assert len(profile['newFloorAttributes']['normals']) == len(floor['vertices'])
links = []
for name in ['README.md','art-review.md','comparison.html']:
    p = ROOT/name; text = p.read_text()
    refs = re.findall(r'\]\(([^)]+)\)',text) if p.suffix == '.md' else re.findall(r'(?:href|src)="([^"]+)"',text)
    for ref in refs:
        if '://' in ref or ref.startswith('#'): continue
        target = ref.split('#')[0]
        assert (p.parent/target).exists(), (name, ref)
        links.append([name, ref])
scripts = []
for p in ROOT.glob('*.py'):
    ast.parse(p.read_text(), filename=str(p)); scripts.append(p.name)
report = {'scope':'Scoped source-only closeout. No app/browser/build/docs-wide check.', 'sourceCandidate':m['candidate'],
          'sceneManifestSha256':sha(ROOT/'scene-manifest.json'), 'artifactHashesVerified':checks,
          'sourceScriptsVerified':list(m['authoringScripts']), 'original3AssetsUnchanged':True,
          'logsVerified':len(m['logs']), 'renderInputsFixed':True, 'sourceViews1280x960':list(render['views']),
          'exactRawHandoffPositionsAndIndices':True, 'normalCountMatchesRawVertices':True,
          'localLinksVerified':links, 'pythonAST':scripts, 'appAcceptance':'Not performed', 'observerN':0}
(ROOT/'verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['localLinksVerified','pythonAST','sourceScriptsVerified','artifactHashesVerified']},indent=2))
