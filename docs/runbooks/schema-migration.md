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

## v8: Local Island Photo Album

- Adopted contract: [shared memories spec](/docs/product/38_island_shared_memories_spec.md), sections 5–8.
- `src/db/index.ts` preserves every v7 schema and adds only `islandPhotoAlbums` (`&profileId`), `islandPhotos` (`&id, profileId, [profileId+capturedAt]`) and `islandPhotoBlobs` (`&id, profileId`). There is no upgrade transform or backfill. Existing profile, learning, island, workshop, plan and receipt rows remain unchanged; all three new stores start empty.
- An absent album reads as revision 0. Reading or ordinary learning does not create photo rows. Unknown existing album/metadata versions are rejected rather than reset.
- Full PNG and thumbnail Blobs stay in the dedicated Blob store. The photo writer touches only appData (ownership read), the three photo stores and islandEvents (receipt). Photos must stay outside `islandTables` and the learning attempt transaction tables.
- Save/delete use the frozen album revision, capture UUID and canonical metadata/digests. The same request after uncertain I/O reuses its receipt; deleting an image retains receipts so an old save cannot recreate it. Known CAS conflicts require a fresh UI action.
- Profile deletion and full reset include all three stores and photo receipts in the existing profile deletion transaction. A native abort must restore both photo and pre-existing profile data.
- Before release, run the focused photo domain/repository tests plus the existing profile deletion tests, then the required checks above. The repository tests include a v7→v8 open with existing learning/workshop receipts, first photo save, two-owner isolation, native abort, capacity limits and stale replay after deletion.
- Roll back with a v8-compatible build that disables the album UI. Do not open the upgraded database with a v7-only build, erase stores, delete the database or ask families to clear browser storage.
