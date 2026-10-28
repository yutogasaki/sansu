# Bounded southern inlet and flower support diagnostic

Input: `60-H-linear-stable-placed-state.json`, merged only into the frozen expanded-v2 state for fields absent from the visible read-only evidence panel. The observed terrain, owners, residents, currency and place progress are retained. The parent expansion had explicit diagnostic currency. These diagnostics do not inject a database or prove earned expansion or browser persistence.

## Rejected eastern cut

The first bounded attempt lowered `(8,4..6)` from −1 to −3, then −4, and `(7,5)` from 0 to −4: 13 ordinary commands. F/H both accepted them and preserved owner support and use, but every edited centre remained dry. `expanded-place-recipe-east-rejected.json` preserves this failure. The `FUNCTIONAL_DIAGNOSTIC` label in that historical report denotes supported owners and use, **not a successful inlet**.

The zero-edit surface at `(8,4)`, `(8,5)`, `(8,6)` is approximately 0.7708, 0.6741, 0.5689 m, respectively (derived from observed centre floors and the full 0.18 m edit step). At the allowed −4 their floors are approximately +0.0508, −0.0459, −0.1511 m; all remain above the dry cutoff −0.375 m. No amount of rearranging those same legal depths can make those centres wet. No depth limit or fixed support protection was changed.

## One southern recipe

From observed UI60, use these ordinary terrain edits:

1. `(5,6)`: 0→−3, three lower commands.
2. `(5,7)`: 0→−3, three lower commands.
3. `(4,6)`: +1→−3, four lower commands.
4. `(4,7)`: 0→−3, three lower commands.
5. `(3,4)`, `(3,5)`, `(3,6)`: +2→+3, one raise each.

Total: **16 commands**. The first six make a narrow sea-connected cut, approximately 0.17–0.25 logical cells wide, and were not labelled a broad bay. Adding seven commands widens it to approximately 1.0–1.25 cells through the shore. The final three widen the flower's high support surface. No high surface at `x0..2,z5..6`, owner location, owner identity, growth, resident, land, currency or place progress is changed. Existing `(0,4)=-3` remains.

`expanded-place-recipe-flower-flat-wide.json` holds the final H/F diagnostic. Its `cove` is computed from the final state, including the flower raises; its `stages` preserve intermediate states. `expanded-place-recipe-flower-flat-wide-fixture.json` is a full in-memory state and command payload, with hashes and no browser-save claim. The six-command and flower-only comparisons are preserved separately.

## What was established

- Every recipe edit is executed through ordinary `applyIntent`, with reject rollback checked. Both F and H use the actual foundation, stable-base, linear-ramp and H projection transforms.
- Water triangles containing `(5,6)` and `(5,7)` belong to the same shared-edge component as outer sea triangles. This proves a surface opening, not merely an enclosed hole. Cross-section widths are sampled in logical coordinates; H curves those coordinates physically.
- The dry path along `z5`, from `(5,5)` through `(4,5)` and `(3,5)` to `(2,5)`, remains supported for the normal body corridor. Final floor heights are approximately 0.0198→0.1998→0.5598→0.5598 m. This proves one usable route, not that it is the only route or visually reads as a single designed entrance.
- All owners remain logically supported. Real Pokomoko and rabbit models use the garden and autonomously choose/use the bench, producing real receipts at least 700 ms after arrival. No walker, route or receipt injection is used. Sampled routes have no unsupported segments; sampled lower bodies have no absent floor or penetration beyond roundoff in the final H/F runs.
- With owners present, undoing and redoing the three flower-side raises succeeds and restores the same terrain/history and owner placement. Actor snapshots are intentionally absent from the command fixture; actual UI editing must still respect current resident positions.

## Contact is improved, not complete

The original near-ground metric included all vertices up to 80 mm above the owner root, including stems. It must not be read as pure foundation gap. The follow-up separates actual flower soil material `#bba178`, including its lower half (432 sampled vertices).

For H, adding the flower-side three raises changes the soil lower-half maximum gap from 0.10527 m to 0.05299 m. The terrain contribution to that separation, relative to the flat surface at the flower centre, changes from 0.07027 m to 0.01799 m. F has the same direction and similar values. Some positive gap is intrinsic to the rounded soil shape and the existing 0.04 m placement offset.

The minimum lower-soil gap stays about −0.0058 m. The natural base beneath the nominally equal saved heights is still curved: soil sampling sees terrain deviations of roughly −0.0294..+0.0180 m from the centre plane. Thus the three raises improve support but do not make the physical ground perfectly flat, and do not resolve all contact polish. This must remain visible in adoption decisions.

## Verification and limits

Run: `fnm exec --using=22.23.3 node docs/design/2026-10-23-place-method-comparison/expanded-place-recipe.mjs --flat-flower --wide-shore`.

Focused ESLint and actual TypeScript compilation were run on the new recipe implementation/runner. Input/source hashes and UTC timestamps are in JSON. Runtime source and constant limits were not modified. Parent owns actual UI, camera/art comparison, live editing and broader application verification. No numeric result here proves child understanding, final art quality, continuous mesh collision, a new place capability, or public-release readiness.
