import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
report = json.loads((root / 'report.json').read_text())
events = [json.loads(line) for line in (root / 'events.jsonl').read_text().splitlines()]
by_event = {event['event']: event for event in events}
bounded, unbounded = report['phases']
comparisons = []
for left, right in zip(bounded['steps'], unbounded['steps']):
    assert (left['label'], left['canonicalSha256'], left['frameRevision']) == (
        right['label'], right['canonicalSha256'], right['frameRevision'])
    comparisons.append({
        'label': left['label'], 'canonicalSha256': left['canonicalSha256'],
        'frameRevision': left['frameRevision'],
        'bounded3PostGcHeapBytes': left['afterGC']['heapUsed'],
        'unboundedPostGcHeapBytes': right['afterGC']['heapUsed'],
        'differenceBytes': right['afterGC']['heapUsed'] - left['afterGC']['heapUsed'],
    })
operations = []
for name, before, after in [
    ('advanceNature18h', 'bounded3:advance18h:before', 'bounded3:advance18h:after'),
    ('syncPlaceMilestones', 'bounded3:advance18h:after', 'bounded3:sync-mature:after'),
]:
    start, end = by_event[before], by_event[after]
    operations.append({
        'operation': name, 'operationMsExcludingCheckpointGc': end['operationMs'],
        'beforePostGcHeapBytes': start['memory']['heapUsed'],
        'afterCallBeforeGcHeapBytes': end['beforeGC']['heapUsed'],
        'afterPostGcHeapBytes': end['memory']['heapUsed'],
        'postGcDeltaBytes': end['memory']['heapUsed'] - start['memory']['heapUsed'],
        **({'events': end['events']} if 'events' in end else {}),
    })

summary = {
    'scope': report['scope'], 'candidate': report['candidate'],
    'outcome': 'LRU3 eight frames completed; unbounded self-stopped after four frames; no OOM',
    'completedComparison': report['completed'], 'selfStopped': report['selfStopped'],
    'totalFrameSteps': report['totalFrameSteps'], 'elapsedMs': report['elapsedMs'],
    'heapLimitBytes': report['heapLimit'], 'heapStopBytes': report['heapStopBytes'],
    'fixedReserveBytes': report['preflightReserveFloorBytes'],
    'bounded3MaxFramePostGcHeapBytes': max(step['afterGC']['heapUsed'] for step in bounded['steps']),
    'bounded3MaxFrameAfterCallHeapBytes': max(step['afterNoGC']['heapUsed'] for step in bounded['steps']),
    'maxObservedRssBytes': max(event['memory']['rss'] for event in events),
    'betweenModes': by_event['between-modes']['memory'],
    'comparisons': comparisons, 'operations': operations,
    'stopReason': report['stopReason'],
    'localInputCount': len(report['initialInputs']), 'localInputsUnchanged': report['inputsUnchanged'],
    'installedDependencyCount': len(report['initialInstalledDependencies']),
    'installedDependenciesUnchanged': report['installedUnchanged'],
    'rawFailure': report['rawFailure'],
    'limitations': report['omitted'] + [
        'Unbounded remaining four frames were not executed.',
        'Forced GC and sequential bounded-first execution are diagnostic conditions, not production performance.',
        'After-call memory is a sampled value, not the maximum inside a synchronous operation.',
        'Original explicit-diagnostic-18h OOM JS call site remains unproven.',
        'All twelve projections were cache misses. Outer/domain cache hit-refresh divergence and the actual direct-delegation repair were not exercised.',
        'Bounded mode uses an outer LRU3 plus the unchanged domain LRU3; acquisition.initial and fixedEdits.initial live references from the full driver are omitted.',
        'Frame :after event elapsedMs/cpu fields contain operation duration/delta because summary fields override cumulative logging fields; other events contain cumulative values.',
    ],
}
(root / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')

def mib(number):
    return f'{number / 2**20:,.1f}'

lines = [
    '# Shoulder c1 frame retention — attempt 02', '',
    'The bounded LRU3 sequence completed all eight frame states. The unbounded sequence stopped safely after four states, before the next allocation, so the requested 8-versus-8 comparison is **incomplete**. The process exited 0 without OOM; this is diagnostic completion of a bounded attempt, not an application or browser acceptance pass.', '',
    'Original c1 failure, candidate, and driver were read only. Attempt 01 remains intact one directory above. No application, driver, source, or fixed-candidate file was changed.', '',
    '## Reproduction and guard', '',
    '```sh',
    'node --expose-gc /private/tmp/sansu-shoulder-memory-diagnostic/attempt-02/diagnose.mjs > /private/tmp/sansu-shoulder-memory-diagnostic/attempt-02/execution.log.txt 2>&1',
    'python3 /private/tmp/sansu-shoulder-memory-diagnostic/attempt-02/analyze.py',
    '```', '',
    'The diagnostic requires a fresh events file; preserve existing output and use a new authorized directory for another run. Node v24.18.0, no heap override, observed V8 heap limit 4,496,293,888 bytes. A fixed 768 MiB next-operation reserve requires starting heap below 2.25 GiB; each post-GC checkpoint must stay below 3 GiB. At unbounded preview-l34, post-GC heap reached 2,446,170,912 bytes. Before apply-l34, heap plus reserve exceeded 3 GiB, causing the recorded stop. No limit was raised.', '',
    'The same c1 projection stdin was extracted and bundled in memory. All 99 local projection/input SHA values match the successful c1 core report; six installed dependency SHA values match its separate installed-dependency closure. Both sets match after the run. Each mode uses a fresh immutable base; all caller-side frames and the base were released between modes. Post-GC heap fell to 45,492,280 bytes (43.4 MiB) before the second mode.', '',
    '## Retention measurements', '',
    '| Frame state | LRU3 cache | LRU3 post-GC MiB | Unbounded cache | Unbounded post-GC MiB |',
    '| --- | ---: | ---: | ---: | ---: |',
]
for index, step in enumerate(bounded['steps']):
    other = unbounded['steps'][index] if index < len(unbounded['steps']) else None
    lines.append(f"| {step['label']} | {step['cacheSize']} | {mib(step['afterGC']['heapUsed'])} | {other['cacheSize'] if other else '—'} | {mib(other['afterGC']['heapUsed']) if other else 'not run'} |")
lines += [
    '',
    'At the fourth identical state, retaining four frames instead of three adds **343,795,440 bytes (327.9 MiB)** after GC. Preview/commit pairs have different canonical keys but the same public frame revision. For example, l33 preview keeps drops=9230/nextId=33, while commit uses 9210/34; both report authored-world:ff2c0183273fbe23. The unbounded outer Map retains both. This proves material extra retention in this sequence; it does not identify the exact object retaining path of the original OOM.', '',
    'LRU3 settled around 2,005–2,047 MiB through later states. It still required 2,702,854,856 bytes (2.52 GiB) at the largest sampled after-call heap. Even a standalone baseline frame retained 911,623,664 bytes after GC and used 2,285,630,432 bytes at the after-call sample. The shared world compilation/projection cost therefore remains an application-level concern; limiting the harness Map cannot establish that the underlying application is memory-safe. Maximum sampled RSS was about 4.69 GiB; RSS includes V8/native reserved memory and is distinct from live JavaScript heap.', '',
    '## Growth versus frame construction', '',
    '| Operation | Call duration, excluding checkpoint GC | Post-GC delta |',
    '| --- | ---: | ---: |',
]
for operation in operations:
    lines.append(f"| {operation['operation']} | {operation['operationMsExcludingCheckpointGc']:.3f} ms | {operation['postGcDeltaBytes']:,} bytes |")
lines += [
    '',
    'The bounded run emitted matured events for l33/l34/l35 and reached the exact canonical frozen mature35 reference. The following mature frame construction took 11,353.711 ms. In this measured state, advanceNature and milestone synchronization did not create a comparable persistent heap increase. The original browser step contains those operations, an actual UI advance, preservation assertions, checkSettled, and a new mature projection, so the phase name alone does not prove that advanceNature itself caused the OOM. The raw native stack is not a JavaScript allocation attribution.', '',
    '## Limits and interpretation', '',
    '- The direct 75-target canPlace scan, real browser renderer, screenshots, and all owner/actor access assertions were omitted. Normal applyIntent and its own domain checks did execute. Their successful execution is not a substitute for the complete browser journey.',
    '- This experiment used an outer LRU3 over the unchanged real domain LRU3. All twelve projections were misses, so the two caches stayed aligned in the measured insertion sequence. The diagnostic outer cache refreshes hits without forwarding them to domain, while c1 had an unbounded outer Map. Hit-refresh divergence, the new direct-delegation driver, and full-driver acquisition.initial/fixedEdits.initial references were not exercised; eight bounded steps are not evidence that the full driver retains at most three frames.',
    '- Forced GC at checkpoints makes retained-state differences visible. It does not model normal scheduling or promise browser performance. Sampled after-call heap can miss higher transient allocation inside an operation.',
    '- All four comparable state hashes and revisions match. The second run is in the same process and follows the first; its baseline post-GC heap differs by less than 1 MiB, but warm execution and RSS reservation can affect timings.',
    '- Frame `:after` event `elapsedMs`/`cpu` fields contain operation duration/delta, overriding cumulative logging fields. Other events use cumulative values. `report.json` frame stages and `operationMs` are the unambiguous duration fields; original raw output is preserved.',
    '- A bounded driver cache is a justified next repair candidate. Dropping acceptance checks, expanding heap, treating equal public revisions as universally interchangeable states, or calling this an app memory PASS would not follow from this evidence.', '',
    '## Evidence', '',
    '- [Diagnostic source](diagnose.mjs), [raw execution](execution.log.txt), [flushed checkpoints](events.jsonl), [full report](report.json).',
    '- [Derived machine summary](summary.json), [analysis script](analyze.py), and [artifact SHA manifest](artifact-manifest.json).',
    '- Original failure: `/private/tmp/sansu-authored-shoulder-c1/regressions/02-shoulder-full/execution.log.txt`; its exact SHA is recorded in the report and summary.',
]
(root / 'README.md').write_text('\n'.join(lines) + '\n')
files = ['diagnose.mjs', 'execution.log.txt', 'events.jsonl', 'report.json', 'analyze.py', 'summary.json', 'README.md']
manifest = {'files': {file: {'sha256': hashlib.sha256((root / file).read_bytes()).hexdigest(), 'bytes': (root / file).stat().st_size} for file in files}}
(root / 'artifact-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({key: summary[key] for key in ['outcome', 'totalFrameSteps', 'elapsedMs', 'localInputsUnchanged', 'installedDependenciesUnchanged']}))
