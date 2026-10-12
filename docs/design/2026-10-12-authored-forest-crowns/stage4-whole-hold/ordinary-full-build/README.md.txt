# One full stage4 source build — derived lamina revision

The single-leaf stable-baseline roundtrip passed. This preparation now combines
fixed27, unchanged-method31 and the classified lamina70 in one bounded build.
The original stage4 field, source assets, owners, roots, geometry controls,
materials and guards are unchanged. No separate leaf/cohort Blender run precedes
this attempt. Art remains HOLD and no render starts automatically.

`build-source.py` assembles exactly128 forest roles, preserves original442 meshes
and their parents/materials, and retains the old source in its own scene. Only
one candidate per owner/sourceNode enters the delivery scene. Each leaf's two
baseline/oracle copies are removed after raw evidence is saved. Source normals
are authoritative for changed101; fixed27 preserve the imported baseline. The
fixed27 raw-to-import discrepancy remains a pre-adoption task, not a new repair
experiment here.

`rules.py` uses exact-zero rational cross products, one-pass incident-edge sharp
selection from failed raw NORMAL corners, and an existing target vertex from a
single Float32 collision group as a deterministic local center. The successful
leaf's vertex38/six edges/center37 are not hardcoded. Positive faces are never
removed; there is no all-sharp, alternate-center, coordinate nudge or tolerance
fallback. The explicit derived152→148 topology and source face/corner maps are
recorded. Same topology does not validate the69 other leaves.

`leaf_adapter.py` builds new clones; `original_method_oracle.py` calls the old31
methods once without assigning extra normals. Original normal and displacement
checks stay in place. Raw input and transported source NORMAL use .002, leaf
world points use1e-6, Jacobian .2/epsilon1e-5 and hero/pin controls stay unchanged.
The bounded build additionally compares every exported role to its proper
normal oracle and world coordinates. Positive local microfaces are retained;
world-Float32 nondegeneracy is not claimed.

`bundle_export.py` copies only selected roles/context plus ancestors into a
single temporary scene, exports with use_active_scene=True, and never restores
or repairs originals. Owner export has exactly128 unique owner:sourceNode roles
plus explicitly counted derived boughs. GLB→reimport→GLB matches exact oriented
local triangles, .002 corner NORMAL,1e-6 world points and source PBR/extensions.
Fixed zero-area faces remain represented and are matched without factorial
permutation search or welding. Original authoring state must remain exact.

After all101 deformations, the unchanged31 primary-junction checks run with the
same19-bough cap. First failure is retained. A complete but failed shape may be
exported for diagnosis, but FIRST must be absent for terminal success or normal
view eligibility. A failed-shape view requires a separate explicit root decision.
The full101+normal+fixed/material/owner+roundtrip result is required before asking
for the first whole image. Leaf70 joints, actor clearance, independent source
acceptance and runtime remain untested. No adoption and N=0.

## Bounded command

```sh
SANSU_FOREST_REPRESENTATION_BUILD_APPROVED=1 python3 /private/tmp/sansu-authored-forest-crown-study/stage4-organic-boughs/normal-generalization-prep/run-once.py
```

One Blender process, CPU2, sampled RSS3GiB, wall300s, fresh execution-full-01 and
attempt-full-01. Runner checks the preparation seal and external input SHAs
before/after, records UTC/PID/peak RSS/process-group exit, and never retries or
renders. Subsequent view is one whole image with the stage3 camera/materials and
only named growing-reachable-paths.visible_shadow=false compatibility correction.

## Static evidence

17 pure fixture tests passed, including primary-junction-failure completion
classification and duplicate fixed-zero-face export matching. Recorded first-leaf
rules reproduce the saved six flags, center and local148 representation exactly.
The initial host Python3.9 arithmetic replay differs from Blender's saved values
by about2.3e-16 in NORMAL (raw failure retained). The same planned replay under
Blender's bundled Python3.13 matches all Float64 components exactly. No mathematical
or guard change was made. Syntax/fixtures cannot predict Blender readback for69
unmeasured leaves; the one full attempt will establish that fact or preserve its
first failure. A small earlier result-schema KeyError is retained in history.
