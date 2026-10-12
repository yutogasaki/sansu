# P04 supported corner entrance — production plan

2026-10-12. Read-only design finding, not an implemented or accepted candidate. No runtime, model, benchmark, owner cell, or app was changed. The bounded original-shell candidates in `result.json` remain rejected because they isolate p6 and p9.

## Exact native source

`docs/design/2026-10-10-island-final-3d/varied-world.py:217–244` authors the shell. `shell_point(a,t)` (line 220) creates one tapered half-vault: 28 longitudinal × 72 arch quad cells, with `SOLIDIFY` thickness `.043` at line 233. At uniform `.45`, the skin is `.01935` thick; the complete roof is about `2.1641 × 1.5559 × 1.5552` world units. The original `whole-island.blend` retains this editable surface/modifier and the curves.

Seven transverse ribs are at `t=j/6`, with 25 arch control points and source radii `.068` at the two mouths and `.047` internally (world `.0306` / `.02115`). Seven longitudinal seams lie at `a=iπ/6`, radius `.029` (world `.01305`). Two three-point side runners, `Harbor / shell grown footing[.001]`, have radius `.13` (world `.0585`); these are the actual omitted supports, not vertical posts. `build-scene.py:79–88` makes these smooth AUTO Bezier curves with resolution 12, bevel resolution 3, and filled end caps. They intersect the skin as separate original solids; they are not one welded structural mesh.

Native-05 takes that geometry from `history/native-04/whole-island.blend` through `build-final-scene.py:10–27`; it does not rerun the shell-generation block. `fantasy-colour-world.py:104–112` gives the upper panels their violet material. Preserve those material assignments and the unchanged roof outside the entrance area.

## Entrance location and initial clear profile

Use the bounded A transform only as the starting assembly: source GLTF pivot `(13.9,.89,1.2)` to authored world `(8,.0475,.50)`, uniform `.45`, yaw 0. Blender pivot is `(13.9,-1.2,.89)`; GLTF coordinates are `(Blender X, Blender Z, -Blender Y)`.

Current owners stay p6 `(7,-1)`, p7 `(9,-1)`, play p9 `(8,0)`. p6's only initially reachable approach refs are `(7,-.25)` and `(7.25,-.25)`. On the original sidewall, world `z = 1.211 - 1.494t`; at `z=-.25`, `t≈.978` and the left base is `x≈7.174`. The nominal rear mouth is `z=-.283` (including original rib bounds, about `-.314`). **The desired frontage is only .033 from the nominal end. A usable opening must merge into that open corner; an isolated side window cannot contain the actor.**

The actual `.45` Pokomoko + eight-friend motion envelope is radius `.244069`, height `.550093`, eight retained height bands, from 117 meshes / 99,868 indexed vertices. Its origin is sole-contact ground: `authoredFlowerObstructions.ts:87–100` subtracts measured moving sole extrema and includes walk bob; the obstruction path uses `layout.point(cell,0)`, not the scene's default `.04` visual offset. Exact bands, source motion intervals, capture/build identity and hashes are in `result.json`.

The raw full-width lower bound is `.488139`; allow `.04` each side. Start authoring with a **clear inside-rim profile `.64` wide × `.72` high** (source `1.4222 × 1.6`), centered longitudinally near world `z=-.25`, facing the p6 frontage across X. A semicircular arch has radius `.32`, spring height `.40`; this preliminary profile also allows the shoulder band (`r=.219172`, top `.491556`) plus the local floor rise `≈.0347` and `.04` horizontal/vertical reserve. These are authoring dimensions, not a collision PASS. The shell-side portion reaches to about `z=.07`, hence `t≈.764`; it affects the last two transverse ribs (`t=5/6,1`) and the lower left seams. Do not carry a footer or decorative sill across the opening. Extend the cutting volume below the lowest floor/sole band.

## Minimal real construction

Create a separate derived candidate script, e.g. `build-cove-entrance-variant.py`, reading a copy of the approved native-05 blend. Duplicate only the shell and affected curves/data. On the duplicate, apply the existing Solidify, then use a smooth rounded arch volume facing Blender X to subtract the actual corner aperture with an EXACT Boolean. `varied-world.py:34–42` already supplies `arch_prism`; lines 52–56 demonstrate the project's real solid Boolean method. It is a cutter/profile starting point, not a ready placement. Keep a closed skin/reveal around the new edge, refine/bevel its smooth boundary, and validate the evaluated geometry; do not delete exported triangles.

Author a continuous grown boundary frame following that opening and joining the original rear arch. Turn the remaining left runner upward into the new side jamb/arch, and keep the rear arch's opposite grounded support. Reroute the affected two ribs and bottom seams into this frame so no floating cut ends or ankle-height bars remain. The side opening joins the original mouth, so **do not add a second jamb behind the mouth toward p6's cap roof** merely to imitate a separate rectangular door. Use a continuous curve/connected frame and real roof joints; exact house-triangle clearance must constrain its shape.

Set the new jamb/runner contact from the actual shared dry triangles through the inverse common transform, retaining adequate buried contact and a flush threshold. The existing floor is `Water town / shared frontage court:0`, p9 Y `.025666217`; nearby low terrain is about `-.009`. The bounded probe found ground under every original footing vertex, but did not prove complete load-bearing contact or full-width walking support. First use that existing floor. If the new contact or swept foot corridor falls off it, the minimum additional work is a real shared ground patch/approach in WorldDefinition floors plus corresponding walk refs/edges and visible geometry. It must not create owner grants or be a render-only platform.

## Integration and stop gates

Keep the derived skin, frame and supports under one source pivot and one pure assembly transform. Export it as a separate authored-shell profile (or separate supported variant parts); leave legacy `shell-roof` origin and its false-default delivery path unchanged. Add the actual new shell/frame/runner triangles to a generalized obstruction-root selector: the current flower-only ancestor-name filter would otherwise falsely pass this entrance. Prove the existing home route reaches p6 and p9 and clears the actual use target with all actor bands; prove the actual p6/p7 cap and entry meshes remain separate. Then inspect ready, whole, close, rotation and phone views. A smooth-looking Boolean or locally clear door alone is insufficient.

Do not run `build-final-scene.py` for the variant: lines 34, 45 and 58 overwrite the approved blend, GLB and render. Save the derived candidate, its source hash manifest and views in a new output directory and compare against the unchanged original benchmark. The source identity at this read is:

| Original | SHA-256 |
|---|---|
| `whole-island.blend` | `d1c7bb078b8f4fafad97862fcd1d691e63cfbcce9c378f21da47ccd167139c2a` |
| `whole-island.glb` | `8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d` |
| `whole-island-render.png` | `9de26a7f8a83176df37a7848cae4beea7962eb782247d07cf7e3b970a856f9c6` |
| `varied-world.py` | `9090dbd0923437d449309bc95ffb27a00ec673e3252ca9f98849e8ce53611c22` |
| `build-final-scene.py` | `007cb5dbaee09aa8f235641409729a71409910c9f24c03f139258af47b135234` |
