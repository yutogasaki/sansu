# Active temporary-scene export — preparation only

This preserves the first isolated-export failure: first GLB scope failure (2 scenes /131 mesh nodes), then original diagnostic-object transform guard, then sampled RSS>2GiB terminal stop. Original raw and scripts are unchanged in `../tip-recenter-isolated-export/`.

## Minimal export option correction

Installed Blender5.2.1 exporter `__init__.py` exposes `use_selection` and `use_active_scene`, both false by default. Our previous call set only `use_selection=True`. `gather.py` selects `bpy.data.scenes` when `gltf_active_scene` is false; `tree.py:construct` changes the window scene for each. Selection filtering happens within each scene. The new call adds only `use_active_scene=True`, keeping the existing selection and all export/mat/normal options. These installed primary source files are SHA-bound.

Immediately after export the scene count, mesh count/name and indexed triangle count are flushed before asserting one scene, one exact named leaf,148 triangles. The actual POSITION oriented triangle multiset is then flushed and asserted exact. NORMAL and world-point oracles are unchanged. All-scene traversal is a plausible cause of the diagnostic original matrices being reevaluated, not yet a demonstrated causal fix.

## Exact guards and bounded observation

All442 original plus2 diagnostic meshes, parent/world/basis/inverse matrices, normals, topology, sharp flags, materials, scene membership/frame remain under exact before/after guard. No original data restoration or repair is performed. The sole snapshot representation change streams each mesh's complete ordered edge vertex indices and sharp boolean through typed SHA256 instead of retaining repeated raw lists (each old snapshot JSON was107.6MB). No edge/object is omitted. The leaf still has full before/after raw attributes and component hashes. This reduces measurement overhead without relaxing equality.

Same Float64 field/J, raw-source NORMAL inverse-transpose, .002 normal and1e-6 diagnostic world bounds. Original four exact-zero faces are excluded only on the148-face diagnostic clone. Original152 remain. Four microscopic faces still collapse after Float32 world cast; this limitation remains separate from local148-face validity.

Six-sharp tip only; one temporary export copy, GLB→Blender reimport→second GLB; no all-sharp/full stage4/render/runtime adoption. All78 world points,148 exact local triangles, desired-source normals and PBR/extensions are checked through the roundtrip. CPU2/RSS2GiB/60sec, no retry.

Preparation only. Root decides execution after readiness SHA. No Blender launched by preparation.
