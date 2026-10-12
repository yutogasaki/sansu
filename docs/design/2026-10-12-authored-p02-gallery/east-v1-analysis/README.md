# East v1 source measurement classification and one v2 design probe

Offline analysis only, completed2026-10-12. Frozen east-v1 input/scripts/run remain unchanged. No Blender, Node world compile, render or source build was run by this analysis. The original east-v1 result remains HOLD; no art or runtime acceptance.

`analyze.py` independently decodes actual indexed context GLB plus the exact restored left-tree GLB, applying the complete node transform chain. It reproduces all30/339 raw reserved-box flags, with0 disagreements in.83seconds. The raw Blender names, ancestry and object triangle IDs are retained in east-v1's measurement; this report maps them to immutable GLB source nodes and owner metadata. `report.json` SHA `6b7386fce94325a37d17df782617c4fb1f08172a6c9bf013ac57a431c391f088`.

| Real object | Raw hit samples | Actual motion-band hit samples | Identity |
|---|---:|---:|---|
| ground path inlay |12|20|GLB context node276, no owner/structural floor |
| sculpted tree wood.002 |16|0|context node186, native05 hollow-trunk, owner l10 |
| young branches.001 |10|0|context node187, original grown doorway edge, owner l11 |

Object counts overlap.30 raw samples comprise10 also positive for motion bands and20 box-only.10 additional motion-band-only samples are all low path contact. The bands are conservative intervals from actual nine .45 rigs; zero band hits is not an exact animated-body proof or permission to shrink the .568138741 clear corridor. The same-radius reserved cylinder also has zero structural hits across all30 raw samples, confirming an AABB-corner/height-reserve effect; the new design still improves the larger box clearance rather than merely changing a test.

The12 raw inlay contacts are the first6/last6 entry points. `placePaths.ts` places this existing-ground decoration at ground+.008; it is not a new walk surface or structural wall. Examples are relative height−.00417..+.01841 at the initial entry. The additional8+2 motion-band contacts near the front bough/ramp beginning include sole-band heights; retain them as named raw contacts until actual constructed floor and motion are checked. No blanket object removal.

Entry wood/branch raw contacts are samples10–14 and324–328. First point `(3.553333282,1.665388823,-7.699834347)` approaches the opening diagonally from the right. Some grown-edge triangles enter the box only at relative Y+.576..+.636; actual upper extent is.550092888. Wood triangles also hit box corners around relative Y+.040..+.197. Every saved eight-band test is negative. Full object geometry and triangle examples remain in `report.json`.

Ramp-only wood contacts are samples73–76 and274–277, positions `(4.467500210,1.874421597,-7.860044003)` through `(4.506530762,1.913272142,-7.923915863)`. These are the original hollow-tree wood/buttress, not p3 house or a restored tree. They also remain outside the actual motion bands. P3 roof/wall, original cobalt door, upper gallery and front-safe interior traversal have no raw hits. All25 original native arrival footprint samples are supported in the root-executed survey; source width/entry/oldground support are separate checks.

## Single bounded design probe, not source production

`design-probe.py` checks only one revised alignment/radius, not an optimizer: align the approach at original front-bough junction X3.454999924 before the doorway; radius1.24 instead of1.16 for the same eastern arc. On186 forward samples, reserved box has0 structural hits and5 path-inlay hits. These are original indexed triangles with a numerical proposed route, not a Blender model with rails/supports. Actual future supports/rails and all animated motion remain unverified.

The visible terrain-seamed connector has width.64 and horizontal length.438734057. It clips this one corridor by every actual ground triangle, uses exact source height on the complete threshold, and rises to the unchanged native interior Y1.681410074. Within that bounded corridor, maximum actual ground is1.667772064; signed coverage area error−2.498e−15; negative proposed top-minus-ground vertices0; lift range0.. .087540688. Connector centre max grade.128447551. Revised ramp max sampled grade.637640410 (a report, not a new slope rule). Existing terrain is untouched. The algorithm triangulates inside each old source triangle, so nonnegative vertex lifts imply nonnegative plane differences inside each generated triangle; final Float32 export/joints remain separate pending checks.

`design-probe.json` SHA `43ec18d642cfd4ba7d20f511a7ab06889144c4daeb6d794ac29594eb7e414c73`. The initial forward-count message said177; the raw result is186 and was explicitly corrected. No raw artifact was overwritten.

The source build preparation is separate at `../east-v2/`. It preserves the same width/head reserve/owners/source and adds real visible floor past the95° use point to115° for terminal foot support before a guard rail. Closed soil/land is not added: this is a timber owner-use floor with a ground threshold and same-owner boughs. It remains HOLD and is intended for whole + entrance close-view review before further detailed validation.
