# Independent native05 cove source-to-world review

2026-10-12 JST. Candidate: `native05-authored-cove-corner-v3`. Fixed fixture: `authored-flower-reference-mature.json`, with p6=(7,-1), p7=(9,-1), p9=(8,0). This review found no source-level issue that should stop integrating this fixed candidate. It does **not** establish an app, visual, use-flow, or whole-island acceptance result. App and authored source files were not edited; no browser/GPU run was performed.

## Frozen identity and materials

Paths below are under `docs/design/2026-10-12-authored-cove-entrance/`:

| Artifact | SHA-256 |
| --- | --- |
| `cove-corner-v3.glb` | `f08ada4907c76a617e2c22090049b9b2880dde2d75fa11ad61f6e76c7eec7146` |
| `cove-corner-with-apron-v3.glb` | `81b1ff0bf9d050d5c78d40d21ee4a664d8e7088feacd082f6c91c5e86a235a6c` |
| `cove-corner-with-apron-v3.blend` | `52b3a24c79ada053728ca55d2c2fb7b86f6954e5e77164a375434446f2952696` |
| `shared-apron-world-patch-v1.json` | `66294123a26f6e4ecb8af2e530aee7e59370d3495bf3c9e4447376ce4fc6c3bc` |
| `assembly-manifest.json` | `092e21cee39bad1f386cf446e3b6901bcdd275f34583da6e4e51a384875dfbf9` |

These are the final material-aligned files, not the earlier combined export. Independent comparison found the shell geometry and all shell material definitions unchanged between shell-only and combined GLB. Pearl/violet transmission remains approximately .72/.69. Apron top is #ccc9d4 and bank #bbb8c7, with corresponding linear glTF color values, roughness .8 and metallic 0.

The adopted `2026-10-10-island-final-3d/whole-island` original GLB, Blender file and benchmark image retain their known hashes: `8398eda9…`, `d1c7bb07…`, and `9de26a7f…` respectively. Full hashes are in the audit JSON. Author `source-continuity.json` records preserved source regions and frame joins; this review did not independently repeat every Blender Boolean/curve topology check.

## Geometry parity and single rendering contract

The independent GLB reader applies complete parent/node transforms. Its apron extraction contains 331 top triangles, matching the patch indices/topology after nearest-vertex correspondence. Maximum exported vertex difference is 4.252e-7 world units. The combined export preserves the separate shell geometry.

There is one explicit numerical exception: patch top triangle 330 is almost collinear (original upward area 1.482e-11). GLB Float32 coordinates reverse its winding, producing a downward area of 6.708e-10 near x=6.487,z=-.548. Thus 330/331 top triangles remain upward. This is a negligible export sliver, not exact coordinate/winding identity; it does not create a meaningful supported-route gap in the patch floor. This exception was disclosed to root and author; no model rework was requested.

Integration should render the shell-only GLB and render the apron from the composed world's floor/surface geometry exactly once. Do not also display the combined GLB apron. The combined GLB is source/evidence, not a second floor draw. Source material parity does not prove runtime GLTFLoader, transmission, or shader behavior.

Common transform: source GLTF pivot (13.9,.89,1.2), authored position (8,.0475,.5), uniform scale .45 and yaw 0. Source Blender→GLTF is (X,Z,-Y). Renderer coordinates subsequently subtract `layout.center` from X and 2 from Z; Y is unchanged. Apply node matrixWorld, pivot, uniform TRS and renderer offset once each. The floor patch is already in authored-world coordinates.

## Existing ground, navigation and width support

The patch was independently applied to compiled base world and the current water-composed world. It preserves old floor definitions, anchor floors, old site prefixes and old edge prefixes. Both retain 73 build grants and add exactly 13 walk-only refs / 15 edges. Four refs append to existing districts via `siteAdditions`; nine belong to the new patch district. These are not new owner cells.

The added apron is one valid polygon with area 2.471875235544728 and 331 triangles. Boundary-fill difference is 0. Overlap with original dry ground is only 2.143e-12 area, numerical tolerance. Ground boundary distance is 0 and the shared boundary length is 4.600923. The 329 checked seam vertices differ in height by at most 1.416e-5 world units. This establishes a connected plan footprint with negligible seam-height differences; it does not assert bit-identical seam coordinates or validate every rendered sidewall.

The actor envelope exactly equals the actual c5 screenshot report's indexed-source-motion-interval envelope: 117 meshes / 99,868 vertices from pokomoko plus eight friends, all at .45 scale, including motion intervals. Radius .24406937059140585; height .5500928879753579. Every one of the 15 added edges was checked with a conservative edge AABB expanded by radius+.04 = .28406937059140586. Added+existing floor union leaves zero uncovered area for all 15 boxes, in both base and water-composed worlds. This is continuous planar width support, not just center-point support.

## Shell obstruction, houses and structural contact

All 79,384 shell/frame/socket triangles were explicitly included in the actual actor-band obstruction algorithm through a diagnostic eligible-root wrapper. The current flower-only root selection must be generalized in production; omitting shell triangles would invalidate a route result. Both base and water worlds exclude 37 walk refs. Reachable approaches are p6=2, p7=7, p9=6; of these, direct source-guard-clear approaches to the owner are p6=2, p7=4, p9=5. Production must select a clear final approach, rather than assume every adjacent ref reaches the owner.

An independent hierarchy plus full triangle SAT, including coplanar axes, checked actual shell/frame/socket geometry against the original home-cap geometry at actual p6/p7 layouts (.45,.5625,.45 home scale). At 1e-8 world tolerance, 89 broad-phase candidate pairs produce zero intersections. This is a fixed-house surface-intersection test, not a universal layout guarantee or a proof about every future added decoration.

Structural support was checked beyond author vertex-only grounding: all 192 downward socket-bottom GLB triangles were intersected with actual water-composed dry-floor triangles. Their total projected area is .312497213. Clipping each overlap by the affine condition groundY−bottomY >= 0 and unioning admissible regions leaves at most 5.450e-17 area without contact, numerical tolerance. Thus there is no meaningful floating bottom region in this fixture.

Do not claim uniform .006 burial or a .003 minimum everywhere: the stricter .003-depth coverage test leaves up to .000212964 area uncovered in one bottom triangle. Highest-floor depths sampled at 7,972 overlap vertices range .003018–.007695 world units; that sampled minimum is not a proven continuous lower bound. The raw JSON minimumDepth=-.028096 considers buried lower overlapping terrain planes, not the highest support surface, and must not be read as a floating failure. The continuous contact-union test is the relevant non-floating result.

## Water scope and outstanding integration evidence

The actual water frame used revision `authored-water-v2:3c5f4ee9f492cc25:eb41954202b1926a` with owners l22,l21,l20,l23,l24. This independently covers the current fixed candidate over that water-composed world, including floor/nav preservation, full width and cove source obstruction. Other water arrangements or moved owner layouts remain unverified.

Still required in the app: hash-verified loading and source-material rendering; composed-world/source transform parity; combined flower/cove/other obstruction eligibility; preview/commit parity with committed actors retaining their canonical physical world during ghost preview; cancel, move, separation, store/reload and removal of shell plus patch sites/edges/floor together; actual walk→play→exit and carry/drop/receipt use; whole/close/rotated/phone visual checks. This source review does not advance those gates or establish whole-island completion.

## Reproducible evidence

All diagnostic paths are under `/private/tmp/sansu-authored-cove-plan/`:

- `independent-audit.mjs` / `independent-audit.json`: source hashes, full-transform parsing, triangle parity, fixed house SAT, compiled-world invariants and source obstruction.
- `independent-floor-audit.py` / `independent-floor-audit.json`: planar unions, conservative widths, seam samples and continuous socket contact. Shapely 2.0.7 / GEOS 3.11.4.
- `independent-floor-input.json`: actual compiled ground, edge and exported socket inputs for that diagnostic.
- `independent-material-audit.json`: complete shell-material equality and final apron colors.
- `independent-input-provenance.json`: final manifest/Blend/fixture/world/report hashes and equality with the actual c5 actor envelope.

The diagnostics do not write app or authored docs. The reports preserve their own input identities; future implementation changes require the relevant integration checks to be rerun.
