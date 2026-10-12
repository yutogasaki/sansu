# First leaf — sharp-fan comparison

This package prepares a new diagnostic; it is not an adopted source correction. The original stage4 scripts, failed build, normal-debug, and zero-face comparison are immutable. The diagnostic may run once only after the explicit source window: CPU2, one Blender process, observed RSS2GiB, 60 seconds. No whole build, render, app/candidate changes, or original source writes.

The previous zero-face case removed exactly original faces 0, 2, 98, 100, preserving all 78 vertices and the remaining 148 triangles. It passed the original field's expected/readback guard (.000159897), but **did not preserve source shading**: raw-source input residual .012402114 and raw-source-derived output residual .011551790 remained at six corners. They all correspond to source vertex38 (retained loops134/136/432/435/439/441; original loops140/142/444/447/451/453). Zero-face removal alone is not adopted.

This comparison reconstructs that identical zero-removed throwaway leaf three times. It preserves all coordinates, edges, retained indices/order, material slots/indices, owner transform, and smooth polygon flags. Each condition explicitly receives the same literal raw source NORMAL at every retained corner; **sharp edges do not mean substituting geometric flat normals**.

1. Zero-removed baseline with original sharp flags.
2. Every existing edge incident to source vertex38 is requested sharp. The selection is derived from the reproduced baseline's source-normal readback residual >.002 and asserted against the saved six-corner result. It is a single nonadaptive selection, not a loop that expands flags until passing.
3. All existing edges requested sharp, a fan-topology control only.

The setter might retain or alter requested flags; complete before/requested/after-source/after-field flag maps and changed edge lists/counts are recorded, not presumed. The original `deform.apply`, original field, Jacobian method and .002 guard are imported unchanged. A return-frame observer retains its actual locals on pass or failure. A separate oracle starts from literal source NORMAL and applies the exact same per-vertex inverse-transpose matrices. Passing against already-altered input normals cannot count as preserving source shading.

All three deformed vertex arrays must match the completed zero-face diagnostic exactly. Every imported original mesh (including fixed27/context) is checked before/after for geometry, normals, matrix, smooth/sharp flags; material digests must also stay identical. Only the three diagnostic clones are altered. No recalculation operator, weld, coordinate cleanup, epsilon change, or further face deletion is permitted.

For an input case with raw-source/readback residual <=.002, export only that selected leaf to a diagnostic GLB and inspect POSITION/NORMAL/index accessors. If its unchanged original method and raw-source output oracle also pass, export and inspect the deformed leaf too. Export inspection compares exact local oriented POSITION triangle/corner multisets; only cyclic triangle rotation/reordering and exporter vertex duplication are allowed. It uses no position epsilon, rounding or weld. Normal errors are reported against both Blender readback and literal-source desired normals, with the same .002 boundary. Repeated identical physical triangles are explicitly treated as normal multisets, not unique original vertex IDs. World-instance composition is outside this local accessor test. Exporting must leave the diagnostic object's matrix/mesh unchanged.

`test_export_check.py` checks the pure-Python accessor oracle with cyclic/reordered duplicate triangles, reversed winding, a 1e-12 coordinate difference, geometric-flat normal replacement, missing triangles/zero edges, and a binary GLB with strided attributes. It does not import Blender. `prepare.py` records these results, compiles Python syntax without importing the diagnostic, and seals scripts and immutable external input SHAs. The runner verifies readiness before launch and all bound files after exit. Observed peak RSS is sampled every .25 seconds, not a continuous peak or performance claim.

Command (requires the separately authorized source window):

```sh
SANSU_FOREST_SHARP_FAN_APPROVED=1 python3 /private/tmp/sansu-authored-forest-crown-study/stage4-organic-boughs/normal-debug/sharp-fan-comparison/run-once.py
```

Outputs go to fresh `execution-01/` and `attempt-01/`. Any failure is retained with its phase; there is no retry or automatic correction. Diagnostic success would establish only this leaf/field case; stage4 art, all101 roles, joints70, actor clearance and runtime remain unaccepted.
