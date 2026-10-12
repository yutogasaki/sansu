# P02 native bough ramp — source study preparation

Prepared only, 2026-10-12. No Blender, Node world compilation, model production, geometry survey, browser, or render has run. Source scripts have only passed Python parsing/compilation and frozen input identity checks. `--scheduled` is an execution-window guard, not a new user permission request. Root schedules this after competing c2 browser work. All outputs stay here; app, product docs, fixed c1/c2, original source and the other artist's forest outputs are read-only.

The bounded story is **enter the same hollow tree → walk up its visible branch ramp → stand on a short gallery → return to the same entrance**. No invisible ramp over ornamental stairs, free supports, new owners/grants, original trunk/crown replacement, or runtime-use score.

| Transfer from benchmark | Do not transfer |
|---|---|
| One high fan crown, warm hollow trunk, readable interior shadow, curved wood floor carried by branches | Original narrow .3195 gallery / .297 stairs as an actor-safe floor |
| Original honey-wood and bark materials, source P02 scale/pivot and branch curve language | A decorative staircase with no continuous surface, or a free support post outside owned assembly |
| Depth of the real forest around the place | The original 15-house composition, missing four left trees, or a gallery that claims to solve sparse foliage |

Viewed the approved native05 whole and c2 acquisition-initial-32 whole for context. The latter is a 32-owner acquisition stage, not a matched mature35 art comparison or a completed c2 journey. The upcoming source study uses fixed c1 mature35 and restores the four original left trees exactly, with no crown revisions by this task. This first bounded ramp is a coarse feasibility candidate, not a selected final direction; the forest artist's independent mass variants remain theirs.

## Inputs and geometry boundary

`study.json` freezes actual input paths/SHA/bytes, original four-owner P02 matrix, source pivot, measured envelope, three existing derived entrance candidates, the actual whole camera and explicit authoring choices. Context is the ~19.6 MB `fixed-c1-context.glb`; exactly 128 original role meshes from `role-separated-originals.glb` restore the removed left trees. Original .blend is loaded only for four named reference objects: native interior floor, continuous gallery, native grown support (materials), and the original core trunk (hidden support-contact probe only; never an additional visible trunk). It does not instantiate another whole island. All old context and restored tree mesh/normal/matrix digests must remain identical.

P02 authored origin `(3.5,1.49033759075,-8.5)`, uniform `.45`, source GLTF pivot `(-4.8,3.7931642532348633,-17)`. Y-up authored→Blender matrix and renderer offset are explicit; no raw Blender/GLTF axis guessing. Owner ids l10–l13 and all 35 records/75 rights remain fixed. `nativeCompactGrove` eligibility and actual runtime graph validation are later work, not replaced by this source scene.

Clear corridor is `.5681387411828117` (actual radius .24406937059140585 plus .04 reserve on each side); upper measured rig extent `.5500928879753579` plus explicit `.04` design head reserve. Structural floor width .64, .07 thickness, radius1.16, ramp -68°→-210°, short gallery to -235° are **unmeasured coarse authoring choices**, not new product thresholds or accepted geometry. Interior/upper heights come from evaluated original floor/gallery, entry height from actual context ground. Three entries only: `(3,-7.25)`, `(3.75,-7.25)`, `(4,-7.25)`.

## Executable stages, all pending scheduling

Use the installed Blender CLI, e.g. `/Applications/Blender.app/Contents/MacOS/Blender`; no install is included. Run from this directory. Every destination/log must be new, including retries.

1. **Bounded survey**, no new mesh saved:

```sh
python3 supervise.py --scheduled --seconds 180 --rss-mib 2560 --log runs/01-survey.log.txt -- /Applications/Blender.app/Contents/MacOS/Blender -b --threads 2 --python source-study.py -- measure --scheduled --out runs/01-survey
```

`measurement.json` keeps all three attempts, collision sample coordinates, entry ground samples, native floor width, actual floor/gallery heights, source triangle counts and input/script SHA. It does not cut a doorway or optimize more locations. No selected candidate means stop with raw HOLD and use the dimensions to revise the art. A successful sample check is still not swept-rig/route PASS.

2. **One coarse source**, only after reading the survey:

```sh
python3 supervise.py --scheduled --seconds 240 --rss-mib 2560 --log runs/02-build.log.txt -- /Applications/Blender.app/Contents/MacOS/Blender -b --threads 2 --python source-study.py -- build --scheduled --measurement runs/01-survey/measurement.json --out runs/02-build
```

Replays the same bounded survey and requires exact input/result identity. New ramp + interior spur + reintroduced native interior floor are Boolean-unioned **only with each other** into a closed continuous floor; no original trunk/crown/ground is an operand. The top is exported once as named `walk-top/...`, with identical physical triangles in `owner-use-profile.json`; remaining faces are `solid-underside/...`. Closed rails and short boughs ray-connect to the actual native trunk and floor underside. Missing bounded trunk contacts stop the build. Bough ends and unions remain independently auditable; sampled walk support is recorded, not presented as all-width continuous proof.

Outputs: `study.blend`, `study.glb`, `owner-use-components.glb`, profile, raw sampled-support report and manifest. Only this new P02 component is generated; original four left trees are restored unchanged, not deformed. Geometry profile carries explicit owner-use floor IDs, source transform, entry, physical XYZ route, use region and return. It is **not an app asset or implemented domain schema**.

3. **Source views**, separately scheduled, one at a time:

```sh
python3 supervise.py --scheduled --seconds 240 --rss-mib 2560 --log runs/03-whole.log.txt -- /Applications/Blender.app/Contents/MacOS/Blender -b --threads 2 --python render-source.py -- --scheduled --source runs/02-build --out runs/03-whole --view whole
```

Use fresh directories/logs for `--view rotated` and `--view entry-section`. Whole uses the actual forest reference matrix/frustum. Rotated is an explicit +35° derived source camera, not a captured rotated app camera. Entry-section is a close camera with a recorded near clipping plane; the source geometry remains unchanged and the whole image remains the uncut comparison. Lighting matches the forest source script; 1280-wide, Cycles CPU, two threads, 16 samples. Residents/Blender materials/transmission/ocean/ripple differ from runtime; N=0, no art/runtime PASS. Do not score a source image as actual c2.

## Exact pending measurements and fail boundaries

- Real ground heights across each full-width landing; any missing dry triangle, step/gap, or unsupported underside at the joint. Current survey records corners/middle only; it does not prove a continuous width union.
- Actual hollow doorway/reveals, existing cobalt entry and window/body thickness against full width and headroom. Survey boxes detect triangle intersections, not containment in a closed volume; original topology/inside tests and full corridor proof are still required. No hidden scaling or automatic trunk derivative.
- Curve turning clearance and ramp rise/run; gallery top is source-derived, not guessed. Steepness report and visual judgment must precede a claim that the ramp is inviting. Current authoring choices may be rejected.
- New floor Boolean topology (checked), source-GLB Float32 parity and material/raw-normal export (later independent check), bottom/branch contact volume, all rail/soffit collisions, and complete actual-rig sweep between samples (pending).
- Real guarded HOME-reachable entrance and all original owner approaches, especially p3 and l25. Entries are existing derived P02 cells, not proof they survive all current physical filtering. No world compiler runs here; source geometry alone cannot grant entry or award a receipt.
- Native original floor has narrow beveled edges; the old `.621` full box width is not a proof of the clear flat surface. Width samples and raw failures remain visible.
- Every support originates from actual same-owner trunk mesh. If no bounded contact exists, report HOLD, never substitute a ground post/free anchor.

Expected cost is **unmeasured**: one survey should be tens of seconds to ~2 minutes; one build adds two small exact unions, source export and local checks, ~1–3 minutes; each 16-sample source image may take ~1–4 minutes. Hard caps are 180/240/240 seconds and 2.5 GiB sampled process-tree RSS per single Blender process. No batch renders or automatic retries. First schedule the survey alone; read its cost/failures before build/render. These caps are reserve controls, not performance guarantees.

## Preparation verification

`python3 check-readiness.py` parses all scripts without importing bpy/app modules and checks input hashes and entrance identities. `readiness.json` records this narrow result. Execution files are absent until a scheduled run. The protected source inputs are rehashed before/after real stages, and first failures stay under their fresh attempt directories.
