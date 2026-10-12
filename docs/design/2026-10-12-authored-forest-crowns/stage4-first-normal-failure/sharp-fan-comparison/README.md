# Completed sharp-fan-comparison diagnostic

This archive retains completed source-only diagnostic evidence. Stage4 remains HOLD; it is not a full build, render, actor test, or runtime acceptance.

Sharp flags on vertex38’s six incident edges reduced input source NORMAL error below .002, also confirmed in the standalone input GLB. The unchanged original field then failed its .002 guard (.628806 targeted / .650464 all-sharp). No deformed GLB was emitted, and no correction was adopted.

- [Machine result](attempt-01/result.json.gz)
- [Execution and resource record](execution-01/result.json)
- [Postflight input/code parity and owned-process exit](execution-01/postflight.json)
- [Exact decoded-byte archive proof](archive-proof.json)
- [Historical preparation README, exact original bytes](README.md.txt)

The copied readiness still says prepared/not-executed because its exact historical bytes are preserved; the execution record is the subsequent outcome. Historical Python and Markdown have `.txt` suffixes so archive packaging does not reinterpret old relative links. Existing gzip files are copied byte-identically; newly compressed large JSON uses deterministic gzip. Every source SHA before/after equals its decoded destination SHA. The next preassignment-basis preparation is excluded. Original sources and other agents’ files were not edited.
