# Pokko whole-flow exact audit — `83210fd`

## Target

- Revision: `83210fdf287f4e4673e00e158f9b50f9b5962f1f`
- Source tree: `d84e75286c5850f4d498493c1409d29d236c1cd9`
- Delivery: `snap-root-v1`
- Visual lineage: `pokko-field-v1`
- Capture: exact detached production build at 390×844 and 768×1024
- Evidence: 32 critical-path screenshots, two simultaneous Q7 composites, [contact sheet](./contact-sheet.jpg), and [manifest](./manifest.json)

## Local gates

| Gate | Result | Evidence |
|---|---|---|
| Visual appeal | **PASS — 52 / 60** | 9 immediate appeal, 9 pop color, 8 authorship/continuity, 8 character appeal, 9 progression/payoff, 9 replay desire |
| Silent-comprehension pre-screen | **PASS** | Route previews distinguish destinations; root opening reveals the same flower/dew light path used by observation and return |
| Safety pre-screen | **PASS** | No contact, restraint, cutting, pain, fear, shame, or body occlusion in the critical path |
| Runtime integrity | **PASS** | Complete TenKey at both sizes, 12 critical raster hashes pass, mixed visible lineage 0, visible legacy 0 |
| Whole-flow coherence | **GO — 8.8 / 10** | World → observation → field book → return → base reads as one edited picture-book journey |
| Tempo | **GO — 9.0 / 10** | Ordinary answers remain rapid; only route, Q7, return, and replay are intentional stops |
| Expansion readiness | **GO — 8.2 / 10** | Root, flower, leaf bridge, archive, and route reuse one material and character contract |

## What changed from the prior HOLD

- Replaced the white strip bridge with separated and joined living leaf states plus a physical crossing payoff.
- Made the opened root scene reveal the investigated flowers and glowing dew as one visible path.
- Removed the three visible recap chips from the Q7 action beat while keeping their ordered accessible semantics.
- Added image-led previews to route cards.
- Reused approved painted runtime scenes in the return book and base hero instead of switching to a flat mascot illustration.

## Verification

- `npm run lint`
- `npm run typecheck`
- 30 focused component/domain tests
- `npm run build` — PWA 11.93 MiB / 12.00 MiB; Explore art 7.32 MiB / 8.00 MiB
- `npm run e2e:smoke` — full critical path PASS
- Root-tangle and bridge: 390×844, 768×1024, 1024×768, 1024×1366, 1080×1920 PASS
- Strict capture: `npm run e2e:visual-audit:local -- --output-dir docs/design/audits/2026-07-23-pokko-field-v1-83210fd`

## Release status

**Production HOLD.** Local G4 is complete. G5 still requires five uninstructed observers with verbatim results, and G6 still requires cold-cache or PWA-update evidence from the actual delivery target. The local screening above does not substitute for either external gate.
