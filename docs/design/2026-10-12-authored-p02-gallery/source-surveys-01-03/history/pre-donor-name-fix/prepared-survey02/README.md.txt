# Corrected P02 donor survey — prepared, not executed

The original run/log/results and pre-fix script are preserved byte-for-byte under `../history/pre-donor-matrix-fix/`; its archive proof covers 20 files / 93,567,766 bytes. All original run artifacts were rehashed unchanged after this edit. Eight frozen inputs, study.json, entry_geometry.py, supervisor and physical tolerances remain unchanged.

The only measurement behavior repair is donor transform lifecycle and validation. Link all four donors, update, record pre-link/basis/world/evaluated matrices and evaluated bounds, and require original GLB node/local/source-world correspondence for all four. Apply `B @ A @ BI @ captured_source_matrix` once, update, require matching evaluated matrix/mesh and unchanged local geometry. `vertices_faces` now pairs the evaluated mesh with its evaluated matrix. No offset fitting, parent stripping, automatic adaptation or geometry edits. Unexpected parent/constraints or parity failure stops before route generation with raw HOLD/first-failure evidence.

Bounds arithmetic uses doubles from captured Float32 mesh/matrix and the unchanged `1e-7` epsilon; no larger gap/parity allowance was added. Authored reference bounds use the explicit target matrix, and the mathematical source-world→A bounds are also recorded to expose numerical transform differences. A source/GLB export discrepancy is HOLD, not snapped into agreement.

Python syntax/compilation, frozen input identities and **8 static/arithmetic cases PASS**. Corrected donor parity in Blender and actual geometry survey remain **unexecuted**. Original native floor/source mass and all three horizontal entry candidates remain unchanged.

After the parent opens the next window, run exactly once from the study root:

```sh
python3 supervise.py --scheduled --seconds 180 --rss-mib 2560 --log runs/02-survey.log.txt -- /Applications/Blender.app/Contents/MacOS/Blender -b --threads 2 --python source-study.py -- measure --scheduled --out runs/02-survey
```

Fresh destination is reserved in the manifest but not created. One CPU-2 Blender process, 180-second / 2560-MiB sampled RSS limits, no retry/build/render. The execution observer must record supervisor and owned Blender PIDs, UTC start/end, observed RSS and before/after input hashes as in the first run. Other functional regressions remain uninterrupted.

New stage records are `donor-source-parity.json` and `donor-authored-parity.json`. Only after both match will candidate-N, partial and measurement outputs be generated. All geometry/HOLD rules remain as before.
