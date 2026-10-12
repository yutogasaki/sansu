# Gallery east v6: retracted low entry — HOLD

This source-only candidate is closed as **HOLD / known route contacts remain**. It is not delivered to the app. The current `native-gallery-v5` assets, original tree, owner transforms, upper stair, handrails and other app files were not changed. No Blender, browser, full 35-owner reachability query or rendered art review was run for this candidate.

The [existing route diagnosis](../../2026-10-12-authored-whole-rough/route-diagnosis/summary.json) found that adding the v5 gallery made 22 of 35 owners unreachable; adding support floor did not repair it. This candidate tried to retract the three low entry parts while retaining the first raised stair and upper geometry. It did **not** solve that cut.

## Source change and retained geometry

The [builder snapshot](build-source.mjs.txt) replaces only the body/top primitives of `terrain-threshold`, `front-junction` and the low portion of `real-sixteen-stairs`. The threshold follows the actual native floor before rising to y=1.681410074; the junction moves to (3.455, 1.681410074, -7.89). A 0.64-wide curved lower stair landing joins the original first riser. The [spec](attempt-03/spec.json) and [terrain provenance](attempt-03/terrain-lineage.json) record the exact construction.

[Geometry checks](attempt-03/geometry-checks.json) retain 33 other nodes and their primitive bytes, original material JSON, owners and transforms. The [replacement proof](attempt-03/lower-source-replacement.json) records 3,048 body and 1,440 top triangles retained with exact original positions, normals and triangles; only the lower 408 body / 244 top triangles were replaced. The inherited delivered stair had 94 exact-weld boundary edges; this is source context, not a newly certified whole-gallery solid. No guard or traversal bypass was added.

Coordinates remain authored Y-up world coordinates from v5. Runtime would only apply its existing renderer translation; no additional 0.45 source scale is intended. The candidate manifest's artifact URL is a suggested basename only: **no file was installed at that URL**.

## First failure and classification

The [earlier contraction attempt](../east-v6-entry/README.md) remains intact. This directory preserves its prior builder in [history](history/attempt01-builder.mjs.txt).

| Execution | Outcome | Meaning |
| --- | --- | --- |
| [attempt-02](execution-attempt-02.json) | Exit 1; [first failure](attempt-02/first-failure.json) at compound stair closure | Ten edges had four incident triangles. No GLB was produced. |
| [attempt-03](execution-attempt-03.json) | Exit 0; asset generation only; [result HOLD](attempt-03/result.json) | Same shape as attempt-02. The check distinguishes two individually closed solids from their non-manifold combination; this does not pass the old union condition. |

The threshold and junction each have zero open/non-manifold edges and positive signed volume. The upper and new lower stair solids separately have zero bad edges and zero zero-area triangles. Their combined stream still has ten four-incident edges. **A manifold Boolean union is not claimed.** The [pre-classification builder](history/attempt02-before-compound-check.mjs.txt) and both raw execution logs are retained.

The [actual-triangle interface audit](attempt-03/compound-interface-audit.json), produced by [audit-compound.mjs](audit-compound.mjs), records all ten shared edges and their four incident faces. It also finds positive-area coplanar overlaps on visible top surfaces at y=1.681410074. For example, threshold/junction sum to 0.143103㎡ and junction/stairs to 0.159818㎡ across triangle pairs. These are pairwise overlap sums, not union areas. The overlap includes retained opening/interior top surfaces. Thus the assembly cannot be described as internal contact only or as free of z-fighting; a rendered artifact is not asserted because no render was made. Individual closure does not compensate for this failure.

## Known path contacts remain

The [contact report](attempt-03/cut-edge-contact.json) reuses the original saved actual actor bands and ground extrema, checking only these three modified parts. It does not remeasure the rig or rerun the world graph.

| Saved edge | Candidate triangle/band hits |
| --- | ---: |
| (3.5,-6.75) → (3.5,-7) | 7 |
| (3.5,-7.25) → (3.5,-7) | 232 |
| (3.25,-7) → (3.5,-7) | 7 |
| (3.75,-7) → (3.5,-7) | 156 |

All remaining hits are the real stair body/top. The curved low landing flares into the road: a recorded side triangle includes (3.6323092,1.6814101,-7.2596865) and (3.6942372,1.6814101,-7.2400618). The last edge also hits the retained first raised stair underside, for example (3.8887031,1.6114100,-7.3732491), (3.9106092,1.6198989,-7.3731627), (3.8868091,1.6114100,-7.2132607). Keeping that geometry fixed while repeating the same local entry idea is not established as viable. Further shape selection waits for separate read-only evidence about supported detours / graph coverage.

## Reproduction and identity

From the repository root, the generator requires a fresh output directory:

```sh
node tools/build-authored-gallery-entry-kit.mjs --attempt 2 --output NEW_DIRECTORY
```

The exact current script is preserved above. Attempt-03 [inputs before](attempt-03/inputs-before.json) and [after](attempt-03/inputs-after.json) match; [closeout identity](closeout-identity.json) also checks them against the files at closeout.

| Artifact | SHA-256 |
| --- | --- |
| Original delivered v5 gzip | `e5cdf3424ab1132fcc1b22d0ea8aa89ae520b0f3137ab252898efd781c842ac6` |
| Original expanded v5 GLB | `e7a8c6dee084c11c199b50b31798b3a8fcf33215252de375d03342da82807919` |
| [Candidate GLB](attempt-03/native-gallery-entry.glb) | `22d6c592ed986d47f9307392550712ed34c4eeb49d07eaeebe99940e3e2b0195` |
| [Candidate gzip](attempt-03/native-gallery-entry.glb.gz) | `574bb38161e01b5381e0475490201371cc0932f7a2066467051d5c158aac57b2` |

Focused syntax/lint and local README-link checks are recorded in [closeout checks](closeout-checks.log.txt). These verify packaging/code only. Full reachability, source/app visual appeal, real use, normal purchase/save and M1 completion remain unverified by this source candidate; independent child observation N=0.
