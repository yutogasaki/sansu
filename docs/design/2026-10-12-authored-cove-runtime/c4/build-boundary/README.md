# c4 normal false build boundary

[Read-only inspection](report.json) PASS after terminal c4 core PASS (`exitCode: 0`, `sourceFixed: true`). [Raw core summary lines](core-summary-excerpt.log.txt) confirm **606 test files / 5265 tests PASS**. This inspection did not start a build, browser or core run.

- Normal build identity: revision `authored-cove-c4`; Island enabled; `nativeOwnedArt=false` and `nativeArtStudy=false`.
- All **2,137 inputs** match the core initial/final manifests, c4 snapshot and current candidate. Exact hashes are in [input-hashes.json](input-hashes.json).
- Dist contains **171 files / 24,547,855 bytes**. This includes promotion and other outputs outside the PWA precache and is not the PWA budget measure.
- PWA precache: **145 files / 8,896,755 bytes (8.48 MiB) / 12 MiB**. Explore artwork: **27 production files / 2.97 MiB / 8 MiB**. The official read-only [asset budget check](asset-budget.log.txt) passed.
- Native/cove raw GLB, glTF, gzip and Blender art payloads were absent from the distributed assets. None of the dist files matched any of **23 source payload hashes**; no embedded GLB marker was found. The [dist inventory](dist-files.json) records every file's size and SHA.

## Code and data that remain

This result does not mean all authored code or data was removed from JavaScript.

| Distributed code | Bytes | Observed content |
| --- | ---: | --- |
| `nativeAuthoredFlower-CBUwdXJ8.js` | 8,482 | Authored flower adapter code |
| `_native-owned-art-disabled-BiOygDaT.js` | 55 | Disabled native loader, no fetch call |
| `authoredGrowingAssets-DFvrLLpN.js` | 469 | DEV-only throwing loader stubs, including cove; no fetch call |
| `GrowingWorld-Di4lC9-e.js` | 415,779 | Cove source names/identity metadata and the exact serialized shared-apron district |

The apron district is actual floor and navigation data, beyond descriptive strings: **147,435 characters**, one floor with **598 vertices / 596 triangles**, and **9 district walk sites**. Its source patch has 15 edges. The exact serialized district SHA is `ef7c526096b066095123b99e9e3b8ea8f0ef73ed40fa98b69030e465e7cd97dc`. This retained inline data is separate from the absent raw source GLB/gzip/Blender assets.

Dist inventory hashes remained unchanged throughout inspection. [Raw execution output](execution.log.txt), [executed script](inspect-build.mjs) and [archive manifest](archive-manifest.json) preserve the result and evidence identities. The script retains its executed `/private/tmp/sansu-authored-cove-c4` path and expects to run from that build-boundary location with the candidate sibling; deliberate path remapping is needed elsewhere. Raw `.log.txt` outputs were copied byte for byte. The core excerpt is selected raw lines, not a full log or a transcription.
