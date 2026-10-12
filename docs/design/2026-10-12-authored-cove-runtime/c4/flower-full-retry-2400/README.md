# c4 full flower retry: PASS

This is one independent complete flower attempt on the same fixed c4 candidate and driver. The external command limit alone changed from 900 to 2,400 seconds. The [initial 900-second timeout](../regressions/README.md) remains preserved and is not relabeled. No automatic retry occurred inside this run.

Candidate: `/private/tmp/sansu-authored-cove-c4/candidate`; build `authored-cove-c4`; existing server `http://127.0.0.1:5357`; authored route `water=wide&reference=preflight32&cove=false`. Driver, internal timeouts and assertions match the fixed core input hash. The initial/final 2,137 candidate hashes, core, snapshot, driver raw subset, capture build/cove metadata and full-scope counts are recorded in `archive-proof.json`. Working-repository differences are informational only, because that repository can advance separately from the fixed candidate.

Result: **PASS**. Observed runner exit code: 0. Failure phase: `None`. A passing run requires 12 captures, four canvas selections, four passing edits, both mature and young references, no raw errors and sourceClosureUnchanged=true. Partial evidence never substitutes for that full gate.

`raw/` contains byte-identical output, scripts and logs from this independent attempt; the proof verifies source-before/source-after/destination SHA256 and byte sizes. This README, archive proof and archive log are additive. No browser, core or build was run during archiving. Timing diagnostics do not establish product performance acceptance, and this result does not establish fresh acquisition, personal-save migration, physical touch hardware, independent art/understanding, or complete M1 acceptance.
