# Stage4 HOLD shape diagnostic v2 — prepared, not executed

This is a separate source-only diagnostic for judging the complete grove shape before spending more time on microscopic representation errors. It preserves the ordinary sealed builder, its first failure and diagnostic v1 unchanged. This is a new classification revision and a fresh run, not a continuation of the v1 process. It is not geometry, contact, roundtrip, art, runtime or performance acceptance. Independent observers remain N=0.

The ordinary build completed 49 changed roles, then stopped at l14/sourceNode2269, leaf ordinal30. Target64→local32 plus cached matrix_world had maximum world error 1.1979911370e-7; Float32 parent reevaluation changed only translation and raised all78 vertices above the unchanged1e-6 bound (maximum1.1455812246e-6). The raw desired NORMAL error was .0003761413 and all148 retained local faces were nonzero. Neither the bound nor the target field is changed here.

Diagnostic v1 stopped after69 changed roles at sourceNode2289 baseline: before world error0, after1.0115243642614567e-6, with every numerical qualification true and only the candidate-only label restriction false. v2 extends that one label predicate; normal, geometry, ownership and resource bounds do not change.

## Narrow continuation

`precision_gate.py` grants **diagnostic continuation only** separately to baseline, source-oracle and final candidate clones when: pre-evaluation world errors are all<=1e-6; before/after linear3×3 and affine bottom row are exactly equal; basis, parent inverse and parent world are exactly equal; after matrix equals the independently recomputed Float32 parent product; and translation actually changed. All unclassified errors stop. These three labels retain distinct records and never count as candidate acceptance. The baseline and source-oracle use identical original coordinates, original parent and original matrix; only requested sharp flags/raw NORMAL readback checks differ. Each actual before/after transform is recorded, so this equivalence is observed rather than assumed. Every leaf's baseline/oracle/candidate evaluation saves before/after matrices, world points, all errors and the reason. Qualified violations remain `precisionHolds`; `strictWorldGeometryGate=false` is permanent for this diagnostic.

Raw source NORMAL .002, local nonzero retained faces, source accessor IDs, original displacement/Jacobian/pins, fixed27/context/owners/materials, hero clearance and original primary-junction conditions remain hard checks. Changed101 normals use raw source accessor transport; fixed27 retain the imported baseline only. The original31 deformation algorithm and the70-leaf representation algorithm are unchanged apart from the explicitly classified diagnostic continuation. Original exact-zero faces are excluded only under the already sealed derived rule; no near-zero face is removed.

## One assembly, not a delivery bundle

The builder selects exactly128 unique owner:sourceNode roles, fixed context and any permitted derived boughs into one active HOLD scene. The baseline and source-oracle clones are deleted before selecting a candidate. Original objects remain in their other source scene for editable provenance and are never linked into the active assembly as duplicate changed roles. Assembly scope, stable matrices, source parent/material slots, final raw NORMAL and all70 local face checks are recorded again before saving.

This copy saves `attempt-hold-01/HOLD-diagnostic-assembly.blend` only. It does not export GLB, reimport, render, or certify roundtrip. All101 normal completion/roundtrip PASS are explicitly false. A zero process exit means a complete HOLD diagnostic scene was saved without another hard failure; `terminalSuccess=false` still applies. Primary-junction failure preserves raw failure and can preserve a full-role HOLD scene, but gives nonzero process exit. Any image requires a separate root decision.

## Execution boundary

Await root's P02/source-window coordination. Once authorized, run exactly the command in sealed readiness. CPU2, one Blender process, sampled RSS3GiB, wall300s; one fresh attempt, no automatic retry or repair. The runner records UTC/PID/group/peak sampled RSS and pre/post hashes. No app, candidate or original source is edited.

The first future view must use the stage3 camera/material/light settings and only the named `growing-reachable-paths.visible_shadow=false` compatibility setting, matching the actual Three path castShadow=false. This preparation does not render or change lighting. It must compare with the corrected stage2 path-shadow baseline and approved native05 benchmark. Four tiny local-positive faces may collapse in world Float32 representation; this known limitation is not solved or hidden.
