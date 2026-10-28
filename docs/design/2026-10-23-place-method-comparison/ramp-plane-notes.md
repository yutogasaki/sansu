# Fixed bilinear ramp diagnostic

Date: 2026-10-22 21:35 UTC. Candidate revision: `fixed-bilinear-interior-ramp-v1`.

The existing F basis contributes to the staircase appearance: the same ascending `0,1,2` input has 24 flat intervals out of 40 sampled intervals with F, while the linear candidate has none. Its interior slope is a constant 0.18; F reaches 0.6609375 between its flat caps. This isolates one geometric cause. It does **not** establish that the resulting island looks good in the actual camera.

## Mechanism and integration

`rampPlaneOffset` uses a fixed bilinear convex combination of the four surrounding signed height coefficients. A fixed spatial collar blends it into the previous cubic interpolation at the exterior. It has no owner-dependent, component-dependent, sign-dependent, or input-height-dependent switch. Integer centres retain the saved values. Changing one coefficient by one step changes every sample by 0..0.18 metres; decreasing has the opposite sign. Equal neighbouring heights still form a plateau. This guarantee is for the offset at fixed bounds; it does not prove expansion continuity or a bound on the total world slope.

`rampPlaneTerrainTransform` applies after `terrainMethodTransform`, optionally after `stableBaseWorldTransform`. Exact order is foundation → terrain method → optional stable base revision → ramp plane. It changes the F/H raw offset source, so rendered mesh, CPU floor, support and walk graph consume the same height source. Browser option is `rampTrial=linear`; Node diagnostics use `{ alwaysLinear: true }`. No new terrain mode or state schema was added. Runtime source is unmodified. The transform also adds a revision marker; applying it with the option off leaves geometry unchanged but changes revision identity.

Stable base separately requires `stableBaseTerrainTransform` on `placeTerrain.ts`. H separately requires the existing curved-grid landscape and scene transforms. The check runner uses those actual transforms, not a private height adapter.

## Two placements, same raw heights

Input is the frozen `expanded-fixture-v2.json`. Its expansion money was explicit diagnostic budget, not earned currency. The following changes are ordinary domain `move` commands; no database is injected. Each mode independently attempts the commands. All modes are also projected onto the first successful F result so same-state comparisons are not confused with successful replay.

1. Flower `(1,5)`, bench `(1,6)`: default F/H accept both, but linear F/H reject the flower. Its full support rim touches the retained negative corner `(0,4)=-3`: additional tilt is 0.2268 m at `(0.54,4.54)`, exceeding 0.13 m. The projected illegal placement can still produce use receipts; that does not make it a valid placement. This counterexample remains in `evidence/ramp-plane-check.json`.
2. Flower `(2,5)`, bench `(1,6)`: all eight conditions (F/H × default/linear × legacy/stable base) accept both moves and support all logical owners. Terrain heights remain identical. Without stable base, flower additional tilt is 0.0645625 m for default and 0.0828 m for linear. With stable base plus linear it is 0.093288164 m, still below 0.13 m. No further placement search was performed.

The second final state and two-command trace are in `evidence/ramp-plane-pair2-fixture.json`; it retains the parent hash. Full diagnostics and source/input hashes are in `evidence/ramp-plane-check-pair2.json`.

## Actual actors and physical limits

The check constructs the actual GrowingLife, real Pokomoko rig and rabbit model. Garden visits use the ordinary `visitPlace`. Bench use comes from seeded autonomous choice, with no forced target/position/receipt. Both actors produce garden and bench receipts in all eight second-placement conditions; observed receipt times are at least 700 ms after arrival. Every sampled route segment is legal and lower-body samples have floor beneath them.

The native kit and real object layer are loaded. The starter tent, flower and bench are procedural objects even with that kit; the fixed cottage uses the native mesh. Near-ground mesh vertices are checked relative to the actual CPU floor. This is a sampled contact diagnostic, not a complete collision proof.

| Condition | p1 minimum mesh gap | Flower minimum mesh gap | Bench minimum mesh gap |
| --- | ---: | ---: | ---: |
| F default, legacy base | −0.080104 m | +0.004126 m | +0.034255 m |
| F linear, legacy base | −0.080104 m | +0.004126 m | +0.045846 m |
| H default, legacy base | −0.082117 m | +0.004124 m | +0.031186 m |
| H linear, legacy base | −0.082117 m | +0.004212 m | +0.042723 m |
| F default, stable base | +0.040000 m | −0.005789 m | +0.034255 m |
| H default, stable base | +0.040000 m | −0.005797 m | +0.031186 m |
| F linear, stable base | +0.028791 m | −0.005789 m | +0.045846 m |
| H linear, stable base | +0.036212 m | −0.005535 m | +0.042723 m |

Ramp alone does not repair the tent's legacy-base penetration. Stable base repairs that sampled tent issue but introduces about 6 mm flower-rim penetration. Positive gaps are also not proof of ideal visual grounding: the flower's sampled maximum gap in linear/stable is about 0.11 m. Native cottage minimum gap remains positive (minimum 0.01397 m in F linear).

In these seeded routes, linear variants have no measured lower-body penetration beyond roundoff. Default variants have rabbit tail penetration: up to 0.02059 m with legacy F, 0.00758 m with legacy H, 0.03796 m with stable F, and 0.01280 m with stable H. Paths differ, so this cannot establish a universal animation fix. Bodies are sampled every 200 ms, route segments every 40 ms.

The saved `(0,4)=-3` centre remains wet in all conditions. `(8,5)=-1` remains dry and is not a proven water inlet. This test does not establish preservation of every old shoreline sample. Geometry's independent stable-base audit also found one west corridor sample `(-1,4.5)` loses reachability; successful garden/bench visits must not erase that limitation.

## Verification and remaining decision

Commands completed successfully:

- `fnm exec --using=22.23.3 node docs/design/2026-10-23-place-method-comparison/ramp-plane-check.mjs --flower-x=2`
- ESLint on the four ramp implementation/check files.
- Focused real TypeScript compilation via `/private/tmp/sansu-ramp-plane-tsconfig.json`.

The coefficient sweep covers −4..12, sampled one-step response 0..0.18 m and centre error 0. Full app verification and actual UI/art comparison belong to the parent integration. No claims are made here about browser save/reload, earned expansion, child usability, all possible routes, full mesh collision, or a new place capability. Both placements still use existing P05 flower/bench behaviour. Candidate files are frozen for visual comparison; the numerical result is not adoption.
