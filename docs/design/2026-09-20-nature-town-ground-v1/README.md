# Nature Town ground A v1

This is a bounded local visual iteration for Nature Town S1 / NT-1. The previous screen used opaque green on each ground button, which made the empty portions of the map read like a uniform checkerboard. The selected candidate makes those land colors continuous and adds broad, static meadow variation. Map coordinates, terrain, props, interaction targets, learning behavior, and storage do not change.

## Direction comparison

Three treatments were compared in the live Nature Town screen at the same paused simulation state and the canonical 390×844 / 768×1024 crops. The four-up view is [candidate-comparison.html](candidate-comparison.html); the source images are the before frame and the A/B/C CSS-injected previews. A was selected because it creates the broadest continuous land while keeping paths, water, and the vertical channel easy to pick out. B kept the cell grid too prominent. C was calm but left the map looking nearly like one flat plane.

| Transfer | Do not transfer |
|---|---|
| The benchmark island’s broad connected grass color masses, quiet edge contrast, and distinction between ground and objects | Its island/coast silhouette, exact asset placement, props, or any change to Nature Town’s navigable cells |

The preview screenshots for A/B/C were taken by injecting only candidate CSS into the live app; they were not app builds. The two `final-*` near-crop screenshots were recaptured from the source after implementation. The full runtime set below is from a separate flagged build and preview.

## Implementation invariants

- `TownMap` still assigns every cell the same `data-cell`, coordinates, 48px near / 27px overview size, click handler, and 44px resident controls.
- Static meadow gradients sit on `.town-map`; ordinary ground cell fill becomes transparent with a 0.03-alpha boundary. Path, bridge, channel, and water classes keep their existing presentation rules.
- Prop, resident, route, overlay, selected, and pending layers are unchanged. The ground color does not encode moisture, shade, traffic, delivery, or any simulated state.
- The runtime candidate attribute is now `nature-town-ground-a-v1`. The actor/prop art remains the prior `nature-town-acting-s2` asset lineage; its visual score is not inherited by this composite candidate.

## Runtime and verification evidence

The local production-format preview was built from HEAD `28bd252613ba3170d8769500e7e9f43480035bcc` plus the source hashes in [source-manifest.json](source-manifest.json), with `VITE_ISLAND_ENABLED=true` and `VITE_NATURE_TOWN_ENABLED=true`. Its `version.json` revision is `development-local`, version `development-local:d8f163fd-c26d-4dc4-92d0-9076bbaa8f70`; the app-wide delivery field is `snap-root-v1`. The Nature Town visual candidate is identified separately by the rendered `data-candidate` value `nature-town-ground-a-v1`. This is a local candidate, not a production deployment.

The [critical-path contact sheet](critical-path.html) records eight actual states at both viewports: before placement, placed house, before transfer, actual pickup, disconnected supply, restored route, resident offer, and admission. The run used a disposable native profile, sound OFF, reduced motion, and diagnostic timer pulses to reach actual saved events; it did not inject town inventory, offers, or food. The new [blind observer page](observer/observer.html) uses the same candidate images and saves responses locally. It currently has zero independent responses.

- `npm run build` with both feature flags: PASS; `assets:check` reports 124 precache files, 11.56 MiB / 12.00 MiB.
- `npm run verify:core` and `npm run e2e:smoke`: PASS. The full app smoke suite covered onboarding, study/review/settings, classic opening, exploration, bridge/tangle play, and parent gate.
- `tools/e2e-nature-town-editing.mjs` on the DEV route: PASS at 390×844 and 768×1024. Brush interpolation, pointer cancellation, pan-only selection, placement preview, invalid placement, and save-conflict retention completed.
- `tools/e2e-nature-town.mjs` on the DEV route: PASS at both viewports for placement, move, reload, learning return, and cross-tab guard.
- `tools/e2e-nature-town-acting.mjs` on the flagged preview: PASS at both viewports for real saved-tick harvest, pickup/carry/delivery, route undo, admission, and reload integrity; the exact runtime report is [acting-report.json](acting-report.json).
- `tools/e2e-nature-town-living.mjs` in diagnostic mode on the DEV route: PASS at both viewports for reload integrity and disconnected-supply undo. Its report does not claim naturally timed life events.
- `tools/e2e-nature-town-silent-review.mjs` on the flagged build preview: PASS at both viewports; all eight stages reported the new candidate, reduced motion, and sound OFF.
- `tools/e2e-nature-town-sprites.mjs` on the preview: PASS at both viewports, including touch selection and offline reload; resident sprites restored and runtime WebGL stayed at zero.

## Separate gates

- **Visual magnetism: HOLD.** No six-axis score is assigned to this new candidate. The predecessor’s 35/60 belongs to `nature-town-acting-s2` and is not carried forward. These screenshots show a local ground improvement, not finished town composition or visual approval.
- **Silent comprehension and safety: HOLD.** The new observer set is ready, but no independent answers have been collected. SAFE-06 remains NOT_RUN.
- **Runtime integrity: PASS for the changed local surface.** Map-editing interactions and the preview’s offline candidate/sprite reload passed. Two-build PWA update, physical iOS operation, and whole-product critical-path continuity were not assessed here.

The parent app spec and Nature Town UX behavior did not change. This is a presentation candidate under the existing world-first map contract; the durable change record is in [IMPLEMENTATION.md](../../product/nature-town/IMPLEMENTATION.md) and [the archived S1 task](../../tasks/archive/2026-09-16-nature-town-s1.md). The next useful step at the time of this audit was independent review of this candidate, followed by real iOS operation; neither was replaced by these automated captures. On 2026-09-22, the separate town direction was superseded by the [Island integration policy](../../product/island-nature-integration.md); this audit remains evidence for the old prototype only.
