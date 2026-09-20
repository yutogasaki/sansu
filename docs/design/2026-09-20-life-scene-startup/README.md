# Life scene construction and growth budgets

Baseline: `788db3f`; candidate: `life-scene-residents-only-v1`. This preserves the existing visual candidate and changes scene construction only.

## Latest public opening

[Public measurement](public-before.json) uses public JS in a disposable Chromium profile, synthetic six-item/100-credit data and a 390×844 viewport. It is not a real user save or device. Persisted replay continues to avoid old-history recalculation. Initial 7-day processing still costs approximately 1.34 seconds before writing; first-frame CPU completion is approximately 1.98 seconds. A roughly 1-second delay remains before the following two RAF opportunity in this headless environment. The marker does not prove actual compositor paint, and the gap is not attributed entirely to scene construction.

## Construction change

Life previously built the Home Journey terrain, house, furniture, patchwork otter and parcel, then disposed those unused geometries. It now requests residents only and directly builds its natural otter. The prototype default remains unchanged. Heritage houses also call the original batched cottage factory directly, avoiding discarded paths, bushes, rocks and flowers. House, landscape, shadows, camera, interactions and animation are unchanged.

TRANSFER: every visible geometry buffer, mesh transform, material/texture content and resident identity. DO NOT TRANSFER: legacy geometry constructed only to be discarded. No new artwork, art direction, UI or learning behavior.

[Scene comparison](scene-benchmark.json) constructs the actual Life renderer content at 0, 30 and 100 placed items. It substitutes the baseline Life builder for the before run. Complete rendered-node geometry/material/transform hashes agree. Construction counters also record temporary geometry allocations. These are CPU diagnostics and do not establish that the full screen's one-second delay is resolved.

## Regression limits

The new `sceneBudget.test.ts` runs in the normal test suite. Limits apply to fixed synthetic fixtures, not player placement caps or hardware guarantees:

| Items | Geometry construction ceiling | Mesh ceiling | Triangle ceiling | Geometry arrays ceiling |
| --- | ---: | ---: | ---: | ---: |
| 0 | 700 | 135 | 67,000 | 4.5 MiB |
| 30 | 2,500 | 290 | 205,000 | 14 MiB |
| 100 | 6,800 | 650 | 530,000 | 36 MiB |

All three fixtures also limit distinct textures to 6 and estimated RGBA8+mip texture bytes to 16 MiB. Geometry bytes count unique CPU buffers; texture bytes are an estimate and exclude driver overhead/render targets. The existing build asset-budget checker continues to limit transfer/precache bytes. Timing remains a comparative diagnostic because CI/headless hardware is variable. Deliberate asset changes must update budgets with new measured evidence, rather than silently raising ceilings.

These fixtures use current production procedural assets; generated GLB runtime assets remain off. Existing generated-asset stress evidence remains separate. An island with many unique future materials is not proven safe by shared-instance counts alone.

## Gates

Visual parity: geometry/material identity plus runtime screen comparison; no new art claim or participant score. Silent comprehension/safety: unchanged controls and learning flows. Runtime integrity: core, smoke and production offline journey results recorded below. Actual phone GPU timing remains unverified.

[GPU probe](gpu.json) confirms Headless Chromium 145 uses ANGLE/SwiftShader, DPR 1. The remaining compositor/RAF delay is not evidence for degrading real-device visual quality. [Public baseline screen](public-before.png).

## Final construction result

Each fixture now constructs exactly 704 fewer BufferGeometry objects (including temporary geometry). Empty-island construction falls from 1,324 objects to 620; 30 items from 2,994 to 2,290; 100 items from 6,994 to 6,290. Retained geometry/material/transform hashes are identical.

Median CPU times were 126.9→79.2 ms (empty), 159.2→119.3 ms (30), and 267.4→309.1 ms (100). The 100-item timing did not improve in this run; shared-host load and GC vary, so no universal latency reduction or frame-rate guarantee is claimed. Reduced allocation count is the stable result. The 0/30/100 resource ceilings run automatically with unit tests.

The first complete suite had four unrelated learning/storage timeouts while another checkout was testing concurrently. The same three files / 35 tests passed with one worker and unchanged deadlines. The final unchanged application run with two workers passed all 437 files / 4,079 tests. After adding construction-count ceilings to the test only, all three budget cases passed again; runtime sources stayed unchanged. Production browser checks follow.

## Verification

- Docs, lint and typecheck passed on the isolated application candidate. The initial combined core command stopped on the four timeouts described above; it is not labeled a clean `verify:core` run. The subsequent complete test run passed 4,079 tests.
- Final construction-budget tests: 3/3 PASS; final production build and asset check PASS; smoke: 31/31 PASS.
- [Build manifest](build-manifest.json) records the exact source and dist SHA-256 values, build revision and flags. [Screen target](screen-target.json) records the actual rendered Life candidate `moon-garden-v1`; the generic version manifest also carries legacy resident metadata and does not override that observed target.
- [Empty candidate screen](after-empty.png) matches the public baseline house, terrain, materials, shadows and controls; moving resident poses differ with capture time.

This is a scene-construction regression verification, not a full release/device certification. Real iOS/Android GPU timing, two-build updates and participant comprehension were not measured in this change.

Production-preview phone (390×844, normal motion) and tablet (768×1024, reduced motion) both passed [the actual UI/storage journey](storage-report.json): onboarding, three real introductory answers, earned-credit purchase, real SW offline reload, move/store, offline answer, explicit Life-write failure with native answer retained, retry and reconnect. Source hash matched before/after. [Critical-path contact sheet](contact-sheet.html) includes purchase, offline storage, fault and recovery. No injected credits or saved ownership were used.

Visual parity gate: PASS for unchanged presentation at the observed views. Silent comprehension/safety: controls and recovery retained, no new participant evidence. Runtime integrity: PASS for the checks above; full device/release certification remains outside this evidence.
