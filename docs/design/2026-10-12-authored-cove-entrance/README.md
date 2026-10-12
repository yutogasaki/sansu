# Native-05 P04 — low shell, entrance and shared shore

2026-10-12. Current visual assembly **`native05-authored-cove-shore-v4`**. The shell itself keeps source ID `native05-authored-cove-corner-v3` and its original verified bytes. **Art HOLD, independent comprehension/safety HOLD (N=0), broader runtime acceptance incomplete. M1 remains open.** [Actual app integration through c4](../2026-10-12-authored-cove-runtime/README.md) is stored separately from these source inputs.

The first actual c1 whole/close views made two homes and the low entrance readable, but exposed a pale rectangular apron protruding into the sea. v4 replaces that outline with a broad asymmetric bowed shore, continuing the existing grass and sand materials. The shell, houses, owned positions, 13 walk-only refs and 15 edges stay unchanged. [c4 actual app screenshots](../2026-10-12-authored-cove-runtime/c4/contact-sheet.html) confirm the rounded shore through move/store/restore, rotation and 390/768 widths. Whole-island art remains HOLD.

| Transfer | Do not transfer |
|---|---|
| Native violet pearl shell, curved ribs, tapered half-vault and grounded runners | A high roof concealing both homes or unowned benches |
| A real open corner leading to the current play target and dry court | A painted doorway, floating cut ribs or invisible floor |
| The native uniform `.45` transform and continuous rounded coast | Stretched proportions or a rectangular display platform |

The spatial action is: enter through the open corner, cross the same dry court, and use the existing play target. These source checks are not actual app rendering, natural acquisition, independent observers or whole-island approval. Normal production remains false-default; integration is explicit DEV `cove=corner`.

## Current source handoff

| Artifact | Purpose |
|---|---|
| [Shell GLB](cove-corner-v3.glb) / [editable shell](cove-corner-v3.blend) | Unchanged v3 shell, continuous entrance rim and terrain-fitted runner sockets; the only cove GLB delivered at runtime |
| [Combined v4 GLB](cove-corner-with-shore-v4.glb) / [editable v4 assembly](cove-corner-with-shore-v4.blend) | Same shell plus the exact shared-ground top and closed bank, for authoring and parity checks |
| [Assembly manifest](assembly-manifest.json) | Separate visual/shell identities, coordinate/material contracts, topology and current hashes |
| [Shell source manifest](source-manifest.json) | Unchanged native-05 hashes, opening dimensions, shell topology and source transform |
| [Current world patch](shared-apron-world-patch-v1.json) | v4 visual geometry in the existing v1 patch schema; one added floor/bank district, four original-ground site additions and walk-only edges |
| [Feasibility](feasibility-with-shore-v4.json) / [full-width support](full-width-support-v4.json) | Author checks of actual source triangles, original owners and conservative route-width support |

Shell SHA is `f08ada4907c76a617e2c22090049b9b2880dde2d75fa11ad61f6e76c7eec7146`. The current patch is `7a5cc9edd5282f7471f8257e4ee83212cbf93f3f30ba269bb102d91bc11dc969`; combined v4 GLB is `ff79d2bff518cbd94a5ef2a5566e5f24ed09296248bd538c7fa41a475f849077`. Approved native-05 GLB remains `8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d`.

## One transform, one floor

Exported source coordinates follow Blender `(X,Y,Z)` → GLTF `(X,Z,-Y)`. Subtract GLTF pivot `(13.9,.89,1.2)`, multiply uniformly by `.45`, then add authored position `(8,.0475,.50)`, yaw `0`. Only the renderer subtracts `layout.center` from X and `2` from Z. The world patch is already authored-world geometry. Combined source export uses the inverse of this transform; Float32 GLB serialization must be compared with an explicit tolerance.

Runtime renders the shell-only GLB and the WorldDefinition floor/bank **once**. The combined source is never added on top of the same world floor. Existing dry triangles are subtracted from the new outline and remain unchanged. The v4 added area is `4.7649456086` world², with bounds X `6.04625–10.28500`, Z `−.917327–2.584374`. The top has 598 vertices / 596 triangles. The closed source has 1,196 vertices / 2,388 faces and no boundary/nonmanifold edges.

Top color `#a4cb87` and roughness `.95` match the current runtime grass floor. The original native terrain roughness is `.78`, as recorded in the [separate normal/material audit](../2026-10-12-authored-whole-massing/floor-normal-audit/README.md). Bank color `#e2d7c9` and roughness `.78` match the native pale sand coast. Source colors convert sRGB to linear glTF values. The shell's original four materials and transmission remain unchanged. The wider outline requires the runtime profile's audited ground/clearance window to cover the whole new shore; reusing the old Z `2.25` limit is insufficient.

## Bounded geometry and lifecycle evidence

The `.043`-thick shell was cut as a closed solid with a rounded arch. Its continuous frame joins the retained runner, jamb and opening into the back arch. The far shell surface, five ribs, five seams and right runner remain native source geometry. Runner sockets contact the actual local ground. No new house, bench or owner is added. The shell contains 18 source nodes / 19 loaded primitives / 79,384 triangles.

The current p6 `(7,-1)`, p7 `(9,-1)`, p9 `(8,0)` and supply l32 `(8,-2)` retain their audited models and maturity. The patch adds nine refs in its own district and four refs on original floor, with 15 walk-only edges. Placement grants remain 73; no join or water rights are introduced. The author's full-width check unions actual dry triangles and covers each added edge's AABB expanded by actor radius `.2440693706` plus `.04`. Maximum numerical uncovered area is `1.303e-13`.

These are fixed-arrangement source results. The application must derive shell, floor and routes together, reject unaudited nearby changes, and remove or restore the assembly after move/store/separation/reconnection. It must preserve committed actor and pointer support during preview. The [c1 focused integration](../2026-10-12-authored-cove-runtime/focused-integration/README.md) verifies that lifecycle on the previous rectangular patch; it is not v4 verification. The [final v4 independent source audit](../2026-10-12-authored-cove-runtime/source-v4-independent/README.md) passed 17 gates. The [v4 focused tests](../2026-10-12-authored-cove-runtime/focused-v4/README.md) and [c4 core/full journey](../2026-10-12-authored-cove-runtime/c4/core-full-archive-proof.json) provide separate application evidence.

The author's current exact planar audit reports old-floor overlap only at numeric area `5.153e-13`, continuous socket contact and maximum seam-vertex height delta `.000545293`. GLB top/bank vertex error is approximately `4.252e-7`; near-collinear triangles can reverse after Float32 export. Their areas and counts are recorded in the author audit, not silently omitted or called exact winding identity. Uniform 6 mm burial across every socket face is not claimed.

## Visual status and preserved history

[Corner](source-corner-v4.png), [interior](source-interior-v4.png) and [overhead](source-overhead-v4.png) are Blender Workbench **source geometry** views. They do not reproduce final native transparency or game lighting. The [c4 runtime review](../2026-10-12-authored-cove-runtime/c4/art-review.md) separately compares actual whole/close/rotated/390/768 screenshots beside the approved benchmark. Author magnetism and silent safety remain HOLD until those respective gates are met.

The [v3 rectangular-apron bundle](history/v3-rectangular-apron/) preserves the prior source before v4 changes. Its [earlier independent audit](independent-audit/independent-source-review.md) remains v3 evidence, including the one Float32 top sliver. The corner-only v1 disconnected p6/p9, and v2 sockets intersected p7's step at two triangles; their original failures remain under `history/`. The first v4 curve left a p6-side width gap, then a too-small verification crop failed; both remain in `history/v4-first-shore-gap/`. Later contour revisions change source shape before freeze and do not count as passed app iterations.

Reproduction uses `build-shore-footprint-v4.py`, `probe-cove-shore-v4.mjs`, `verify-floor-support-v4.py`, `build-assembled-shore-v4.py` and `render-source-preview-v4.py`. Blender is `/Applications/Blender.app/Contents/MacOS/Blender`; the bounded planar helper uses Shapely 2.0.7 / GEOS 3.11.4 in the temporary geometry environment. These are source-authoring tools, not new app dependencies. Raw execution logs retain same-byte `.log.txt` copies so fixed snapshots include them. Runtime/core/browser reports belong in the sibling `authored-cove-runtime` folder, outside this source collector.
