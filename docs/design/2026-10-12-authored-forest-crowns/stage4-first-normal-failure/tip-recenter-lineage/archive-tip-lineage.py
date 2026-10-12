"""Package completed tip-normal diagnostics, preserving every original decoded byte."""
from pathlib import Path
import gzip,hashlib,json
from datetime import datetime,timezone

REPO=Path('/Users/yutogasaki/Projects/sansu')
BASE=Path('/private/tmp/sansu-authored-forest-crown-study')
DEBUG=BASE/'stage4-organic-boughs/normal-debug'
FOREST=REPO/'docs/design/2026-10-12-authored-forest-crowns'
PARENT=FOREST/'stage4-first-normal-failure'
OUT=PARENT/'tip-recenter-lineage'
assert not OUT.exists();OUT.mkdir()
sha=lambda b:hashlib.sha256(b).hexdigest()
names=['tip-recenter-probe','tip-recenter-export-observation','tip-recenter-isolated-export',
       'tip-recenter-active-scene','tip-recenter-evaluated-baseline']
files=[]
for name in names:
    files.extend(p for p in sorted((DEBUG/name).rglob('*')) if p.is_file() and '__pycache__' not in p.parts)
for name in ['README.md','analyze-saved.py','saved-face-fan-analysis.json','trace-precision.py','precision-trace.json']:
    files.append(DEBUG/'preassignment-basis'/name)
files.append(Path(__file__))
records=[];mapping={}

def package(src,relative,kind='completed-diagnostic'):
    data=src.read_bytes();before=sha(data)
    destination=OUT/relative
    if destination.suffix=='.md':destination=destination.with_suffix('.md.txt')
    encoding='identity'
    if destination.suffix=='.json' and len(data)>=65536:
        destination=destination.with_suffix('.json.gz');encoding='gzip-mtime0'
        encoded=gzip.compress(data,mtime=0)
    else:encoded=data
    destination.parent.mkdir(parents=True,exist_ok=True);assert not destination.exists();destination.write_bytes(encoded)
    stored=destination.read_bytes();decoded=gzip.decompress(stored) if encoding=='gzip-mtime0' else stored
    assert decoded==data and sha(src.read_bytes())==before
    row={'source':str(src),'destination':str(destination.relative_to(OUT)),
         'sourceBeforeSHA256':before,'sourceAfterSHA256':sha(src.read_bytes()),
         'destinationDecodedSHA256':sha(decoded),'destinationStoredSHA256':sha(stored),
         'sourceBytes':len(data),'storedBytes':len(stored),'encoding':encoding,'kind':kind}
    records.append(row);mapping[str(src)]=row
    return row

for src in files:package(src,src.relative_to(DEBUG))

# Bind every external replay input. Reuse exact durable originals where possible;
# copy missing inputs once by SHA, never duplicate the large original native scene.
external={}
for name in names:
    external.update(json.loads((DEBUG/name/'readiness.json').read_text())['externalInputs'])
references=[];deduplicated={}
for name,expected in sorted(external.items()):
    src=Path(name);data=src.read_bytes();assert sha(data)==expected
    if name in mapping:
        references.append({'source':name,'sourceSHA256':expected,'archive':mapping[name]['destination'],
                           'encoding':mapping[name]['encoding']});continue
    candidates=[]
    if src.is_relative_to(REPO):candidates.append(src)
    if src.is_relative_to(BASE):
        rel=src.relative_to(BASE)
        if str(rel).startswith('stage4-organic-boughs/normal-debug/'):
            tail=Path(str(rel).removeprefix('stage4-organic-boughs/normal-debug/'))
            if tail.parts[0] in ['zero-face-comparison','sharp-fan-comparison']:
                candidates.append(PARENT/tail)
            else:candidates.append(PARENT/'normal-debug'/tail)
        elif str(rel).startswith('stage4-organic-boughs/'):
            candidates.append(PARENT/Path(str(rel).removeprefix('stage4-organic-boughs/')))
        else:candidates.append(FOREST/rel)
    if '/candidate/' in name:candidates.append(REPO/name.split('/candidate/',1)[1])
    verified=None
    for candidate in candidates:
        for target,encoding in [(candidate,'identity'),(Path(str(candidate)+'.txt'),'identity'),(Path(str(candidate)+'.gz'),'gzip')]:
            if not target.is_file():continue
            raw=target.read_bytes()
            try:decoded=gzip.decompress(raw) if encoding=='gzip' else raw
            except gzip.BadGzipFile:continue
            if sha(decoded)==expected:
                verified={'source':name,'sourceSHA256':expected,'existingDurable':str(target.relative_to(REPO)),
                          'encoding':encoding,'storedSHA256':sha(raw)};break
        if verified:break
    if verified:references.append(verified);continue
    if expected in deduplicated:
        row=deduplicated[expected]
    else:
        row=package(src,Path('replay-inputs')/(expected+'__'+src.name),'external-replay-input')
        deduplicated[expected]=row
    references.append({'source':name,'sourceSHA256':expected,'archive':row['destination'],'encoding':row['encoding']})

for row in records:assert sha(Path(row['source']).read_bytes())==row['sourceBeforeSHA256']
for name,expected in external.items():assert sha(Path(name).read_bytes())==expected
proof={'archivedAtUtc':datetime.now(timezone.utc).isoformat(),'status':'EXACT DECODED BYTE ARCHIVE',
       'archiveRoot':str(OUT),'records':records,'externalReplayInputs':references,
       'allSourceBeforeAfterAndDecodedDestinationEqual':True,
       'excluded':['unexecuted preassignment-basis/probe.py','unexecuted generalization preparation'],
       'markdownPackaging':'historical README.md becomes README.md.txt with identical bytes; no historical link rewriting',
       'gzipPackaging':'existing .gz copied byte-identical; only large plainJSON gets deterministic mtime0 gzip'}
(OUT/'archive-proof.json').write_text(json.dumps(proof,indent=2)+'\n')
result=lambda directory,relative:mapping[str(DEBUG/directory/relative)]['destination']
summary=result('tip-recenter-evaluated-baseline','terminal-summary.json')
success=result('tip-recenter-evaluated-baseline','attempt-01/result.json')
(OUT/'README.md').write_text(f'''# Single-leaf source-normal representation diagnostic

The final single-leaf diagnostic passed; this does not adopt the forest composition, all101 deformations, runtime, joint/actor gates or M1. All prior failures remain here in original decoded bytes.

The successful input is l14/source node2239, hanging-leaf0. The original152 faces remain untouched. The derived diagnostic excludes exactly four source-zero faces0/2/98/100, retains148 nonzero local triangles, preserves raw source NORMAL using the same inverse-transpose field Jacobian, splits six source-normal fan edges and stores tip-relative Float32 positions with compensated child translation. The owner/root matrix stays unchanged. Four microscopic retained faces still collapse after a Float32 world cast; local validity is a distinct result.

Final [summary]({summary}) and [full result]({success}): raw input NORMAL maxL2 .000499945; desired Blender .000593805; GLB1/2 .000625178; reimport .000598594. All are below .002. Both GLBs retain exact148 triangles/PBR; maximum world error7.608781644e-7 is below the unchanged1e-6 diagnostic bound. Original442 source meshes/parents/materials stayed exact during clone evaluation. Stable authoring552objects/444meshes/199materials stayed exact across the complete roundtrip, with no restore/repair.

Run PID52306 exited0, 2026-10-12 06:11:04.064496–06:11:28.251803 UTC, sampled peak630,128,640B. CPU2/RSS2GiB/60s bounds stayed fixed. These source diagnostics may overlap other authorized functional tasks and provide no performance acceptance.

## Preserved sequence

1. `tip-recenter-probe`: original-pivot comparison fails, tip reaches first export; combined digest assertion stops. Active record was not flushed before that assertion; this missing observation is explicit.
2. `tip-recenter-export-observation`: identifies only child matrix translation changing; raw POSITION/NORMAL/triangles/material/sharp/parent stay exact.
3. `tip-recenter-isolated-export`: first meaningful failure is2scene/131mesh output, then diagnostic-object transform guard, then RSS limit. Do not reorder this as an initial memory failure.
4. `tip-recenter-active-scene`: explicit active-scene selection completes both exports/reimport but fails exact authoring-scene guard on the two newly created clones.
5. `tip-recenter-evaluated-baseline`: one view-layer evaluation completes new clone construction before the authoring snapshot. Raw parent/basis math proves the Float32 composition; all original source data remain exact. Complete numeric roundtrip passes.

The final step synchronizes clone construction before comparison; it does not loosen a transform guard or repair a post-export mutation. Earlier source-space field/normal collapse tracing is in `preassignment-basis/`.

## Replay and byte identity

[Archive proof](archive-proof.json) maps every original absolute path to archived bytes or a hash-verified existing durable input. It binds all replay inputs, source-before/source-after and decoded-destination SHA256. Restore paths using this map to reproduce the original commands, whose fixed temporary roots remain recorded; do not run archived scripts blindly from this differently nested directory. Historical Markdown is `.md.txt` unchanged. Existing gzip stays byte-identical; large plain JSON uses deterministic gzip. Source assets are reused by exact SHA, not regenerated.

Original fixed extraction: [role GLB](../../extraction-attempt02/role-separated-originals.glb), [c1 context](../../extraction-attempt02/fixed-c1-context.glb), [bindings](../../extraction-attempt02/bindings.json). Earlier [source import-normal correspondence](../normal-debug/README.md), [zero-face comparison](../zero-face-comparison/README.md), and [sharp-fan comparison](../sharp-fan-comparison/README.md) remain separate complete archives.

Generalization is preparation only: vertex38/six-sharp and the tip anchor are not blanket rules for all roles. Fixed27, original materials/owners/roots and previously passed roles retain their boundaries. Independent child observation remains N=0.
''')
print(json.dumps({'archive':str(OUT),'fileCopies':len(records),'externalReplayInputs':len(references),
                  'proofSHA':sha((OUT/'archive-proof.json').read_bytes()),'copiedStoredBytes':sum(r['storedBytes'] for r in records)},indent=2))
