# Stage2 executable preparation

**Ready for a separately scheduled source window; not executed.** The earlier 3 outputs remain immutable and all HOLD. This stage makes one `forest-crown-b1-layered-v1` source candidate from the fixed extraction, then one whole render only if source checks pass. No Node world re-extraction, browser, app asset, new owner or land.

[brief.md](brief.md) records the intended asymmetrical upper/middle/lower leaf mass and two distinct openings. [proposal.json](proposal.json) remains the exact reviewed static parameter set. Its `-proposal` ID becomes the generated candidate ID only when the builder completes. [fields.py](fields.py) remains unchanged since the static proposal.

The execution implementation is now [build-stage2.py](build-stage2.py), [joints.py](joints.py), [stage1_support.py](stage1_support.py), and [render-one-whole.py](render-one-whole.py). The previous brief's statement that a builder had not yet been implemented describes its preparation checkpoint. [helper-provenance.json](helper-provenance.json) identifies exact copied function ranges from stage1; the stage1 generation loop is never imported or executed.

The builder checks all source/extraction hashes, 128 original roles, the fixed 23 node vertex/index/normal/matrix digests, 105 changed roles, preserved topology, original material values and role slots, every retained context mesh digest, Jacobian/displacement guards, and clearance beneath the highest hero. After export it reads the component GLB and checks the original 128 role/material identities and NORMAL presence. Exact split-normal GLB roundtrip and independent actor-route auditing remain separate; these checks must not be described as complete geometry or art acceptance.

Actual trunk, branch, stem and crown triangles form BVH volumes. A position-weld query checks that each volume is closed and oriented without modifying source vertices. Existing joints need a positive-radius ball inside both closed volumes with nearest-surface clearance. A missing connection can receive a closed curved same-owner native-material bough, with each full cap disk contained in an actual endpoint interior ball. The source node/material is recorded. No generic replacement crown is created. Boolean union, bough self-intersections and full actor clearance are not certified by this local joint proof.

The 5 willow trunk/lobes, 6 birch branch roots and 6 branch/crown ends, 14 hanging-stem roots, and all 70 leaf/stem attachments are checked. Automatic closed connector repairs are capped at 31. Hanging leaves that cannot prove a volume attachment stop the first attempt; the script does not silently add a field of decorative petioles or loosen the requirement. A native source joint or a sampled Jacobian may therefore stop the first build. The failure JSON, joint progress, raw log and current editable failed scene are retained for review.

Before deforming, the same query-only `query_joint` records all 70 unmodified imported leaf/stem pairs into `baseline-joints.json`. Each pair keeps owner/source-node IDs, k/j, original source anchor, original and queried world anchors, matrix/pivot identity, and the same .00048m actual overlap-ball radius. The original anchor is used directly before deformation and through the reviewed common field afterwards. Closure and ray-parity failures are baseline states, not swallowed generated-geometry failures. The baseline retains scalar JSON only and unconditionally clears the name-keyed BVH cache before any deformation; afterwards every BVH is rebuilt from the changed mesh.

The final first-failure can distinguish proof lost after deformation, proof already absent in the unmodified imported input, and a baseline/after query that could not establish valid closure or ray parity. A finite no-ball search is **not** proof that meshes do not touch. The baseline is after Blender import, so it also does not by itself assign a defect to the original authored source. Generated checks, .00048m threshold, closure tolerance, repair cap and leaf stop behavior are unchanged. The pre-baseline builder and readiness are preserved in `history/pre-baseline/`.

Run only after root releases the c2 browser window:

```sh
SANSU_FOREST_STAGE2_APPROVED=1 python3 /private/tmp/sansu-authored-forest-crown-study/stage2/run-window.py
```

[run-window.py](run-window.py) launches the two Blender commands serially with **2 threads** and no GPU. CLI, OpenMP, saved Blender scene, renderer and render metadata all use 2; OpenBLAS remains 1. The builder receives a 300-second wall bound; the single 1280px, Cycles CPU16-sample whole render receives 120 seconds. The wrapper samples only its owned process's RSS once per second and stops above 3 GiB. This is an observed RSS guard, not a hard OS allocation limit. It records UTC start/end, effectiveThreads, PID, elapsed time, peak observed RSS, exit and stop reason. No second Blender process runs concurrently. Existing `attempt-01/` or `execution-attempt-01/` aborts rather than overwriting. The exact preceding 4-thread scripts, README and readiness are retained in `history/pre-2-thread/`.

Time and memory are **unmeasured for stage2**. Stage1 generation for all 3 was about16 seconds and each whole render about4.5 seconds with its prior thread setting. Added volume checks and the 2-thread cap make those timings unsuitable as a promise. A rough planning allowance is 1–3 minutes total; the bounded window can stop at 7 minutes plus termination grace. An unresolved source joint stops earlier. Any permitted overlap with functional regressions must be recorded separately from performance claims; this is not a product performance run.

Expected successful outputs in `attempt-01/`: `study.blend`, `study.glb`, `owned-tree-components.glb`, source/input/deformation/joint manifests, then `source-whole.png` and `render-manifest.json`. Failed source never reaches the render stage. The original whole camera, light, AgX, no-resident context and known black path dots remain unchanged.

## Black path dots: static evidence, no fix

[black-path-static.json](black-path-static.json) reads the fixed extraction and b1 GLB path metadata plus only their first/last path triangles. Both have one ordinary `growing-reachable-paths` mesh, no GPU instancing extension, unchanged sample positions, and opposite geometric Y winding: ribbon sample -0.00408880676, joint-disc sample +0.002392088705. Raw path PBR values are saved. These findings do not identify the exact black pixels.

The runtime path uses 12-step ribbons and 24-sided joint discs at floor+.008, a double-sided material with polygonOffset -1/-1, receiveShadow true and default castShadow false. Those Three-specific bias and shadow flags are absent from the glTF node/material. Coplanar opposing ribbons/discs combined with Blender default casting is a plausible roundtrip explanation, still untested. `instanceColor` is not the explanation established for this ordinary path mesh. The missing water-ripple lines are a separate limitation and are not named as the cause.

No image, material, light or path has been changed. A later same-frame source diagnostic with path-only `visible_shadow=false` could test part of the hypothesis after the reference comparison, with separate authorization and its own candidate label.
