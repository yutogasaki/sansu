# Publish park retirement

- Review By: 2026-09-09
- Scope: remove the park menu/onboarding/runtime and shipped assets; old `/park` redirects home. Shared learning and all persisted data remain intact. Other dirty-checkout work and prototype/source archival are excluded from this publication.
- Tested application tree before this evidence-only document: `6edf54069522c80129d63d348c04c1d3e70fc1cc` (base `dd69308`). All checks ran in an isolated worktree, not the shared working directory.

## Verification

- docs:check and lint PASS (existing overdue-review and fast-refresh warnings). The first docs check found retired-source links; converted them to historical references.
- typecheck PASS after removing a test-only import of the retired ParkAnswerForm wrapper; shared form coverage remains.
- Full unit/integration run: 3,382 passed, one 15-second timeout in the unchanged learning progression test. Its complete 12-test file passed on focused retry without source or timeout changes. The initial full-suite failure is retained; this is not a clean full-suite run.
- Production build/assets check, smoke, PWA update checkpoints, and real two-build SW update/offline/data-retention checks PASS.
- Retired-mode browser checks PASS for classic and island at 390/768 widths: old URL, onboarding, menu removal, opaque legacy saved rows, and real island answer.
- Published flag configuration was built with Island=true, BuildPlay=true, ParkRenderer=three; output correctly reports park.enabled=false / renderer=retired. Local island build version: `development-local:5ebeb4b7-7f9c-4739-81b1-042acdcaa18f`, target `http://127.0.0.1:5438`. The staged tree above identifies its source; this local version does not claim a deployed revision.
- Menu screenshots at both widths reviewed: readable and no park entry. This functional removal does not claim new art appeal or observed child comprehension. Physical iOS/Android installation was not tested.
- Local raw evidence: `output/playwright/publish-park-2026-09-09/` (ignored, not a tracked link).

## Integration before push

- Concurrent publications advanced main to `f44f04f`, then `9fd1213`. Both are retained. The only manual rebase conflict was two independent parent-spec notices; both notices remain.
- On the `f44f04f` integration candidate (`a9a311d` before this evidence amendment), docs, lint, typecheck, and the 42 launch/shared-form tests PASS. Production build/assets and the complete retired-mode phone/tablet browser checks PASS. Both updated menu screenshots were reviewed.
- Integrated full-suite retry was interrupted after two 5-second timeouts in unchanged `experienceRepository.test.ts`, during concurrent machine-heavy test activity. This remains a full-suite verification gap, not an asserted clean pass or a proven application defect. Initial and retry logs are retained.
- Integrated local island version: `development-local:92f6fb7a-2115-4b8f-8116-8831df94ae41`. The final `9fd1213` rebase only brings independently published Stats display/CSS/smoke expectation and docs changes; reviewed with no overlap in park routes or persistence. The full matrix was not repeated for that unrelated Stats publication.
