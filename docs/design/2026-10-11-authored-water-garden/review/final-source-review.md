# Diff Review Report — authored water garden final source review

Date: 2026-10-11. Reviewer: `/root/authored_world_domain`.
Revision: `a029a511` plus the frozen, uncommitted source diff.

## Findings

No additional confirmed P1/P2 regression was found in the requested scope: player save, owner identity, clocks, source provenance, or the water cut/access/bridge integration boundary. This is a bounded source review, not M1, whole-island art, or performance acceptance.

## Summary

- Safety: OK within the reviewed DEV diagnostic boundary.
- Spec alignment: OK for the current derived-world and player-save boundary. M1 and the comprehensive goal remain incomplete.
- Tone: Not evaluated by this narrow review.
- Over-change: None identified in the reviewed integration changes.

## Source evidence

- `GrowingWorld.tsx:130–144` loads bridge skin only for an authored world with explicit water assembly. Both diagnostic loaders reject non-DEV execution, verify exact compressed/expanded source delivery, and honor abort/release. The normal world path does not call the bridge loader.
- Renderer-loop bookkeeping (`shown`, `placeShown`, retry collections, telemetry deadline) is initialized before the first `loop()` call. Water preview suppresses life ticking, actor interaction, and place shown/use dispatch. Rendering errors run the existing release/failure path. No clock or player repository writer was introduced in this loop.
- The source bridge boards use the same plan span, width, arch profile, yaw, deck height, and scene X/Z offset as the real deck. Mesh selection retains the supplying water owner's ID; optical ripples and bank surfaces cannot steal pointer selection. The renderer adds no site, owner, passage, or reward.
- `worldScene.ts` applies the same bridge skin to committed and future terrain. Cancellation removes/disposes future terrain and restores the committed terrain/life. Pointer support deliberately remains the committed actual floor while preview is shown. These branches match the existing integration test contract; tests were read, not rerun.
- `authoredWaterWorld.ts:450–556` cuts current ground from a cloned immutable base, creates water/bed from original triangles, builds actual deck support, then restores only original walk grants accepted by the compiler's foot-band predicate. Shore entries are derived after final support and walking grants. The final world and plan receive the same revision including bridge profile/plan and shore mappings; published plan/world are frozen.
- Source joins/water grants and immutable acquisition anchors remain outside the carving operation. Scope allows only explicitly named original ground, and bank/rock/flow surfaces add no support. The prior exact protection/coverage helper review and 36 cases were not repeated.
- `src/prototypes/placeQa/authored.tsx` is DEV-only and keeps the synthetic fixture in React state. It uses a fixed fixture timestamp and ordinary world-aware commands; it does not import or write the player repository, learning state, storage, or navigation migration. `authoredWaterFrame` derives/caches by ownership input, excluding progress receipts from the cache key.
- `tools/growing-authored-water-fixture.mjs:20–25,54–124` closes over bundle inputs, the source fixture inputs, lockfile, both raw-world copies, and bridge artifact. It asserts unchanged owner fields except synthetic positions, 27 owners, 73 acquisition sites, unchanged anchor/non-walk signatures, all owner approaches, all non-water full footprints, and continuous actual stream heights before writing the final fixture. Output uses exclusive creation.

## Direct artifact inspection performed

These were read/hash checks only; no composition, tests, browser, or generation was run.

- Current fixture `sources`: all 36 recorded file hashes match current files.
- Current fixture `waterSources`: all 47 recorded file hashes match current files.
- Both aggregate source hashes recompute correctly. The raw runtime world matches `worldSha256`.
- Bridge gzip/expanded hashes, expanded byte count, source ID/SHA, scale, and part count all match the profile and decoded artifact.
- Fixture has 27 distinct owned IDs with unchanged kinds. Its fixed epoch is `1791687600000`, nature remains `{hours:216, realAt:1791687600000, lastSpread:216, lastMix:216}`, and town remains `{clock:0, bank:0}`.
- Saved plan contains 3 pools, 4 streams, and 1 bridge supplied by existing owner `l24`; its owner set is the existing five water owners. Revision: `authored-water-v2:3f6b964a9069c5f0:eb41954202b1926a`.

## Verification evidence and limits

The root supplied the following completed checks; this reviewer did not rerun them: core 594 files / 5164 tests; b6 actual-water 6 steps / 14 captures; plain authored 6 steps / 7 captures; legacy 8 scenarios / 22 captures; classic 32 smoke cases.

No additional test run is requested because this review found no new defect and changed no app/source/tools. Known unresolved art, independent N0 observation, the close-camera framing diagnosis, and browser preview latency around 12–13 seconds remain separate outstanding work. These successful checks must not be used to claim M1 or the whole-island goal is complete.

## Frozen review snapshot

Fourteen primary source/tool/fixture files were hashed at closeout. Ordered hash-map SHA-256: `54acbdec9fdeb894891af94873d48468f0356a9254f1a2e6f54236ea448648f8`.

Included files: GrowingWorld; worldScene; authoredGrowingAssets; authoredGrowingGround; authoredWaterBridgeArt; authoredWaterWorld; authoredWaterBridge; authoredWorldAccess; worldDefinition; worldTypes; prototype authored.tsx; growing-authored-water-fixture.mjs; e2e-authored-water.mjs; authored-water-fixture.json. This review writes only this report under `/private/tmp`.
