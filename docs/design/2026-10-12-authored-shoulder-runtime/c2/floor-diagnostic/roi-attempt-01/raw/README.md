# Local ridge face-normal diagnostic — prepared, not executed

This separate diagnostic uses the existing actual Scene/renderer hook against immutable c2 on **5359**. It does not read live app sources, edit candidate/app files, or start another server. Root's earlier shadow-off, unlit, and static-audit artifacts remain untouched.

Run only after root authorizes the diagnostic:

```sh
python3 /private/tmp/sansu-floor-shading-diagnostic-c2/roi-face-normal-prepared/run-once.py --start
```

Fresh outputs are `actual-01/` and `execution-01/`; an existing output rejects a retry. The outer runner owns only its new Node process group, with a 900 second deadline and 4 GiB observed process-tree RSS limit sampled every 0.5 seconds. Normal Playwright operation waits remain 90 seconds. It preserves the first failure and kills only its own surviving group, never root's Vite server. These are diagnostic bounds, not performance criteria.

## Exact intervention

1. Capture shadow-off baseline on the same 32-owner hill-close camera. Verify fixed core/all8 reports, 6,460 source hashes, 6 installed dependency hashes, actual Vite/Three identity, and the actual floor's prior position/normal/color/index hashes and groups.
2. Verify source triangles 36705/36710 at renderer index offsets 118563/118578, including expected indices, all vertex positions/normals (Float32 tolerance 1e-6), identity matrixWorld, and material group 0. Refuse mismatch before intervention.
3. Clone only material 0 as **MeshStandardMaterial**, retaining all material properties; material 1 stays the original reference. Add a shader-only override within authored coordinates x=[5.08,5.46], y=[0.52,0.66], z=[-4.885,-4.82], translated to renderer world by (-7.0026560305,0,-2). No override outside that AABB.
4. Capture ROI face-normal, then restore the original material and dispose the single clone while keeping shadow reception off for the third comparison capture. Final cleanup also restores the original receiveShadow=true and Scene hook.

No position, normal, color, index, group, support, or world-state buffer is edited. Raw state/poses remain recorded; the inherited invariant compares canonical state without `applied`/`placeProgress`, and topology without instantaneous actor poses, exactly as the parent probe.

## Why this shader location is valid

`normal_fragment_begin` declares `normal` and `nonPerturbedNormal` in Three r185's MeshStandard fragment shader. The injection follows that include and precedes normal maps and `lights_physical_fragment`. The diagnostic rejects normal/bump/displacement/alpha maps, custom onBeforeCompile, physical-material extensions, clipping, and flatShading.

The local face normal uses the same `normalize(cross(dFdx(vViewPosition),dFdy(vViewPosition)))` expression as Three's FLAT_SHADED branch. Both `normal` and `nonPerturbedNormal` are assigned only inside the ROI. Derivative fields are computed outside conditional control flow; geometryRoughness uses the original normal's derivatives outside the ROI and the face-normal derivatives inside. This avoids leaking an artificial normal-field derivative at the ROI boundary into outside lighting. It is a temporary local normal-field test, not a global flat-shading change or proposed repair.

Shader compiler console/page errors fail the probe. A real matching draw and onBeforeCompile record are required before capture. Full injected vertex/fragment shader text and exact ROI uniforms are retained as shader evidence. GPU compilation is **not verified yet**.

## Source-shape context and evidence

The runtime placed-water cuts are near z=-9..-8, but the original native terrain was already sculpted near a lower native stream. The target source coordinate maps to native x≈-1.166, Blender y≈8.509,z≈2.071, close to that lower flow. This preparation does not attribute the ridge to runtime clipping, and does not modify the frozen earlier audit.

JavaScript syntax (`node --check`), Python AST parsing, and static shader-string injection against the installed Three shader templates passed. No browser or GPU/GLSL compile ran. See [readiness](readiness.json), [target](target.json), [static check](static-check.json), [driver diff](base-to-roi.diff), and [prepared fragment shader](prepared-fragment-shader.glsl.txt).

Driver SHA: `f94d8ce0d306fc5c04228cfb63dcd81c47fdd7a533b697edc98fe24ec6fc3415`. Wrapper SHA: `180cc5ba75e279acb41b6cf31087dc7a40735912fda26852d52e05caea0191a0`. Successful completion requires exactly three stages, restored original identity/hook, one disposed clone, unchanged source/dependencies/physical buffers/camera/light/state invariants, and no errors. Visual judgment remains root-owned; completion alone is not art, performance, or M1 acceptance.
