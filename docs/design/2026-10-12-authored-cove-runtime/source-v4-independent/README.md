# Independent v4 shore audit

PASS for the source/floor/domain checks recorded in [summary.json](summary.json). This is not browser, core, visual, or complete actor pose/lifecycle acceptance.

The author explicitly froze the v4 patch, combined GLB, editable Blender source, and assembly manifest before input collection. This audit independently decoded those GLB bytes, compiled the actual domain frame, measured current actor rigs, and ran the planar floor kernel. It did not copy the author's numeric results. The kernel was adapted from the earlier fixed c1 independent audit.

- Visual candidate: `native05-authored-cove-shore-v4`; shell source: `native05-authored-cove-corner-v3`.
- The unchanged shell, transform, delivery gzip, and combined shell geometry/materials match. The earlier shell/home intersection result is carried only because those bytes and transform are unchanged; this run did not repeat the full shell/home SAT comparison.
- Base and water composition preserve every original floor, anchor, site, edge, source identity, and all 73 placement grants. All 2063 existing site supports remain identical. The patch adds exactly 13 walking refs and 15 walking edges.
- The current domain frame equals independent additive patch compilation in both modes. GLB top 596 triangles and bank 1196 triangles match the patch; maximum vertex serialization error is `4.251159422060467e-7` world units. The 2388-triangle combined shore has 0 boundary edges and 0 nonmanifold edges.
- Nine actual fixture actors, 117 meshes and 99868 indexed source vertices give walking radius `0.24406937059140586`; the sweep uses radius plus `0.04`. All 15 routes have maximum unsupported area `4.3133129806609846e-14`, below the recorded `1e-12` planar tolerance. All 192 actual socket-bottom triangles retain contact within numerical tolerance.
- The old eligibility window did not cover the new shore. Root widened localGround and clearCourt to min `(5,-3.5)`, max `(11,3.5)` with base/water fingerprint `b854fd9d1de0c4d9`. Current source and actor sweep bounds fit. The earlier custom-profile test retained the fixture and rejected an extra owner at `(10.7,3.1)` that the old bounds accepted. Pre-fix evidence is retained in `before-profile-fix/` and `bounds-audit.json`.

## Explicit numerical limitations

Three nearly collinear GLB top triangles have non-upward orientation after Float32 serialization (largest area `1.0519057550928499e-7`). Their minimum altitudes are at most `1.8887918123272132e-7`, below measured vertex serialization error. All triangles are retained and both floor materials are double-sided. This is recorded rather than silently deleting geometry or claiming every top normal points up. Maximum sampled seam height delta is `0.0005452929999999988` world units; this check uses a `0.001` height tolerance.

## Reproduction and provenance

The exact commands run from the project root were:

```text
node /private/tmp/sansu-authored-cove-v4-independent/audit.mjs
/private/tmp/sansu-authored-cove-entrance/geometry-venv/bin/python /private/tmp/sansu-authored-cove-v4-independent/floor-audit.py
node /private/tmp/sansu-authored-cove-v4-independent/bounds-audit.mjs
python3 /private/tmp/sansu-authored-cove-v4-independent/finalize.py
```

`audit.mjs` produces the floor input before the planar check; the durable copy compresses that input as `independent-floor-input.json.gz`. Decompress it beside `floor-audit.py` to replay only the planar audit. The scripts record the original repository and fixed-c1 paths explicitly. Dependencies were the repository's Three/esbuild and Shapely 2.0.7 / GEOS 3.11.4.

`initial-inputs.json` and the final raw report contain exact before/after hashes; closeout verifies all 64 collected inputs still match. `artifact-hashes.json` checks this archive's files and excludes itself to avoid a circular hash. Outputs live in the sibling runtime evidence directory, outside source input collection.

The first harness attempt failed because it looked up `bank.color` instead of `bank.material.color`. The raw failure and initial hashes are retained. Only the harness was corrected; no app or source edits were made by this auditor.
