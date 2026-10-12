# P04 native shell — bounded numerical planning

2026-10-12. Read-only investigation; app sources and original art unchanged. No browser render or acceptance claim.

The exact original probe and raw result are archived here. Its constants name the original `/private/tmp/sansu-authored-cove-plan` output and c5 temporary capture paths. To replay after those temporary paths are removed, change only those input/output constants: the same c5 report and screenshot bytes are retained under `../c5-shape/`, and choose a new output directory. App and model inputs are identified by SHA in `result.json`; a different source revision needs its own result rather than replacing this record.

`result.json` records exact source/input hashes, unchanged-input closure, the c5 capture and build identity, actor-envelope provenance, and compact raw geometry/navigation results. The source is native-05 GLB SHA `8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d`.

The current fixed state has p6 `(7,-1)`, p7 `(9,-1)`, and play p9 `(8,0)`. p9's physical floor is Y `0.025666217`, `Water town / shared frontage court:0`. P04's l32 is an individual bowl; the water-composed frame cuts only the northern l20–l24 group. Consequently this bounded P04 dry-floor probe uses the unmodified base world's same local triangles and graph. It does not re-prove the whole composed world.

## Source architecture

The native shell/ribs/seams are `4.8092 × 3.4575 × 3.4560` source units. Uniform `.45` gives `2.1641 × 1.5559 × 1.5552` world units. Both omitted `shell grown footing` curves have 295 source vertices; together with the roof there are 63,440 actual source triangles. All are transformed together from pivot `(13.9,.89,1.2)`, preserving their source joints. No unrelated roof or new posts were used.

The footings are gently rising curved runners. Sampling every footing vertex establishes dry ground beneath the observed samples, not a guarantee that every triangular interior is supported or that the entire underside rests on a plane. Candidate A's lower band has floor offsets about `-.0048…+.0655`; each side has 52/64 sampled vertices within 25 mm of the existing floor. Full physical support remains a later geometry gate.

## Bounded candidates

Coordinates are authored world coordinates. Renderer X subtracts `layout.center`; renderer Z subtracts 2. All candidates have X=8 and Y=.0475.

| Candidate | Z | Uniform scale | Yaw | Unsupported footing vertices | House triangle intersections | Removed walking refs | Reachable approaches p6 / p7 / p9 |
|---|---:|---:|---:|---:|---:|---:|---|
| A | .50 | .45 | 0° | 0 | 0 | 39 | 0 / 7 / 0 |
| B | .40 | .45 | -15° | 0 | 0 | 32 | 0 / 6 / 0 |
| C | .50 | .40 | 0° | 0 | 0 | 27 | 0 / 7 / 0 |

All three are rejected. A is a plausible low silhouette only: default-camera rays from both cap roofs have 0/45 occluded samples per home, p6's actual blue entry has 3/41 covered and p7's 0/41. This treats transmission as geometric occlusion and cannot replace a rendered whole/close view. At p9 and its straight front approach, source underside rays have roughly 1.16–1.49 world Y clearance. The existing actor envelope is radius .244069 and height .550093.

The fatal issue is approach topology: p6 initially has only `(7,-.25)` and `(7.25,-.25)` home-reachable approach refs. The lowered source sidewall/runners block them. p9's front center refs `(8,.75)`, `(8,1)`, `(8,1.25)` still stand on dry ground and are clear to the play target, but are isolated from home after the shell is included. A shell ignored by the flower-only triangle selector would falsely pass; this probe explicitly routes all shell/runners through an in-memory named wrapper to reuse the exact obstruction kernel. Final implementation must generalize eligible obstruction roots.

## Next requirement

Do not implement candidate A as finished P04 or simply lift it again. First design a real entrance from p6's frontage and the island path to p9. Either author a supported side opening in the original shell family or provide a dry approach around an open end with the full actor band supported and clear of the runners. If existing ground is insufficient, author that shared support/approach into WorldDefinition floors, explicit walk refs/edges, and source geometry; do not invent planting rights or a renderer-only platform. Retain current ownership, maturation, P04 supply/use conditions and input positions.

The minimal pure assembly plan must therefore output the shared source transform, support contacts, entry/approach refs and obstruction geometry together, rejecting a candidate when any current owner or p9 use target becomes unreachable. Preview and committed world must read that same result. Whole, close, rotation and phone renders follow a feasible plan; these numerical findings are not art acceptance.
