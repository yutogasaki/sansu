# l14 baseline approach diagnosis — read-only

Scope: one existing owner l14 at (2,-4), current unchanged 32-owner/73-right fixture. No proposed forest district, bench search, app/source/durable edits, browser, core or production build. `report.json`, `probe.mjs` and `execution.log.txt` are the original executed results; this note is separate.

## Narrow cause

The physical shape is l14's individual `growing-tree-spread` willow, ownerIds=[l14], not a shared 4-owner trunk or an owner-ID mismatch. Nature age is 234 h, above the 168 h big-tree threshold and below the 720 h lord threshold; the native source .45 scale is multiplied by the earned 1.3 age scale. Keep this age, source ratio, ID and cell.

| Diagnostic index | Triangles | Reachable refs | l14 reachable approaches |
| --- | ---: | ---: | ---: |
| Current flower+cove | 115808 | 1386 | 4 |
| Plus all actual trees | 211560 | 1380 | 0 |
| Plus l14 only | 143680 | 1380 | 0 |
| Plus all trees except l14 | 183688 | 1386 | 4 |

Material isolation identifies only l14's `sculpted tree wood` (2720 triangles). The three leaf materials and `young branches` each retain all 4 original approaches. The wood bounds are x=[1.4729618502,2.5848022246], z=[-4.4392168573,-3.5577111390], y=[0.2059705232,3.1974884548]. The actual 9-rig envelope has 8 measured bands, radius .2440693706 and height .5500928880. It is unchanged from the cove diagnostic.

All original approach candidates have actual floor. Four are base-open and initially reachable. The wood blocks (2.75,-4), (2.75,-3.75), (2.75,-4.25). (2.75,-3.5) is point-clear but is removed by the guard's existing unsafe-edge endpoint rule. Other offered candidates are occupied by neighboring owners. The 0 therefore combines a correct actual trunk obstacle with a candidate-discovery limitation, not missing ground, overhead leaves, exaggerated full-height cylinder, or shared-owner mapping.

`authoredWorldAccess.ts:205-212` explores only while `authoredPointBlocked(next, ownerCell)` is true; it emits the first logical-footprint boundary and stops traversal there. Its radius ceiling is 1.1, but it never discovers a second ring when the first ring is physically blocked. The same actual floor already contains (3,-4), distance 1.0, y=.209249989. With every tree in the guard this ref is reachable and point-clear, and a 33-point route from HOME passes actual `clearGroundPath` throughout. No added floor/ref/grant/edge, smaller rig, smaller tree or movement is needed for that candidate. This remains a route/point diagnostic, not a completed actor-use or full-footprint support proof.

## Smallest next M1 change

When native groves join the production obstruction index, add one shared runtime owner-approach resolver/map produced after actual obstruction filtering. It should continue candidate discovery through rejected first-ring candidates within the existing 1.1 local bound and actual world neighbors, then admit only existing supported walk refs in the guarded HOME-reachable set. For native tree owners, enumerate using the actual owner/root identity. Keep ordinary domain derivation unchanged unless a separate semantic change is intended; do not make place recognition, source eligibility or layout identity depend on renderer geometry.

Use the same resolved candidates for reporting and actual life destination/entry/exit decisions. Routes must still use the real guarded world graph. Treat enumeration through a rejected point only as discovering an endpoint; never authorize a route through that point. Non-tend seat/play transitions must retain clear-to-seat and exit checks. Gallery/shore explicit authored routes remain distinct and must not be replaced with a nearby ground point. A missing safe candidate stays a failure.

Production registration also needs the correct scope: `GrowingLife.sync` currently indexes `layer.placeRoot` and only flower/cove names. The diagnostic indexes `layer.root` so standalone native trees outside `placeRoot` participate too. Add the actual visible native tree/shared-trunk/branch roots without counting hidden replaced solitary models, selection proxies, or indexing duplicate descendants. This is not solved merely by reporting l14 reachable.

## Existing consumers to connect

- `growingLife.ts:61-66`: ownerAccess proof currently calls domain approachCells directly.
- `walkers.ts:38-41`: besideOpen selects the first allowed domain approach. GrowingLife uses it for add/goHome (151/163), place target selection (180), ordinary home/seat destinations (186/190), and guarded tend-drop placement (342).
- `growingLife.ts:198-203`: seatBeside independently checks domain approach membership; a new candidate selected elsewhere would otherwise fail actual seat entry here.
- `growingLife.ts:210-215`: playExit independently chooses domain approaches plus clear-to-seat. Share the candidate resolver but retain that collision condition.
- Actual movement (479-497) consumes world routes. Actual use still flows through enterPlace (402), real seat/shore/gallery behavior, observeUse (366), and guardPose (241). Normal seat exit (530) stays at its retained approach; drop-play exit uses the previously chosen safe exit.

l14 itself has no seat/use target: `objectLayer.ts:34/180` does not classify sapling as a seat, and `places.ts:170-179` creates bench/play/gallery/shore use targets. Do not create an l14 use receipt to make an approach diagnostic pass. Its actual resident approach/leave should be tested separately; a real existing grove use target should cover the full approach/use/exit lifecycle with the same resolver where applicable. Gallery remains pending in the current authored grove source and must not be treated as usable by this patch.

## Focused verification for the next implementation

1. Preserve this real 32-owner fixture, actual native kit, 234 h l14 age and unchanged 8-band/9-actor envelope. Index all visible actual grove roots and assert baseline l14 gains an existing safe ref such as (3,-4), while the three trunk-hit refs and unsafe incident edge remain rejected. Preserve all 32 owner approaches, old floors/grants and state records.
2. Prove ownerAccess and actual destination/seat/exit selection consume the same map. Use normal public life operations/ticks to approach the selected supported ref and leave over actual neighbor edges; check the rendered poses with the real guard and floor support throughout. No forced walker coordinates or receipt injection.
3. At a genuinely existing grove use target, require actual entry, one legitimate receipt when supported by that target's behavior, and safe exit. For l14-only visitation require no invented receipt.
4. In the same guarded baseline, use normal move/store/restore of a tree to rebuild roots and candidates; check no stale safe ref or ghost obstruction remains. Add a deliberately unavailable local approach case that still fails, rather than widening the radius or weakening collision/support checks.

104 local production/resource inputs were hashed before and after the original probe; all remained equal. Their historical whole-massing input hashes also match the current production files. No implementation or broader acceptance is claimed.
