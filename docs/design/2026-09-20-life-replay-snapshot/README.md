# Life persisted replay projection

Candidate: `life-replay-snapshot-v1`, based on `8d61bae`. This is a CPU/storage change; artwork, learning and rewards are unchanged.

## Contract and rollback

`LifeRecord.replaySnapshot` is an optional, disposable projection saved in the same existing `worlds` transaction as the authoritative record. It adds no store or database version and never removes actions, credits or migration backups. Deleting it restores the prior behavior. Old clients ignore it; writes made by old clients invalidate it through the build, history or timestamp checks.

The snapshot carries a format, exact app-build token, full existing replay key, state and SHA-256 checksum. On reopening, restore requires matching owner/history/cutovers, exact saved logical time, supported cadence and build, and valid checksum. The ordinary replay and migration checks remain in place. The checksum detects accidental corruption; it is not an authentication mechanism against a person editing both the data and checksum.

The memory cache receives only the verified snapshot. It then advances the elapsed time using the existing simulation. New credits or commands change the replay key and trigger full replay before saving a fresh projection. Requests for earlier times still use the original event history. Every new deployment intentionally invalidates the projection so simulation dependency changes cannot reuse stale results. First open after deployment or changed history can still be slow; a 7-day unattended interval still needs 7 days of simulation. This change chiefly removes repeated historical work across page reloads.

Projection construction failure falls back to saving without a snapshot. A database write failure rolls back the entire record and retains the existing retry flow. Owner deletion also deletes the embedded projection. No native learning stores are changed.

## Verification

Focused tests compare entire accelerated states with cold full replay at 1 and 7 days, then after a same-time purchase/move and new learning fact. They cover changed history, foreign owner, changed clock/build, missing/corrupt projection, historical replay and failed transactional writes. Full replay is deliberately expensive: the initial 30-second test deadline was insufficient for multiple 7-day baselines, so this one regression has a 120-second deadline; the unchanged test assertions then passed.

Browser evidence uses disposable local profiles only. A legacy production harness stopped at its obsolete wallet-title assertion (before testing snapshots); the current Life storage harness covers actual learning, purchase, offline storage and explicit projection-write failure/retry. An exploratory storage run also overlapped a rebuild of its served directory and failed during update navigation; it is not acceptance evidence. The final storage run uses a frozen source and distribution manifest. See final results below.

## Experience gates

Visual appeal: no visual change; this is not a new art review. Silent comprehension/safety: existing UI, labels and retry actions remain unchanged. Runtime integrity: independent state-equivalence, persistence and browser checks are required; synthetic CPU timings are not end-to-end user-device loading times.

## CPU results and build identity

[Benchmark](benchmark.json): same-state cold replay versus snapshot verification/restore was 2,781 ms versus 1.35 ms at 24 hours, and 10,527 ms versus 1.02 ms at 168 hours. Snapshot JSON was approximately 7 KB. This includes snapshot hashing and cloning, but excludes IndexedDB IO, rendering and the next unattended interval; it does not predict complete page-opening time. There is no timing threshold assertion.

[Build manifest](build-manifest.json) records the exact source/distribution hashes and local production version. The fixed build enables Island and Life with preview disabled; the synthetic build revision is `replay-snapshot-v1`, not a claim of a deployed commit.

`npm run verify:core`: PASS (435 files / 4,074 tests), including lint, typecheck, docs, default build and asset budget. Life-enabled production build and asset budget: PASS. The application inputs were tested in an isolated copy of the baseline plus this change; unrelated shared working changes are excluded.

Final acceptance: `npm run e2e:smoke` PASS (31 cases). [Frozen production storage report](storage-report.json) PASS for phone and tablet (reduced motion): real onboarding, three real answers, purchase, offline reload/move/storage/learning, injected Life write failure with native answer preserved, retry exactly once and reconnect. All five saved stages carry a snapshot at the record time with the actual build token. [Phone](phone-reconnected.png), [tablet](tablet-reconnected.png). Full state equality and corruption fallback are unit evidence, separate from these genuine UI journeys. Real iOS/Android and a real user save have not been measured.
