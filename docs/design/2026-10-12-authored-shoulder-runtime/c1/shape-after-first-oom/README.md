# Shoulder c1 — shape-only diagnosis after first OOM

This independent diagnosis **passed** against the same immutable `authored-shoulder-c1` candidate and root-owned server on port `5358`. It does not replace the [first full regression FAIL](../regression-summary/README.md), which remains a Node/V8 heap OOM during acquisition maturity. No acquisition or editing journey was retried here.

The original, unchanged driver ran with `SHAPE_ONLY=1`, the same build identity, and the completed c1 core report. The frozen `shoulder35` reference produced exactly two desktop captures at 1280 × 900:

- [Whole view](actual/fixed35-desktop-whole-day.png)
- [l34 close view](actual/fixed35-desktop-hill-close-day.png)

The driver skipped acquisition, editing, rotation, phone, and tablet branches. It retained the initial/final settled-state checks, actual guarded access for all 35 owners, placed-pose checks, source identities, and runtime flags. Both driver and outer runner exited `0`; elapsed outer time was 262.960 seconds within the 900-second diagnostic deadline. This timing is not performance acceptance. `diagnosticOnly=true` and `fullJourneyAccepted=false` are explicit in the [outer report](report.json).

Integrity checks passed: all 6,398 local input hashes and 6 installed dependency hashes match before/after; the driver's actual 2,127 input hashes match the previously collected set and the core subset. Core/snapshot/driver/first-failure evidence remained unchanged. The outer inspection has no failed checks, both screenshot SHA values match, and the runner-owned process group had already exited. The root-owned Vite server was not stopped.

Raw evidence is preserved in the [driver report](actual/report.json), [driver execution log](execution.log.txt), [progress record](actual/progress.json), and [outer stdout](runner-execution.log.txt). The [executed runner](runner.py) has SHA-256 `1fa185634a17386a83f251732b87f513b32532c02824f9ed72d684a3a98b48c1`; [preparation evidence](preparation.json) records the static branch review. The runner used the unchanged driver SHA-256 `c31ad10110bc641e3edffb12de36075ee2eb23885241c807203e8f4bf764f29d`.

[Copy proof](archive-proof.json) records every original-before/original-after/destination SHA and confirms the first failed shoulder archive's 8 files were unchanged. Raw paths and results were not rewritten. This evidence establishes only the executed shape diagnosis; art quality, child acceptance, full acquisition/editing, mobile, and whole-M1 completion remain outside its acceptance scope.
