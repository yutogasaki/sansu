from pathlib import Path
import hashlib, json, shutil, datetime

BASE = Path('/private/tmp/sansu-authored-shoulder-c1')
DEST = Path('/Users/yutogasaki/Projects/sansu/docs/design/2026-10-12-authored-shoulder-runtime/c1')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
def inventory(root):
    return {str(p.relative_to(root)): sha(p) for p in sorted(root.rglob('*')) if p.is_file()}
protected_floor = DEST / 'regressions/01-floor-shading-ab'
floor_before = inventory(protected_floor)
assert floor_before, 'Root-owned floor archive must exist; never create or replace it'
owned = [DEST/'regressions/02-shoulder-full', DEST/'regression-summary', DEST/'runner-records']
for p in owned:
    assert not p.exists(), f'Refuse overwrite: {p}'
items = []
for p in sorted((BASE/'regressions/02-shoulder-full').rglob('*')):
    if p.is_file(): items.append((p, DEST/'regressions/02-shoulder-full'/p.relative_to(BASE/'regressions/02-shoulder-full')))
for rel, name in [
    ('regressions/report.json','report.json'),
    ('regressions-runner-execution.log.txt','execution.log.txt'),
    ('prepared/regression-first-terminal.json','regression-first-terminal.json'),
    ('prepared/regression-process-cleanup.json','regression-process-cleanup.json'),
]: items.append((BASE/rel, DEST/'regression-summary'/name))
for rel, name in [
    ('prepared/regressions.py','regressions.py'),
    ('execution-handoff.json','execution-handoff.json'),
    ('prepared/archive-first-regression.py','archive-first-regression.py'),
]: items.append((BASE/rel, DEST/'runner-records'/name))
for p in sorted((BASE/'prepared/runner-cove-contract-fix').rglob('*')):
    if p.is_file(): items.append((p, DEST/'runner-records/runner-cove-contract-fix'/p.relative_to(BASE/'prepared/runner-cove-contract-fix')))
records=[]
for source,target in items:
    assert not target.exists(), str(target)
    before=sha(source); size=source.stat().st_size
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(source,target)
    after=sha(source); copied=sha(target)
    assert before==after==copied, str(target)
    records.append({'source':str(source),'destination':str(target.relative_to(DEST)),'bytes':size,'sourceSha256Before':before,'sourceSha256After':after,'destinationSha256':copied,'identical':True})
assert not (DEST/'regressions/02-shoulder-full/actual/report.json').exists()
assert floor_before==inventory(protected_floor), 'Root-owned floor archive changed during copy'
proof={'recordedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'Byte-identical first failed shoulder stage, outer regression summary, and runner-only correction records. No rewrite of missing-tool-report failure; OOM diagnosis is separate. Root-owned floor archive not overwritten.','files':records,'fileCount':len(records),'totalBytes':sum(x['bytes'] for x in records),'allBytesIdentical':True,'missingSourceToolReport':'regressions/02-shoulder-full/actual/report.json','missingSourceToolReportPreservedAsAbsent':True,'protectedFloorArchive':{'relativePath':'regressions/01-floor-shading-ab','before':floor_before,'after':inventory(protected_floor),'unchanged':True}}
(DEST/'regression-summary/archive-proof.json').write_text(json.dumps(proof,indent=2)+'\n')
print(json.dumps({'files':len(records),'bytes':proof['totalBytes'],'identical':True,'protectedFloorFiles':len(floor_before),'protectedFloorUnchanged':True}))
