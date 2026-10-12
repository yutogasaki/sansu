from pathlib import Path
import json,hashlib,re,shutil
base=Path('/private/tmp/sansu-authored-cove-c4')
src=base/'build-boundary'
dst=Path('/Users/yutogasaki/Projects/sansu/docs/design/2026-10-12-authored-cove-runtime/c4/build-boundary')
dst.mkdir(parents=True,exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
report=json.loads((src/'report.json').read_text())
core=json.loads((base/'core/report.json').read_text())
raw=(base/'core/execution.log').read_bytes()
text=raw.decode()
filesMatch=re.search(r'Test Files\s+(\d+) passed \((\d+)\)',text)
testsMatch=re.search(r'Tests\s+(\d+) passed \((\d+)\)',text)
assert filesMatch and testsMatch
assert filesMatch.group(1)==filesMatch.group(2)=='606'
assert testsMatch.group(1)==testsMatch.group(2)=='5265'
assert core['pass'] and core['exitCode']==0 and core['sourceFixed'] and core['phase']=='complete'
assert report['pass']
lines=raw.splitlines(keepends=True)
indices=[i for i,line in enumerate(lines) if b'Test Files' in line or re.search(rb'^\s+Tests\s',line) or b'   Duration ' in line or b'PASS assets:check' in line or b'- PWA precache:' in line or b'- Explore artwork:' in line or b'- Production-input contract:' in line]
excerpt=b''.join(lines[i] for i in indices)
(src/'core-summary-excerpt.log.txt').write_bytes(excerpt)
files=['inspect-build.mjs','report.json','execution.log.txt','asset-budget.log.txt','input-hashes.json','dist-files.json','core-summary-excerpt.log.txt','archive-boundary.py']
for f in files:shutil.copyfile(src/f,dst/f)
manifest={'scope':'Exact copy of the completed read-only c4 build-boundary outputs. Core excerpt preserves selected raw log lines byte for byte; it is not the full core log.',
 'core':{'pass':core['pass'],'phase':core['phase'],'exitCode':core['exitCode'],'sourceFixed':core['sourceFixed'],'revision':core['revision'],'testFiles':606,'tests':5265,'reportSha256':sha((base/'core/report.json').read_bytes()),'executionLogSha256':sha(raw),'excerptSourceLines':[i+1 for i in indices]},
 'rawCopyBytesPreserved':all((src/f).read_bytes()==(dst/f).read_bytes() for f in files),
 'files':{f:{'bytes':(dst/f).stat().st_size,'sha256':sha((dst/f).read_bytes())} for f in files}}
(dst/'archive-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
readme='''# c4 normal false build boundary

[Read-only inspection](report.json) PASS after terminal c4 core PASS (`exitCode: 0`, `sourceFixed: true`). [Raw core summary lines](core-summary-excerpt.log.txt) confirm **606 test files / 5265 tests PASS**. This inspection did not start a build, browser or core run.

- Normal build identity: revision `authored-cove-c4`; Island enabled; `nativeOwnedArt=false` and `nativeArtStudy=false`.
- All **2,137 inputs** match the core initial/final manifests, c4 snapshot and current candidate. Exact hashes are in [input-hashes.json](input-hashes.json).
- Dist contains **171 files / 24,547,855 bytes**. This includes promotion and other outputs outside the PWA precache and is not the PWA budget measure.
- PWA precache: **145 files / 8,896,755 bytes (8.48 MiB) / 12 MiB**. Explore artwork: **27 production files / 2.97 MiB / 8 MiB**. The official read-only [asset budget check](asset-budget.log.txt) passed.
- Native/cove raw GLB, glTF, gzip and Blender art payloads were absent from the distributed assets. None of the dist files matched any of **23 source payload hashes**; no embedded GLB marker was found. The [dist inventory](dist-files.json) records every file's size and SHA.

## Code and data that remain

This result does not mean all authored code or data was removed from JavaScript.

| Distributed code | Bytes | Observed content |
| --- | ---: | --- |
| `nativeAuthoredFlower-CBUwdXJ8.js` | 8,482 | Authored flower adapter code |
| `_native-owned-art-disabled-BiOygDaT.js` | 55 | Disabled native loader, no fetch call |
| `authoredGrowingAssets-DFvrLLpN.js` | 469 | DEV-only throwing loader stubs, including cove; no fetch call |
| `GrowingWorld-Di4lC9-e.js` | 415,779 | Cove source names/identity metadata and the exact serialized shared-apron district |

The apron district is actual floor and navigation data, beyond descriptive strings: **147,435 characters**, one floor with **598 vertices / 596 triangles**, and **9 district walk sites**. Its source patch has 15 edges. The exact serialized district SHA is `ef7c526096b066095123b99e9e3b8ea8f0ef73ed40fa98b69030e465e7cd97dc`. This retained inline data is separate from the absent raw source GLB/gzip/Blender assets.

Dist inventory hashes remained unchanged throughout inspection. [Raw execution output](execution.log.txt), [executed script](inspect-build.mjs) and [archive manifest](archive-manifest.json) preserve the result and evidence identities. The script retains its executed `/private/tmp/sansu-authored-cove-c4` path and expects to run from that build-boundary location with the candidate sibling; deliberate path remapping is needed elsewhere. Raw `.log.txt` outputs were copied byte for byte. The core excerpt is selected raw lines, not a full log or a transcription.
'''
(dst/'README.md').write_text(readme)
assert all(sha((dst/f).read_bytes())==v['sha256'] for f,v in manifest['files'].items())
assert all((dst/link).exists() for link in re.findall(r'\]\(([^)]+)\)',readme))
print(json.dumps({'pass':report['pass'],'archive':str(dst),'files':len(files)+2,'rawBytesPreserved':manifest['rawCopyBytesPreserved'],'coreTestFiles':606,'coreTests':5265,'reportSha256':sha((dst/'report.json').read_bytes()),'archiveLinkAndHashChecks':'PASS'},indent=2))
