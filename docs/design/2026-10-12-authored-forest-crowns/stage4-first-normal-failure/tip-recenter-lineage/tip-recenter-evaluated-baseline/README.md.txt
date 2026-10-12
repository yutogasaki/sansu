# Evaluated clone baseline — preparation only

Previous stages and first failures stay immutable. The active-scene probe completed two1leaf/148tri exports and reimport with desired source NORMAL/world points within .002/1e-6, but its final exact guard found that the two newly constructed diagnostic clones had their cached world matrix reevaluated. Original442 meshes/parents/materials remained exact.

## Cause and narrow harness change

Saved basis/identity parentInverse/parentWorld reconstruct both measured after matrices exactly with Float32 products. The prior clone function copied a parented object, assigned matrix_world, wrote normals and immediately returned without an explicit view-layer update. It froze the initially assigned cached world matrix, which was inconsistent with its stored Float32 parent/local basis. This is supported by raw matrix algebra; the precise later reevaluation trigger is not claimed.

The new clone function captures construction state, calls `bpy.context.view_layer.update()` once after mesh/parent/matrix/normal setup, and records raw before/after world/basis/parentInverse/parentWorld plus full diagnostic components. It verifies original442 meshes and all source objects/parents/materials exactly before/after; verifies local basis/parent state unchanged; verifies all non-world clone components exact; verifies the evaluated world matrix matches the recorded Float32 parent composition exactly. It then checks all78 world points against the unchanged target within1e-6 before using this stable evaluated authoring state as the export baseline. No matrix is repaired or restored.

Input control uses the original source matrix/coordinates as its target. Tip output uses the unchanged Float64 field targets. NORMAL transport/math and .002 guard are unchanged. Evaluation does not recalculate source normals or geometry.

## Existing gates retained

Active temporary-scene deep-copy export remains byte-identical in its isolation helper. Original scene/444meshes including2diagnostics and all source transforms/materials stay exact across export/reimport/second export. Each output is flushed/asserted one scene/one named leaf/148 exact local triangles. GLB and reimport NORMAL/PBR/world points use the same source oracle. No fixed roles or owner transforms are altered.

Only original exactly-zero faces0/2/98/100 are excluded on the derived148-face diagnostic clone; original152 remain. Four near-zero retained faces can still collapse at world-Float32 precision. No near-zero deletion, normal tolerance increase or global recalc is introduced. Full101-role generalization/source adoption is not authorized by this preparation.

CPU2/RSS2GiB/60sec; one fresh attempt only after root authorization. Pure Python tests/static seal do not start Blender.
