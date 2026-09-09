# Island direct actions — 2026-09-09

## Fixed production candidate

- Target: `http://127.0.0.1:5341/#/island`
- Build revision: `68b8d935862fe7530191f7ea1f1c376c5877e405`
- Delivery: `VITE_ISLAND_ENABLED=true`, `mystic-island-v1`
- Visual: `mystic-island-shore-garden-v18`; learning: `mystic-island-learning-v2`
- Source digest: `cc045163d1d5fc6bc5d91f62cffb537ddd369bc06a8fa9eeb48ab5df72cd795b`; [source and build manifest](source.json)
- [Runtime report](report.json): PASS, phone 390×844 and tablet 768×1024. Disposable native profile only; first three answers earn growth through the actual writer. Sound off, reduced motion, Service Worker allowed. Human N=0.

## Rendered evidence

| Viewport | Critical path | Home | Next garden | Benchmark comparison |
|---|---|---|---|---|
| Phone | [8-screen contact sheet](390-flow.png) | [Full capture](390-home.png) | [Full capture](390-garden-next.png) | [Side by side](390-comparison.png) |
| Tablet | [8-screen contact sheet](768-flow.png) | [Full capture](768-home.png) | [Full capture](768-garden-next.png) | [Side by side](768-comparison.png) |

The comparison uses the previously approved benchmark preserved in the [September 8 production audit](../2026-09-08-production-release/README.md). Existing navigation, framing and later art differences are visible; this local interaction change is not a new approval of the entire island artwork. The compact labels remain readable and do not cover the main character faces. The garden comparison changes the earned next plant in the same camera frame.

## Independent gates

- Visual: author reviewed the actual production contact sheets and benchmark pairs. Local labels/panel are acceptable; no new global art-quality claim.
- Comprehension/safety: physical ray tap, touch labels, drag suppression, keyboard Enter/Escape, same saved reservation, no writes during growth preview and selected resident identity pass. Child comprehension and replay appeal remain unmeasured.
- Runtime: final production direct-action journeys PASS in both layouts; final candidate typecheck, lint (one existing warning), 24 related tests, build and asset budget PASS. Earlier full core, smoke and PWA checks are described in the [implementation audit](../../2026-09-09-island-direct-actions.md). Full growth E2E remains incomplete due to the previous menu hierarchy's stale harness; this is not a full release PASS.

A failed physical-tap/Escape run is preserved locally under `output/playwright/island-direct-actions-verified/`; it exposed browser focus returning to body. The release fixes Escape handling while the panel is mounted. Original raw captures are under `output/playwright/island-direct-actions-merged/`; the durable contact sheets and full key views above belong to the one version in the runtime report.

[Fixed-ten summary](throughput-summary.json): PASS, evidence.eligible=true, 80 runs with 10 repetitions per layout/scenario/lane. All data and source-stability gates pass. This run precedes only the final panel Escape handler fix; learning sources are identical. Other local UI/build verification ran concurrently, so do not infer exclusive-GPU performance or child behavior from these timings.

The final main integration includes `70ad92c` (DEV-only home journey). Production keeps that flag disabled. The merged candidate was rebuilt with typecheck/assets PASS and the complete direct-action journey repeated on both viewports. Fixed-ten predates this DEV integration and the panel Escape fix; its original source/version remain in its summary.

After these captures, main advanced again to `adf71f1` (whole-fraction entry and draft correction). Rebase applied without code conflicts. The captures and fixed-ten retain their earlier exact sources; they are not relabeled as a rerun of that later input change. The final integrated type/unit/build checks are separate.

Final integration: typecheck, related unit tests, production build and assets:check PASS.
