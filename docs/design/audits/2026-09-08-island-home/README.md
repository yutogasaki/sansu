# Island home — 2026-09-08

Island is the primary home. The secondary games list keeps Park, Explore and two-player games available; Park has a persistent return-to-Island control disabled during saves. Central navigation returns to Island. Explicit mode URLs, stored courses, reservations, and PWA protection remain intact. With Island disabled the existing launch/menu behavior remains unchanged.

## Verification

- [Clean verify:release](verify-release.txt): PASS, 144 files / 1676 tests, lint/types/build/assets, 31 smoke cases and four classic PWA checks.
- [Production build](production-build.txt): PASS, Island and Park enabled, Three renderer. Exact inputs: [build-source.json](build-source.json); fixed target `http://127.0.0.1:5599/`, revision `14f26b8-home-99e78d87b3c4`.
- [Phone/tablet route and storage report](screens/report.json): PASS. Real UI reserves Island learning, saves a named Park course, returns and reopens Park with the exact saved record, returns through Settings to the same Island question, and saves the next answer once.
- [Island PWA](pwa-report.json): PASS including real SW offline. An existing Explore run no longer replaces Island home; explicit Other games → Explore resumes the same committed run and problem with Island data intact.
- [Onboarding](onboarding-report.json): all six cases PASS, including profile addition, explicit old-run resume, persistence rollback/retry and update protection.
- [Contact sheet](contact-sheet.html): ten screens, 390×844 and 768×1024. Author review: primary/back controls fit, menu reads as a secondary utility list, Park return is visible. Existing world art and learning inputs are unchanged. Visual regression and control clarity PASS for these screens; human preference/wordless comprehension and physical-device relaunch remain unmeasured.

Verification ran from a HEAD archive plus only this task's files, excluding unrelated ongoing sharing-QA/doc edits. Initial docs-check attempts stopped on missing task-template fields; the corrected task passed the complete clean gate. The route harness also pauses an existing Island reservation before opening Other games, matching the real automatic learning-resume behavior. No runtime correction was needed after the full gate. A fixed-ten benchmark was not repeated for this navigation-only change; learning/rendering code and timings are unchanged.
