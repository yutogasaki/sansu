# Prepared failed coarse shape views — not executed

Purpose: whole massing first, before further Boolean/detail repair. Render the sealed failed scene exactly as saved. It is INCOMPLETE FLOOR ONLY / NO NEW BOUGHS OR RAILS / TOPOLOGY INVALID / HOLD. Duplicate faces and other recorded artifacts remain visible; no cleanup, hiding of failed floor, or geometry adoption occurs. No app screenshot or runtime pass is produced.

The existing east-v2 renderer's lighting, Cycles CPU16 samples,1280px whole and entry camera blocks are reused unchanged. Whole uses the recorded fixed-c1 matrix; entry near clip stays.1 and retains the ground threshold. No object geometry/material/matrix/visibility is edited. World lighting and a camera are only created in memory for the same source-view recipe. Source Blend is never saved; all mesh identities and source/code SHA are checked before/after. Whole and entry execute separately; whole first, parent reviews before the next view.

One CPU2 process, RSS2560MiB,240s per view, fresh output/log. Exact command in preparation.json. The inherited supervisor stays unchanged; executor records external PID/UTC/RSS. No execution until parent reviews. Failure is preserved with no retry.
