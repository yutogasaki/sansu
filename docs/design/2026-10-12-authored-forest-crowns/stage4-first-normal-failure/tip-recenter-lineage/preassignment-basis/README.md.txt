# Saved-data precision analysis; Blender probe deferred

No Blender was started for this analysis. `probe.py` is an **unexecuted, unsealed draft** of the clear-before-update comparison; root explicitly deferred it after actual geometry collapse was found. It has no runner/readiness and is not part of completed zero/sharp archives.

`saved-face-fan-analysis.json` uses exact rational cross products of the stored binary-float coordinates. Retained faces45/47/146/150 are nonzero before and exactly zero after all three prior variants. Source vertices36/37/38 collapse to identical coordinates. All-sharp’s four failures occur on those four faces; targeted6sharp additionally shares error through vertex37’s remaining fan. No near-zero threshold or face cleanup was introduced.

`precision-trace.json` traces the same-build matrix multiplication formula and unchanged Python field without Blender. The first loss is float Vector storage after `transform @ vertex.co`, before the nonlinear field. Twenty-four previously recorded worldPoint/worldTarget pairs match the offline arithmetic exactly. Final local coordinates are the actual old raw result; the uncaptured inverse-matrix internals are not presented as a new engine observation. The same-build [Matrix/Vector source](https://github.com/blender/blender/blob/9e2066aef7ef/source/blender/python/mathutils/mathutils_Vector.cc#L2059) supports the arithmetic model.

Preservation options remain distinct:

| Option | What it preserves | Remaining issue |
| --- | --- | --- |
| Float64 math, old local pivot | Same field formula and retained face indices | Final Float32 storage still collapses all four tiny faces; insufficient alone. |
| Float64 field, tip-relative mesh plus compensating child translation | Same intended nonlinear field,148 explicit retained faces, raw-source normal/J provenance; owner/root unchanged | Offline local triangles survive, but actual normal storage, child matrix rounding and GLB/reimport need the separately prepared tip-recenter probe. GPU/world Float32 may still collapse sub-ULP faces. |
| Literal original local leaf mesh plus rigid/affine child pose | Original local POSITION/NORMAL values and original dimensions/topology can remain exact | Replaces the nonlinear per-vertex field with an affine pose; leaf/stem endpoints and art mass are no longer automatically the same. This is a different structural proposal, not a silent numerical fix. |

The minimum next numerical probe is the second option; no correction is adopted. Raw source NORMAL and corner correspondence are authoritative. The four input exact-zero faces may only be omitted under an explicit derived revision retaining the original; the remaining148 must not be silently pruned or inflated. Fixed27/owner/root/material data must remain unchanged. The source should preserve authored shading and physical shape semantics, not merely make a guard return true.

Offline commands:

```sh
python3 -B analyze-saved.py
python3 -B trace-precision.py
```

Outputs bind immutable source/raw input SHAs before and after. No asset, render, app or candidate writes occurred.
