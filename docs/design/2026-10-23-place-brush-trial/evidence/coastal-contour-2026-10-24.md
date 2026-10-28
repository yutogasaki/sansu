# Elliptic cliff contour — 2026-10-24 10:36 JST

## Hypothesis and scope

The parent rejected soft08/soft12 as the primary art solution after viewing the
western scene: a lowered strip gouged the coast and exposed the old rear wall.
The adopted native-05 reference permits cliffs, but its grass edge, face and
water edge share a legible curve. This new opt-in `shoreTrial=contour` tests that
geometric relationship. It is not a material/color change.

The same nearest-sea rule chooses west for (−1,4) and south for (5,5). Outside the
existing explicit top, a single elliptic radius controls a 0.12 bevel, 0.28 cliff
face, 0.18 low water rim and 0.14 transition to the existing underwater level.
The sea-facing arc is 120 degrees with a fully weighted central 60 degrees.
Arc ends taper within the width of their own ellipse/rim, then continue to the
existing sea. Top and whole ramp reservations remain unchanged. There are no
owner-dependent cuts, exceptions for the dock or scene-specific coordinates.

The first unbounded angular fan widened too far towards the sea, affecting the
west coast near z=0. That overly broad scope was rejected before visual testing;
`coastal-section-contour-first.json` preserves its result. The final variant caps
lateral extent to the arc's own rim: approximately 1.730 on west-low and 2.162
on east-high. This is the same formula with the ellipse's cross-axis scale.

## Mechanical result: partial

| Scene | Changed union sample points | Protected top/ramp changes | Result |
| --- | --- | --- | --- |
| West low | 943 / 25,357 | 0 / 5,506 checks | Place accepted, ordinary bench/flower moves and supported routes pass |
| East high | 917 / 25,347 | 0 / 8,016 checks | Existing fixed-footing guard rejects the dock conflict |

Neither scene raises any actual floor sample, creates a new dry sample, or
changes a sample outside the explicit affected lattice-cell closure. Every
extra scalar result is capped at the original completed surface; this operator
therefore cannot fill an existing opening. This does not certify hole
preservation in the preceding place-outline generator.

The western house/dock support probes are identical. Its actor negative control
at (−3,4) receives the resident-footing rejection. The eastern dock loses dry
support at 4 of its 25 probes and remaining support shifts by up to 0.5064, so
the failure is substantive. No guard is relaxed. This remains **one scene's
mechanical success and one correct rejection**, not a two-location acceptance.

Maximum sampled dry-floor lowering is about 1.3003 at west and 0.7054 at east.
Large lowering is not inherently an art improvement. Parent must compare the
actual silhouette against off/soft08/soft12 and the adopted reference. The
central eastern ray already passes through water; its retained gap also means
that a continuous-looking contour cannot be promised for that input.

## Compatibility and verification

The existing off/soft08/soft12 branches remain unchanged. Their geometry
diagnostic records and center sections match `coastal-section-integrated.json`.
`contour` uses the existing active-mode revision suffix and is refused with
`trialSave=local`. Default/no shape/unsupported shape is still an exact no-op.
No Vite, UI, store, model or production files were changed by this worker.

`coastal-section-contour-final.json`: 2026-10-24T01:36:07.373Z, assertion PASS,
`changedInputs: []`, old-mode diagnostic parity true. Bundle SHA-256
`18c45477c7df797dad08a336c897dc1adc8e08414641e4709478818dfb4db6aa`.
Command: `fnm exec --using=22.23.3 node docs/design/2026-10-23-place-brush-trial/coastal-section-check.mjs contour-final`.
ESLint for the three worker files passed after the final edits. Parent owns
transformed TypeScript/build, visual comparison, ordinary UI and live-use tests.
No art-quality, saved-world, delivery or user-comprehension acceptance is claimed.
