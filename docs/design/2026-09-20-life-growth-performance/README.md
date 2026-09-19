# Life opening follow-up and growth integration

Baseline: production `eb65d7c`. Candidate: `life-growth-fast-path-v1`. This changes only growth integration CPU work; no UI, saved format or reward rule changes.

## Public observation

[Public diagnostic](public-before.json) uses public JS in a disposable desktop Chromium profile with six synthetic furnishings and 100 synthetic credits. It never reads a user's save. The first 7-day replay spent 1,613 ms between world read completion and write start; immediate reload spent 11 ms, or 44.6 ms at CPU 4× slowdown. First-frame markers were 2,222 ms, 927 ms and 1,256 ms respectively. This confirms persisted replay reuse works in the deployed build. PNG encoding calls are absent, and production runtime GLB assets remain disabled.

The first-frame marker is CPU render completion, not compositor paint. The following two-animation-frame opportunity remained about one second later in this headless environment, even on same-document return. It cannot be attributed wholly to replay or translated directly into phone GPU performance. No real user device was measured.

## Change

Every resident tick integrates plant growth. If no completion or 24-hour expiry falls strictly inside the interval, compute its constant rate in one validating pass. Skip the temporary arrays, Set, sorting and repeated scans. Intervals crossing a boundary retain the original integration. Invalid values are still rejected even for zero-duration intervals.

The independent frozen formula agrees exactly across 2,000 deterministic randomized intervals and explicit start/expiry/zero boundaries. [Growth benchmark](growth-benchmark.json) compares 100,000 intervals with 0/6/100 completion times. [Whole replay comparison](replay-benchmark.json) substitutes only the old growth function into otherwise identical code and compares the complete final state hash for 1-day and 7-day replay. These are synthetic CPU diagnostics, not promised page-loading times.

Reproduce with `node tools/benchmark-life-growth.mjs` and `node tools/benchmark-life-growth-replay.mjs`. The latter intentionally pins old rules to `eb65d7c` and uses the tracked disposable storage fixture. Core and runtime verification results follow below.

## Experience and remaining work

Visual appeal and comprehension: unchanged assets, layout, labels and interactions; no new participant evaluation. Runtime integrity: exact arithmetic and whole-state equivalence are the primary gate. Remaining costs include route planning, scene creation and first-frame GPU work; this change does not claim to eliminate them. Persisted cache misses after new history/deployments still use full replay.

## Final CPU diagnostic

After the regression suite finished (no concurrent test/build workload from this task), the six-item CPU replay measured 383.6 → 326.1 ms at 24 hours (15.0% reduction), and 2,438.8 → 2,003.6 ms at 168 hours (17.8%). Both complete state hashes match. This is one diagnostic run, not a cross-device performance guarantee. The earlier overlapping-test timing was discarded from final comparison.

`npm run verify:core`: PASS, 436 files / 4,076 tests, including persisted replay equivalence and invalid-cache recovery. Island/Life-enabled production build and asset budget: PASS. New benchmark tools: targeted ESLint PASS. [Build manifest](build-manifest.json) binds the local production candidate to exact source/dist hashes; its revision label is synthetic, not a deployed revision.

Final runtime checks: smoke PASS (31 cases). [Production storage report](storage-report.json) PASS at 390×844 and 768×1024 (tablet reduced motion), including real learning, purchase, offline move/storage/answer, explicit failed island save with native answer retained, retry and reconnect. [Phone](phone-reconnected.png), [tablet](tablet-reconnected.png). Source and distribution hashes were stable from start to finish. User-device latency and new-code public latency remain unmeasured.
