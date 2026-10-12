from pathlib import Path
import hashlib, json, shutil

BASE = Path('/private/tmp/sansu-authored-cove-c4')
DEST = Path('/Users/yutogasaki/Projects/sansu/docs/design/2026-10-12-authored-cove-runtime/c4')
def read(p): return json.loads(p.read_text())
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
core = read(BASE / 'core/report.json')
full = read(BASE / 'full/report.json')
snapshot = read(BASE / 'snapshot.json')
assert core['pass'] and core['sourceFixed'] and core['exitCode'] == 0
assert full['pass'] and full['shapeOnly'] is False and full['sourceClosureUnchanged']
assert core['initialInputs'] == core['finalInputs']
assert full['initialInputs'] == full['finalInputs']
assert all(core['initialInputs'].get(k) == v for k,v in full['initialInputs'].items())
assert all(snapshot['files'].get(k) == v for k,v in core['initialInputs'].items())
assert all(sha(BASE/'candidate'/k) == v for k,v in core['initialInputs'].items())
assert full['expectedBuild'] == core['revision'] == 'authored-cove-c4'
copied = []
def copy(source, relative):
    target=DEST/relative
    target.parent.mkdir(parents=True, exist_ok=True)
    assert not target.exists(), str(target)
    shutil.copyfile(source,target)
    assert sha(source)==sha(target)
    copied.append({'file':str(relative),'sha256':sha(target),'bytes':target.stat().st_size,'source':str(source)})
for directory in ['core','closure','full','snapshot-first-copy']:
    for source in sorted((BASE/directory).rglob('*')):
        if source.is_file():
            relative=source.relative_to(BASE)
            if source.suffix=='.log': relative=Path(str(relative)+'.txt')
            if directory=='snapshot-first-copy' and source.suffix=='.md': relative=Path(str(relative)+'.txt')
            copy(source,relative)
for name in ['snapshot.json','snapshot.mjs','server-startup-note.json','full-execution.log','archive-core-full.py']:
    copy(BASE/name, name+'.txt' if name.endswith('.log') else name)
for name in ['closure.py','core.py','check-driver-imports.mjs','regressions.py']:
    copy(Path('/private/tmp/sansu-authored-cove-c4-prep')/name,Path('runners')/name)
proof={'revision':core['revision'],'candidate':full['candidate'],'shellSourceId':full['shellSourceId'],
       'target':full['target'],'corePass':True,'fullPass':True,'coreInputCount':len(core['initialInputs']),
       'driverInputCount':len(full['initialInputs']),'driverExactCoreSubset':True,
       'snapshotSha256':sha(BASE/'snapshot.json'),'captureCount':len(full['captures']),
       'canvasSelectionCount':len(full['canvasSelections']),'editCount':len(full['edits']),
       'regressions':'separately recorded; no result inferred here',
       'scope':full['scope'],'excludes':full['excludes'],'files':copied}
(DEST/'core-full-archive-proof.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in proof.items() if k!='files'},ensure_ascii=False))
