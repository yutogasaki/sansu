# P02 eastern timber ramp v2 — coarse source build prepared, not executed

No Blender / source build / render / browser / app edit was performed for v2. East-v1 analysis was separately byte-archived as authorized. The preceding east-v1 survey remains immutable raw HOLD. This source-only candidate always stays HOLD, even if a coarse mesh builds. Root must review the prepared command and schedule each source window; no retry or automatic render.

The actual classification in `../east-v1-analysis/` shows that all remaining native wood/door-edge hits are reserved-box-only; every actual motion-band structural test is negative. Width/head/rules remain unchanged. V2 improves the larger box margin with two explicit changes: align the entry at the original opening's centre before entering, and increase the east arc radius from1.16 to1.24. A single numerical probe of186 forward points found0 old structural box hits and5 retained ground-inlay contacts. It is not a test of new meshes and used the rejected middle approach. The corrected west threshold has a separate21-point numeric old-obstacle check with0 reserved-box hits; final new meshes remain unexecuted.

## One concrete source shape

- Same p3 house/bench/P02 four owners,35 records/75 grants, all original source bytes and all128 exact left-tree meshes. Source origin `(3.5,1.49033759075,-8.5)`, pivot `(-4.8,3.7931642532348633,-17)`, scale.45, B/A transforms unchanged. The valid source/evaluated donor matrix and bounds checks are reused byte-for-byte. No original trunk/crown/root/door/ground edit or Boolean operand.
- Original derived west ground entry `(3,-7.25)` to aligned front junction `(3.454999924,1.681410074,-7.57475)`, then straight through the existing opening to front-safe Z−8.215. The same doorway is used to return to the connected front branch. No rear-door penetration, ground snap or new entrance grant.
- A **visible .64m-wide timber threshold** uses the unchanged actual terrain at west entry Y1.563063105. Its first .20m rises to native Y1.681410074; the rest is an explicit level plateau. The first overlap with other proposed flat floor is .239157911m from the entry, leaving .039m before overlap. The top is split at the plateau break and each actual terrain-triangle edge. The one bounded numeric check preserves all268 resulting top triangles, gives a closed extruded slab with0 nonmanifold edges, area error1.33e−15 and nonnegative lift0.. .109271538. This is a chosen visible timber connector, not a ground edit. Maximum centre grade .702429 remains a reported design concern; no runtime slope rule is invented.
- **Known rejected middle-entry mismatch:** the old `(3.75,-7.25)` threshold was already under a flat branch top about4.8cm higher. This was distinct from the original horizontal landing/terrain mismatch. `history/pre-doorway-overlap-fix/` preserves the exact former preparation742031d and scripts. `entry-audit/` saves the two footprint comparisons and the one selected west connector. West uses an already-derived P02 approach, with the same owners and hollow door. No coordinate search follows it.
- Route heights come from the authored connector alone. The Boolean union cannot silently lift the route onto a higher surface. The build records original-vs-composed full-width threshold intervals and planned-vs-union route heights; any mismatch above unchanged EPS1e−7 stays raw HOLD. Float32 seam deviations are not excused by a new tolerance. They may be viewed and repaired later, rather than hidden in a ground receipt.
- The straight opening floor and a rounded **same-floor branch junction** connect threshold, original interior slab and front branch. Radius.32 is the floor's half width; this is joint geometry, not an extra prop/owner/post. Only these new slabs and the reintroduced copy of the native interior floor are Boolean-unioned into one closed floor. Existing scene geometry is untouched.
- Continuous east ramp R1.24,−68°→75°, same actual source-gallery endpoint Y (v1 measured2.997417); no invisible ramp over stairs. Current numeric maximum grade~.638 is still steep enough to require a whole/close visual judgment. There is no invented pass threshold or unseen levelling.
- The radial joint leads to the same native crescent's outward width derivative, centre radius.914 and actual native gallery height sampled at each angle from original mid-radius.75375. Use target stays95°. **Visible floor continues to115°**, giving~.319m of floor beyond the use point before a real end guard. This fixes the old centre-at-floor-end support deficiency rather than claiming its former endpoint was supported. No new owner/grant or free art anchor.
- Six short curved timber boughs must hit the actual same-owner native trunk within the existing1.35m span. Start penetrates actual source wood by.015 and the other end meets the real slab underside. Missing contact stops with a failed-scene file; no free posts. The original wood/bark donor materials and curved native branch language are reused.
- Both ramp edges and the actual far end get solid rails/posts. The entire new floor uses `walk-top/...` separately from `solid-underside/...`, boughs, rails and posts. One floor profile references the same rendered triangles and explicit four-owner/transform provenance; it is not an implemented runtime schema or default ground surface.

## Coarse execution and raw limits

`build-coarse.py` has only a build stage and no render call. It imports the fixed35 context, restores exact left trees, validates all four source donors, builds this one shape, then records closed-floor topology, floor/ground triangle relations, same-trunk bough contacts, reserved-box hits against original context + left trees + new structure, surface samples, and source/code hashes before/after. The source survey's pavement contacts are kept in those results; there are no blanket exclusions or gate changes. Source body bands/continuous rig sweep and solid contact volume remain pending.

Topology or missing same-trunk contact is a hard failure that preserves first-failure JSON and failed-scene Blend. Clearance/ground/support concerns are recorded as HOLD in `coarse-qa.json`; a source scene can still be saved for the requested whole/entry review. It never receives an app/source-physics PASS merely because it exports.

The entry close view now keeps near clip.1, retaining the actual ground threshold and hollow opening. The older3.38 near plane would have clipped away that threshold. Whole retains the exact recorded fixed-c1 reference camera; rotated whole remains the explicitly derived35° camera. These are source views with known Blender/runtime material/light/ripple differences, not actual c2 screenshots or accepted art.

## Pending commands, one process at a time

From this directory, after root schedules a fresh source window:

```sh
python3 supervise.py --scheduled --seconds 180 --rss-mib 2560 --log runs/01-coarse-build.log.txt -- /Applications/Blender.app/Contents/MacOS/Blender -b --threads 2 --python-exit-code 1 --python build-coarse.py -- build --scheduled --out runs/01-coarse-build
```

After root reviews the saved build/raw HOLD, separately schedule the first whole view; do not chain it to build:

```sh
python3 supervise.py --scheduled --seconds 240 --rss-mib 2560 --log runs/02-whole.log.txt -- /Applications/Blender.app/Contents/MacOS/Blender -b --threads 2 --python-exit-code 1 --python render-source.py -- --scheduled --source runs/01-coarse-build --out runs/02-whole --view whole
```

Entry close uses fresh `runs/03-entry-section` /log and `--view entry-section`. Rotated whole uses fresh `runs/04-rotated` /log and `--view rotated`; neither is scheduled automatically. CPU2, RSS2560MiB, one process;180s build/240s each16-sample1280px render caps. Source-import baseline was11.34s/~.72GiB in v1; Boolean/support work and view times are unmeasured. Stop and retain any first failure, no retry.

## Preparation checks and first failure

`check-preparation.py` checks syntax, eight fixed inputs and sealed v1 code/measurement hashes, exact donor block, unchanged width/head/EPS and obstacle scope, plus tiny synthetic topology/terrain tests. It does not import bpy or build actual source geometry. The first synthetic test exposed two mathematically identical clipping intersections represented near zero as1e−16 variants, creating a double side. Its original helper/check/log are preserved in `history/pre-intersection-weld/` and `static-first.log.txt`. The fix reuses computed intersections within **existing EPS1e−7**, keeps the first coordinate and records maximum weld distance; it never moves source ground or drops collapsed triangles. The second static/synthetic check passes. Actual source closure is still unexecuted and may fail; that would remain a fresh raw failure.

## Final doorway correction readiness

`static-doorway-first.log.txt` passes21 static/synthetic checks. Original source/owner/envelope/transform, donor block, EPS, width/head and full obstacle scope remain fixed. The selected west approach and .20m plateau are explicit authoring changes. Missing support, collisions, material/render quality, continuous actual actor sweep and source union all remain HOLD until observed; this is a coarse shape for whole/entry images, not route adoption.

The inherited supervisor remains byte-identical and does not record exact child UTC/PID. The executor must record actual child PID/start/end UTC externally, plus observed RSS and exit. Do not infer exact process timestamps from file mtimes. Preparation is unexecuted; root schedules the single build. No automatic render/retry.
