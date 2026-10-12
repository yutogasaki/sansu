# Next M1 source brief: P02 interior, ascent and supported gallery

2026-10-12. Preparation only, not an accepted art candidate or runtime PASS. No app/product-spec edit, browser, render, geometry probe or new source generation. The source artist owns production. Start with coarse whole-scene options alongside the forest mass study; do not finish stair/rail details before comparing the full island and source directions.

## Fixed context and source transform

Use the actual fixed35 c1 objectLayer context, not the original 15-house alternative composition:
`docs/design/2026-10-12-authored-forest-crowns/extraction-attempt02/fixed-c1-context.glb`.
Its companion manifest records sourceFixed and 35 owners. `bindings.json` describes the four left-tree crown study owners only; it does **not** contain P02's matrix. P02 values below were read independently from the context GLB JSON node hierarchy (no accessor/mesh calculation):

- Place `P02:p3`, compact cluster grown; members l10/l11/l12/l13, existing seat l25 and anchor p3. Keep the existing bench/recognition contract.
- Support cells: l10 (3,-9), l11 (4,-9), l12 (3,-8), l13 (4,-8). No new tree/owner/placement grant, no move of these owners. The original highest great tree remains the one principal peak.
- `place-native-shared-tree` node 184 renderer translation = (-3.5026560305, 1.49033759075, -10.5); ancestor `renderer-to-authored-once` node 0 adds (7.0026560305,0,2). Thus authored shared origin = **(3.5, 1.49033759075, -8.5)**, with no rotation.
- Hollow trunk child 185 has uniform scale **0.45**. Fan-crown child 190 has the same scale plus local Y **2.055093097686768**. Keep their native relative placement.
- Original GLTF pivot for hollow trunk: **(-4.8,3.7931642532348633,-17)**. Native kit origin code: `src/components/island/growing/native/nativeGrowingKit.ts:23–30`; original fan Y-min 8.360037803649902. For original already-world-evaluated source GLTF coordinates, common mapping is `authored = (3.5,1.49033759075,-8.5) + 0.45 * (source - (-4.8,3.7931642532348633,-17))`. Renderer subtracts `(7.0026560305,0,2)` exactly once. Blender uses its own export-axis conversion; do not reinterpret these GLTF Y-up values as Blender Z-up coordinates.
- Original source GLB SHA: `8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d`; original .blend SHA from context inputs: `d1c7bb078b8f4fafad97862fcd1d691e63cfbcce9c378f21da47ccd167139c2a`. Preserve benchmark bytes. Any necessary local doorway change must be a separately identified derivative, with original trunk/crown and changed-node/triangle provenance retained.

## Measured constraints reused from existing evidence

Original `varied-world.py` has continuous bough gallery, grown support, crescent rail and spiral bough stairs, but the current owned kit excludes the gallery/stairs. Existing source inventory gives gallery width **0.3195** and stair width **0.297** after 0.45 scale. Merely re-extracting them cannot produce the requested usable passage.

Recorded actual rig envelope (`actor-envelope-identity.json`, same cove c1/c2 actors): radius **0.24406937059140585**, upper extent **0.5500928879753579** above standing reference, lower animated band **-0.0190976441475757**; 9 actor rigs, 117 meshes, 99,868 vertices, all visual scale 0.45, foot swing 0.5, arm swing 0.6, walk bob 0.01575 included. The existing source-corridor target adds 0.04 lateral reserve each side: **clear width 0.5681387411828117**, equivalent to **1.2625305359618038 source units** at 0.45. This is a corridor target, not raw body width.

Headroom must clear the actual 0.5500928879753579 upper envelope at every floor height, including at bends, under boughs and entering/exiting the hollow; retain an explicit visible clearance reserve rather than designing at equality. This report supplies the existing measured body envelope, not a measurement that any current opening is already clear. Future source validation must use the selected current actors and actual foot contact, including negative foot bands; no shrink-the-actor workaround.

## Required coarse source result

Create one supported route from a real reachable existing ground entry into the hollow interior, then via a visible continuous ascent to a short bough gallery and back to that same entry. The shared origin Y above is a **model transform**, not the entrance or finished floor height. Derive actual entry/landing heights from the unchanged final world floor under the fixed source; do not assign a flat assumed terrain plane or use the legacy +1.35 spiral route. Keep p3's entry, l25 bench and all existing ground approaches usable. A nearer ground point under the gallery is not an entrance.

The floor needs closed thickness, a meaningful interior, doorway reveals, an actual landing, and continuous load-bearing connections into the existing trunk/bough/owned-root assembly. Widening must shape a branch-supported platform/entry, not a decorative staircase attached to a facade, a floating deck, a hidden walk plane or a disconnected pedestal. Preserve the hollow trunk's identity and original material/normal lineage. Keep roof/head clearance, bends, rail intrusions and the passage's full width together. If four-owner support cannot carry the needed source geometry, report the incompatibility instead of inventing a free support anchor or erasing ground/trees.

A visible smooth ramp is compatible with the first bounded physical-route implementation. If discrete stairs are chosen, retain exact tread/riser geometry and plan actual step/contact motion; current straight XYZ interpolation alone is not proof that feet traverse discrete treads. The source author should deliver walk-top triangle IDs separately from walls/risers/undersides/rails, with full source geometry intact for collision and rendering.

Proposed runtime boundary is an explicit **owner-use floor role**, stable floor IDs, owner/place/source transform binding, ordered physical XYZ route with per-segment floor identity, actual ground entry and designated use region. Same-XZ different heights remain separate in this use plan. Upper floors are excluded from default ground support/planting/graph, while their exact triangles drive both visible rendering and use-route validation. See `/private/tmp/sansu-p02-authored-gallery-contract-review.md`; no generic multi-level graph rewrite is proposed.

## First art handoff and later acceptance

First handoff: coarse editable derivative plus manifest of preserved source, owner transform, walk/support/obstruction roles and the proposed continuous section. Compare whole-scene mass with the current forest study and the approved benchmark, in three consistent source directions (whole, rotated whole, entry/section view), keeping the fixed35 context/camera lineage and source limitations explicit. Keep the highest crown/forest layers, houses, water and open ground readable. Gallery detail does not remedy a thin forest by itself and must not displace the whole-massing work.

Later independent gates: source-top/render triangle parity; closed structural joins and full-width/head clearance; unchanged ground/rights/owner records and all owner approaches; real actor entry/use/return plus source-triangle collision; preview/cancel and move/store/separate/rejoin with safe evacuation and no invisible floor. Source images alone cannot pass app interaction or whole-island M1.

## Read-only input identity

- `docs/design/2026-10-12-authored-forest-crowns/extraction-attempt02/fixed-c1-context.glb`: `67e7959da39c5854afe4441d76d5d093fa6206b5d4b916491fb48c17d480c008`
- `docs/design/2026-10-12-authored-forest-crowns/extraction-attempt02/manifest.json`: `3c3fcd13bf4867946a0f393769f852cb938286329dfa2e11dac3afe74796bda2`
- `docs/design/2026-10-12-authored-forest-crowns/extraction-attempt02/bindings.json`: `ea37659462f0b84df651131d60b47cba04c9f588aa4981d74d6c74bf8a229d16`
- `docs/design/2026-10-12-authored-whole-massing/raw/actor-envelope-identity.json`: `444beab3c5b078799e974424e225e0a2e6742d6b99ad7e94be5edb54088af1db`
