# Shoulder c1 — first regression execution

This archive preserves the first sequential regression execution for `authored-shoulder-c1`. The overall result is **FAIL**. The source candidate and drivers were not changed or retried during this run.

- Floor A/B passed: 10 captures / 5 pairs. Its [root-owned archive](../regressions/01-floor-shading-ab/report.json) is unchanged by this archive operation.
- Shoulder full aborted in Node/V8 during the `acquisition:explicit-diagnostic-18h` phase after 1,159.636 seconds (driver exit `-6`, outer runner exit `1`). Five acquisition PNGs exist: initial 32, three young purchase previews, and young 35 whole. Mature acquisition and fixed-35 full acceptance were not completed.
- The driver did not create `actual/report.json`. The original [stage report](../regressions/02-shoulder-full/report.json) and [outer report](report.json) retain `missing-tool-report`; neither was rewritten to substitute a diagnosis.
- The [raw execution log](../regressions/02-shoulder-full/execution.log.txt) records `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory` around a 4,080 MB heap. This establishes a Node/V8 OOM, not a browser wait timeout or the 3,600-second outer deadline. The exact memory-retention cause is outside this archive task.
- The remaining six stages were not executed: baseline27 editing, wide27 water, authored flower full, authored cove full, ordinary Growing balance, and classic smoke.
- All 6,398 local input hashes and all 6 installed dependency hashes matched before/after. `sourceFixed` and `installedDependenciesFixed` are both true. These integrity results do not convert the incomplete shoulder run into acceptance.

The separate [terminal diagnosis](regression-first-terminal.json), [last driver progress](../regressions/02-shoulder-full/actual/progress.json), and [outer execution log](execution.log.txt) retain the observed failure and scope. [Process cleanup evidence](regression-process-cleanup.json) found no process remaining in the owned driver PID/process group `89811`; no kill was needed. Root-owned Vite PID `87576` on port `5358` was observed and retained.

## Runner-only correction before execution

The prepared runner originally applied shoulder-specific checks to the cove stage. Before any regression execution, the cove contract was corrected to 10 captures, 4 ordered edits, and 1 successful canvas selection, with the expected revision/full scope/no-shoulder conditions. Generic error extraction also recognizes shoulder `firstFailure.error`.

The [executed runner](../runner-records/regressions.py) SHA-256 is `deffbce627f91546e83a4fbbbf24745162613a15efa76478e84ead275f40b333`. The [unaltered original](../runner-records/runner-cove-contract-fix/original-regressions.py.txt) SHA-256 is `e7f1e1e24d675128bb38e1dce9a9a8570a384da8ff62442ce0c4e8c208760add`. See the [exact diff](../runner-records/runner-cove-contract-fix/runner-only.diff), [correction record](../runner-records/runner-cove-contract-fix/report.json), [contract audit](../runner-records/runner-cove-contract-fix/contract-audit.json), and [execution handoff](../runner-records/execution-handoff.json). Six historical actual report shapes and two new statically reviewed driver shapes were checked; this audit is not a substitute for new browser execution.

## Preservation

The [archive proof](archive-proof.json) records source-before, source-after, and destination SHA-256 for all 22 copied files (6,056,414 bytes). All copied bytes match. It also verifies all 14 pre-existing files in the floor A/B archive remained unchanged. Absolute `/private/tmp/...` paths in raw reports are intentionally preserved rather than rewritten. The [archive script](../runner-records/archive-first-regression.py) refuses to overwrite existing owned destinations. No missing report, missing screenshot, or later-stage success was synthesized.
