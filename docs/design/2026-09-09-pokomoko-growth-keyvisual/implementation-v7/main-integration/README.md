# Final main integration verification

Parents: remote main `864916fca592dd9e3402d554c6a95c76cd47ff32` and home connection `36ffec4c09596ca69ca45170b7fba5d300d95bf2`. Tested source tree: `d3bd8d1b76fe8e3af00702de454a8967a66ded84` before this evidence addition. Application inputs unchanged after verification.

Target http://127.0.0.1:5221 / DEV + VITE_ISLAND_ENABLED=true + VITE_HOME_JOURNEY_PREVIEW=true. Candidate home-journey-connected-house-v7.

PASS typecheck, lint (one existing warning), build, 324 test files / 3524 tests, 31 classic smoke scenarios. [Phone and reduced-motion tablet journey](report.json): 45 normal planner answers, growth, same house/interior, real photo persistence, and resuming the same learning reservation. [Runtime contact sheet](review.html).

Preserves the latest main tutorial and challenge implementation. Passes challenge display selections into the DEV room. Shows floor-walking instructions only in the supported legacy room.

Visual appeal: HOLD. Independent child evaluation: N=0. Runtime: tested DEV paths PASS; production migration, rollout and PWA update acceptance remain incomplete. Parent directory and commit-check contain earlier snapshot evidence.
