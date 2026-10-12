# Stage4 HOLD shape diagnostic v4 — prepared, not executed

The purpose is to see the full same-field grove shape before spending more time on subpixel representation limits. The numerical HOLD classifier is byte-identical to v3. This revision fixes only the save-scope responsibilities: exact original128 identity/object mapping, exact six CREATED objects and owners, and exact fixed314 context. Unknown forestRole objects are rejected, not ignored. The ordinary builder, v1/v2/v3 and every first failure remain unchanged. v3 saved its pre-joint128 scene and later made6 boughs, but failed before saving the after-joint scene because its broad forestRole collector confused those6 derived objects with the original128. That failure and the unsaved state remain evidence. Source art remains HOLD; runtime and independent observers remain untested/N=0.

## Preserved v3 diagnostic boundary

The ordinary build stopped after49 changed roles at node2269. v1 continued three translation-only final-candidate cases, then stopped after69 roles at node2289's original-coordinate baseline. v2 extended the same classification to baseline/source-oracle/candidate, then stopped after70 roles at node2290 baseline. Its pre-evaluation error was0, post error1.0028618414361853e-6; verified parent recomposition changed two linear components by-8.940696716308594e-8 as well as translation. The original442 meshes, owners/parents and materials remained unchanged.

**v3 removes linear-difference-zero and translation-difference-present from the diagnostic continuation conditions.** For each baseline/source-oracle/candidate separately, it still requires finite data, pre-world error<=1e-6, exactly unchanged basis/parent inverse/parent world, an unchanged affine bottom row, and post-world exactly equal to the same Float32 parent product. The matrix must actually have changed. No world tolerance is increased. A world-bound violation is recorded as `translation-only` or `linear-recomposition` in `precisionHolds`; `strictWorldGeometryGate=false` remains permanent for the whole diagnostic.

Every clone emits its actual before/after matrices, points/errors, role/ordinal/owner/sourceNode and all3×3 linear deltas. `world-evaluations.json` receives each evaluation before the next assertion, even if that role later fails a different hard gate. The manifest reports maximum recorded world error and linear component difference. Baseline and source-oracle use the same original coordinates, parent and original matrix, with separately recorded requested sharp flags and source NORMAL readback. Their results do not count as candidate acceptance.

## Hard stops retained

Raw source input/desired NORMAL .002, finite data, all retained local nonzero faces, source accessor identity, original displacement/Jacobian/pin guards, hero clearance, original442 geometry/parent/material checks, owner metadata and original primary-junction conditions remain hard stops. Changed101 normals use raw source accessor transport; fixed27 preserve their imported baseline only. No near-zero face is deleted; the existing explicit exact-zero derived revision is unchanged. No field, source position, owner, material or normal is adjusted to avoid a diagnostic failure.

## Complete shape before joints

Once128 unique roles are present, including101 changed representations, the builder rechecks stored NORMAL, retained leaf faces, stable matrices, parents and source material slots. It saves `attempt-hold-01/complete128-HOLD.blend` **before any primary-joint call**. This active scene contains the128 roles and fixed context only; baseline/source-oracle copies are excluded. The original objects remain in other Blender scenes solely for editable provenance.

Primary joints then run with the original conditions. The later assembly uses `HOLD-diagnostic-assembly-after-joints.blend`; it cannot overwrite the complete128 checkpoint. A joint failure remains first failure/exit1. True normal/local-face/source damage stops immediately and never earns diagnostic completion. No GLB export, reimport or roundtrip runs here. All101 normal completion, strict geometry, roundtrip and terminal acceptance fields remain false even if the diagnostic process exits0.

## Execution boundary

Root authorized this one fresh build after static checks and seal notification; it may overlap functional core44939 and must not be used as performance evidence. Rendering is still not authorized. One fresh CPU2/300s/sampled RSS3GiB Blender attempt, no automatic retry/render/repair. The sealed runner records UTC/PID/group, peak sampled RSS and all input hashes before/after. Only a later root decision can authorize a whole image.

That image must keep the stage3 camera/material/light settings and the named `growing-reachable-paths.visible_shadow=false` compatibility setting matching Three castShadow=false. No other shadow edit is allowed. Compare with the corrected stage2 baseline and approved native05 benchmark; no runtime art score. Four local-positive microscopic faces can still collapse in world Float32 representation; this known limit is not solved or hidden.
