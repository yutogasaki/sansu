# c3 water-support reuse — prepare/seal only

The authorized source delta is exactly `authoredWaterBridge.ts`, `authoredWaterWorld.ts`, and `authoredWaterBridge.test.ts`. Their bytes must match the root-owned water-support-reuse focused evidence. No other main file is copied. Main's `src/tools/prototypes/public` path set and SHA maps must equal c2 except for these three files, before and after copying.

`clone-candidate.mjs` reads c2's original snapshot file set, validates every c2 byte, and makes an independent APFS copy-on-write clone with a direct macOS `clonefile(2)` call with no fallback. It rejects hard links and never falls back to a full copy. The snapshot excludes generated `dist/` and `node_modules/`. The installed-module symlink points to the same real installed directory, separately hashed by the actual shoulder projection collector plus installed lock. All c2 evidence and candidate files remain unchanged. Main's new docs/art are not copied; the c2 documentation snapshot remains the exact verification input. New provenance is outside the c3 candidate.

Preparation command:

```sh
python3 /private/tmp/sansu-authored-shoulder-c3/prepared/preflight.py --start
```

This performs clone → closure → installed-dependency collector → eight-driver static import audit → real shoulder read-only input collector → snapshot seal. It stops at the first failure, keeping fresh `.log.txt` files. This changes the c2 single-copy snapshot into a clone step followed by a read-only seal, so the dependency audits can inspect the actual isolated candidate. It does not run a driver, browser, build, tests or core.

The closure inherits c2's verified input names and recollects the candidate's full trees, imports, source bundles, config and document targets. Sealing requires an identical closure path set with exactly three changed hashes, unchanged installed dependencies, all snapshot-file bytes equal to the clone proof, and passing static/import/harness audits. This is operational immutability with hash verification, not a permission change to source files.

## Planned verification, not executed by this preparation

1. Root's existing focused record: 2 files / 30 tests, target ESLint and typecheck passed on the three new file hashes. It records tool return values, not saved raw stdout, and is not relabelled as a c3 result.
2. After separate root authorization, `python3 /private/tmp/sansu-authored-shoulder-c3/prepared/core.py --start` runs the actual candidate's `npm run verify:core`: docs/current-entry/lint/typecheck/full unit tests/build/assets. Flags are Island=true and native=false, revision `authored-shoulder-c3`. The wrapper uses a 7,200 second outer deadline, first-failure preservation, and full source/installed hashes before and after. Actual test counts come from the raw log; no expected count is hardcoded.
3. After terminal core PASS, inspect normal-false distribution boundaries and run the affected actual water/shoulder editing journeys against a separately identified server. Those commands, ports and timing remain root-owned future authorization. No all-eight regression sequence or server is started/prepared for automatic execution here. Existing c2 all-eight PASS remains evidence for c2 only.

This covers a narrow domain compile-reuse implementation. Performance improvement, visual appeal, M1, PWA/release or full product acceptance are not established by preflight/core or by prior c2 results. ROI attempt 02 remains an independently archived raw FAIL due to favicon 404; no retry is included.

The first preflight failed before copying any file because Node v24.18 `COPYFILE_FICLONE_FORCE` returned ENOSYS. Its original scripts/logs are preserved under `preparation-history/attempt-01-node-enosys/`. A separate throwaway probe confirmed `/bin/cp -c` and direct `clonefile(2)` succeed with separate inodes, matching initial SHA and independent destination writes. Since cp may silently fall back, only the direct syscall is used for the candidate. The newly authorized run writes `preflight-attempt-02/`; no previous failure is overwritten.
