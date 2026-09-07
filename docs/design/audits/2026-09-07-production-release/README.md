# Production release verification — 2026-09-07

User authorized commit, main push and latest app publication. The Vercel build now enables Island while keeping Park enabled with Three.js. Existing active exploration runs retain launch priority. No data clearing is part of release.

## Evidence

- App code revision: `b9607fa`. Local production target: `http://127.0.0.1:5399`.
- [Critical path contact sheet](contact-sheet.html), 16 scenes at 390×844 and 768×1024. Exact version, source revision, flags and candidates: [capture report](screens/production-capture-report.json).
- `verify:release`: PASS, docs/lint/typecheck, 127 test files / 1,411 tests, build/assets, 31 smoke cases and four classic PWA cases.
- Island functional E2E: PASS. Production Island PWA: four protection cases and real SW offline reload/answer/resume PASS.
- Fixed ten: phone/tablet ten repetitions, PASS. First attempt was interrupted by DEV navigation during the operator's Git branch switch; it is retained separately under output/playwright/production-release/throughput.json. The uninterrupted rerun is [throughput-retry.json](throughput-retry.json).
- Production written arithmetic: all nine cases PASS; raw logs under output/playwright/production-release/written.
- Production precache: 9.50 MiB / 12 MiB; exploration artwork 4.92 MiB / 8 MiB.

## Separate gates

- Visual appeal: desktop review PASS for regression. Latest phone home compared beside approved island-loop home; bold color, faces and ground silhouette remain consistent. Children's preference and replay appeal are not measured by this release check.
- Comprehension/safety: desktop review PASS for visible answer and placement controls; no clipping in reviewed phone learning and tablet placement. Wordless child comprehension is not established.
- Runtime integrity: automated critical path, learning records, placement, continued learning and offline/PWA checks PASS on the identified artifact. Physical iOS/Android relaunch is untested.

## Rollback

Set `VITE_ISLAND_ENABLED=false` and redeploy the current schema-compatible code to return root launch to Park. Preserve IndexedDB/localStorage; do not downgrade to older database schemas.

## Hosted verification

Production commit `83965c7` deployed successfully with Island enabled. Real hosted old→new PWA verification PASS: one reload per context, protected onboarding input preserved, IndexedDB/localStorage preserved, existing Park replay works. [Hosted update report](hosted-update-report.json). Physical mobile remains untested.

GitHub CI initially failed only because nine linked historical `.log` files were ignored by Git. They are now explicitly tracked; a clean checkout docs check verifies the published file set. Follow-up documentation commits keep the application code unchanged.
