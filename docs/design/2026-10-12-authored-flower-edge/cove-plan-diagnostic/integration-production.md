# P04 corner shell + apron — minimal integration plan

2026-10-12. Read-only architecture investigation; app sources remain frozen for c6. The worker owns `docs/design/2026-10-12-authored-cove-entrance/`. Its local candidate is experimental and fixed to the present P04 arrangement. The final source handoff targets `cove-corner-with-apron-v3.blend/.glb` and shell-only `cove-corner-v3.glb`; grounded sockets and a `.284069` half-width floor sweep passed the separate source audit. Trust its final artifact manifest, not earlier v1/v2 geometry. App integration is underway after the c6 boundary was archived. No composed-runtime integration or acceptance is claimed here.

## One-way composition

Add a small domain-level `authoredWorldFrame.ts` coordinator alongside the unchanged `authoredWaterFrame.ts`. Its dependency/order should be:

1. Immutable original base + current state → existing `authoredWaterFrame(state, base)` when water is enabled.
2. `derivePlaces(state, upstreamWorld)` → eligible **input** P04s. Read the play owner from `mainIds` / the real play use target, not `anchorId`: the present P04's anchor is p6, while its play is p9.
3. New pure `deriveAuthoredCovePlan(state, upstreamWorld, inputP04s, sourceProfile)` → explicit eligibility, one shared transform, source identities, support/entry specification and apron patch. No Three.js, SceneLayout, saved geometry, receipt or actor state belongs here.
4. New `composeAuthoredCoveWorld(upstreamWorld, plan)` → append the supported apron floor/bank, walk-only sites and edges; compile once through `compileWorldDefinition`. Return `{ world, waterPlan, covePlan, revision }` from the coordinator, with `revision` describing the **whole** frame.
5. Layout, ordinary final `derivePlaces`, relations, owner placement checks, rendering and committed life all read that returned world. Verify final P04 membership/use identity agrees with the plan; the patch must not bootstrap its own qualification. If adding its route changes the qualifying owners, reject the plan rather than repeatedly feeding final places into composition.

Keep `derivePlaces`, `worldDefinition` and `sceneLayout` free of calls back into this coordinator. Pass plans into layout as data/type-only dependencies. This makes the flow acyclic: frame → water / places / cove composer; renderer → frame / layout. Never compose from an already composed cove frame, or old apron sites can survive removal.

The first production profile should state its proven applicability explicitly. Derive whether the current owners, stages, supply, shore and role-relative positions match it. Do not hardcode that the strings `p6/p7/p9` alone authorize a permanent structure, and do not translate the fixed apron freely with a moved play until that placement has been proved. Moving, storing or separating required inputs must deterministically remove/recompute the entire shell-plus-apron assembly. Ordinary owners remain. A nonapplicable authored-cove plan must not silently fall through to the old enlarged household roof.

Cache by immutable base, enabled features/profile identity and all actual derivation inputs. Existing water cache uses only plots/landmarks/keepsakes; cove additionally depends on `unopened` (`places.ts:193`). Include every other field consumed by its planner, while excluding receipt-only `applied/placeProgress`. Keep bounded cache eviction. Composite revision must include upstream water revision, cove source/profile hash, eligible owner roles/positions/stages and the evaluated transform/patch; a cove-only change cannot be keyed only by `waterPlan.revision`.

## Existing integration points

| File / function | Smallest responsibility |
|---|---|
| `src/prototypes/placeQa/authored.tsx`, `AuthoredIsland` | Use the common frame for UI `world`, placement permissions and `applyIntent`; keep passing the immutable base to GrowingWorld. Add explicit opt-in cove delivery, false by default. |
| `worldScene.ts`, `createWorldScene().layout` and `showWaterPreview` | Use the same coordinator for commit and future state. Key ground/preview on composite revision. Existing preview replacement of terrain remains visual; `groundAt()` and life retain committed world. Rename/generalize the preview method if useful, without changing that contract. |
| `sceneLayout.ts`, `sceneLayout/authoredSceneLayout` | Carry `authoredCovePlan`, base and enabled composition options in addition to water plan. Continue mapping the **final composed** floor through `point(cell,0)`, `heightAt`, `logicalAt` and `cellAt`. Do not derive or compose here. |
| `native/authoredGrowingGround.ts`, `buildAuthoredGrowingGround` | Already renders every ground/deck triangle from `layout.world.floors`. Its `buildAuthoredGrowingWater` helper also renders all `world.surfaces`, including a new bank. The apron therefore needs no second render-only floor. |
| `placeGeometry.ts:300`, `placeShellGeometry.ts:43` | Add the authored-cove branch using the matching plan and separately loaded candidate skin/factory. Apply its one common source pivot/rigid-uniform transform, then the renderer offset `(-layout.center, 0, -2)`. Do not recompute PCA/eaves from owners. Keep the existing legacy branch untouched when the new flag is false. |
| `GrowingWorld.tsx` | Load/verify the separate candidate source, pass the factory through object/place builders, publish its candidate/source/composite revision for evidence, and release owned resources. The current native source retains the shell's physical/transmission materials. |

The worker patch currently adds its own district, `native05-cove-corner-shared-apron-v1`, containing one concave ground top, one bank and nine `placement:false` refs; four more refs append to original districts through `siteAdditions`. Its 15 added edges allow only `walk`. Its external graph anchors must resolve against the actual upstream water world. Preserve original districts, floors, anchor floors, acquired sites and join/water edges; keep 73 placement grants. Let compiler support checks reject unsupported edges; also prove full-width floor union separately. Keep `definition.source` as the immutable base identity so the existing coast/source check stays valid; record the extra cove source in the cove plan and composite revision.

The apron GLB is authored evidence of the same patch. Extract/verify its exact triangles through the common transform, then render the world floor once. Do not draw both a coplanar apron GLB top and the evaluated floor, and do not substitute a new rectangular floor. Profile/GLB hashes, transformed skin geometry and patch provenance need one verifiable lineage.

## Preview semantics: preserve the committed world

Retaining committed geometry during a ghost is intentional today, not a general stale-geometry defect. `objectLayer.ts:119` says saved objects persist; tests at `objectLayer.test.ts:151` and `placeGeometry.test.ts:109` preserve their identity. Future places are translucent `.32` overlays (`placeGeometry.ts:330–342`). `worldScene.showWaterPreview` separately swaps visible terrain, hides live visitors and leaves committed pointer support/routes in place.

The missing P04 case is **explicit future disappearance**: `objectLayer.updatePreview` currently renders only changed future places, so an absent future P04 produces no overlay and leaves its old solid shell visible. For the new cove mode, compare committed and future cove-plan revisions/IDs as well as derived-place revisions. Temporarily hide only the affected committed cove visual root while showing its future shell overlay and prospective apron, including the present→absent case. Preserve the actual root/resources and prior visibility; restore them on cancellation/invalid ghost. Do not hide owner houses/play, replace `layer.places`, call life.sync with future state, or install the prospective world as actor support. Preview shells remain outside the committed `placeRoot` obstruction input. This is a scoped presentation extension, not a new physical preview contract.

`objectLayer.ts:267` currently enables future composition only when a water plan exists; use the common enabled-frame context so cove-only mode works. `worldScene` preview keys must likewise use composite revision. A future model rendered from that frame and the subsequently confirmed frame must have identical source transforms and apron geometry. Keep the existing static-preview actor hiding and committed ground picking behavior.

## Actor obstruction integration

The flower-specific activation and filter gates need generalizing; changing only the triangle filter is insufficient:

1. `growingLife.ts:95`: `authored-flower-support` existence currently decides whether the physical guard runs.
2. `authoredFlowerObstructions.ts:128`, `stockIndex`: ancestor names admit only three flower roots.
3. Same file, `authoredFlowerWalkSet:280`: `stockCount` counts only `authored-flower-owned-stock`, and zero returns unrestricted.

Also replace the stock-only conditions in `GrowingLife.playExit` and its drop-origin handling; otherwise a cove-only scene can still bypass reachable exits. Use one explicit eligible-obstruction-root convention/helper for current flower roots plus the new shell/frame/runner root. Preserve flower `stockCount` diagnostics if needed, but drive guard activation/early return from actual eligible roots/triangles. Keep the new root recognizable through GardenGeometry batching (`nativePart`/ownership boundary as appropriate). Run the same measured `.45` actor bands, edge sweeps and final-pose guards on the final composed world. Do not index the supporting apron top as an overhead obstruction: it is the floor. A cove with no flowers must still be checked, while legacy scenes remain unchanged.

## Required focused verification

- Domain/frame: actual candidate + **water-composed** world; unchanged old floor/anchor/placement/join/water data, exactly scoped additions, valid edge support, no copied state mutations, deterministic revision/cache. Unsupported/profile-mismatched arrangements produce no cove patch.
- Source parity/integration: exact candidate source hash, common shell/support transform, GLB-apron versus evaluated-floor triangle parity, no doubled floor, all required owner approaches and p9 use reachable through actual source obstacles. Local pre-water route success is insufficient.
- Edit lifecycle through `applyIntent`: required-home/play/supply move, store, separation and restore; entire dependent shell/apron/refs/edges disappear or recompute; original owners/grants remain; reconnect restores exact plan. Model on the command/preview tests in `native/authoredWaterIntegration.test.ts:88–134`.
- Preview/cancel/commit: changed and removed P04 visual roots match the future plan, cancel restores original visibility/resources, canonical world/picking/actors stay committed, confirmed geometry equals prediction, receipt-only state changes retain the layer.
- Life: cove-only and mixed flower+cove fixtures, actual source triangles included, walk→play→exit and occupied-edit/carry/drop/cancel remain safe without false use receipts. Follow existing `authoredFlowerLife.test.ts` behavior without replacing its flower cases. Whole/close/ready/rotation/phone visual gates follow source/contact proof.
