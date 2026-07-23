# Carry Bloom v4 exact-build visual audit

## Target

- Revision: `e807776e52ea441396da2b629116f5e7fa71231f`
- Source tree: `76cff10143a9521493dbb439aa26de780f4148cc`
- Candidate delivery: `snap-root-v1`
- Visual lineage: `pokko-field-v1`
- Capture: exact detached production build at 390×844 and 768×1024
- Evidence: 38 critical-path screenshots, two simultaneous Q7 composites,
  [contact sheet](./contact-sheet.jpg), and [manifest](./manifest.json)

## Non-compensating gates

| Gate | Result | Evidence |
| --- | --- | --- |
| Visual appeal | **GO — 4.3 / 5** | Cold-open through Q8 now shares one cyan/ochre/green/coral horizontal handmade stage; world unity 4.6, joy 4.1, simple shapes 4.4, quiet space 4.8, material difference 4.0, body gag 4.6, low AI drift 3.7 |
| Silent-comprehension pre-screen | **PASS** | Ready → digging → pop, four-drop carry, pebble stumble, safe seated fall, flower opening, root-loop release, and final hat gag remain readable without explanatory copy |
| Safety pre-screen | **PASS** | The physical jokes end in soft seated poses; no injury, fear, restraint, shame, or contact danger is shown |
| Runtime integrity | **PASS** | Complete TenKey at both sizes, 17 critical raster hashes pass, mixed visible lineage 0, visible legacy 0, decoded media and crop contracts pass |
| Formal G5 | **PENDING** | Five independent uninstructed observers with verbatim answers are still required |
| Production default | **HOLD** | `classic-v1` remains the default until G5 and the explicit production-promotion decision |

## Visual conclusion

The earlier split between a dense cold-open and the lighter Q4–Q8 world is
resolved. The whole sequence now uses large simple silhouettes, broad quiet
color fields, local paper/clay differences, one readable action, and one safe
physical joke. The comparison target is Nintendo's official *Yoshi and the
Mysterious Book* presentation for staging, color-mass restraint, playfulness,
and handmade material contrast only; no Nintendo character, silhouette, prop,
or protected shape is copied.

The remaining non-blocking weakness is at 390 px: Pokko and the Q6 pebble are
small in a single still. Across the adjacent frames, the backward tilt,
windmilling arms, four-drop arc, and seated payoff preserve the cause and
effect. Repeated embossed texture and unusually regular drops retain a small
amount of generated-image character, but there is no cinematic glow, unrelated
companion, fantasy depth plate, or mid-flow style switch.

## Verification

- `npm run verify:core` — docs, lint, typecheck, 91 files / 844 tests, build,
  and asset budgets PASS
- `npm run e2e:smoke` — full critical path, mid-problem return, persistence
  retries, Q4/Q6/Q7/Q8, bridge, and root-tangle PASS
- `npm run e2e:visual-audit:local -- --output-dir
  docs/design/audits/2026-07-24-carry-bloom-v4-e807776` — exact detached build
  PASS
- PWA precache: 85 files / 9.87 MiB
- Explore artwork: 27 production files / 5.26 MiB

## Release status

The candidate is suitable for main and deployment, but production default
promotion remains **HOLD**. This expert screenshot pre-screen does not replace
the required five-person silent-comprehension test.
