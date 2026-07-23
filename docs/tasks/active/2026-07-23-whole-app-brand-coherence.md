# Whole-app Brand Coherence

- Date: 2026-07-23
- Owner: Codex `/root`
- Status: Awaiting external validation
- Review By: 2026-07-30
- Related ADR / Runbooks: `docs/runbooks/pwa-release.md`

## Primary purpose

Replace the legacy `ふわまな` identity with the child-facing product `ポッコのふしぎずかん` and make the complete app read as one exploration game without slowing arithmetic input.

## Prior runtime baseline

Current-run screenshots are stored under `docs/design/audits/2026-07-23-whole-app-brand/`.

- Exploration problems use the approved painted cyan/ochre storybook direction.
- Map and base use a flatter, thick-outline version of the same actors and palette.
- Onboarding, Study, Records, Settings, and parent surfaces still use the older pastel glass language.
- Study exposes `Layout Debugger` in ordinary development previews.

Overall baseline: **HOLD**. The latest whole-run audit found a painted leaf-hat Pokko in the cold-open, a ribbon-antenna pear in ordinary encounters, white or cream cat-like actors in research/return, and legacy Makimodon in the base. Strong art in one flow cannot compensate for mixed visual lineage elsewhere.

## Scope

- [x] Establish the display name, tagline, brand actor, palette, and density contract in the parent spec.
- [x] Replace PWA/app icons with the approved yellow leaf-hat explorer mark.
- [x] Update HTML, manifest, package identity, PDF metadata, and onboarding copy.
- [x] Carry shared brand tokens through utility screens and the persistent footer.
- [x] Make the exploration route the footer's explicit first destination.
- [x] Hide layout debugging unless explicitly enabled.
- [x] Keep the visually unintegrated legacy album out of child-facing Records while preserving its data.
- [x] Re-capture the critical path at the same viewport and judge before/after together.
- [x] Run release verification before publication.

## G4 whole-flow lineage graph

The prior checklist completed brand metadata and utility styling, but did not prove one game experience. G4 is therefore a separate dependency graph; a child node cannot be called complete only because its parent screen renders.

| Node | Depends on | Deliverable | Status |
|---|---|---|---|
| G4-0 evidence contract | G3-3 | actual-target capture list, opt-in writes, non-compensating gates | Complete |
| G4-1 runtime identity | G4-0 | build revision, delivery, `pokko-field-v1`, candidate and mode in DOM | Complete |
| G4-2 canonical Pokko | G4-0 | one silhouette across painted, live, research and base modes | Complete (candidate) |
| G4-3 major encounters | G4-2 | light bridge and root tangle use same-camera three-state painted scenes | Complete (candidate) |
| G4-4 semantic Q7 | G4-2, G4-3 | world reaction provenance reaches same-camera payoff before the book | Complete (candidate) |
| G4-5 return and base | G4-2, G4-4 | same Pokko and latest finding remain legible through replay/base | Complete (candidate) |
| G4-6 critical-path audit | G4-1..G4-5 | 390/768 contact sheet from one build, mixed lineage 0, TenKey fit | Pending v3 re-audit |
| G5 blind value test | G4-6 | 4/5 same action/payoff, 4/5 want more, danger 0 | Pending |
| G6 production promotion | G5 | cold-cache/PWA actual target evidence and explicit default switch | Pending |

### G4 implementation checkpoint — 2026-07-23

- Canonicalized the yellow seed-body / broad green leaf-hat Pokko across ordinary problems, research art, return, replay, and the base. The legacy component export remains only as an API adapter; its rendered silhouette and DOM character ID are Pokko.
- Replaced the light bridge and root tangle with `pokko-painted-encounters-v4`, each using locked-camera idle / correct / crossed frames. Rejected smooth cinematic generations were not wired into production assets.
- Carried committed attempt identity into the Q7 observation selector. A compatible root-tangle clear now keeps the crossed root scene and camera before the separate `firefly-field-book-v1` paper edit; an incompatible ordinary clear remains an ordinary field-book reveal.
- Added build revision and delivery identity at the app root, surface lineage / candidate / mode identity at critical roots, and opt-in-only audit screenshot writes. Normal smoke runs no longer mutate versioned visual evidence.
- Kept TenKey structure and answer cadence unchanged. `verify:core` passed 90 files / 826 tests, the full smoke path passed at phone and tablet sizes, asset budgets passed, and the three PWA update handoff scenarios passed.
- Production remains **HOLD**. G4-6 still needs the same-build 390 / 768 critical-path contact sheet; G5 still needs the blind five-person value test, and G6 still needs actual delivery-target cold-cache / PWA evidence before changing the default.

### G4 final local checkpoint — revision `83210fd`

- Exact detached-build evidence is stored at `docs/design/audits/2026-07-23-pokko-field-v1-83210fd/`: 32 critical-path screenshots, two Q7 composites, one contact sheet, and a machine-readable manifest from revision `83210fdf287f4e4673e00e158f9b50f9b5962f1f`, delivery `snap-root-v1`, lineage `pokko-field-v1`.
- Replaced the white-strip bridge with a same-camera living leaf bridge. Idle shows two separated leaf tips, correct joins them with a large flower clasp, and resolved places Pokko on the load-bearing bridge.
- Unified Q7 into one visible cause: opened roots reveal the previously investigated flowers and glowing dew as a path. The same resolved scene continues into the observation and return book; the visible three-card recap was removed from the action beat while its ordered semantics remain available to assistive technology.
- Added route-card scene previews and replaced the flat return/base hero art with approved painted runtime scenes. Independent image screening now passes route differentiation, Q7 causality, TenKey visibility, and child-safety checks.
- Independent whole-flow screening scores are **8.8 / 10 coherence**, **9.0 / 10 tempo**, and **8.2 / 10 expansion readiness**, all GO. Runtime integrity passes with zero visible mixed lineage and zero visible legacy actors.
- The independent six-axis visual score is **52 / 60**, with every axis at least 8 / 10, so the local visual gate passes.
- `lint`, `typecheck`, 30 focused tests, production build and asset budgets passed. Full browser smoke passed, including 390×800, five bridge sizes, five root-tangle sizes, persistence, return, parent gate, and PWA-critical flows.
- For that exact `83210fd` candidate, local G4 was complete. Production remained **HOLD** until G5 could record five uninstructed observers and G6 could verify the actual delivery target after cold cache or PWA update. These external gates are not inferred from local screenshots.

### G4 lightweight art reset — `firefly-dew-path-painted-v3`

- The user rejected the prior ordinary/Q7 flower plates as too dense, too cinematic, and insufficiently pop. The `83210fd` evidence remains historical for its exact candidate and does not approve the new visual candidate.
- The current candidate uses one 16:9 cyan/ochre/leaf-green stage through Q4–Q7: one flower, one Pokko, four droplets, and one groove. The neutral Q7 payoff leaves three droplets on the path, drops the fourth onto the leaf hat, and ends with a safe seated body gag.
- Two-way and three-way route plates now use the same quiet stage and physical groove split. The prior dense forest route plates and prior four dense flower plates are removed from production precache.
- Generic return pages use the new final plate. The committed root-tangle provenance now uses the same lightweight stage as `root-tangle-dew-path-v3 / root-tangle-side-v3`: one root loop blocks four drops, the loop opens, and the resolved droplet/leaf-hat body gag remains the exact source scene through observation and archive.
- The leaf bridge is also reset to `light-bridge-dew-path-v3 / light-bridge-side-v3`: two separated leaf halves join once, the same four drops cross, and Pokko lands safely seated. Old tall bridge, dense root, flow, and dense WebP plates have no runtime references and are removed from `public`.
- Local 390×844 and 768×1024 Chromium captures keep the full horizontal plates, equation, and complete TenKey visible without page overflow; five bridge sizes and five root-tangle sizes pass focused browser verification. The pending-problem back-arrow `abandoned` path also passes. These local checks remain diagnostic until the exact clean revision audit is regenerated.
- Production and external value gates remain **HOLD**. G4-6 must be regenerated for this candidate; G5 still requires five uninstructed observers, and G6 still requires the canonical production target after cold cache/PWA update.

## Non-goals

- Do not change question generation, scoring, SRS, keypad structure, or answer cadence.
- Do not force the painted scene density into parent/utility screens.
- Do not declare the cold-open visual candidate production-ready; its existing value gates remain authoritative.

## Docs To Touch

- Must update: `CONSTITUTION.md`, `docs/product/01_app_spec.md`, `docs/product/16_legacy_feature_decision.md`, this task, `.agents/tasks/TASKS.md`, and the current-run visual audit.
- Intentionally unchanged: learning thresholds, Dexie schema, exploration candidate gates, and release-channel defaults.

## Acceptance gates

1. `ポッコのふしぎずかん` is used consistently in install metadata and the child-facing welcome; `ふわまな` is not retained as a prefix or subtitle.
2. The installed icon is recognizable at 32, 180, 192, and 512 pixels and contains no text.
3. Explore, Study, Base, Records, Settings, and onboarding share the cyan/ochre/coral/leaf/cream/ink system.
4. Utility surfaces read as an explorer's field notebook, not translucent pink/purple glass.
5. `Layout Debugger` is absent unless `VITE_SHOW_LAYOUT_DEBUG=1`.
6. Existing keypad and problem tempo remain unchanged.
7. Release verification passes and current-run screenshot evidence is attached.
8. Cold-open, ordinary problem, major encounter, Q7, field book, return, replay, and base all expose `pokko-field-v1` and show the same Pokko silhouette; legacy actors are absent.
9. Q7 keeps the solved encounter and observation causally aligned before the field-book edit.
10. A same-build 390/768 critical-path contact sheet passes visual appeal, silent comprehension/safety, and runtime integrity as separate gates. Until then production remains HOLD.

## Verification

- Commands: `npm run docs:check`, `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`, `npm run e2e:smoke`.
- Automated: title marker, route smoke, legacy album hidden, PWA asset policy, existing learning and persistence suites.
- Manual: 390 × 844 current-run capture of onboarding, Explore, Base, Records, Settings, Study; compare the baseline and current runtime in one board.
- Evidence: `docs/design/audits/2026-07-23-pokko-field-v1-83210fd/`.
