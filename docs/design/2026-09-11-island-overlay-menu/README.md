# Island overlay menu

The new home inherited the legacy fixed-screen clipping, leaving construction controls below the visible area. The user explicitly chose paged overlay controls instead of page scrolling or shrinking the island.

The world fills the available space. Build, inventory, colors and expansion open compact panels over it; products and inventory use two-item pages with arrow buttons. Selection closes the product panel and exposes placement confirmation. The alternative cell picker is also paged. Main navigation remains reachable. Learning uses the bottom navigation only, including the loading/error fallback.

- World candidate: island-life-garden-v6; menu candidate: life-overlay-menu-v1.
- Production flags: VITE_ISLAND_ENABLED=true, VITE_ISLAND_LIFE_ENABLED=true.
- Final target: http://127.0.0.1:5280. Build: [version.json](version.json), source base and changed-file hashes: [source.json](source.json).
- Final Chromium: [report](runtime/report.json), 320x568 / 390x844 / 768x1024 (tablet reduced motion). Actual touch coordinates and hit tests, all four menu entrances, paging, world bounds and camera invariance, real first learning and flower purchase, placement/cancel and removal/cancel; one learning button.
- WebKit: [report](webkit/report.json), 390x844. Same interaction checks passed on v4. Final change after v4 only removes the duplicate learning button from loading/error fallback and its unused prop; normal home rendering unchanged.
- [Contact sheet](contact-sheet.html) shows ready, build and placement on the final build.
- Core: 339 files / 3608 tests, docs/lint/typecheck/build/assets passed before final small layout/fallback adjustments. Final changed TSX lint, typecheck and production build passed separately. [core](core.txt), [typecheck](typecheck.txt), [build](build.txt), [smoke](smoke.txt).
- No storage, learning or economy changes. Offline was not re-certified: an earlier WebKit offline reload reported an internal browser error; an earlier Chromium run waiting for SW readiness was stopped. These are not labeled PASS. Existing offline evidence remains attributed to the previous release.
- Initial WebKit retry stayed at onboarding once; unchanged retry passed. Preserve diagnostics separately.
- A world-height regression from wrapped resident text was found by bounds comparison and fixed with a stable resident row.

## Independent gates

Visual: reviewed rendered phone/small/tablet panels; the world stays the same size when menus or placement open. Controls overlay it, with no page scrolling.
Comprehension/safety: primary learning action is unique, menus have explicit close/cancel and removal still requires confirmation. Human N=0; no claim of child usability validation.
Runtime: listed checks passed within their stated scope. No claim of an actual iPhone install/update test.
