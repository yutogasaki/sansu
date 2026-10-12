# Isolated export copy — preparation only

A new six-sharp tip-recenter probe. The first probe and observation-only run are immutable in their sibling directories. No full stage4, all-sharp, source adoption, render, browser or app change is included.

## Exact preserved contract

The same Float64 field/Jacobian and raw-source NORMAL transport are used. `geometry.py`, original accessor oracle, their tests and resource runner are byte-identical. Input, desired-source and exported NORMAL retain .002; all78 world positions retain the 1e-6 diagnostic bound. This does not loosen the original authoring transform check.

Only the four originally exact-zero faces0/2/98/100 are excluded on the diagnostic clone. The original152 faces are untouched; the candidate has148 retained faces. The four microscopic faces45/47/146/150 can still collapse when evaluated world positions are cast to Float32. Local nonzero148 faces are not claimed to resolve this separate GPU/world limitation.

## Export isolation

The actual authoring object stays in its original scene and parent. A disposable deep mesh copy is unparented in a new temporary scene and receives the same world matrix. Context switches to that scene for export, GLB reimport and second export. No object from the authoring scene is selected, transformed or repaired.

Before switching, all original objects (including the fixed442 meshes plus the two diagnostic meshes), object/parent/basis/world matrices, mesh/loop/corner-normal hashes, sharp flags, material hashes and scene membership/frame are frozen. After scene switch and after returning/temporary cleanup they must be exactly equal. If switching scenes evaluates pending original transforms, this is a HOLD; no assignments restore them to make the guard pass.

The temporary export copy's POS/indices/NORMAL/sharp/material and matrix are flushed separately before/after export. Only its matrix may be reevaluated; all other components stay exact. Its emitted GLB must still reproduce the148 exact local oriented triangles, desired source NORMAL .002 and all78 same-field world points within1e-6. PBR/extensions remain tied to the original source material.

The successful first export is reimported into the temporary scene. Reimported normals, triangles, nonzero faces and world points are measured against the original desired source oracle. A second GLB repeats the same checks. Temporary data are removed; original data are never repaired.

## Bounded execution

CPU2, sampled RSS2GiB,60s, one fresh `execution-01` / `attempt-01`, no retry. This is preparation only; root will decide execution after receiving readiness SHA. Child-local rounding on a disposable export is kept in raw and cannot substitute for exact original scene preservation.
