# Shoulder c1 — executed runner records

These files preserve the runner-only correction made before the first regression sequence. No app, frozen candidate, or driver was modified by that correction.

- [Executed runner](regressions.py) and [current execution handoff](execution-handoff.json).
- [Original runner](runner-cove-contract-fix/original-regressions.py.txt), [original handoff](runner-cove-contract-fix/original-execution-handoff.json), [byte/hash correction report](runner-cove-contract-fix/report.json), and [exact diff](runner-cove-contract-fix/runner-only.diff).
- [Contract audit script](runner-cove-contract-fix/audit-contracts.py), [raw audit log](runner-cove-contract-fix/audit.log.txt), and [audit report](runner-cove-contract-fix/contract-audit.json).
- [Archive script](archive-first-regression.py), [copy proof](../regression-summary/archive-proof.json), and [first execution outcome](../regression-summary/README.md).

Raw files retain their original absolute paths and byte contents. The first execution stopped at the shoulder Node/V8 OOM; no automatic retry occurred.
