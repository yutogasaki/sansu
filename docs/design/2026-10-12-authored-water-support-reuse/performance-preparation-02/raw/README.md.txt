# Water support reuse: second preparation after preflight rejection

Status: **PREPARED, NOT EXECUTED**. Parent must explicitly assign a quiet window before `--start`. This program does not start a browser, build an application, edit a candidate, or rerun the eight-stage acceptance journey.

## Question and measurement boundary

Compare the unchanged `composeAuthoredWaterWorld(state, base)` exported by immutable c2 and c3. The source delta is exactly the two production water-support reuse files and their focused test. The primary time is the function call only, measured with `process.hrtime.bigint()`. CPU user/system microseconds and RSS immediately before/after the same call are separate measures. Base construction, fixture I/O, forced GC, output hashing, all-site queries, logging, process startup and disposal are outside that interval.

This measures the whole local domain composition containing the removed redundant compile. It does **not** instrument or measure the isolated compiler call's self-time, UI input latency, rendering, cold entry, frame rate, P95, phone hardware or product performance acceptance. The previous parity timings overlap other work and are never included in performance results. Their roughly 8–23 second process durations are used only for conservative run budgeting; not for an improvement claim.

## Fixed inputs and repetitions

- The existing real-input parity's saved synthetic wide27, source32 and shoulder35 are loaded unchanged. wide27 uses legacy floor; source32 and shoulder35 use source shading; only shoulder35 adds the shoulder profile. Water scope is the same `withNative05WaterCarvingScope` constructor. No cove/renderer is involved. Expected state/base/output hashes come from the previous successful parity results, not reconstructed targets.
- Both cores' 6,460 input hashes and six installed dependency hashes, actual 24-input bundle closures, Node binary/version, bundle SHA, same benchmark template and unchanged water E2E driver SHA are sealed. Production input files are never transformed or instrumented. Only the entry's absolute candidate prefix differs.
- Three independent process blocks. Scenario order rotates: 27/32/35, 32/35/27, 35/27/32. Each scenario alternates c2/c3 order across blocks (AB/BA/AB or BA/AB/BA). Three blocks cannot give exactly balanced order counts; retain every raw value and this limitation.
- Each fresh Node process uses exactly two warmups then two measurements on the same state/base. Thus each version/scenario has **six measured calls from three independent processes**; two calls within a process are correlated. No outlier rejection, adaptive warmup or replacement run. Report median, min/max, raw values and three paired process medians. Do not claim statistical significance or P95.
- `--expose-gc` and exactly two explicit GC calls before each composition are identical across versions and outside timing. This is a controlled warmed diagnostic, not natural user memory/GC behavior. RSS after the call includes unreclaimed allocations; whole-worker peak also includes setup/verification and is labeled separately.
- The iteration function retains only small timing/hash/scalar records. Previous world/plan/query graphs leave scope before the next GC. WeakSets check that each returned world and plan has a fresh identity without keeping previous graphs alive.

## Functional and cache-path checks

Every warmup and measured call checks one adopted bridge, owner l24, exact restored edge IDs, exact final definition/plan SHA, every site's floor/anchor query SHA and every source walk-edge support SHA. State/base must remain unchanged and result world must differ from base. All expected hashes must agree with both old parity sides.

Static audit: `authoredWaterWorld.ts:398–563` has no result cache/WeakMap/early return; it creates new arrays and clones the base definition at line 455. `authoredWaterBridge.ts:230–233` compiles each candidate before adoption; c3 returns the last adopted support and c2 recompiles it at `authoredWaterWorld.ts:548`. Both still compile cutWorld, dryWorld and final output. `worldDefinition.ts:107` clones the input anew and has no cross-call compiler-result memoization. Therefore an exact bridge-bearing result on a fresh world follows the accepted compile path; this is source-path evidence, **not an instrumented call count**.

The base `authoredWaterCarving.ts:9,41–73` WeakMap holds a source spatial index by base-world identity. It is intentionally warmed equally; it does not memoize the composition. `authoredWorldAccess.ts:26–27` caches indexes by compiled floors/walk-sites; each new dry world supplies new keys. The shoulder base is built once outside timing, so its construction is not part of this question. [Cache audit](cache-audit.json) freezes exact source hashes and locations.

## Isolation, bounds and rejection

Budget estimate: **10–20 minutes**, whole-run deadline **2,700 seconds**, each owned fresh Node **180 seconds**, sampled owned process-group RSS **4 GiB**. Deadlines are fixed before execution. An exceeded bound, wrong result, changed hash, prohibited overlap or failed worker stops the sequence and preserves its first result; no retry is automatic.

Before work, observe ten seconds of host activity. During work, sample process identity/CPU/RSS every second. Command arguments are only examined transiently to classify interpreter tasks; stored host observations contain PID, executable basename, CPU delta, RSS, rule and aggregate load. No complete private process command-line inventory is saved.

Background Blender/test/build/benchmark and headless test browser processes reject the run by presence. Existing GUI browsers and OS helpers are instead monitored by cumulative CPU delta, as is the user-owned GUI Blender PID 13395. Root Vite PIDs 6704/47164 and their actual descendant esbuild services may remain idle; an unrelated esbuild process is still prohibited. Root Vite and GUI Blender identities are sealed by PID/parent/executable (Vite also exact command). Observed CPU greater than 10% of one core for any activity-monitored process rejects the measurement. Other external summed CPU greater than 100% for three consecutive one-second samples also rejects it.

A first observation without a cumulative-CPU baseline records `cpu: null` and `cpuBaselineAvailable: false`; it is never labeled zero or idle. The ten preflight samples must end with at least three consecutive samples with complete baselines for the monitored activity processes. The same monitoring continues throughout runtime. New background test/build/benchmark work is prohibited independently of whether a CPU delta already exists. CPU uses cumulative time differences, not only ps's decaying percentage. User processes and root servers are never signaled. Sampling cannot exclude subsecond activity between observations; the parent quiet-window schedule and process observations are both required.

`ps` observes all processes; only the benchmark's own process group can be terminated by this runner. Whole-host VM counters and load are recorded, without claiming resource isolation equivalent to a dedicated test machine. All source/runtime/preparation/dependency hashes are checked before and after. Functional success alone does not set performance-valid when isolation or input stability fails.

## Exact gated command

```sh
python3 /private/tmp/sansu-water-support-perf-c2-c3/prepared-02/run.py --start
```

Fresh output is `/private/tmp/sansu-water-support-perf-c2-c3/actual-02`. There is no browser/server option. Invoking without `--start` only prints the sealed plan. Existing c2/c3 candidates, previous parity attempts, runtime evidence and main sources remain unchanged.

## Initial rejection retained

Attempt 01 started no worker and stopped at its first presence-based process snapshot. Browser/helper and idle Vite esbuild presence was treated as prohibited, while zero delta had no preceding baseline. The old report, protocol, source and seal remain unchanged. This second preparation changes only the external isolation supervisor/protocol and output location. The same worker bundle bytes, state/base/expected hashes, 18-worker order, warmups, counts, GC, 10% activity ceiling and resource/deadline bounds are reused. The historical builder is copied as text and not executed again. A new quiet-window authorization is required.
