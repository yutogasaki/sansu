# Island / iPhone PWA performance

- Review By: 2026-09-30

## Startup scheduling follow-up, 2026-09-25

- User authorized startup measurement and spreading optional prop loads. Keep the existing specification 48 contract: the procedural island is usable before optional GLBs, failures retain fallbacks, and no save/learning/offline requirement changes. No new product rule is needed.
- Measure latest local durations for initial restore, state replay, renderer construction, scene generation/framing, first render submission and each optional asset's load/decode and attach. Measurements contain no profile data, stay in the browser Performance timeline, and are bounded to one entry per phase. CPU submission is not proof of GPU completion or screen paint.
- Queue optional models one kind at a time with one KTX decoder worker, leave visible frames between loads, and postpone new work during placement or recent pointer/key input. In-flight downloads may finish; queued work is removed on scene replacement/unmount. Retain the same final assets and LOD.
- The first scheduling comparison left the learning→Life first frame near 1.8 seconds. A separate Chromium CPU profile attributed about 760ms to `IslandStage`/legacy runtime `forceContextLoss` during that transition. Life learning was still mounting the CSS-hidden legacy world. Remove that mount only for Life learning, consistent with specs 44/48 (learning has no visible world); preserve legacy-mode and other-screen stages. This is a measured transition cost, not an installed-device cold-launch result.
- Final Life-enabled core passed (461 files / 4,173 tests, lint with the existing IslandMilestone warning, typecheck, build and 8.04 MiB asset budget). Focused tests cover serial load start, quiet-frame gating, queue continuation after failure, replacing a queued scene, in-flight completion/unmount and bounded timing entries.
- The paired Chromium diagnostic used real onboarding then closed the first learning screen into an empty Life island. Phone learning→island first observed frame: 1,832→1,043ms; tablet: 1,847→1,083ms. These are one local sample per width, including UI/automation/paint opportunities, not an installed-iPhone speed percentage. The startup probe also checks that Life learning contains no legacy stage, interaction postpones new kinds, and four explicitly failed GLBs retain the procedural island and working learning return.
- Tradeoff: all optional props completed at 3,196/4,036ms versus 2,904/3,182ms before, because loads are spread out. Stored-profile reload first frame was 1,435/1,468ms versus 1,429/1,782ms before. Phone reload is effectively unchanged; no general cold-launch improvement is claimed. On reload, measured restore was 27–29ms, state replay about 0.1ms, scene construction 77–83ms and CPU first render submission about 64ms; a roughly 940–960ms frame gap remained outside those measured CPU sections. Do not label that gap as a confirmed GPU cause without a device trace.
- Raw evidence: `output/playwright/startup-20260925-baseline-final/report.json`, `output/playwright/startup-20260925-final/report.json`, and the intermediate CPU diagnostic `output/playwright/startup-20260925-profile/390.cpuprofile`. Final target `http://127.0.0.1:5298`, version `development-local:189fd423-850b-44fa-a5f1-d13878cb411b`; final build/probe hash `c7757db96a909192bdb7416dc4c086cc548d2bfea729b0aa7df633ce680f9e76` matched at start/end. Final assets/candidates and production Life flags remain the same as the preceding fix. The earlier scheduling-only reports are retained and do not represent the final page change.
- Phone/tablet purchase/placement/offline regression passed on the same final version: six earned answers, purchases, rotation/move/store/re-place, injected abort/retry, offline reload and learning return, plus a separate 30-item fixture. Both widths retained 34 instances/17 textures and zero page errors. Evidence `output/playwright/startup-20260925-decorations/report.json`, app/dist/harness hash `be7b8a4ef8e8bb62142181a11b8bf8b247ee8e6fed038141988f9c82c680f606` matched at start/end. Classic `npm run e2e:smoke` also passed; its Explore captures are not Life visual evidence.
- Final normal/failure captures were inspected for the retained scene and available controls. Existing art and copy are unchanged; no new visual approval or child-comprehension/replay result is claimed. This local startup change is complete. No deployment, real-device timing or full release-matrix pass is implied; the stored-profile first-frame gap remains a follow-up.

## Docs To Touch

- This task record. Update a product spec only if the saved behavior or offline contract changes.

## Verification

- `verify:core` with the production Life flags, Island placement and storage coverage, and the relevant PWA update/offline checks.
- Compare the same local production build in a disposable browser; iPhone Safari needs separate device confirmation.

## Purpose

Reduce the current Island's first-download cost and the delay after placing an item, then measure the remaining startup and interaction work. Keep the existing save format, resident clearance safety, learning flow, and optional Explore offline images.

## Baseline (public revision `9060996b8663803418f6dd7c99a0dd26884212cd`)

- Public service worker lists 125 precache files. An equivalent local production build precaches 11.61 MiB; 5.16 MB is Explore artwork, which remains required for its offline mode.
- A disposable Chromium profile at 390×844 fetched 1.36 MB of eight home-prop GLB transfers after entering Island. This is desktop browser evidence, not iPhone timing.
- With a disposable profile and synthetic credits, one flower placement took 3,472 ms; two Life DB writes took 29 and 32 ms. The data was local to the test browser, not a user's save.
- Six synthetic items after seven unattended days took 1,560 ms to the CPU first-frame marker and 2,548 ms to the next two-frame paint opportunity. A repeat load reached the first-frame marker in 609 ms.
- An idle empty Island still wrote a new Life revision every 15 seconds. Each snapshot rebuilt the entire Three scene and caused roughly 1-second frame gaps at the 15- and 30-second marks in a local browser probe.

## Contract decision

This is a performance implementation within the existing product rules, so the parent and Island behavior specs need no rule change. Existing offline Explore art, CAS purchase safety, resident retreat before overlap, receipts, credits, ownership, and PWA update protection remain required. Do not deploy or alter a user's saved data as part of local verification.

## Steps

1. Reduce Island entry bytes without changing offline mode behavior.
2. Skip the clearance write when no resident needs to move; keep the current clearance path when one does.
3. Reuse the live scene during clock-only snapshots. Rebuild for commands, credits, visual growth stages, layout changes, and long background gaps.
4. Run the applicable PWA, storage, smoke, core, and placement checks before closeout.

## Local result (Life-enabled production build, disposable Chromium profile)

- Precached files now total 9.98 MiB, down from the equivalent original build's 11.61 MiB. The manifest's maskable icon entries use the same bytes and canonical URLs as the ordinary icons, eliminating two duplicate downloads. Explore's 27 production artwork files remain offline. The initial Island no longer preloads the Stats charts chunk.
- One flower placement with synthetic credits wrote one Life revision. A one-off candidate browser run took 1,982 ms versus the 3,472 ms public baseline; environment and sampling differ, so the write count is the reliable comparison.
- During a 34-second idle run, revisions advanced at 14.8 and 29.8 seconds with no corresponding large frame gaps. The remaining 373 ms and 200 ms gaps were within the first 1.1 seconds of loading runtime assets. These timings are Chromium diagnostics, not iPhone Safari timings.
- In matching Playwright WebKit iPhone 13 emulation runs, the original build paused for 137 and 159 ms at its 15- and 30-second refreshes. The candidate advanced both revisions with zero frame gaps above 100 ms over 34 seconds; its median frame was 17 ms. This is browser emulation, not an installed iPhone PWA measurement.
- Mobile-size software WebGL rendered approximately 196 calls and 130k triangles per frame in an empty Island. Its frame rate varied substantially across diagnostic runs; an unverified renderer-quality change is outside this fix.

## Verification outcome

- `verify:core` passed: docs, current UI guard, lint, typecheck, 460 Vitest files / 4,166 tests, Life-enabled build, and asset budget. A newly added same-stage placement reuse case was checked again after the full run.
- Real Life service-worker storage/offline run passed for phone and tablet, with actual onboarding, earned credits, purchase, offline move/store, reload and answer. Old-to-new Life service-worker update passed for both widths, retaining ownership and the partially answered learning plan through offline restart. Both used source hash `30da8b14697da9b60cae90db32490174340e5d75fde53c98478943af4ebf4ca5` and candidate app version `development-local:f57c2cf0-0a14-4c43-86e5-b7194f2b3533`.
- Classic PWA update passed four guarded-route/version-drift cases. Classic Explore smoke passed on the second complete run. Its first run hit an existing test parser gap when a sequence question appeared in a case expecting arithmetic; no application error was observed.
- No deployment or real iPhone home-screen measurement was performed. If the installed iPhone remains slow after this build is delivered, capture its launch/network and frame trace before changing renderer fidelity or offline art.

## Follow-up: remaining large costs

- A fresh WebKit iPhone 13 emulation installed a 125-entry Workbox cache while opening the Island. The cache represents the 9.98 MiB precache above. Page-visible responses during that run totaled about 3.08 MB, dominated by home-prop near/far GLBs and the Basis transcoder. The response event total excludes service-worker-owned fetches, so it must not be interpreted as all transferred bytes. No 9.1 MB PDF-era OTF download was observed.
- In a disposable WebKit profile with 12 synthetic credits, flower purchase confirmation changed the visible revision 72 ms after the click. Selecting the product and target produced 60–84 ms frame gaps; the confirmation interval had a 61 ms gap. The earlier near-two-second candidate number included the surrounding automation/UI steps, so it is not evidence of a two-second persistence delay. This is emulation, not a real iPhone trace.
- The real earned-credit storage report's one-item Life record was about 12 KB as JSON. Life state lives in IndexedDB; there is no evidence here of a large save upload causing the download cost.
- A local encoding trial of the 26 Explore JPEGs (4.83 MiB) yielded 2.87 MiB with WebP quality 90. This is only a size experiment. Visual similarity samples ranged about 0.94–0.97 SSIM; do not replace approved art until the real mobile crop and visual gates pass.
- Next priorities: reduce offline artwork bytes without losing the approved visual sequence or offline contract; then profile targeted scene updates on a populated Island and on the user's installed iPhone. Avoid downgrading renderer quality or changing save rules based solely on empty-island emulation.

## Follow-up implementation: Explore artwork transfer, 2026-09-24

- Replaced the 26 production Explore JPEGs with same-dimension WebP encodings. The scene sequence and offline precache contract remain intact; [the encoding evidence](../../design/2026-09-24-explore-webp-encoding/README.md) records per-file hashes, a source/encoded comparison, and phone/tablet runtime contacts.
- The 26 files fell from 5,060,150 to 3,014,088 bytes (−40.4%). The Life-enabled production precache fell from 9.98 to 8.03 MiB, with 125 entries before and after. Its 27 Explore images fell from 4.92 to 2.97 MiB.
- The Life-enabled `verify:core` and classic Explore `e2e:smoke` passed. A real old-JPEG to new-WebP Life service-worker update passed on phone/tablet widths while retaining earned ownership and a partial learning plan through offline restart. Chromium phone/tablet also decoded the new ready image after a direct offline reload. The classic `e2e:pwa-update` and `e2e:pwa-two-build` suites passed against new WebP builds.
- Fixed-ten's launcher had drifted to the Island default, so it now starts the explicit classic test server. Its four 10-run technical cells passed after the fix, but the report's formal `pass` remains false because `cleanRevision=false` in this shared worktree. No versioned release-audit credit is claimed from that diagnostic.
- This addresses transfer and storage, not the remaining rendering cost. The current home-prop GLBs and Basis decoder still contribute to Island entry traffic. Populated-scene profiling and a trace from the installed iPhone remain the next diagnostic steps before changing renderer detail or save behavior.

## Follow-up implementation: incremental runtime props, 2026-09-24

- Loading each GLB kind previously detached and cloned every already-loaded prop again. Index the current scene's targets by kind and attach only the newly loaded kind. Explicit scene rebuilds still detach borrowed resources before disposing geometry; in-flight loads use the latest scene's targets.
- Internal rendering optimization only: keep the same assets, materials, LOD thresholds, camera, animation, save format and offline fallback. No product rule/spec change is needed.
- A 30-prop regression verifies that a later asset completion retains all existing visual object identities, far LOD and porch resources. A separate regression covers scene replacement during loading. Focused runtime asset tests passed (13 tests). A synthetic 30-prop/four-kind comparison of the original loader and this implementation reduced recursive Object3D clone calls from 462 to 180 (61%); this is operation count, not an FPS or elapsed-time improvement claim.
- Life-enabled `verify:core` passed: 460 files / 4,168 tests, lint (one existing IslandMilestone fast-refresh warning), typecheck, build and asset budget. The production decorations journey passed at 390×844 and 768×1024 (tablet reduced motion): six real answers, earned purchase, rotate/move/store/re-place, abort/retry, offline reload and learning return, followed by a separate synthetic 30-item stress fixture. Both stress scenes loaded 34 instances from eight GLBs, retained 17 textures, switched LOD, and had no page errors. Phone placement and tablet stress screenshots were inspected for visible props/residents and controls.
- Local browser evidence: `output/playwright/runtime-props-20260924/browser/report.json`; operation-count diagnostic: `output/playwright/runtime-props-20260924/clone-count.json`. Target `http://127.0.0.1:5298`, version `development-local:b761cc63-f444-40d7-8107-d092ddce3f07`, app/dist/harness fingerprint `3583321974cb0a09960d6a6867689645af002eb229fdd61c18efa28b46892671` matched at start/end. Delivery Island/Life enabled, Life preview/BuildPlay disabled; runtime assets `island-life-runtime-assets-v3`, home props `island-home-props-v1`.
- This local renderer change is complete. No deployment, real iPhone timing, new art approval, child comprehension/replay assessment or full release-matrix pass is claimed. Ongoing per-frame rendering costs and installed-device measurement remain separate follow-ups.
