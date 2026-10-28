import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fixture from '../2026-10-23-place-method-comparison/evidence/expanded-place-recipe-flower-flat-wide-fixture.json';
import { commandGrowingIsland, GrowingIslandDatabase, readGrowingIsland, type GrowingRecord } from '../../../src/domain/growingIsland/repository';
import { canPlace, type Intent } from '../../../src/domain/growingIsland/commands';
import { editableIslandWorld, terrainRevision } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { terrainEditingRevision } from '../../../src/domain/growingIsland/terrainEditing';
import { derivePlaces } from '../../../src/domain/growingIsland/places';
import { landBounds } from '../../../src/domain/growingIsland/space';
import type { Command, GrowingState } from '../../../src/domain/growingIsland/types';
import { placeHeight as legacyPlaceHeight } from './field';
import { shapeOf, placeHeight, type PlaceShape } from './directional-field';
import { LEGACY_TRIAL_PLACE_RECIPE, TRIAL_PLACE_RECIPE, placeEditingRevision, trialHistoryOf, validateTrialPlaceState, type PersistentPlaceState, type TrialPlaceCommand } from './persistent-model';
import { openSavedTrial, trialInitialRecord } from './trial-store';

const profileId = fixture.state.seed;
const databases: GrowingIslandDatabase[] = [];
const results: { name: string; detail?: unknown }[] = [];
const now = 1_000;
const safety = { actors: [], occupiedPlaceTargets: [] };
const hill: PlaceShape = { center: { x: 5, z: 5 }, radius: 1.6, height: .5, entrance: 1.2, flatRadius: 1.75 };
const wide: PlaceShape = { ...hill, radius: 2, entrance: 2 };
const inlet: PlaceShape = { center: { x: 5, z: 5 }, radius: 1.6, height: -.55, entrance: 1.2 };
const snapshot = (value: unknown) => JSON.stringify(value);
function initial(): GrowingRecord {
    const state = structuredClone(fixture.state) as unknown as PersistentPlaceState;
    state.trialPlaceHistory = { version: 1, recipe: TRIAL_PLACE_RECIPE, undo: [], redo: [] };
    validateTrialPlaceState(state);
    return { profileId, islandId: 'main', version: 6, revision: 0, createdAt: now, updatedAt: now, state };
}
async function database(empty = false) {
    const db = new GrowingIslandDatabase(`SansuPlaceOutlineDiagnostic-${crypto.randomUUID()}`);
    databases.push(db); if (!empty) await db.islands.add(initial()); return db;
}
async function read(db: GrowingIslandDatabase) { return (await readGrowingIsland(profileId, db))!; }
function placeIntent(state: GrowingState, id: string, action: TrialPlaceCommand['action'], shape?: PlaceShape): Intent {
    return { id, islandId: 'main', command: { type: 'place-outline', action, shape, safety, expectedPlaceRevision: placeEditingRevision(state) } };
}
async function place(db: GrowingIslandDatabase, id: string, action: TrialPlaceCommand['action'], shape?: PlaceShape) {
    const before = await read(db);
    return (await commandGrowingIsland(profileId, placeIntent(before.state, id, action, shape), now, db)).record;
}
async function normal(db: GrowingIslandDatabase, id: string, command: Command) {
    return (await commandGrowingIsland(profileId, { id, islandId: 'main', command }, now, db)).record;
}
const nonPlaceState = (state: GrowingState) => {
    const copy = structuredClone(state) as PersistentPlaceState;
    delete copy.trialPlace; delete copy.trialPlaceHistory; copy.applied = [];
    return copy;
};
function legacyRecord(record: GrowingRecord): GrowingRecord {
    const legacy = structuredClone(record);
    (legacy.state as PersistentPlaceState).trialPlaceHistory!.recipe = LEGACY_TRIAL_PLACE_RECIPE as unknown as typeof TRIAL_PLACE_RECIPE;
    return legacy;
}
function floorSignature(state: GrowingState) {
    const world = editableIslandWorld(state)!, bounds = landBounds(state), floors: unknown[] = [];
    for (let zi = 0; zi <= (bounds.depth - 1) * 12; zi++) for (let xi = bounds.minX * 12; xi <= bounds.maxX * 12; xi++) {
        const cell = { x: xi / 12, z: zi / 12 }, floor = world.floorAt(cell);
        floors.push([cell.x, cell.z, floor ? [floor.point.x, floor.point.y, floor.point.z] : null]);
    }
    return { points: floors.length, sha256: createHash('sha256').update(JSON.stringify(floors)).digest('hex') };
}

try {
    const freshDb = await database(true);
    const fresh = await openSavedTrial(freshDb, now);
    assert.deepEqual(fresh, trialInitialRecord());
    assert.deepEqual(await openSavedTrial(freshDb, now + 1), fresh);
    results.push({ name: 'empty isolated trial initializes v3 once through the actual opener' });

    const db = await database(), base = await read(db);
    assert.deepEqual(await place(db, 'empty-undo', 'undo'), base);
    assert.deepEqual(await place(db, 'empty-redo', 'redo'), base);
    const intent = placeIntent(base.state, 'first-hill', 'apply', hill);
    const first = (await commandGrowingIsland(profileId, intent, now, db)).record;
    assert.equal(first.revision, 1); assert.equal(trialHistoryOf(first.state)?.undo.length, 1);
    assert.deepEqual((await commandGrowingIsland(profileId, intent, now + 1, db)).record, first);
    assert.deepEqual(await place(db, 'same-shape', 'apply', { entrance: 1.2, height: .5, radius: 1.6, flatRadius: 1.75, center: { z: 5, x: 5 } }), first);
    db.close(); await db.open();
    assert.deepEqual(await read(db), first);
    assert.equal(terrainRevision((await read(db)).state), terrainRevision(first.state));
    results.push({ name: 'actual repository save/reopen; duplicate intent and semantic no-op unchanged' });

    const oldCursor = placeEditingRevision(first.state);
    await place(db, 'widen', 'apply', wide);
    await normal(db, 'move-bench-east', { type: 'move', id: 'starter-bench', cell: { x: 6, z: 5 } });
    await normal(db, 'move-flower-north', { type: 'move', id: 'starter-flower', cell: { x: 5, z: 4 } });
    const beforePurchase = await read(db);
    const purchaseCell = [{ x: -1, z: 2 }, { x: -2, z: 1 }, { x: 3, z: 6 }].find(cell => canPlace(beforePurchase.state, cell));
    assert(purchaseCell, 'a disclosed independent site for the normal purchase');
    const purchased = await normal(db, 'buy-another-flower', { type: 'place', kind: 'flower', cell: purchaseCell });
    assert(purchased.state.drops < beforePurchase.state.drops, 'actual purchase changes wallet');
    const stable = nonPlaceState(purchased.state);
    const undo = await place(db, 'undo-after-furniture', 'undo');
    assert.deepEqual(shapeOf(undo.state), hill);
    assert.deepEqual(nonPlaceState(undo.state), stable, 'undo does not rewind ownership, wallet, learning, clock or life receipts');
    assert.notEqual(placeEditingRevision(undo.state), oldCursor, 'same geometry with redo cursor is not the previous edit revision');
    db.close(); await db.open();
    const reopenedUndo = await read(db);
    assert.deepEqual(reopenedUndo, undo);
    assert.equal(trialHistoryOf(reopenedUndo.state)?.redo.length, 1);
    const redone = await place(db, 'redo-after-reopen', 'redo');
    assert.deepEqual(shapeOf(redone.state), wide);
    assert.deepEqual(nonPlaceState(redone.state), stable);
    results.push({ name: 'reopened Undo/Redo preserves later normal moves and purchase', detail: { purchaseCell, drops: redone.state.drops, owners: redone.state.landmarks.map(owner => ({ id: owner.id, cell: owner.cell })) } });

    const migrationDb = await database(), legacy = legacyRecord(undo), oldFloor = floorSignature(legacy.state);
    await migrationDb.islands.put(legacy);
    await assert.rejects(read(migrationDb), /保存をよみこめなかった/, 'ordinary current reader cannot silently reinterpret v2');
    const migrated = await openSavedTrial(migrationDb, now + 5_000);
    const expectedMigration = structuredClone(legacy);
    (expectedMigration.state as PersistentPlaceState).trialPlaceHistory!.recipe = TRIAL_PLACE_RECIPE;
    expectedMigration.revision += 1; expectedMigration.updatedAt = now + 5_000;
    assert.deepEqual(migrated, expectedMigration, 'only recipe and record revision/update time change');
    assert.equal(migrated.version, 6, 'trial contract does not bump the production save version');
    assert.deepEqual(floorSignature(migrated.state), oldFloor, 'the exact actual floor remains unchanged by migration');
    assert.equal(terrainRevision(migrated.state), terrainRevision(legacy.state));
    migrationDb.close(); await migrationDb.open();
    assert.deepEqual(await openSavedTrial(migrationDb, now + 9_000), migrated, 'opening v3 is idempotent and performs no revision write');
    assert.deepEqual(shapeOf((await place(migrationDb, 'migrated-redo', 'redo')).state), wide);
    const migrationUndo = await place(migrationDb, 'migrated-undo', 'undo');
    assert.deepEqual(shapeOf(migrationUndo.state), hill);
    assert.deepEqual(nonPlaceState(migrationUndo.state), nonPlaceState(legacy.state));
    results.push({ name: 'actual opener atomically upgrades v2 recipe to v3, preserving both history chains, owners, wallet and clocks',
        detail: { oldRecipe: LEGACY_TRIAL_PLACE_RECIPE, newRecipe: TRIAL_PLACE_RECIPE, oldRevision: legacy.revision,
            migratedRevision: migrated.revision, version: migrated.version, northFloor: oldFloor } });

    const concurrentMigrationDb = await database();
    await concurrentMigrationDb.islands.put(legacy);
    const concurrentOpens = await Promise.all([openSavedTrial(concurrentMigrationDb, now + 5_000), openSavedTrial(concurrentMigrationDb, now + 5_000)]);
    concurrentOpens.forEach(record => assert.deepEqual(record, migrated));
    assert.deepEqual(await read(concurrentMigrationDb), migrated, 'two concurrent openers migrate and increment only once');
    const rollbackClockDb = await database();
    await rollbackClockDb.islands.put(legacy);
    assert.equal((await openSavedTrial(rollbackClockDb, now - 1)).updatedAt, legacy.updatedAt, 'wall-clock rollback cannot move saved metadata backwards');
    results.push({ name: 'concurrent v2 openers advance once; migration timestamp is monotonic under wall-clock rollback' });

    const migrationFailureDb = await database();
    await migrationFailureDb.islands.put(legacy);
    const failedMigrationWrite = () => { throw Error('diagnostic migration disk-full'); };
    migrationFailureDb.islands.hook('updating', failedMigrationWrite);
    try { await assert.rejects(openSavedTrial(migrationFailureDb, now + 5_000), /diagnostic migration disk-full/); }
    finally { migrationFailureDb.islands.hook('updating').unsubscribe(failedMigrationWrite); }
    assert.deepEqual(await migrationFailureDb.islands.get(profileId), legacy, 'failed migration leaves every saved byte intact');
    assert.deepEqual(await openSavedTrial(migrationFailureDb, now + 5_000), migrated, 'failed migration retries once from the original record');
    const deletedMigrationDb = await database();
    await deletedMigrationDb.islands.put(legacy);
    await deletedMigrationDb.deletedOwners.put({ profileId, deletedAt: now + 1 });
    await assert.rejects(openSavedTrial(deletedMigrationDb, now + 5_000), /プロフィール/);
    assert.deepEqual(await deletedMigrationDb.islands.get(profileId), legacy, 'migration respects the permanent deleted-owner fence');
    results.push({ name: 'migration write failure rolls back atomically and retries; deleted owner cannot migrate' });

    const legacyBadDb = await database();
    const legacyCorruptions: { name: string; mutate: (record: GrowingRecord) => void }[] = [
        { name: 'v2 current shape has explicit north', mutate: record => { (record.state as PersistentPlaceState).trialPlace!.rampDirection = 'north'; } },
        { name: 'v2 history has a west direction', mutate: record => { (record.state as PersistentPlaceState).trialPlaceHistory!.redo[0].after!.rampDirection = 'west'; } },
        { name: 'v2 direction key is undefined', mutate: record => { (record.state as PersistentPlaceState).trialPlace!.rampDirection = undefined; } },
        { name: 'v2 extra shape key', mutate: record => { Object.assign((record.state as PersistentPlaceState).trialPlace!, { futureShape: true }); } },
        { name: 'v2 broken chain', mutate: record => { (record.state as PersistentPlaceState).trialPlaceHistory!.undo[0].after!.height = .4; } },
        { name: 'v2 unsupported record version', mutate: record => { record.version = 7 as 6; } },
        { name: 'v2 mismatched owner', mutate: record => { record.state.seed = 'another-owner'; } },
        { name: 'v2 invalid revision', mutate: record => { record.revision = Number.MAX_SAFE_INTEGER; } },
        { name: 'v2 invalid production growth', mutate: record => { record.state.growth = undefined as unknown as GrowingState['growth']; } },
    ];
    for (const corruption of legacyCorruptions) {
        const record = structuredClone(legacy); corruption.mutate(record);
        await legacyBadDb.islands.put(record);
        await assert.rejects(openSavedTrial(legacyBadDb, now + 5_000));
        assert.deepEqual(await legacyBadDb.islands.get(profileId), record, 'invalid legacy data stays untouched, never fixture-reset');
    }
    assert.equal(trialHistoryOf(trialInitialRecord().state)?.recipe, TRIAL_PLACE_RECIPE);
    results.push({ name: 'legacy migration strictly rejects unrecognized old keys, corrupt history and invalid record without repair', detail: legacyCorruptions.map(test => test.name) });

    let northSamples = 0;
    const baseline = (cell: { x: number; z: number }) => .1 + cell.x * .03 + cell.z * .02;
    for (const shape of [hill, { ...hill, flatRadius: undefined }, inlet]) {
        const northState = { trialPlace: shape }, explicitState = { trialPlace: { ...shape, rampDirection: 'north' as const } };
        for (let zi = 0; zi <= 120; zi++) for (let xi = -36; xi <= 96; xi++) {
            const cell = { x: xi / 12, z: zi / 12 }, expected = legacyPlaceHeight(northState, cell, baseline(cell), baseline);
            assert.equal(placeHeight(northState, cell, baseline(cell), baseline), expected);
            if (shape.height >= 0) assert.equal(placeHeight(explicitState, cell, baseline(cell), baseline), expected);
            northSamples++;
        }
    }
    results.push({ name: 'omitted north height is exactly old v2, including low inlet; explicit hill north is exact', detail: { samples: northSamples } });

    const directionDb = await database();
    await place(directionDb, 'direction-base', 'apply', hill);
    const westHill: PlaceShape = { ...hill, rampDirection: 'west' };
    await place(directionDb, 'direction-west', 'apply', westHill);
    await normal(directionDb, 'direction-bench', { type: 'move', id: 'starter-bench', cell: { x: 5, z: 5 } });
    const withDirectionOwners = await normal(directionDb, 'direction-flower', { type: 'move', id: 'starter-flower', cell: { x: 6, z: 5 } });
    const directionStable = nonPlaceState(withDirectionOwners.state);
    assert.deepEqual(shapeOf((await place(directionDb, 'direction-undo', 'undo')).state), hill);
    const directionRedone = await place(directionDb, 'direction-redo', 'redo');
    assert.deepEqual(shapeOf(directionRedone.state), westHill);
    assert.deepEqual(nonPlaceState(directionRedone.state), directionStable);
    const directionFloor = floorSignature(directionRedone.state);
    directionDb.close(); await directionDb.open();
    assert.deepEqual(await openSavedTrial(directionDb, now + 5_000), directionRedone);
    assert.deepEqual(floorSignature((await read(directionDb)).state), directionFloor);
    results.push({ name: 'direction-only edit, Undo/Redo and actual opener preserve shape parameters and later moved owners after reopen',
        detail: { shape: westHill, floor: directionFloor, owners: directionRedone.state.landmarks.map(owner => ({ id: owner.id, cell: owner.cell })) } });

    const savedBeforeStale = snapshot(await read(db));
    await assert.rejects(commandGrowingIsland(profileId, { id: 'old-cursor', islandId: 'main', command: { type: 'place-outline', action: 'apply', shape: hill, safety, expectedPlaceRevision: oldCursor } }, now, db), /かわった/);
    assert.equal(snapshot(await read(db)), savedBeforeStale);
    const raceDb = await database(), raceBase = await read(raceDb);
    const races = await Promise.allSettled([
        commandGrowingIsland(profileId, placeIntent(raceBase.state, 'race-a', 'apply', hill), now, raceDb),
        commandGrowingIsland(profileId, placeIntent(raceBase.state, 'race-b', 'apply', wide), now, raceDb),
    ]);
    assert.equal(races.filter(result => result.status === 'fulfilled').length, 1);
    const raceSaved = await read(raceDb);
    assert.equal(raceSaved.revision, 1); assert.equal(trialHistoryOf(raceSaved.state)?.undo.length, 1);
    results.push({ name: 'stale cursor rejected; simultaneous edits commit exactly once' });

    const failDb = await database(), beforeFailure = await read(failDb);
    const diskFull = () => { throw Error('diagnostic disk-full'); };
    failDb.islands.hook('updating', diskFull);
    try { await assert.rejects(place(failDb, 'failed-save', 'apply', hill), /diagnostic disk-full/); }
    finally { failDb.islands.hook('updating').unsubscribe(diskFull); }
    assert.deepEqual(await read(failDb), beforeFailure);
    assert.equal((await place(failDb, 'failed-save', 'apply', hill)).revision, 1, 'same intent can retry after a real writer rollback');
    results.push({ name: 'write failure rolls back shape, history, revision and intent; retry succeeds' });

    const unsafeDb = await database();
    await place(unsafeDb, 'cut-inlet', 'apply', inlet);
    await place(unsafeDb, 'fill-platform', 'apply', hill);
    await normal(unsafeDb, 'bench-on-platform', { type: 'move', id: 'starter-bench', cell: { x: 5, z: 5 } });
    const beforeUnsafe = await read(unsafeDb);
    await assert.rejects(place(unsafeDb, 'unsafe-undo', 'undo'), /足もと/);
    assert.deepEqual(await read(unsafeDb), beforeUnsafe, 'undo may not submerge furniture placed after the shape edit');
    const actorDb = await database();
    const actorBase = await place(actorDb, 'actor-platform', 'apply', hill);
    const actorIntent = placeIntent(actorBase.state, 'occupied-edit', 'apply', inlet);
    assert.equal(actorIntent.command.type, 'place-outline');
    // An actor stands on the dry platform that this inlet would submerge.
    // The old centre-only path bug used to satisfy this assertion for the wrong reason.
    const actor = { x: 5, z: 5 };
    assert.equal(editableIslandWorld(actorBase.state)!.floorAt(actor)!.point.y, .5);
    assert.equal(editableIslandWorld({ ...actorBase.state, trialPlace: inlet } as PersistentPlaceState)!.floorAt(actor), undefined);
    if (actorIntent.command.type === 'place-outline') actorIntent.command.safety = { actors: [actor], occupiedPlaceTargets: [] };
    await assert.rejects(commandGrowingIsland(profileId, actorIntent, now, actorDb), /なかまが いる/);
    assert.deepEqual(await read(actorDb), actorBase);
    results.push({ name: 'new furniture prevents unsafe Undo; live actor footing remains guarded' });

    const placeForReceipt = derivePlaces(redone.state).find(place => place.ruleId === 'P05' && place.useTargets.some(target => target.kind === 'seat'));
    assert(placeForReceipt, 'derived usable P05 for synthetic receipt writer diagnostic');
    const target = placeForReceipt.useTargets.find(target => target.kind === 'seat')!;
    const correctReceipt: Command = { type: 'place-used', profileId, expectedRevision: redone.revision,
        actorId: 'v2', placeId: placeForReceipt.id, ruleId: placeForReceipt.ruleId, revision: placeForReceipt.revision, targetId: target.id };
    await assert.rejects(normal(db, 'wrong-profile-use', { ...correctReceipt, profileId: 'unrelated-profile' }), /じぶん/);
    const received = await normal(db, 'synthetic-current-use', correctReceipt);
    db.close(); await db.open();
    assert.deepEqual((await read(db)).state.placeProgress, received.state.placeProgress);
    assert(received.state.applied.includes('synthetic-current-use'));
    results.push({ name: 'synthetic current-revision receipt passes real writer and survives reopen; wrong identity rejected', detail: 'This is not evidence of a rendered or naturally occurring use.' });

    const terrainDb = await database(), shaped = await place(terrainDb, 'terrain-base-hill', 'apply', hill);
    const staleBeforeTerrain = placeIntent(shaped.state, 'place-before-terrain', 'apply', wide);
    const terrainEdited = await normal(terrainDb, 'remote-terrain', { type: 'terrain-edit', cell: { x: -2, z: 6 }, delta: 1,
        expectedTerrainRevision: terrainEditingRevision(shaped.state) });
    assert.deepEqual(trialHistoryOf(terrainEdited.state), trialHistoryOf(shaped.state));
    assert.deepEqual(shapeOf(terrainEdited.state), hill);
    assert.notEqual(placeEditingRevision(terrainEdited.state), placeEditingRevision(shaped.state));
    await assert.rejects(commandGrowingIsland(profileId, staleBeforeTerrain, now, terrainDb), /かわった/);
    const placeUndone = await place(terrainDb, 'undo-place-after-terrain', 'undo');
    assert.deepEqual(placeUndone.state.terrain, terrainEdited.state.terrain, 'place undo retains an independent grid edit and its history');
    const placeRedone = await place(terrainDb, 'redo-place-after-terrain', 'redo');
    assert.deepEqual(placeRedone.state.terrain, terrainEdited.state.terrain);
    const terrainUndone = await normal(terrainDb, 'undo-remote-terrain', { type: 'terrain-undo', expectedTerrainRevision: terrainEditingRevision(placeRedone.state) });
    assert.deepEqual(shapeOf(terrainUndone.state), hill);
    assert.deepEqual(trialHistoryOf(terrainUndone.state), trialHistoryOf(placeRedone.state));
    results.push({ name: 'independent grid edits and place history survive one another; grid edits invalidate stale place input' });

    const limitDb = await database();
    for (let i = 0; i < 66; i++) await place(limitDb, `bounded-${i}`, 'apply', i % 2 === 0 ? hill : wide);
    const limited = await read(limitDb);
    assert.equal(trialHistoryOf(limited.state)?.undo.length, 64);
    limitDb.close(); await limitDb.open();
    assert.deepEqual(await read(limitDb), limited);
    await place(limitDb, 'bounded-undo', 'undo');
    const boundedRedo = await place(limitDb, 'bounded-redo', 'redo');
    assert.deepEqual(shapeOf(boundedRedo.state), wide);
    assert.equal(trialHistoryOf(boundedRedo.state)?.undo.length, 64);
    await place(limitDb, 'branch-undo', 'undo');
    const branched = await place(limitDb, 'branch-new-outline', 'apply', { ...hill, entrance: 1.5 });
    assert.equal(trialHistoryOf(branched.state)?.redo.length, 0);
    assert.deepEqual(await place(limitDb, 'branch-empty-redo', 'redo'), branched);
    results.push({ name: '66 real writes retain the newest 64 edits after reopen; a new branch clears redo' });

    const corruptDb = await database(), valid = await place(corruptDb, 'valid-before-corruption', 'apply', hill);
    const corruptions: { name: string; mutate: (state: PersistentPlaceState) => void }[] = [
        { name: 'unknown recipe', mutate: state => { state.trialPlaceHistory!.recipe = 'future-recipe' as typeof TRIAL_PLACE_RECIPE; } },
        { name: 'unknown history version', mutate: state => { state.trialPlaceHistory!.version = 2 as 1; } },
        { name: 'unknown v3 direction', mutate: state => { state.trialPlace!.rampDirection = 'up' as 'north'; } },
        { name: 'null v3 direction', mutate: state => { state.trialPlace!.rampDirection = null as unknown as 'north'; } },
        { name: 'direction on negative inlet', mutate: state => { state.trialPlace = { ...inlet, rampDirection: 'north' }; } },
        { name: 'infinite coordinate', mutate: state => { state.trialPlace!.center.x = Infinity; } },
        { name: 'out of acquired land', mutate: state => { state.trialPlace!.center.x = 100; } },
        { name: 'radius below supported range', mutate: state => { state.trialPlace!.radius = .99; } },
        { name: 'height above supported range', mutate: state => { state.trialPlace!.height = 1.41; } },
        { name: 'entrance below supported range', mutate: state => { state.trialPlace!.entrance = .29; } },
        { name: 'platform above supported range', mutate: state => { state.trialPlace!.flatRadius = 2.01; } },
        { name: 'broken undo chain', mutate: state => { state.trialPlaceHistory!.undo[0].after!.radius = 2; } },
        { name: 'broken redo chain', mutate: state => { state.trialPlaceHistory!.redo.push({ before: inlet, after: wide }); } },
        { name: 'missing history', mutate: state => { delete state.trialPlaceHistory; } },
        { name: 'oversized history', mutate: state => { state.trialPlaceHistory!.undo = Array.from({ length: 65 }, () => ({ before: undefined, after: hill })); } },
    ];
    for (const corruption of corruptions) {
        const record = structuredClone(valid); corruption.mutate(record.state as PersistentPlaceState);
        await corruptDb.islands.put(record);
        await assert.rejects(read(corruptDb), /保存をよみこめなかった/);
        await assert.rejects(openSavedTrial(corruptDb, now + 5_000), /保存をよみこめなかった/);
        assert.deepEqual(await corruptDb.islands.get(profileId), record, 'reject corrupt record without repair or data loss');
    }
    results.push({ name: 'corrupt/future saves rejected and retained unchanged', detail: corruptions.map(test => test.name) });

    console.log(JSON.stringify({ at: new Date().toISOString(), recipe: TRIAL_PLACE_RECIPE,
        scope: 'Actual commandGrowingIsland/readGrowingIsland/openSavedTrial on fake IndexedDB, transformed trial code, isolated v2-to-v3 trial recipe migration; not browser, SW, worker sync, production-save migration or live-use proof',
        results }, null, 2));
} finally { await Promise.all(databases.map(db => db.delete())); }
