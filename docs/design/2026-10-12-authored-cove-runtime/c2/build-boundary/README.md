# c2 normal false build boundary

Canonical result: `report.json` from `inspect-build.mjs`, with raw output in `execution.log.txt` and the official read-only asset check in `asset-budget.log.txt`. No browser, core or build was started by this inspection.

- Terminal core PASS / exit 0 / sourceFixed=true was required before inspection. All 2,137 input hashes match core initial/final inputs, snapshot and current candidate.
- `version.json`: revision `authored-cove-c2`, Island true, nativeOwnedArt false, nativeArtStudy false.
- Dist: 171 files / 24,547,855 bytes, including promotion and other non-precache outputs. This total is not the PWA budget.
- PWA precache: 145 files / 8,896,755 bytes (8.48 MiB), below 12 MiB. Official `assets:check` PASS; Explore artwork 27 files / 2.97 MiB below 8 MiB.
- No raw native/cove GLB, glTF, gzip or Blender source payload was distributed. No dist file matches any of the 23 source payload hashes, and no embedded GLB marker was found.
- Authored code/data is **not entirely absent**: nativeAuthoredFlower is an 8,482-byte JS adapter; the native loader is a 55-byte no-op; the authored loader is a 469-byte DEV-only throwing stub with no fetch call.
- GrowingWorld's 415,779-byte JS contains cove ID/SHA metadata and the **actual** serialized apron district (147,435 characters; one floor, 598 vertices, 596 triangles, 9 district walk sites). Its source patch also has 15 edges. This is more than descriptive strings and is separate from the absent raw GLB/gzip/Blender payloads. No complete tree-shaking claim is made.
- Dist inventory hashes stayed unchanged throughout the read-only checks. `dist-files.json` and `input-hashes.json` contain exact inventories; version/index/SW anchors and script hashes are in the report.

`first-name-match-*` is an intermediate inspection: an overbroad filename substring matched “Discovery” as “cove”. The final script restricts the filename prefix and records exact inline district content; use the canonical report for conclusions. This was an inspection classification correction, not an application/test failure.
