# First leaf — exact-zero face comparison (prepared only)

No Blender execution yet. This is a new bounded diagnostic; stage4, its first failure and the completed normal-debug stay unchanged. It is not a stage4 rebuild or source correction. CPU2 / one process / observed RSS2GiB / 60 seconds.

The previous pure accessor audit proved original GLB and extracted role POSITION/NORMAL/index arrays are identical. GLTF→Blender local coordinate mapping matches all78 input vertices exactly, and all456 imported loop vertex indices match the original index accessor. At node2239 (`l14`, first hanging leaf), original NORMAL is unit length; imported pre-deformation corner normals already differ at17 corners (maxL2 .5755355). Five corners atvertex0 later fail the original .002 expected/stored guard. Four source triangles have **exactly zero area**: indices0,2,98,100. Their causal effect is not yet established.

This diagnostic reimports the fixed context and roles but touches only temporary copies of that one leaf. It checks the original imported leaf exactly matches the saved input; the previous19 independent deformations are not rerun. There are three cases:

1. **Imported baseline:** unchanged imported data copy; original stage4 field and guarded method.
2. **Original topology + raw source NORMAL:** same copy, with literal original NORMAL values assigned by the proven index→corner mapping. No normal recomputation.
3. **Only exact-zero faces removed + same raw source NORMAL:** preserve all78 positions and original edges, remove only the four faces whose float64 cross product of original float32 coordinates equals `(0,0,0)`. Keep all remaining face order/indices, smooth flags, material slots/index and sharp flags. Assign exactly the same original NORMAL payload on retained corners. No epsilon, near-zero removal, vertex weld, coordinate change, normal generation or recalculation operator.

**Compare cases2 and3 to isolate the face-removal effect.** Comparing1 and3 alone would conflate restoring source NORMAL with changing topology. The normal setter may itself alter Blender's internal sharp flags; before/after dictionaries are recorded rather than assumed unchanged. Case3 creates a temporary mesh with the retained face list and the original vertices/edges. No result is written back to the source object or saved as `.blend`/GLB.

Each case uses the unchanged original `deform.apply` and .002 guard. A Python return-frame observer records its actual locals even when it passes, without patching the function. It also compares stored output to the desired inverse-transpose result using the literal original NORMAL, so passing a guard against already-corrupted imported normals cannot masquerade as preserving authored shading. Original and deformed vertex positions must be exactly identical across all three cases.

Outputs retain source-face/source-loop correspondence, provided raw normals, before/after stored normals, exact method error/result, source-normal error, geometry parity and sealed input hashes. No joins, 70-leaf test, actor test, new source production or renderer runs. A successful diagnostic does not authorize any correction.
