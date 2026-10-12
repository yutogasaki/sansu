# Shoulder memory diagnostic — initial safety stop

Pure Node / c1 immutable input subset / default V8 heap / --expose-gc. Browser, renderer, canPlace acceptance and performance acceptance are outside this diagnostic. Original c1 failure remains unchanged.

The first process exited normally after one bounded baseline frame. No OOM was forced. The adaptive reserve used the first cold frame allocation burst for the next frame and stopped too early for the requested comparison. The bounded/unbounded hypothesis is **not confirmed or rejected** by this initial run. advanceNature was not reached.

- Baseline before GC-cleared projection: heapUsed 132,247,192 bytes.
- Baseline immediately after projection: heapUsed 2,302,175,216 bytes.
- Baseline after forced GC: heapUsed 911,592,632 bytes.
- Self-stop before preview-l33: retained heap 911,711,112 + estimated reserve 2,712,410,030 >= 3 GiB.
- Frame calls completed: 1 / 16 maximum.
- Initial/final local input SHA equality: True; installed dependency SHA equality: True.

Files: diagnose.mjs, execution.log.txt, events.jsonl, report.json. All raw events are fsync-flushed. report.json separates beforeGC / afterNoGC / afterGC and does not retain world objects.

Read this result as an overly conservative diagnostic safety stop, not an application failure, driver repair, or successful memory comparison. Further execution requires a revised bounded diagnostic run; none has yet been started.
