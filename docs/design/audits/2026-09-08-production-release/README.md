# Production release — 2026-09-08

User authorized committing the current changes to main and publishing the app. This release includes shared resident play, progressive learning support, the profile-free first-play entrance, prospective Island learning observations, and the latest framing/recovery corrections. No storage reset or SRS threshold change is part of publication.

## Exact application target

- Fixed local production: `http://127.0.0.1:5399/`.
- Candidate revision: `84d3ddf-experience2-3ddcac1103f0`; source SHA-256 `3ddcac1103f0262eeeddc6dfa48cf93e334cab7436596cba677930d8b63f6f16`.
- All 625 build inputs match the staged application and the isolated verification copy. [Build-source manifest](build-source.json).
- Version: `84d3ddf-experience2-3ddcac1103f0:3ee728b8-f6c5-4668-a583-a1d589ef39ab`.
- Island and Park enabled; Park renderer `three`; Island delivery `mystic-island-v1`, world `mystic-island-procedural-v2`, learning `mystic-island-learning-v2`, art `moon-garden`.
- [Critical path and benchmark comparison](contact-sheet.html), with exact [image hashes](images.json). Viewports are Chromium 390×844 and 768×1024, not physical devices.

## Verification

- [Clean publishable-tree verify:release](verify-release.txt): PASS. Docs, lint, typecheck, 144 test files / 1,676 tests, build/assets, 31 smoke cases, four classic PWA cases. This is the actual clean-tree count; earlier candidate notes report 145 / 1,694 and are not substituted for this run.
- Island DEV: 11 scenarios PASS, including real reserved learning, growth, delayed rewards, placement, profile isolation, and rendering recovery.
- Fixed-production Island PWA: PASS, including protected persistence/checkpoints and real service-worker offline reload/answer/resume.
- Fixed-production onboarding: six scenarios / 49 images PASS; progressive support: nine / 45 PASS; prospective observation: two / 11 PASS; all normal learning inputs: 23 / 139 PASS.
- Fixed-production critical path: both viewports PASS, from welcome through learning, earned placement, resident use and next learning.
- Latest shared-play evidence is reused only after matching all 625 source inputs and its exact production version: [report](sharing/report.json), [runner provenance](sharing/runner-provenance.json). Both viewports, all three combinations, fox participation, replay/cancellation, storage invariance, motion preference and renderer recovery PASS.
- [Formal Island fixed-ten](throughput.json): PASS and `evidence.eligible=true`, 80 runs, ten repetitions per viewport/scenario/lane. Correct-input P95 phone 193.8 ms / tablet 194.1 ms; same-question incorrect retry P95 194.2 / 193.5 ms. All-correct Island/Study throughput ratio 2.120 / 2.088. These are automated keyboard measurements, not human solving speeds. The process snapshot taken near benchmark start showed this benchmark as the only test/build job; source and rendered candidate stayed unchanged.
- Each new QA runner records matching source and production version before/after in [qa-results.json](qa-results.json). Detailed reports are in `reports/`.

The first clean docs check found a link into ignored local output. The original synthetic observer verification manifest is now preserved beside the observer document, and its link works in a clean checkout. The initial root lint was stopped to avoid scanning accumulated local artifacts; the full release gate then ran in the isolated publishable tree. These are verification-environment/documentation corrections, not application changes.

## Separate gates and limits

- Visual appeal: author regression review PASS for the reviewed critical path and shared-play stills against the previously approved moon-garden benchmark. Bold colors, faces and open ground remain coherent. The reviewed latest tablet fox pickup keeps the participants clear of the tree; previous HOLD images are not current evidence. This is not a measurement of children's preference or long-term replay.
- Comprehension/safety: author review PASS for the visible first-play, answer, support, reward and placement controls, with no clipped primary action in reviewed screens. Automated input geometry and assisted/independent record separation PASS. Child wordless comprehension remains unmeasured (N=0).
- Runtime integrity: the checks listed above apply to the exact identified source/artifact. Physical iOS/Android installation/relaunch and a real hosted old-build→new-build update remain untested in this release. PWA hook/version-drift and real local SW-offline checks are separate evidence. The broader exploratory art study and classic fixed-ten benchmark are not rerun by this publication task.

## Rollback

Set `VITE_ISLAND_ENABLED=false` in the existing Vercel build command and redeploy the current schema-compatible code to return default launch to Park. Preserve IndexedDB/localStorage and earned items; do not downgrade the database schema.
