# Directional entrance diagnostic — 2026-10-24 10:13 JST

## Question and result

The fixed northern entrance rejects the requested 0.9-high platform at (5,5).
Keeping the same acquired land, platform dimensions, height and two owned objects,
a west-facing entrance passes the actual transformed geometry, placement and walking
checks. North, east and south remain rejected. This is a bounded geometric finding,
not a persistence, browser interaction, art-quality or resident-use acceptance.

Input fixture: `../../2026-10-23-place-method-comparison/evidence/expanded-place-recipe-flower-flat-wide-fixture.json`.
The test preserves the source fixture and starts with no actors; a separate negative
case verifies that a resident on the changing floor blocks the edit.

| Case | Inputs | Expected / actual |
| --- | --- | --- |
| Existing north | center (5,5), height 0.5, radius 1.6, entrance 1.2, flatRadius 1.75 | Existing success preserved; both objects moved and usable |
| High north | same dimensions, height 0.9, north | Insufficient ramp length; rejected |
| High west | same dimensions, height 0.9, west | Accepted; bench (5,5), flower (6,5) moved with ordinary commands |
| High east | same dimensions, height 0.9, east | Insufficient dry space; rejected |
| High south | same dimensions, height 0.9, south | Insufficient dry space; rejected |

The west ramp reaches existing floor at (2,5): topDistance 1.75, length 1.25,
center landing height 0.559827091. Available westward length is 5.75; the planner
does not enlarge the island, shrink the platform, lower the height, or fill a water
gap to secure an entrance. Source floor is sampled every ≤0.08 along the strip and
at lateral offsets −0.18, 0, +0.18. This source-strip check is sampled, not a
continuous proof about every possible opening in the outline blend area.

The bench has 4 reachable approaches and the flower has 3. Every returned route
segment passes `editableTerrainSegmentSupported` in the occupied actual world.
Both direct west-ramp routes and routes around the other side of the platform
occur; this evidence does not claim every route uses the west ramp.

## Preservation and negative controls

- Absent direction and explicit north delegate to the original field. 11,570 scalar
  comparisons are exactly equal; the old low north paired-object case still passes.
- Short space, wet landing, wet body rim, water strip and non-finite samples reject.
- Preselected fixed-house and fixed-dock edits reject with the fixed-footing error.
- A resident at (4,5) rejects with the resident-protection error.
- Acquired bounds remain minX −3, maxX 8, depth 8. Current ownership is rectangular;
  clipped water within that rectangle is separately checked by floor/body/routes.

### Mesh boundary qualification

The initial diagnostic checked only new dry vertices and was too narrow. The final
check uses the union of old/new floor vertices and compares dry presence and actual
3D floor coordinates. Among 47,826 samples outside the continuous analytic outline
and ramp, 8 samples (4 unique points) change close to the southern shore. The H
compiler uses a fixed 1/12 lattice: a triangle can cross the analytic boundary.
All differences lie in lattice cells having an analytically affected corner. There
are zero changed samples outside that explicit mesh-cell closure. The analytic
boundary itself therefore **is not** the exact compiled-mesh boundary.

Earlier failing evidence is retained in `directional-check-dry-strip.json` and
`directional-check-boundary-detail.json`; `directional-check-first.json` must not
be cited as a complete boundary-preservation proof.

## Verification

At 2026-10-24T01:13:49.425Z, command
`fnm exec --using=22.23.3 node docs/design/2026-10-23-place-brush-trial/directional-check.mjs final`
exited 0 with `status: PASS`. It bundles the actual Vite-transformed world/model,
redirecting field imports only inside this diagnostic bundle. The adapter and the
parity check retain their original `field.ts` imports, avoiding a self-import.

`directional-check-final.json` records input SHA-256 values, exact bundle SHA-256,
and `changedInputs: []`. Bundle SHA-256:
`edd950ae0b7863fcce31d1fd489a0799a4476fede38ca3c71044c4050f137909`.
Targeted ESLint for the three new source/runner files exited 0 with no output.
Parent integration owns transformed typecheck, build, saved-history and browser
checks; those are not claimed by this diagnostic.

## Integration contract

`directional-field.ts` exports `PlaceShape` (optional `rampDirection` of north,
east, south or west), `shapeOf`, `placeHeight`, `placeRevision`, and the unchanged
north-only `planRamp`. `planDirectionalRamp(state, shape, sample)` is explicit for
diagnostics. The non-north revision marker is `directional-platform-diagnostic-v1`.
North uses the original revision and numerical function.

The adapter reads `landBounds` only inside runtime planning, with no top-level
world construction. Root integration can point the Vite-injected world import,
model and controls at this adapter while leaving `field.ts` intact.

Persistence should use a separate v3 recipe and strict validation/migration of the
existing v2 payload. An older reader must reject a directional save rather than
silently interpret it as north. No database or save contract was edited by this probe.

Remaining risks: shape/profile joins and lateral end-height variation need visual
inspection; logical design slope is not a substitute for actual curved-world body
support. Directional negative-height inlets are intentionally unsupported. The
sampled corridor guard does not establish global preservation of every water hole.
