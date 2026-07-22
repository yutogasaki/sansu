# Whole-app Brand Coherence

- Date: 2026-07-23
- Owner: Codex `/root`
- Status: Active
- Review By: 2026-07-30
- Related ADR / Runbooks: `docs/runbooks/pwa-release.md`

## Primary purpose

Replace the legacy `ふわまな` identity with the child-facing product `ポッコのふしぎずかん` and make the complete app read as one exploration game without slowing arithmetic input.

## Runtime baseline

Current-run screenshots are stored under `docs/design/audits/2026-07-23-whole-app-brand/`.

- Exploration problems use the approved painted cyan/ochre storybook direction.
- Map and base use a flatter, thick-outline version of the same actors and palette.
- Onboarding, Study, Records, Settings, and parent surfaces still use the older pastel glass language.
- Study exposes `Layout Debugger` in ordinary development previews.

Overall baseline: **HOLD**. Strong art in one flow cannot compensate for mixed visual lineage elsewhere.

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

## Verification

- Commands: `npm run docs:check`, `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`, `npm run e2e:smoke`.
- Automated: title marker, route smoke, legacy album hidden, PWA asset policy, existing learning and persistence suites.
- Manual: 390 × 844 current-run capture of onboarding, Explore, Base, Records, Settings, Study; compare the baseline and current runtime in one board.
- Evidence: `docs/design/audits/2026-07-23-whole-app-brand/`.
