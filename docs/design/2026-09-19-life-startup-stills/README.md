# Island startup stills — 2026-09-19

`life-startup-stills-v1` removes two home-control WebGL renders and PNG encodes on opening. The original mature flower and Pokomoko PNG bytes were exported from production revision `5e71991`; combined size is 58,322 bytes. Seed, bud, other residents and color variants retain runtime rendering. No game state, replay or learning behavior changes.

## Evidence

- [Source capture and hashes](capture.json), [candidate source hashes and flags](candidate.json).
- [Browser results](report.json): default component WebGL / PNG counts both zero; image bytes match source; dynamic variants work; failed image requests show text. Actual home → learning works at 390 and 768 pixels, with zero startup PNG calls and no page errors.
- [Phone home](390-home.png), [tablet home](768-home.png), [phone learning](390-learning.png), [tablet learning](768-learning.png).
- [Original scene capture](before.png) was taken before controls appeared; it is not a complete UI comparison. Exact source-image equality is the control parity evidence.

Visual appeal: existing control artwork is preserved byte-for-byte; no new art direction. Silent comprehension/safety: labels and actions unchanged, learning remains reachable; no new child testing. Runtime integrity: browser checks pass; full core 433 files / 4,071 tests pass; production-flag build and asset budget pass. Smoke: all 31 cases pass. The two bundled PNGs are explicitly precached for offline use.

This removes work measured at roughly 0.33 seconds for PNG encoding in the earlier public desktop trace; it is not a measured end-to-end speedup on the user's device. Historical replay and the long frame after the first render marker remain separate issues.

## Reproduce

Create a disposable checkout with dependencies. Copy [HTML fixture](startup-stills-qa.html.txt) and [TSX fixture](startup-stills-qa.tsx.txt) to its root, removing `.txt`. Run Vite on port 5261 with `VITE_ISLAND_ENABLED=true VITE_ISLAND_LIFE_ENABLED=true`, then run `node tools/verify-life-startup-stills.mjs` from the repository root. The fixture is not included in production.

The capture tool intentionally refuses an existing output or an already baked image. Future artwork changes must refresh the corresponding still explicitly; this is a maintenance tradeoff for avoiding repeated startup rendering.

[Critical-path contact sheet](contact-sheet.html).

Production preview: [offline results](production-offline.json), [offline screen](production-offline.png). Initial offline verification exposed missing PNG precache entries; adding two narrowly scoped asset globs fixed it. Fresh service-worker-controlled offline reload passes with both images loaded and zero PNG encodes. Generic core and smoke ran before the cache-glob addition; production build, asset budget, lint and offline verification ran after it.
