# Local sea-facing section — 2026-10-24 10:20 JST

## Finding

The first lower-only shoreline section works mechanically at the western low
platform, but the identical rule at the eastern high platform reaches the fixed
dock footing and is correctly rejected. This is not a two-location acceptance.
No visual or resident-use result has been collected by this diagnostic.

The hypothesis follows the completed field pipeline: the place top/ramp is
generated before the rectangular ownership edge falls to sea over roughly
0.44–0.86 logical units. This experiment acts after that completed surface,
including the H coarse exterior sampling. It tests a shoulder, a low shore at
−0.27, and the existing underwater level −0.52, rather than just changing paint.

Reference rationale is the adopted native-05's distinct broad terrain and local
support pads, and the existing `strategy-assessment.md` contract that a place's
sea-facing skirt reaches actual water. This is an implementation inference from
those references, not evidence that the benchmark uses this particular formula.

## Fixed comparison

- Same 96-cell fixture, old terrain, ordinary domain and triangulated world.
- Western place: center (−1,4), height 0.5, flat radius 1.75, north entrance.
- Eastern place: center (5,5), height 0.9, flat radius 1.75, west entrance.
- Both: radius 1.6, entrance width 1.2; same bench and flower.
- Conditions: `off`, requested inland width `soft08`, requested width `soft12`.
- One nearest-cardinal-edge rule at both positions; no per-scene coordinates or
  owner-dependent terrain. The top ellipse and complete entrance strip have a
  two-cell reserve on the 1/12 lattice.
- Every additional result is `min(oldHeight, proposedHeight)`. The operator
  cannot raise the completed field. This does not prove that the preceding
  place-outline generator preserves every original hole.

## Results

| Scene | Mode | Geometry | Ordinary placement / routes |
| --- | --- | --- | --- |
| West low | off | 25,229 union sample points, zero changes | bench/flower accepted, body-supported approaches |
| West low | soft08 | 1,112 changed of 25,334 points | both accepted and usable |
| West low | soft12 | 1,292 changed of 25,334 points | both accepted and usable |
| East high | off | 25,215 union sample points, zero changes | both accepted and usable |
| East high | soft08 | 573 changed of 25,258 points | fixed-dock footing rejection |
| East high | soft12 | 640 changed of 25,258 points | fixed-dock footing rejection |

All conditions preserve the actual top and ramp samples, introduce no new dry
sample, raise no actual-floor sample, and change nothing outside the explicit
affected lattice-cell closure. Western house/dock footing probes remain exact.
The eastern dock at (7,7) changes by up to about 0.4911, so the existing guard
refuses the place edit. It was not weakened or masked by a custom dock exception.

At the west centerline, both requested widths clip to a 0.5033 shoulder because
the explicit top reservation consumes the remaining space. The two conditions
therefore share the same center section, although their lateral patches differ.
At distance 2.5 from the center the previous surface was 0.8681 and becomes
−0.27; the maximum remaining dry-floor drop within the patch is about 1.1953.
These are substantial shape changes requiring visual assessment, not automatic
art improvements. The eastern center ray is already an open water region, so the
lower-only operator does not change it; its side region causes the dock failure.

The actor protection negative case at (−3,4) is rejected with the resident-footing
message. A shape without an explicit top, a negative shape, no shape, and off do
not activate this operator. The runner checks unknown flags as off and rejects
an active coastal flag combined with `trialSave=local`.

## Integration boundary

Only new `coastal-section.ts`, `coastal-section-check.ts/.mjs`, and this evidence
were written by this worker. No production source, old field, model, persistence,
UI or Vite file was edited. Parent owns integration and browser comparison.

`createCoastalPlaceSection(state, completedSurfaceHeight, mode).heightAt` wraps
the final surface, not rawHeight. `coastalTrialMode()` parses `shoreTrial` and
throws for active mode plus `trialSave=local`, preventing silent v3 save changes.
`off` returns the original sample function itself. Parent should retain the old
revision exactly for off and include the mode/revision for an active experiment.

The diagnostic runner currently injects the wrapper and an explicit fourth mode
argument into the real transformed world, allowing exact off/on comparison in
one process. Normal model calls use the same query-selected current mode. Once
the parent integrates the wrapper, the runner must detect that and avoid applying
it twice.

At 10:23 JST the parent integrated that wrapper and fourth argument. The runner
now detects the integrated import and validates its signature instead of wrapping
twice. The parent also resets field-plan caches on cold compilation. The
integrated run reproduced all six conditions above without input changes.
`coastal-section-integrated.json` at `2026-10-24T01:23:26.333Z` has bundle SHA-256
`797850853ae5e3595fd783348ab73c4ece93e41e8f11351144c751f4204379b0` and PASS
assertions. The preintegration evidence remains intact; candidate acceptance is
still PARTIAL. The adapted runner's ESLint also passed.

## Verification and limits

Final evidence: `coastal-section-final2.json`, at
`2026-10-24T01:20:57.200Z`, `changedInputs: []`, bundle SHA-256
`7699efbd25cadffdb180d6286cda78966c4dc0bc9000181d1527d4b55e8541fd`.
Command: `fnm exec --using=22.23.3 node docs/design/2026-10-23-place-brush-trial/coastal-section-check.mjs final2`.
Target ESLint for the three files passed. Diagnostic assertion status is PASS;
candidate status is PARTIAL because the east scene is rejected. Parent still
needs transformed TypeScript/build and actual visual/UI inspection.

Do not narrow the patch merely to evade the dock after seeing this result. First
inspect the western silhouette and decide whether the shape hypothesis improves
the scene enough to justify a second construction rule or placement choice.
