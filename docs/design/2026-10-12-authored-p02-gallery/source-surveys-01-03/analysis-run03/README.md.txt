# P02 run03: classified HOLD and eastern route production boundary

Completed read-only analysis of the valid run03. No Blender, Node world compilation, app edit, build, render, or source geometry edit was performed in this analysis. All original scripts, study, runs01–03, and eight inputs remain unchanged. This is source feasibility evidence, not an app or art PASS.

## Evidence and limits

`analyze.py` decodes the frozen context GLB's node matrices and actual indexed triangles. It independently reconstructs all raw box hit/no-hit flags: 0 disagreements across 361 / 329 / 331 route samples; raw hit counts remain 159 / 142 / 144. The local crop retains 67,950 obstacle and 9,691 floor triangles. The corrected parser ran in 3.30 seconds. The first parser failure (non-triangle primitive mode) remains in `analyze-first.py.txt`, `first.log.txt`, and `first-attempt-note.md`; it did not execute Blender or mutate source. `sections.py` consumed those raw results and actual triangles; it did not repeat a production survey.

Two checks are kept separate. The original survey uses a reserved axis-aligned box: XZ radius .2840693706, Y +.012 to +.590092888. The independent classifier also uses all eight saved motion-band cylinders from nine actual .45 rigs / 117 meshes / 99,868 vertices (radius max .2440693706, upper .550092888), without the extra .04 design reserve. Band hits still describe a conservative motion envelope, not exact animated body mesh penetration. A box-only result does not waive the reserved corridor. Triangle overlap also does not prove containment in a closed volume.

## Per-candidate segments

Counts below are raw survey hit samples; one sample can hit several objects. Both gallery directions have zero raw or motion-band hits.

| Segment | Entry (3,-7.25) | Entry (3.75,-7.25) | Entry (4,-7.25) |
|---|---:|---:|---:|
| Ground entry → interior front | 10 | 11 | 13 |
| Interior front → old centre | 2 | 2 | 2 |
| Old centre → front | 3 | 3 | 3 |
| Front → ground entry | 10 | 10 | 12 |
| Ground entry → ramp | 14 | 5 | 4 |
| Western ramp outward | 53 | 53 | 53 |
| Western ramp return | 53 | 53 | 53 |
| Ramp → ground entry | 14 | 5 | 4 |
| **Raw total** | **159** | **142** | **144** |

Raw box hits also positive for a motion band: 117 / 110 / 110. Raw box-only samples: 42 / 32 / 34. Additional band-only hits: 14 / 10 / 8 (the lower motion bands include sole/contact heights below the box's +.012 bottom). These counts are diagnostic, not a new acceptance rule. Full object identities, sample XYZ, cumulative 3D distance, relative triangle heights, segment counts and object progress ranges are in `report.json` and `sections.json`.

## Fixed p3 house is the dominant real obstruction

Nodes 115 and 116 (`grove / blue silver leaf tips`, `home / curled jade leaf roof`) belong to `objectId=p3`, `nativePart=home-leaf`; the leaf-tips name is a **house roof material**, not the P02 fan crown. Node119 is p3 porcelain wall. The owner/hierarchy metadata, original template component names and exact bounds are retained in the JSON.

Each western ramp leg hits roof node116 in 53 box / 44 motion-band samples, roof node115 in 52 / 42, and wall node119 in 16 / 13. These object counts overlap. All three entries feed the same bad arc, so changing the entry alone cannot fix it.

First roof-band point is `(2.712265253,2.138811588,-7.648487568)`, raw sample124/106/110 respectively (progress4.868623/4.000263/4.190433m). An actual roof triangle spans relative Y +.47146..+.580775. The interference continues while the route rises and goes west, ending around `(2.347352028,2.656248093,-8.627932549)`. First wall-band point is `(2.675997496,2.166382790,-7.683532238)`; the wall extends up to Y2.322271611.

There is stronger evidence than an envelope corner: the route centre/spine segments at offsets0/.10/.20/.30 cross actual roof triangles 16 times including the reversed journey. One zero-offset crossing is `(2.340787771,2.599192810,-8.462648613)` between raw route samples160–161. Its roof triangle is retained in `sections.json.routeAxisSurfaceCrossings`. This is direct route-axis/surface intrusion, while an exact animated-body test remains unperformed. **Reject the western arc; keep p3 fixed.**

## Original interior endpoint reaches the door

The first meaningful non-pavement interior collision, candidate0 sample25, is `(3.454999924,1.681410074,-8.308084488)` at progress1.2057199m. It meets actual original cobalt-door triangles at Z−8.518000412 spanning relative Y−.01575..+.57375. All candidates share 2 incoming / 3 outgoing raw door hits and 1 / 2 motion-band hits. The old target centre `(3.454999924,1.681410074,-8.356000900)` is too far back.

Door bounds are X3.259249988..3.650749937, Y1.634160213..2.286660127, Z−8.581000137..−8.518000412. A front target must keep the whole reserved radius in front of this plane; Z ≥ −8.233931041 is the plane-only bound. Proposed Z−8.215 gives ~.01893m residual front-to-door reserve; it is a **pending measured route target**, not a moved floor or source offset. The actual floor's bevel and front boundary must also support the full footprint. The native floor top is Y1.681410074; deep slices showed .621000052 doorway width and ~.91575 head clearance, but front-slice missing rays do not prove a safe/open volume. Preserve door/trunk and test the new target and entire doorway traversal; never route through the door.

## Pavement/foot contact is a separate category

Node276 `growing-reachable-paths` is an existing floor inlay, with no owner or structural-use floor. `placePaths.ts:8–9,65,75,87–90` places it 8mm above ground and uses polygon offset; it grants neither navigation nor ownership. The original source survey conservatively included it as an obstacle, unlike the runtime structural obstruction root inventory. Candidate0 sample5 only contacts this inlay at relative Y+.00943..+.02684, with no motion-band hit. Candidate1/2 sample0 has lower motion-band contact around relative Y−.004..+.020. Classify these as potential sole/support contact rather than roof/body clearance; the original raw HOLD remains. Do not suppress this object globally or infer all its hits are harmless: the proposed walk surface must be proved supported and above the actual terrain, with the inlay's top/normal and sole-contact band retained separately.

The original doorway wood/branch box contacts (4–6 per entry leg) have no motion-band hits. These are reserve/box-corner candidates, not permission to reduce the .568138741 corridor or delete branches.

## Existing-ground seam and proposed floor gaps

Every unchanged horizontal entrance cross section has full terrain coverage and no missing/discontinuous interval, but none matches actual ground across .64m width. Signed values are proposed walk-top minus existing ground; positive is gap, negative burial.

| Candidate | Ramp-entry seam min/max | Interior-spur seam min/max | Connector grade | Spur grade |
|---|---|---|---:|---:|
| 0 | −.00666 / +.03075m | −.01181 / +.01889m | .124485 | .145421 |
| 1 | −.00160 / +.01763m | −.03279 / +.03415m | .189259 | .065269 |
| 2 | −.03292 / +.03391m | −.03707 / +.04347m | .163582 | .035146 |

The local foot samples (centre and ±.284069 across the route) show larger gaps farther along the proposed spur, even though all samples find real ground. Outbound entry→front ranges are candidate0 −.01101..+.11147m, candidate1 −.02894..+.08690m, candidate2 −.03309..+.08015m. Outbound connector ranges are −.03484..+.04297m, −.02442..+.04252m, −.02455..+.04213m. Return-side samples and all source triangle indices/relations remain in raw JSON. This is **not** support from an existing flat pavement: a real visible structural joining floor is required. Native interior top itself has source-ground gap .01923.. .29142m and no burial; its supporting structure remains separate work.

## Next bounded eastern survey (not executed)

Preserve the same source, matrices, four owners, p3, ground, floor height, .64 structural / .568138741 clear widths and .04 head reserve. Use the existing middle approach `(3.75,-7.25)` for the first east candidate, the hollow doorway's front-safe interior target, then return through the same existing front opening onto a visible short front bough. From there turn toward the east ramp; do not take an unmeasured diagonal through the trunk wall. The new route is one connected owner-use journey, with no return to the old ground entrance between entering the hollow and ascending.

Proposed radius1.16 arc is −68°→+75°, followed by a short +75°→+95° upper segment. Since x = 3.5 +1.16 cos(angle), the ascent stays east of X3.80 and the short upper segment east of X3.3989; even after .284069 reserve this is horizontally beyond p3 roof max X2.627715. This is a useful p3-only bound, not an all-object clearance proof. All trunk/root/crown/other obstacles still participate. The old western source gallery minimum Y2.734410286 must not be reused blindly: measure the actual source gallery's upward top at the matching east angular stations, then report the resulting rise and grade. Do not move the native gallery to make a match. Reusing its wood/curved bough language does not make a new outer ramp physically joined to the old inner gallery.

Entrance repair is a production design proposal only: take the actual terrain-triangle intersection across the entire .64 threshold as the shared edge of a visible wood/branch connector. Preserve all triangle-edge breakpoints and exact heights; connect that nonplanar edge to the native interior top with a closed short wedge/branch. No additional ground patch, invisible ramp, automatic terrain flattening or tolerance increase. Record top/ground intersections and do not allow buried/coplanar positive-area walk tops. The first east survey keeps a flat diagnostic ribbon and records the exact terrain section; it does not manufacture a passing terrain-following mesh. A later explicitly designed connector needs full-width support, closed joint/bough contact and continuous physical floor proof before build.

The east preparation remains measurement-only, no build/render path, no automatic shape adaptation or retry. A changed route may still HOLD on actual trunk/door/canopy, floor overlap, ground seam, entry width or structural contact. Runtime owner-use XYZ graph, HOME approach, poses, return and art views are separate pending gates.
