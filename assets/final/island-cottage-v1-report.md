# Island cottage — Meshy → Blender pipeline test

- Date: 2026-09-16 JST
- Result: one Meshy generation completed, raw saved, Blender inspected and adjusted, final GLB exported and reimported successfully.
- Scope: standalone asset experiment. No game runtime integration, product behavior, deployment, or release claim; product specs unchanged.
- Input: assets/source/island-cottage-v1.png (built-in image_gen; prompt stored beside image).
- Meshy task: 01a0aaaa-4f68-7154-bfe9-cd7d7eb1bac8
- Model: meshy-7, standard; textures=true; PBR=true; 2K; GLB; ultra=false; triangle topology; target 20,000; generation-integrated remesh=true; symmetry off; remove_lighting=true; origin_at=bottom.
- Generation calls: exactly 1. No separate remesh/retexture/conversion/rigging calls. No purchase or recharge.
- Credits: 1,000 → 970; task reports 30 credits.
- Time: approximately 205 seconds from request start to observed success (polling-inclusive; server compute time unavailable).

## Files

- Source: assets/source/island-cottage-v1.png
- Raw: assets/meshy_raw/island-cottage-v1.glb (9,448,048 bytes)
- Separate raw maps: assets/meshy_raw/island-cottage-v1_textures/
- Final: assets/final/island-cottage-v1.glb (9,448,088 bytes)
- Editable inspection project: assets/final/island-cottage-v1.blend
- Review renders: assets/final/island-cottage-v1-review/front.png, back.png, reimport.png
- Structural evidence and hashes: assets/final/island-cottage-v1-review/glb-verification.json

## Blender 5.2.1 LTS adjustments

- Imported into a separate scene, preserving the user's initial scene.
- Renamed mesh/object/material to IslandCottage / IslandCottageMesh / IslandCottage_PBR.
- Uniform geometry scale: 1.576733303526855; height 3m; dimensions X 2.882076m × Y 2.596672m × Z 3m in Blender.
- Subtracted bounding-box bottom-center then scaled vertex coordinates. Origin at bottom-center; location/rotation zero; scale one.
- Orientation already upright and front-facing toward Blender -Y; preserved. GLB uses Y-up with front +Z.
- Faces: 19,513 triangles, raw and final. No further decimation necessary for this test.
- Preserved imported custom normals, UVs and PBR maps; color texture sRGB and data maps Non-Color.
- Material has base color, combined metallic/roughness, and normal maps; each 2048×2048. Combined metallic/roughness accounts for three embedded images versus four standalone raw maps.
- No extra imported objects. Restricted final export to selected object AND active scene; inspection camera/lights and original default cube excluded.
- No speculative automatic hole filling or normal recalculation. UV-split imported vertices give misleading boundary counts. A scratch-only weld check left 103 boundary edges and 163 nonmanifold edges; mesh is not certified watertight. No visible major holes in reviewed front/back views. Appropriate for visual test, not validated as collision or fabrication geometry.

## Verification

- GLB v2 header, declared file length, single mesh/node, 19,513 triangles, embedded images and PBR references checked.
- Final bounding box: X [-1.441038, 1.441038], Y [0, 3], Z [-1.298336, 1.298336] in glTF coordinates.
- Raw and final embedded image bytes have identical SHA-256 hashes.
- Reimported final into a fresh Blender scene: single mesh, one material, expected dimensions and face count.
- Re-rendered with same camera/lights: mean absolute RGBA pixel difference on 0–255 scale = [0.0001578125, 0.0000984375, 0.0001375, 0].
- Exporter warned about multiple texture nodes contributing to a packed texture sampler. Embedded texture equality and reimport rendering confirmed preservation for this asset.
- App test suite not run: no application code or runtime asset references changed. In-game appearance/performance and child testing remain unverified.

## Visual findings

- Recognizable match: overall gabled silhouette, yellow/pink/cyan tiles, chimney, arched door, front and side windows, foundation and doorstep.
- Tiles appear paler and less saturated than input, with irregular light patches.
- Some wrinkles/dents on tiles, walls and foundation; trim/detail softer than source.
- Back and unseen roof were inferred from one view and cannot be checked against the input.
- Visual appeal: usable pipeline candidate; source-quality parity not achieved.
- Silent comprehension/safety: recognizable house in agent review; no independent child observation.
- Runtime integrity: GLB round trip passed; game integration and release untested.

## Issues and automation improvements

1. Preflight should verify image existence/hash, balance, Blender connection and compatible addon protocol before spending. Connected addon protocol 5 vs server 7 generated a compatibility warning.
2. Persist task ID before polling and refuse duplicate generation on retry. Poll timeouts were waiting limits, not generation failures.
3. Capture server timestamps when available; this test only has polling-inclusive elapsed duration.
4. Blender 5.2 dynamic export_format enum returns no useful default in generic RNA inspection; initial assertion failed before export. Installed exporter source confirmed GLB; explicit format fixed it.
5. Selection-only export included a selected cube from the user's other scene. use_active_scene=True plus use_selection=True fixed it; structural validation caught and prevented delivering that intermediate file.
6. Automate dimensions, axis, bottom-origin, texture embedding, object-count and reimport-render checks.
7. Define per-asset mobile polygon/texture/file-size budgets, collision geometry and LOD policy before production. This ~9MB 2K asset is a pipeline result, not a measured mobile budget pass.
8. Use neutral fixed-light reference renders and a source/3D comparison for texture saturation and geometry defects; preserve manual visual approval separately from technical pass.
