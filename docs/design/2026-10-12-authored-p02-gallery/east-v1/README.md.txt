# P02 east ascent — preparation only

No Blender / source survey / build / render / Node world compilation / browser has run for this proposal. The completed western run03 remains raw HOLD. All original study scripts, runs01–03, source inputs, owners and actual context remain unchanged. Root owns the execution window; this directory is not an app asset or a selected art result.

The story is: use the same ground entrance → enter the native hollow's safe front interior → exit through that same visible opening onto a short connected front bough → ascend on the east side → use a short gallery → descend and return to the same ground entrance. It does not revisit the ground entrance between the interior visit and ascent, nor pass through the original door/trunk wall.

## Proposed coordinates, unchanged references

All coordinates below are authored Y-up physical coordinates. Source GLTF pivot `(-4.8,3.7931642532348633,-17)` → origin `(3.5,1.49033759075,-8.5)`, scale `.45`; Blender B / inverse and source donor matrix checks are byte-identical to valid run03. No constant corrective offset. Owners l10–l13, home p3, bench l25, all 35 owners / 75 grants, original trunk/root/crown, source floor and exact original left trees are fixed.

- Existing middle ground entrance `(3.75,-7.25)` is the single first diagnostic approach. Its Y is measured from actual ground again. This selects one of the three original entries; it does not grant a new approach.
- Native floor Y is read from the actual transformed donor (run03 observed1.681410074). Native front X/Z is source-derived (run03 observed3.454999924 / −7.924751282).
- Pending interior arrival Z is **−8.215**, same native centre X/Y. This retains approximately .01893m beyond the full reserved radius in front of actual door plane Z−8.518000412. It is only a door-plane bound. The new 5×5 footprint/rays and entire traversal must still pass actual source checks. The old rear centre Z−8.356 is no longer a route target.
- Proposed front bough junction `(native centre X,native floor Y,−7.57475)` is in front of the native doorway. Travel back through the same opening before turning east; no diagonal through a side wall.
- Radius1.16 ramp, **−68°→+75°**, using `x=3.5+r*cos(a)`, `z=−8.5−r*sin(a)`. StartXZ `(3.934543648,−7.424466729)`; endXZ `(3.800230092,−9.620473958)`. Interior floor→local native-gallery height uses the same smoothstep as run03. Actual rise/grade is pending.
- The initial analysis suggested an outer R1.16 short arc. This preparation makes the connection explicit: a radial segment at75° joins the outer ramp to a proposed short gallery centre R**.914** (native inner nominal radius1.32×.45=.594 plus half new structural width.32), then follows75°→95°. CentreXZ at75° `(3.736560607,−9.382856205)`, at95° `(3.420339651,−9.410521954)`. This is an outward width derivative of the same native crescent, not a substitute flat platform. Exact polygon/closed-joint parity is unproved, and the original source is untouched.
- Upper Y is measured at every angular station from the **actual native donor gallery top**, at original mid-radius `(1.32+2.03)/2×.45=.75375`. Missing upward ray hits stop the survey; no western/global minimum fallback. The nominal radius comes from original `varied-world.py:69–75`; actual source triangles set heights, never that authoring formula.

P3 roof maxX2.627715 is west of this entire proposed reserved route by over .50m in the simple horizontal bound. This says only that the new east envelope avoids that p3 bound. Actual trunk/crown, restored trees, all other local objects and joins remain unmeasured. The survey now includes context **and all 128 restored left meshes** in the obstacle index, preserving the previous floor / placementHitOnly / hide_render filter. This closes an old survey scope limit; no object is silently excluded to produce a pass.

Structural width .64, clear width .568138741, .04 head reserve, .05 probe step and source terrain EPS1e-7 are unchanged. Native footprint ray comparisons retain the original run03 diagnostic tolerance1e-5 and report it explicitly; it is not a terrain gap allowance. Motion bands remain based on the actual nine .45 rigs. This measurement preserves the reserved box; raw object/triangle IDs allow the same later contact-vs-body classification.

## Terrain and structure remain raw HOLD boundaries

`groundSpur` keeps the unchanged horizontal threshold at the actual centre Y and records its full .64 terrain section, source triangle breakpoints, gap/burial and coplanar overlap. It does not auto-conform or manufacture a pass. The branch starts on the native owner floor: its ground comparison is labelled as diagnostic, not wrongly used as a second ground-entry seam. Native arrival footprint and existing ground relations are recorded separately.

The production proposal is a visible short wood/branch connector whose ground edge follows the measured full-width terrain intersection, and whose upper edge joins the native interior top. No added ground, flattening or arbitrary tolerance. Its closed bottom/sides and native floor/bough/gallery joints require later explicitly designed geometry and independent checks. New rails/undersides and same-owner supports are also unbuilt. The survey always keeps `selectedIndex:null` / pending-design HOLD; even zero raw hits would not close these gates.

The script has **only a measure stage**. It cannot build or render. The same forward/reverse path is connected by endpoint assertions, final return equals the original entry, and each leg records slope and sample ranges. Actual geometry/width/swept rig/HOME approach/runtime-use semantics remain pending. Source coarse whole / rotated whole / entry-section views come only after a measured viable design, with exact left trees restored. No runtime or whole-island PASS is implied.

## Scheduled command — NOT RUN

Run only after root opens the single-source window, from this directory, with fresh output/log paths:

```sh
python3 supervise.py --scheduled --seconds 180 --rss-mib 2560 --log runs/01-east-survey.log.txt -- /Applications/Blender.app/Contents/MacOS/Blender -b --threads 2 --python-exit-code 1 --python source-study.py -- measure --scheduled --out runs/01-east-survey
```

CPU2 / one Blender /180seconds /2560MiB RSS, no retry. Valid run03 cost8.24seconds /~0.70GiB; adding original left-tree collision scope and explicit object provenance may add work, so that cost is only context, not an estimate guaranteed for this proposal. Expected bounded execution remains within the same cap; retain any failure and stop. No heavy process was used to prepare this script.

`check-preparation.py` is AST, exact source/code hashes, and synthetic arithmetic only. It does not import bpy or app code. It verifies original run03 files and eight inputs unchanged, exact donor transform block, copied helpers, preserved widths/filter, east endpoint/p3-only arithmetic and nonzero ribbon tangents. Synthetic Y values are not native source measurements. `manifest.json` records pending command and code hashes; the survey verifies active code/helpers/config before and after execution.

A separate static reviewer identified three preparation issues, all addressed before freeze: restored left meshes now enter obstacles; the inherited1e-5 native ray tolerance is explicit; helper/config hashes are verified at runtime and bound to the result. No survey was executed during these corrections.
