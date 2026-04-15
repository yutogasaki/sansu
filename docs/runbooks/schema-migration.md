# Schema Migration Runbook

## Purpose

Use this runbook when local data shape, Dexie schema, or profile structure changes.

## When To Use

- `src/db.ts` changes
- `schemaVersion` changes
- `UserProfile` or stored memory shape changes
- Existing local profiles may load old data

## Preflight

- Review [docs/product/01_app_spec.md](/docs/product/01_app_spec.md)
- Review [docs/wiki/memory.md](/docs/wiki/memory.md)
- Write an ADR if the migration is non-obvious

## Required Checks

- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `npm run build`

## Migration Questions

- Is this backward-compatible?
- What happens to existing local profiles?
- What happens if a field is missing?
- Can the app recover without manual storage clearing?
- Do we need a one-time transform or only defensive defaults?

## Checklist

- Data shape change is documented
- Default handling for missing old fields exists
- Existing users are not silently broken
- Tests cover the new fallback or migration path
- Rollback implications are noted

## Rollback Clues

- If users lose access to data, inspect schema upgrades and missing defaults first
- If UI crashes only on old profiles, inspect nullable fields and migration guards
