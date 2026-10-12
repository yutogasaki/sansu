# P02 eastern timber ramp v2 — coarse source build prepared, not executed

No Blender / source build / render / browser / app or docs edit was performed for v2. The preceding east-v1 survey remains immutable raw HOLD. This source-only candidate always stays HOLD, even if a coarse mesh builds. Root must review the prepared command and schedule each source window; no retry or automatic render.

The actual classification in `../east-v1-analysis/` shows that all remaining native wood/door-edge hits are reserved-box-only; every actual motion-band structural test is negative. Width/head/rules remain unchanged. V2 improves the larger box margin with two explicit changes: align the entry at the original opening's centre before entering, and increase the east arc radius from1.16 to1.24. A single numerical probe of186 forward points found0 old structural box hits and5 retained ground-inlay contacts. It is not a test of new meshes.

## One concrete source shape

- Same p3 house/bench/P02 four owners,35 records/75 grants, all original source bytes and all128 exact left-tree meshes. Source origin `(3.5,1.49033759075,-8.5)`, pivot `(-4.8,3.7931642532348633,-17)`, scale.45, B/A transforms unchanged. The valid source/evaluated donor matrix and bounds checks are reused byte-for-byte. No original trunk/crown/root/door/ground edit or Boolean operand.
- Same existing ground entry `(3.75,-7.25)` to aligned front junction `(3.454999924,1.681410074,-7.57475)`, then straight through the existing opening to front-safe Z−8.215. The same doorway is used to return to the connected front branch. No rear-door penetration, ground snap or new entrance grant.
- A **visible .64m-wide timber threshold**, length.438734057, is clipped at every real terrain-triangle edge. At its ground edge the top uses exact source heights; each clipped piece rises to the same native interior Y. The original ground maximum here is1.667772064, below the unchanged interior1.681410074. The numeric probe has no buried top vertices or missing area. This is one chosen connector, not an automatic world terrain adaptation or new floor patch. Its.07m closed timber thickness meets/embeds the threshold ground; the new walk top does not duplicate a positive-area old ground top. Final mesh coordinates/Float32 are measured after construction; any failure stays HOLD.
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
