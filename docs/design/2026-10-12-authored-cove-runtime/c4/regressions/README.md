# c4 regression results and first failure

Four stages passed. The fifth full flower run is **FAIL / incomplete**, stopped at the fixed external 900-second deadline during `rotate-whole`. The runner terminated with exit code 1 (session 71587); flower PID 68908 was confirmed exited. No automatic retry or limit change occurred.

| Stage | Result | Recorded checks | Captures | Raw input evidence |
| --- | --- | --- | --- | --- |
| baseline27 editing | PASS | 6 steps | 7 | 1,581 before/after subset |
| wide27 water | PASS | 6 string steps | 14 | 1,585 before/after subset |
| ordinary Growing balance | PASS | 8 scenarios | 22 | 1,580 before/after subset |
| isolated classic smoke | PASS | 32 scenarios | not reported | matching harness SHA; outer closure |
| full flower, cove=false | FAIL / incomplete | 4 canvas selections, 4 passing edits, 6 selections | 4 | 1,899 initial subset only; final inputs absent |

## First failure and unfinished scope

The first meaningful failure is the outer runner's 900-second command deadline. Its process-group termination closed the browser during `whole()` / `rotate-whole`; the raw report records `locator.scrollIntoViewIfNeeded: Target page, context or browser has been closed`. The report does not establish a pre-timeout app assertion failure or a successful full flower run.

The flower raw records successful cancel, move/split, store and restore/reconnect edits, four canvas selections, and mature desktop captures. Rotation completion and rotated captures, tablet/phone whole and close views, young-reference load/captures, and the final driver input check remain unfinished. `sourceClosureUnchanged` and `finalInputs` were never recorded. The runner's raw-subset mismatch rows contain missing final values; they are preserved, but are not evidence of changed source bytes.

All 2,137 fixed candidate inputs match core before/after, snapshot, outer before/after and every stage before/after, and a further candidate hash read after copying. The current working repository has root's separately recorded next-work contract edit in `docs/ai/verification_matrix.md`; original bytes remain fixed in the c4 candidate. Current repository equality is not claimed. Exact working-repository differences are recorded in `archive-proof.json`. No app source difference was allowed.

## Build identity and classic limitation

Every available non-classic capture records build/revision `authored-cove-c4`. The four flower captures have cove=false, mature reference and `native05-authored-flower-garden-v3`; they do not establish young-reference coverage. Authored routes explicitly use native art although the fixed server default is native=false and Island=true.

Classic used `npm run e2e:smoke` from the fixed candidate cwd, command PID 68382, and its own server at `http://127.0.0.1:4173`. Its environment was Island=false, native=false, classic-v1, with runner-wide `SANSU_BUILD_REVISION=authored-cove-c4`. Its dedicated startup, fixed 2,137-input closure, harness SHA and 32 passing results support provenance. PID 68382 identifies the command process; a separate child Vite PID is not asserted.

The classic raw report has no captured screen build value: that value remains **not obtained**. Supplemental HTTP responses and the initial parser's false result are retained. The parser expected an inline value but received `__BUILD_REVISION__`. A later env-module read encountered connection refused after normal classic completion and server cleanup. This supplemental observation did not alter the regression result; no retry or extra browser was started.

## Archive and interpretation

All temporary regression files are copied byte-for-byte, including the first failure, captures, logs, supplemental observation, prepared success-only archive helper (not executed), and executed failure archive helper. The manifest proves source-before/source-after/destination SHA256 equality. This README, proof, archive execution log and derived timing analysis are additive; copied raw reports are unchanged. Prior c2/c3 failure evidence remains separate.

Timing/frame markers remain diagnostics and do not establish product performance acceptance. Synthetic authored fixtures do not establish fresh acquisition, natural growth, personal-save migration, physical touch hardware, independent art/understanding, general cove source applicability, complete M1 or release acceptance. Ordinary Growing uses disposable preview profiles and its driver-defined learning flow; late-save fixtures remain explicit. No source, core, build or browser was rerun for archive.
