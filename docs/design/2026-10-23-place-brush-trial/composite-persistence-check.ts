import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { GrowingIslandDatabase, commandGrowingIsland, readGrowingIsland, type GrowingRecord } from '../../../src/domain/growingIsland/repository';
import { editableIslandWorld } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { HOME_CELL, landCells, walkableCells } from '../../../src/domain/growingIsland/space';
import type { Command, GrowingState } from '../../../src/domain/growingIsland/types';
import type { Intent } from '../../../src/domain/growingIsland/commands';
import type { PlaceShape } from './directional-field';
import { compositeOf } from './composite-field';
import { compositeEditingRevision } from './composite-model';
import { COMPOSITE_DATABASE, COMPOSITE_PROFILE, COMPOSITE_SAVE_RECIPE, compositeInitialRecord, openCompositeTrial, type SavedCompositeState } from './composite-store';
const db = new GrowingIslandDatabase(COMPOSITE_DATABASE), results: { name: string; detail?: unknown }[] = [];
const west: PlaceShape = { center: { x: -1, z: 4 }, radius: 1.6, height: .5, entrance: 1.2, flatRadius: 1.75 };
const east: PlaceShape = { center: { x: 5, z: 5 }, radius: 1.6, height: .9, entrance: 1.2, flatRadius: 1.75, rampDirection: 'west' };
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const read = async () => (await readGrowingIsland(COMPOSITE_PROFILE, db))!;
const intent = (record: GrowingRecord, id: string, action: 'apply' | 'undo' | 'redo', shape?: PlaceShape): Intent => ({ id, islandId: 'main',
    command: { type: 'place-set', action, slot: 'west', shape, safety: { actors: [], occupiedPlaceTargets: [] }, expectedPlaceRevision: compositeEditingRevision(record.state) } });
async function send(id: string, command: Command) { return (await commandGrowingIsland(COMPOSITE_PROFILE, { id, islandId: 'main', command }, 1000, db)).record; }
async function place(id: string, action: 'apply' | 'undo' | 'redo', shape?: PlaceShape) {
    const before = await read(); return (await commandGrowingIsland(COMPOSITE_PROFILE, intent(before, id, action, shape), 1000, db)).record;
}
function nonShapes(state: GrowingState) {
    const copy = structuredClone(state) as SavedCompositeState;
    delete copy.trialPlaceSet; delete copy.trialPlaceSetHistory; copy.applied = [];
    return copy;
}
function geometry(state: GrowingState) {
    const world = editableIslandWorld(state)!, open = walkableCells(state, world);
    return { floor: sha(world.floors), routes: sha(landCells(state).map(cell => world.route(HOME_CELL, cell, open) ?? null)) };
}
try {
    const initial = await openCompositeTrial(db, 1000);
    assert.deepEqual(initial, compositeInitialRecord()); assert.deepEqual(await openCompositeTrial(db, 2000), initial);
    let record = await place('saved-west', 'apply', west);
    const eastCommand = intent(record, 'saved-east', 'apply', east);
    if (eastCommand.command.type === 'place-set') eastCommand.command.slot = 'east';
    record = (await commandGrowingIsland(COMPOSITE_PROFILE, eastCommand, 1000, db)).record;
    record = await place('saved-west-small', 'apply', { ...west, radius: 1.2 });
    for (const [id, cell] of [['starter-bench', { x: -1, z: 4 }], ['starter-flower', { x: 0, z: 4 }]] as const)
        record = await send(`saved-move-${id}`, { type: 'move', id, cell });
    for (const [kind, cell] of [['bench', { x: 5, z: 5 }], ['flower', { x: 6, z: 5 }]] as const)
        record = await send(`saved-buy-${kind}`, { type: 'place', kind, cell });
    assert.equal(record.state.drops, initial.state.drops - 30);
    const stable = nonShapes(record.state), shape = structuredClone(compositeOf(record.state)), beforeGeometry = geometry(record.state);
    db.close(); await db.open(); assert.deepEqual(await openCompositeTrial(db, 5000), record);
    assert.deepEqual(geometry((await read()).state), beforeGeometry);
    results.push({ name: 'two places and later ordinary moves/purchases survive actual writer close/reopen', detail: { drops: record.state.drops, geometry: beforeGeometry, owners: record.state.landmarks } });
    record = await place('saved-undo', 'undo'); assert.deepEqual(compositeOf(record.state)!.west, west);
    assert.deepEqual(compositeOf(record.state)!.east, east); assert.deepEqual(nonShapes(record.state), stable);
    db.close(); await db.open(); assert.deepEqual(await openCompositeTrial(db), record);
    record = await place('saved-redo', 'redo'); assert.deepEqual(compositeOf(record.state), shape); assert.deepEqual(nonShapes(record.state), stable);
    assert.deepEqual(geometry(record.state), beforeGeometry);
    results.push({ name: 'reopened Undo/Redo changes only shapes, preserving purchases, wallet, clocks, progress and owners' });

    const duplicate = intent(record, 'saved-duplicate', 'apply', west);
    record = (await commandGrowingIsland(COMPOSITE_PROFILE, duplicate, 1000, db)).record;
    assert.deepEqual((await commandGrowingIsland(COMPOSITE_PROFILE, duplicate, 1000, db)).record, record);
    const stale = intent(record, 'saved-stale', 'apply', { ...west, radius: 1.2 });
    await place('saved-advance', 'apply', { ...west, entrance: 1.3 });
    await assert.rejects(commandGrowingIsland(COMPOSITE_PROFILE, stale, 1000, db), /かわった/);
    const beforeRace = await read();
    const race = await Promise.allSettled([
        commandGrowingIsland(COMPOSITE_PROFILE, intent(beforeRace, 'saved-race-a', 'apply', west), 1000, db),
        commandGrowingIsland(COMPOSITE_PROFILE, intent(beforeRace, 'saved-race-b', 'apply', { ...west, radius: 1.2 }), 1000, db),
    ]);
    assert.equal(race.filter(result => result.status === 'fulfilled').length, 1);
    results.push({ name: 'duplicate intent is idempotent; stale cursor rejects; concurrent same-cursor edits commit once' });

    const beforeFailure = await read(), failureIntent = intent(beforeFailure, 'saved-retry', 'apply', { ...west, entrance: 1.4 });
    const failWrite = () => { throw Error('composite diagnostic disk-full'); };
    db.islands.hook('updating', failWrite);
    try { await assert.rejects(commandGrowingIsland(COMPOSITE_PROFILE, failureIntent, 1000, db), /disk-full/); }
    finally { db.islands.hook('updating').unsubscribe(failWrite); }
    assert.deepEqual(await read(), beforeFailure);
    record = (await commandGrowingIsland(COMPOSITE_PROFILE, failureIntent, 1000, db)).record;
    assert.equal(record.revision, beforeFailure.revision + 1);
    results.push({ name: 'actual writer failure rolls back every saved byte; same intent retries once' });

    const beforeCorruption = structuredClone(record), corrupt = structuredClone(record);
    (corrupt.state as SavedCompositeState).trialPlaceSetRecipe = 'unknown' as typeof COMPOSITE_SAVE_RECIPE;
    await db.islands.put(corrupt);
    await assert.rejects(openCompositeTrial(db)); assert.deepEqual(await db.islands.get(COMPOSITE_PROFILE), corrupt);
    await db.islands.put(beforeCorruption);
    const foreign = { ...structuredClone(record), profileId: 'foreign-owner' };
    await db.islands.delete(COMPOSITE_PROFILE); await db.islands.put(foreign);
    await assert.rejects(openCompositeTrial(db)); assert.equal(await db.islands.count(), 1); assert.equal(await db.islands.get(COMPOSITE_PROFILE), undefined);
    results.push({ name: 'bad recipe and foreign-key record reject without fixture substitution' });
    console.log(JSON.stringify({ at: new Date().toISOString(), status: 'PASS', database: COMPOSITE_DATABASE, recipe: COMPOSITE_SAVE_RECIPE,
        scope: 'Fake IndexedDB actual production transaction/read/observe dependencies under the trial transform; no browser or release claim', results }, null, 2));
} finally { db.close(); await db.delete(); }
