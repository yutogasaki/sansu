# ROI attempt 01 — first harness failure preserved

The single authorized run exited **1** at 2026-10-12 05:09:37 UTC after 32.528 seconds. It stopped before the ROI material intervention or any screenshot: **0 captures, no shader compilation evidence**. The original material and Scene hook were restored, no clone was created, and the owned process group was empty at exit. Root's Vite 5359 server was untouched.

The first assertion compared an in-memory orthographic projection containing `-0` with the same projection read through JSON, which represents those entries as `0`. Node strict equality distinguishes their signs. This is a harness representation failure; it does not test or disprove the local shading hypothesis. Exact nonzero projection entries were not relaxed. The failure followed target/index/normal/group checks, but the observation had not yet been saved, so no persisted target-match capture is claimed.

A separate console 404 was recorded without URL, location, resource type or response body. It remains **unclassified**. Favicon is only a hypothesis; no error is dismissed. A later attempt must capture this evidence while keeping unknown 404 and shader errors fatal.

Peak observed process-tree RSS was 3,156,967,424 bytes; neither the 4 GiB nor 900 second limit was reached. Source 6,460 / installed 6 and browser-driver dependencies were unchanged. These bounds and elapsed time are diagnostic bookkeeping, not performance acceptance.

Every one of the original directory's 30 files is copied byte-for-byte under `raw/`. Program filenames alone gain `.txt` to remain inert. Historical preparation README/readiness files still say “not executed”; they are preserved history, not the final status. The final status is the original [terminal summary](raw/execution-01/terminal-summary.json), [outer result](raw/execution-01/result.json), [raw report](raw/actual-01/report.json), and [execution log](raw/execution-01/execution.log.txt). [Archive proof](archive-proof.json) maps all paths and verifies every byte before and after copying.

No candidate, application, source mesh, earlier root diagnostic, or raw failure record was changed. This archive is not visual acceptance, a geometry repair, or an M1 pass.
