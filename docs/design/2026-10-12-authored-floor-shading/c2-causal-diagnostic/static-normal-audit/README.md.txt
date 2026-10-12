# c2 hill fine-line: static diagnosis

This is a narrow read-only diagnosis of the same fixed c2 hill view as the root shadow-off/unlit probes. No source/candidate edit, fresh browser, build, or domain compilation was run. Existing screenshot and metadata were read; Python parsed the existing source-shading gzip in a few seconds.

## Findings

- The actual renderer creates normals with computeVertexNormals, then overwrites every vertex having a source normal (`authoredGrowingGround.ts:103-105`). The ten original floor groups use one PBR setting (roughness 0.7799999714, metalness 0); splitting the terrain colors does not create different PBR materials. Water bed/addition groups use a separate default material.
- Extraction keeps GLB normals after the normal matrix, and the domain only rotates them. Water clipping interpolates the field, but the observed fine-line segment is around world z=-4.86; this probe's water centers/streams are near z=-9 to -8. The corresponding original terrain:0 group retains its 38,007 triangles in the renderer metadata.
- The source same-position audit found 131,942 shared edges, no exact duplicate physical triangles, and no open source edge in the selected hill ROI. Its 10 ROI normal-discontinuous shared edges belong to the Grove terrace perimeter, not this hill segment. This is not a proof against every T-junction, overlap, runtime composition error, or geometry gap.
- A source-only orthographic ray, using the actual captured camera, changes from a background slope at pixel (727,614.5) to a near ridge at (727,615). At the latter pixel, source `Island / continuous sculpted mature terrain:0` triangle 36705 has a geometric normal facing the camera (dot +0.079383), while the interpolated smooth source normal faces away (dot -0.167274). The neighboring ridge back face lies about 0.005808 view-depth units behind at this pixel. This is a concrete candidate for a narrow lit-shading artifact at a self-occlusion contour, not a proven cause of the entire line.
- That source triangle has vertices [19456,20205,19457]. Expected combined renderer indices start at 118563 with global vertex indices [23109,23858,23110]. These offsets must be confirmed from the actual floor buffers before any intervention; this offline audit did not export the live buffer.

## Minimal next causal test

Use the existing external actual-renderer hook. First confirm the target triangle coordinates/index mapping and preserve the baseline normal/material/light/camera/physical hashes. Keep shadow reception off consistently in both arms. Within a small world-space ROI enclosing this ridge segment only, temporarily replace the smooth interpolated fragment normal with the geometric normal from `normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)))`, using the same convention as Three's FLAT_SHADED branch. Keep MeshStandardMaterial, PBR values, vertex colors, lights, camera, geometry/index/normal buffers, and world state identical. Restore the original material/shader afterward and verify restoration.

The shader injection must state whether it replaces both `normal` and `nonPerturbedNormal` (the latter drives Three's geometryRoughness). Replacing the local shading-normal field in both terms isolates that field as a whole; a later separate derivative-only test is only warranted if the first test changes the line. A locally changed shader is diagnostic, not a proposed shipping repair. If the line does not change in the matched ROI, preserve the negative result and investigate the remaining lit terms rather than smoothing the whole island.

## Evidence

- `audit.py` / `report.json`: shared-point/edge source audit, explicit scope.
- `roi.py` / `roi-report.json`: approximate image-line to source point mapping.
- `ray.py` / `ray-report.json`: front source-floor ray hits around three image samples.
- `candidate-cause.json`: exact triangle coordinates, hashes of nine pipeline/payload/shader inputs, and proposed intervention.

The parent owns the durable archive and the original actual-renderer visual judgment. This diagnosis alone changes neither runtime acceptance nor the visual HOLD.
