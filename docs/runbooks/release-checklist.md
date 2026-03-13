# Release Checklist

## Purpose

This checklist is for release-sensitive changes and pre-release sanity checks.

## Baseline Commands

- `npm run docs:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `npm run build`
- `npm run e2e:smoke` when critical flows changed

Shortcuts:

- `npm run verify:core`
- `npm run verify:release`

## Checklist

### Code / Quality

- GitHub Actions status is green for the relevant checks
- Lint passes
- Typecheck passes
- Required tests pass
- Build passes

### Spec / Docs

- Behavior changes are reflected in the correct spec or doc
- New durable decisions moved to `memory.md` or an ADR when needed
- Active-task context is not left in backlog/status docs

### UX / Design

- Child/parent wording was reviewed
- Shared UI changes were checked against [design_review_checklist.md](../design_review_checklist.md)
- Mobile/tablet layout impact was considered

### Operations

- If PWA-related, also follow [pwa-release.md](pwa-release.md)
- If storage/schema changed, document migration or risk
- If release risk is high, record rollback clues

## Exit Rule

If any high-risk item is intentionally skipped, write the gap down before release.
