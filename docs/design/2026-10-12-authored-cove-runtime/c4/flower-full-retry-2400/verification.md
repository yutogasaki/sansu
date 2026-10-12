# c4 full flower retry verification

**PASS as an independent complete regression attempt.** Runner session 18858 exited 0; driver PID 73815 exited. The measured runner duration was **1,326.932 seconds**. This is diagnostic elapsed time, **not product performance acceptance**.

The [initial 900-second timeout](../regressions/README.md) remains a failed/incomplete attempt. Its 121 archived raw files were rehashed after this retry archive and remain byte-identical. This retry changes only the external command deadline from 900 to 2,400 seconds. It uses the same fixed candidate, source, server and driver; internal driver timeouts and assertions were not modified. There was no automatic retry.

| Check | Evidence |
| --- | --- |
| Candidate and target | `/private/tmp/sansu-authored-cove-c4/candidate`; existing server `127.0.0.1:5357`; authored `water=wide`, `cove=false` |
| Runtime identity | All 12 captures report build `authored-cove-c4`, flower candidate `native05-authored-flower-garden-v3`, and cove disabled |
| Full scope | 12 captures, four passing canvas selections, four passing edits; mature and young references; shapeOnly=false and rayOnly=false |
| Raw completion | pass=true; sourceClosureUnchanged=true; no raw errors |
| Fixed source | All 2,137 inputs match core initial/final, snapshot, retry initial/final, current candidate and post-archive candidate |
| Driver raw source | All 1,899 initial/final inputs are identical and an exact subset of core |
| Archive integrity | 20 files, 7,344,172 bytes; source-before/source-after/destination SHA256 and lengths match |

The unchanged driver SHA256 is `acffc6dce33d5366d88cd0e8ea5c77699c48260919562b7b55262d33b3cdb912`. The working repository has the separately recorded `docs/ai/verification_matrix.md` next-work contract change; working-repository equality is not claimed or required for this fixed-candidate run.

Evidence: [raw driver report](raw/actual/report.json), [outer runner report](raw/report.json), [execution log](raw/execution.log.txt), [archive proof](archive-proof.json). Archive proof SHA256: `04cdce400f38757d3c44251bf0c4ddff2d0f73cae0a2644d684cecbdf31f79ca`.

This result does not establish fresh acquisition, natural growth, personal-save migration, physical touch hardware, independent art/understanding, general cove source applicability, complete M1 or release acceptance. Root retains ownership of server shutdown and overall c4 closeout. No source, core or build was rerun for this archive.
