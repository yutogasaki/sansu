# ROI attempt 02 — three captures acquired; raw run FAIL

The authorized single run exited **1**, preserving the all-errors gate. Its sole recorded error is a console 404 whose location identifies `http://127.0.0.1:5359/favicon.ico`. It was not excluded. The run acquired all three requested images and checked all instrumented invariants before that final gate. This archive does not replace the raw FAIL with PASS or retrospectively identify attempt 01's URL.

The browser console provides the URL and 404 text. The page response/requestfailed listeners did not observe this browser-level request, so response-body/resource-type evidence is absent and is not invented. No shader error was recorded. See [raw report](raw/actual-02/report.json), [final network evidence](raw/actual-02/network-errors-final.json), [terminal summary](raw/execution-02/terminal-summary.json), [outer result](raw/execution-02/result.json), and [execution log](raw/execution-02/execution.log.txt).

## Actual acquisition and invariants

- [Shadow-off baseline](raw/actual-02/1280-hill-close-source-shadow-off.png)
- [ROI face-normal](raw/actual-02/1280-hill-close-source-roi-face-normal.png)
- [Restored shadow-off](raw/actual-02/1280-hill-close-source-restored-shadow-off.png)

The actual target matches source triangles 36705/36710 at index offsets 118563/118578 in material group 0 (`start=8448`, `count=114021`). All 54 groups and prior position/normal/color/index hashes match. The three capture invariant hashes are identical: `0d04b99f959f74119d940a64688fd3b2f522ccd31cb1c4a59b0099152d67e08c`.

Two onBeforeCompile records and actual post-intervention draws were observed. [Full shader evidence](raw/actual-02/shader-evidence.json) preserves both generated programs, ROI uniforms and treatment of `normal` plus `nonPerturbedNormal`. Only the cloned material's shader changed; geometry/normal/color/index buffers, groups, camera, light, renderer, canonical state and walking topology remained invariant. Original material identity, receiveShadow and Scene hook were restored; one clone was disposed.

The original actual projection's indices 12 and 13 are `-0`, while JSON target entries are `0`. [Pre-assert raw evidence](raw/actual-02/shadow-off-pre-assert.json) retains number tokens and negative-zero indices before comparison. Only signed zero was canonicalized; all three canonical comparisons have no mismatches. No tolerance or geometry/shader change was added for this comparison.

Execution was 2026-10-12 05:18:55.286–05:19:44.385 UTC, 49.099 seconds, Node/PGID 38695. Peak observed process-tree RSS was 3,126,067,200 bytes; neither the 900 second nor 4 GiB boundary was reached. Source 6,460 / installed 6 and browser dependencies were stable. The owned group was empty, no cleanup signals were needed, and root Vite 5359 was untouched. Timing is not performance evidence.

All preparation and raw files are byte-identical under `raw/`; only program filename suffixes become `.mjs.txt` or `.py.txt`. [Archive proof](archive-proof.json) records each path/hash and before/after equality. Historical readiness/README claims of “not executed” describe preparation and remain unchanged. [Attempt 01](../roi-attempt-01/README.md) is independently preserved. No candidate/app/source edit or further retry was made. Visual comparison remains root-owned; this is not art, repair, M1 or product acceptance.
