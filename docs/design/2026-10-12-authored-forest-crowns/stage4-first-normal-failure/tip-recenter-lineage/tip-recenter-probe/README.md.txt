# Tip-relative local mesh — bounded probe, not executed

This is preparation for one leaf (l14/source2239), not a source correction, full stage4 build, art view, or runtime integration. No Blender execution is authorized by this README. The original asset retains 78 vertices/152 triangles. All probe meshes explicitly omit only original exact-zero faces0/2/98/100 and retain the other148 with original index correspondence. That exclusion remains diagnostic and is **not** claimed to preserve all original topology. Nothing is deleted or enlarged at the newly collapsed faces45/47/146/150.

Offline saved-data analysis found that original vertices36/37/38 differ by 4.22468e-13 in local x. Their first `point = transform @ vertex.co` result is stored as Float32, where all three become identical. The same-build arithmetic replay matches all24 previously recorded world-point/field-target samples exactly. The relevant implementation accumulates float products in double and stores a float result. [Blender build9e2066aef7ef, column_vector_multiplication](https://github.com/blender/blender/blob/9e2066aef7ef/source/blender/python/mathutils/mathutils_Vector.cc#L2059)

Float64 evaluation alone does not preserve the four faces when the final vertex coordinates are stored at the old local origin. In the offline counterfactual, subtracting the deformed tip before Float32 mesh storage retains all148 nonzero local triangles. Compensating that offset in a child transform is mathematically the same authored field. The owner/root transforms stay fixed; the leaf child matrix changes explicitly. Whether Blender storage and export preserve its normals is still untested.

The probe uses two sharp-flag settings: the six original edges incident to vertex38 and all228 edges. Each first recreates the raw source input NORMAL at every retained corner and must reproduce the earlier readback exactly. Each then compares two **fresh** deformed mesh representations with the same Float64 positions/J/desired normals: old pivot (control) and tip-relative pivot. Both fresh meshes have no inherited custom-normal data, so any benefit from rebuilding the basis is controlled consistently. The old failed matrix/field records remain separate baselines.

The same authored field runs with Float64 world/local arithmetic until final Float32 storage. Jacobian samples use the unchanged central-difference step1e-5 and determinant floor.2. Desired normals come from literal original GLB NORMAL via `A^T J^-T A^-T`, normalized, not Blender’s altered imported normals. The source-input and desired-source output thresholds are both unchanged .002. Input and desired-output vectors, sharp flags and matrices are retained in raw records.

All78 world-coordinate errors against the Float64 field targets are recorded. A declared **diagnostic representation bound** of1e-6 world units gates roundtrip work; it is separate from the .002 normal criterion and is not a product acceptance threshold. Local triangles use exact rational zero-area checks on stored Float32 coordinates. A separate Float32 world-cast check reports any remaining sub-ULP collapse; nonzero local authoring triangles must not be described as nonzero GPU/world triangles.

Only cases passing both normal criteria, local face checks and the declared representation bound are exported as a standalone leaf. Their GLB POSITION/NORMAL/index accessors are compared against the desired local triangle/corner multiset with exact positions, no weld/epsilon. Then Blender imports that GLB, its corner normals and local face areas are checked, and it exports a second GLB for the same accessor comparison. Matrix changes during roundtrip are bounded/recorded. PBR values and extensions are checked against the original extracted leaf material; material names do not hide geometry. All imported original meshes, materials and owner/root transforms are checked unchanged.

Resources for a later explicit window: one Blender process, CPU2, sampled RSS2GiB limit, 60-second limit, no automatic retry. Successful completion would establish only a local representation/roundtrip result for this leaf. Original file hashes, 27 fixed roles, other owners, materials, field controls and normal tolerance remain unchanged. No joints70, actor, whole source-art or runtime pass is implied.

`prepare.py` performs only Python syntax checks and pure numerical/oracle tests, then seals code and immutable inputs. `run-once.py` checks the seal before launch and afterward. The future command is:

```sh
SANSU_FOREST_TIP_RECENTER_APPROVED=1 python3 /private/tmp/sansu-authored-forest-crown-study/stage4-organic-boughs/normal-debug/tip-recenter-probe/run-once.py
```

Do not execute until root assigns the next source window. A successful source correction, if later chosen, needs a distinct derived revision and explicit152→148 face provenance.
