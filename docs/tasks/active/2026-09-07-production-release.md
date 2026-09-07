# Latest app production release

## Goal
Commit current completed work, merge main, push and verify the latest app on production. User authorized publication on 2026-09-07.

## Scope
Mystic Island, shared written arithmetic, learning and print improvements, existing accompanying assets and documentation. Enable Island in the Vercel build.

## SSOT
- docs/product/28_mystic_island_spec.md
- docs/runbooks/pwa-release.md
- docs/ai/verification_matrix.md

## Plan
Run release checks, verify Island production critical path, commit and fast-forward main, inspect hosted build and update pickup.

## Verification
Local checks PASS; production push and hosted checks pending. Logs in /tmp/sansu-release-check.log and output/playwright/production-release/. Physical iOS/Android testing is unavailable in this desktop session.

- Review By: 2026-09-08

## Docs To Touch
- docs/runbooks/pwa-release.md
- docs/design/audits/2026-09-07-production-release/README.md
- docs/done/2026-09.md
