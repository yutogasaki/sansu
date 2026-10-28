# Curved bay displacement — 2026-10-24 10:58 JST

## Candidate and boundary

`shoreTrial=bay08` and `bay12` displace the completed original shore towards the
sea by at most 0.8 and 1.2 logical units. Sampling that more seaward position at
the current coordinate cuts the dry shoreline inward. The new curve is not
mixed with the former negative-height ellipse: in these two modes only, the
root Vite raw-height wrapper bypasses `placeHeight`. The supplied negative
shape is inlet/center/width metadata, with width equal to twice its radius.
Its negative height magnitude, entrance width and flat radius do not reshape
the bay; their changes were checked against identical actual floor vertices
and indices. A nonnegative shape is explicitly rejected.

For lateral coordinate `t` from 0 to 1 across the selected width, displacement
is `depth × 64 × t³ × (1−t)³`, with exact zero outside. Position, first derivative
and second derivative meet zero at both ends. The same nearest-cardinal-edge
rule chooses the sea direction at either location. Displacement remains full
up to depth inland, fades to zero over the next unit, and is zero outside a
one-unit seaward band. There is no owner-dependent shape selection.

For old completed surface S and displaced point T(p), the result is
`S(p) − positivePart(S(p) − S(T(p)))`. The C1 positive-part function is zero for
nonpositive values, quadratic up to epsilon 0.005, then linear. It never
exceeds the positive difference. Thus the additional operation only lowers
S and cannot fill an old hole. Zero displacement returns the original sample
function exactly. The original land and per-cell terrain inputs remain intact.

This is a local large-shape experiment. It intentionally allows acquired dry
land to become water. Fixed house/dock, furniture and current residents still
use the existing guards; no tolerance was changed to make the bay pass.

## Fixed inputs and mechanical result

Same 96-cell fixture, original bench at (1,6), flower at (2,5), no injected live
actor movement. West center (−1,4), radius 1.6; south center (−1,7), radius 2.
The south case targets the long front-left wall seen from the ordinary camera.
Its location was explicitly requested before the result was measured.

| Input | Changed union samples | Dry samples lost | New dry / raised / outside changes |
| --- | --- | --- | --- |
| West, depth 0.8 | 601 / 25,353 | 246 | 0 / 0 / 0 |
| West, depth 1.2 | 690 / 25,365 | 328 | 0 / 0 / 0 |
| South, depth 0.8 | 1,351 / 25,370 | 296 | 0 / 0 / 0 |
| South, depth 1.2 | 1,539 / 25,380 | 402 | 0 / 0 / 0 |

Counts are sampled points in the union of old/new compiled floor vertices,
not area or a success rate. Locality uses the affected 1/12 lattice-cell
closure; the analytic curve is not claimed to be the exact mesh boundary.
Maximum retained-floor drops are respectively about 1.2772, 1.2898, 0.8507
and 0.8794. Whether those shapes improve the art remains for actual viewing.

All four place commands were accepted while preserving the original owners.
Each original owner retained a HOME approach whose entire route passes the
body-width floor check. Ordinary Undo/Redo preserved the owners and restored
the place/world revision. A second command sequence moved the same bench to
(2,4), then the flower to the now-vacant (1,6), in both the original baseline
and the edited bay. Both moved owners remained reachable and supported.

The first move test did not find a second valid position in its small candidate
pool. It is preserved in `bay-check-first.json`; it was not counted as two
successful moves. The final comparison tracks the baseline bench move too,
then tests the newly vacant old bench cell for the flower. The failed near-shore
targets remain listed in the final evidence. This is not proof that furniture
can be placed anywhere around the new bay.

Actor negative controls on the changing west and south floor reject with the
resident-footing message. A bay centered on the dock at (7,7) rejects with the
fixed-footing message. Positive-height input, saved-trial combination and
two-platform combination are also refused. The same ordinary safety contract
was used for the positive and negative cases.

The pure field matches S exactly at each lateral endpoint; the smallest tested
inward epsilon 0.0025 gives a derivative-of-difference below 1e-6. This endpoint
test concerns the continuous formula. Mesh continuity/locality is assessed
separately on actual compiled triangles and their finite interpolation halo.

## Entry safety and compatibility

An entry review found that a recognized coast query without the dedicated
fixture could fall through to the normal island hook. The parser now requires
`trialScene=shore` and `terrainTrial=H` for every recognized coast mode, before
caching or constructing the trial. The parent integration calls that parser
before the normal hook. The diagnostic checks 25 missing/unknown fixture or
wrong-terrain combinations across all five modes, plus valid combinations.
It does not treat a missing fixture as permission to use personal saved data.

Existing valid off/soft08/soft12/contour inputs are unchanged. The old-mode
geometry diagnostic and center-section parity pass in
`coastal-section-after-bay.json`. The existing negative-ellipse inlet remains
available only in the old off mode; the new bay modes do not combine it with
the new displacement. No production source or normal save schema was edited.

## Evidence and remaining work

Final static evidence: `bay-check-entry-guard.json`,
`2026-10-24T01:58:02.772Z`, PASS, `changedInputs: []`, bundle SHA-256
`a0bc91776b5d8b58b6ba876c24634ce7fedbb7772053d0e8e4d59e30f619c33b`.
Command: `fnm exec --using=22.23.3 node docs/design/2026-10-23-place-brush-trial/bay-check.mjs entry-guard`.
The worker's coast/bay source and diagnostic ESLint checks passed. Parent owns
transformed TypeScript/build, actual UI/camera comparison, live residents,
and the final visual decision. No browser-use, saved-world, art-quality,
delivery or child-comprehension acceptance follows from these static results.
