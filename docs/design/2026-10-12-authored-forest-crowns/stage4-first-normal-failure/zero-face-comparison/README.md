# Completed zero-face-comparison diagnostic

This archive retains completed source-only diagnostic evidence. Stage4 remains HOLD; it is not a full build, render, actor test, or runtime acceptance.

Removing only the four exact-zero input faces reduced source NORMAL error, but six corners still differed by .012402 before and .011552 after the original field. Passing the original local .002 guard did not prove preservation of source shading. No correction was adopted.

- [Machine result](attempt-01/result.json)
- [Execution and resource record](execution-01/result.json)
- [Postflight input/code parity and owned-process exit](execution-01/postflight.json)
- [Exact decoded-byte archive proof](archive-proof.json)
- [Historical preparation README, exact original bytes](README.md.txt)

The copied readiness still says prepared/not-executed because its exact historical bytes are preserved; the execution record is the subsequent outcome. Historical Python and Markdown have `.txt` suffixes so archive packaging does not reinterpret old relative links. Existing gzip files are copied byte-identically; newly compressed large JSON uses deterministic gzip. Every source SHA before/after equals its decoded destination SHA. The next preassignment-basis preparation is excluded. Original sources and other agents’ files were not edited.
