# Exact XZ search-index sharing — prepared diagnostic

Runtime change: `worldDefinition.ts` shares the logical coarse/fine search bins with physical queries only when **every compiled indexed triangle vertex has exactly equal logical and physical XZ**. It preserves the original candidate lists, their order, epsilon, physical barycentric calculations, support, source normals and render payloads. Mapped worlds take the original independent-index path. No cove result cache was added.

Preparation only: the memory runner has **not run**. Root must authorize starting it. Browser/build/core/render have not been run for this change. The esbuild call in the runner is the original in-memory Node projection bundle, not an app build.

The live focused tests pass: 20 worldDefinition tests and 6 worldFloorIndex differential tests; both edited files pass targeted ESLint. `focused-first.log.txt` and `lint-first.log.txt` preserve the first runs. The new case checks physical inverse lookup for a mapped floor following identity floors. The existing differential covers the actual 89,488-triangle native05 floor, ordered EPS seams, thin triangles, water masking, mapped/turned districts, nearest-y choices and source immutability.

`prepared-inputs.json` pins all 99 local inputs and six installed dependency inputs from the original c1 memory diagnostic. Its live comparison differs only in `worldDefinition.ts` and the externally repaired driver; the test file is separately tracked with those two. The c1 candidate and its core report remain read-only. `worldDefinition.before.ts` is byte-identical to c1. No other domain input differs.

The runner uses separate processes for before and after, the same extracted projection export text, Node v24.18.0/default heap, and only baseline32 → preview-l33 → normal applyIntent/commit-l33. Both cases call the real authoredWorldFrame directly with **no outer cache**. It uses forced GC checkpoints, a 768 MiB next-operation reserve, and a stop at 3 GiB retained heap. It checks the exact original V8 heap limit rather than increasing it. The reserve cannot prove that an operation never exceeds it internally.

After the frame-retention checkpoint, it separately records streamed physical geometry, complete source definition, render payload including normals/materials, sites/nav grants, plans, and floor/inverse queries for every site plus ±.28 footprints. Proof construction is outside the frame operation sample and followed by GC. It stores hashes, not worlds. No source mutation, canonical placement/maturity change, or model substitution is permitted.

After explicit authorization, run sequentially (never in parallel):

```sh
node --expose-gc /private/tmp/sansu-world-index-sharing/diagnose.mjs before --start > /private/tmp/sansu-world-index-sharing/before-execution.log.txt 2>&1
node --expose-gc /private/tmp/sansu-world-index-sharing/diagnose.mjs after --start > /private/tmp/sansu-world-index-sharing/after-execution.log.txt 2>&1
node /private/tmp/sansu-world-index-sharing/compare.mjs > /private/tmp/sansu-world-index-sharing/comparison.log.txt 2>&1
```

Each process refuses an existing output directory. If a run fails, preserve all raw data and create a new explicit attempt; do not overwrite. At exit, local inputs, reviewed source/test/driver, c1 input closure, and installed dependencies must still match their starting SHA. If the shared checkout changes, stop and repin the reviewed inputs with root rather than silently ignoring the mismatch.

Expected effect, **unmeasured**: remove one duplicate current-floor search index per identity world, including its fine-bucket arrays. This is not half of total heap: anchor/mixed-original samplers, definition/compiled copies, support indices, multiple cached worlds and temporary stage compilations remain. The `compare.mjs` result will distinguish retained heap from sampled after-call heap and RSS. It cannot establish true peak, browser stability, full acquisition, actor access or product acceptance.

## Executed comparison (2026-10-12)

Root authorized sequential execution after preparation review. Both first runs and the comparison completed without a retry or safety stop. All local, reviewed-file, c1, and installed dependency hashes matched before/after.

Compare **only this new before/after pair**. The earlier attempt-02 used different caller retention and checkpoint timing, so its numbers must not be subtracted from this run.

| State | Before retained MiB | After retained MiB | Reduction MiB | Before sampled after-call MiB | After sampled after-call MiB |
| --- | ---: | ---: | ---: | ---: | ---: |
| baseline32 | 952.43 | 888.57 | 63.87 | 1161.84 | 1991.57 |
| preview-l33 | 1436.59 | 1355.45 | 81.14 | 2653.37 | 1511.43 |
| commit-l33 | 1764.55 | 1668.89 | 95.65 | 1930.60 | 1823.79 |

All three states matched exact physical/source/render payloads, sites/plans/revisions and 18,837 footprint query sets (with physical inverse queries). Each final world has 146,482 floor triangles and 75 rights. This confirms the tested output parity and a 5.42–6.71% retained-heap reduction in this pair. It does not establish general performance acceptance.

The baseline sampled after-call heap **increased** from 1,161.84 to 1,991.57 MiB. Samples are affected by GC timing and do not locate the true peak. Do not report a universal/transient-peak reduction. The final state still retains 1,668.89 MiB; the substantial remaining cost and full browser journey remain separate concerns.

Raw results: `before/`, `after/`, `before-execution.log.txt`, `after-execution.log.txt`, `comparison.json`, `comparison.log.txt`. The preparation manifest is historical and pins the pre-execution README; archive-proof records final bytes.
