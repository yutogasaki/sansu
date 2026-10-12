# Shoulder c3 — sealed preparation, core not started

The new candidate is `/private/tmp/sansu-authored-shoulder-c3/candidate`, revision `authored-shoulder-c3`. It contains 20,775 independently cloned c2 snapshot files with exactly three replacements from main: authoredWaterBridge.ts, authoredWaterWorld.ts and authoredWaterBridge.test.ts. The clone validates all c2 snapshot bytes, the complete main/c2 src/tools/prototypes/public path and SHA maps, and the root-owned before/after hashes. Main and c2 remain unchanged. Generated dist is absent; the existing installed-module directory is shared and separately hashed.

Preparation **PASS**: 6,460 local closure inputs, 6 installed dependencies, 8 driver static imports, 90 domain projection imports and 2,127 actual shoulder input-collector inputs. The closure path set equals c2, with exactly those three changed hashes. Every candidate file matches the snapshot/copy proof. No core, build, test, browser, or server was started by this preparation.

The first preparation attempt failed at the first copy with Node `COPYFILE_FICLONE_FORCE` ENOSYS. No source file was copied. Its original scripts/logs and empty partial candidate are preserved in temporary history, with raw evidence archived here. The separately authorized attempt02 used direct macOS `clonefile(2)` after throwaway `/bin/cp -c` and direct-syscall probes verified distinct inodes, initial SHA equality and independent destination mutation. The native syscall fails instead of falling back to full copying or hard links. Free storage remained about 13 GiB after cloning. This is preparation bookkeeping, not performance evidence.

See [readiness and all script hashes](raw/readiness.json), [snapshot](raw/snapshot.json), [copy proof](raw/candidate-copy.json), [successful preflight](raw/preflight-attempt-02/report.json), [first failure](raw/preflight/report.json), [native clone probe](raw/clone-probe/report.json), [input audit](raw/closure/driver-input-audit.json), [import audit](raw/closure/import-audit.json), and [archive proof](archive-proof.json). Copied program and historical Markdown names gain `.txt`; bytes are unchanged and every mapping is recorded.

Snapshot SHA256: `e585e81b2ae462ff673883bde384d7511c167582250ed4cb13c5dc1e46444451`.

Closure SHA256: `aff1e4d3c12b82d74db7c08da5c1f4db6c063151372b6de47f893cca6ad98722`.

Core runner SHA256: `cabaa8ee5a9f4c2e1759a54864ffeae27ff89cdc9ebfd7c23001341d7e0cebc4`.

## Pending verification

The [verification plan](raw/verification-plan.json) separates root's earlier 2-file/30-test focused PASS from unexecuted c3 integration. After separate authorization, `python3 /private/tmp/sansu-authored-shoulder-c3/prepared/core.py --start` runs the full package verify:core sequence (docs, entry checks, lint, typecheck, full unit tests, build/assets) with Island=true/native=false and a 7,200 second outer deadline. Actual counts must come from its raw log. Then inspect the normal-false build boundary and run the affected real water/shoulder editing checks against an identified candidate server. No all-eight rerun is scheduled by this preparation; c2 results remain c2 evidence.

The archived [focused source-change record](source-change-evidence/focused-checks.json) reports root's completed tool return values, not saved raw stdout; it is not relabelled as a c3 rerun. Performance gain, art appeal, M1, PWA/release and product acceptance remain separate. ROI attempt02 remains a separate raw FAIL due to the favicon 404, with no retry here.
