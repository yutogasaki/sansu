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
import { ASSEMBLY_DATABASE, ASSEMBLY_PROFILE, ASSEMBLY_SAVE_RECIPE, assemblyInitialRecord, openAssemblyTrial, type SavedAssemblyState } from './assembly-store';
const db = new GrowingIslandDatabase(ASSEMBLY_DATABASE), results: { name: string; detail?: unknown }[] = [];
const west: PlaceShape = { center: { x: -1, z: 4 }, radius: 1.6, height: .5, entrance: 1.2, flatRadius: 1.75 };
const east: PlaceShape = { center: { x: 5, z: 5 }, radius: 1.6, height: .9, entrance: 1.2, flatRadius: 1.75, rampDirection: 'west' };
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const read = async () => (await readGrowingIsland(ASSEMBLY_PROFILE, db))!;
const intent = (record: GrowingRecord, id: string, action: 'apply' | 'undo' | 'redo', shape?: PlaceShape): Intent => ({ id, islandId: 'main',
    command: { type: 'place-set', action, slot: 'west', shape, safety: { actors: [], occupiedPlaceTargets: [] }, expectedPlaceRevision: compositeEditingRevision(record.state) } });
async function send(id: string, command: Command) { return (await commandGrowingIsland(ASSEMBLY_PROFILE, { id, islandId: 'main', command }, 1000, db)).record; }
async function place(id: string, action: 'apply' | 'undo' | 'redo', shape?: PlaceShape) {
    const before = await read(); return (await commandGrowingIsland(ASSEMBLY_PROFILE, intent(before, id, action, shape), 1000, db)).record;
}
function nonShapes(state: GrowingState) {
    const copy = structuredClone(state) as SavedAssemblyState;
    delete copy.trialPlaceSet; delete copy.trialPlaceSetHistory; copy.applied = [];
    return copy;
}
function geometry(state: GrowingState) {
    const world = editableIslandWorld(state)!, open = walkableCells(state, world);
    return { floor: sha(world.floors), routes: sha(landCells(state).map(cell => world.route(HOME_CELL, cell, open) ?? null)) };
}
try {
    const initial = await openAssemblyTrial(db, 1000);
    assert.deepEqual(initial, assemblyInitialRecord()); assert.deepEqual(await openAssemblyTrial(db, 2000), initial);
    let record = await place('saved-west', 'apply', west);
    const eastCommand = intent(record, 'saved-east', 'apply', east);
    if (eastCommand.command.type === 'place-set') eastCommand.command.slot = 'east';
    record = (await commandGrowingIsland(ASSEMBLY_PROFILE, eastCommand, 1000, db)).record;
    const bayCommand = intent(record, 'saved-bay', 'apply', { center: { x: -1, z: 7 }, radius: 2, height: -.55, entrance: 1.2, bayDepth: 1.6 });
    if (bayCommand.command.type === 'place-set') bayCommand.command.slot = 'bay';
    record = (await commandGrowingIsland(ASSEMBLY_PROFILE, bayCommand, 1000, db)).record;
    record = await place('saved-west-small', 'apply', { ...west, radius: 1.2 });
    for (const [id, cell] of [['starter-bench', { x: -1, z: 4 }], ['starter-flower', { x: 0, z: 4 }]] as const)
        record = await send(`saved-move-${id}`, { type: 'move', id, cell });
    for (const [kind, cell] of [['bench', { x: 5, z: 5 }], ['flower', { x: 6, z: 5 }]] as const)
        record = await send(`saved-buy-${kind}`, { type: 'place', kind, cell });
    assert.equal(record.state.drops, initial.state.drops - 30);
    const stable = nonShapes(record.state), shape = structuredClone(compositeOf(record.state)), beforeGeometry = geometry(record.state);
    db.close(); await db.open(); assert.deepEqual(await openAssemblyTrial(db, 5000), record);
    assert.deepEqual(geometry((await read()).state), beforeGeometry);
    results.push({ name: 'two platforms, a deep bay and later ordinary moves/purchases survive actual writer close/reopen', detail: { drops: record.state.drops, geometry: beforeGeometry, owners: record.state.landmarks } });
    record = await place('saved-undo', 'undo'); assert.deepEqual(compositeOf(record.state)!.west, west);
    assert.deepEqual(compositeOf(record.state)!.east, east); assert.deepEqual(nonShapes(record.state), stable);
    db.close(); await db.open(); assert.deepEqual(await openAssemblyTrial(db), record);
    record = await place('saved-redo', 'redo'); assert.deepEqual(compositeOf(record.state), shape); assert.deepEqual(nonShapes(record.state), stable);
    assert.deepEqual(geometry(record.state), beforeGeometry);
    results.push({ name: 'reopened Undo/Redo changes only shapes, preserving purchases, wallet, clocks, progress and owners' });

    const duplicate = intent(record, 'saved-duplicate', 'apply', west);
    record = (await commandGrowingIsland(ASSEMBLY_PROFILE, duplicate, 1000, db)).record;
    assert.deepEqual((await commandGrowingIsland(ASSEMBLY_PROFILE, duplicate, 1000, db)).record, record);
    const stale = intent(record, 'saved-stale', 'apply', { ...west, radius: 1.2 });
    await place('saved-advance', 'apply', { ...west, entrance: 1.3 });
    await assert.rejects(commandGrowingIsland(ASSEMBLY_PROFILE, stale, 1000, db), /かわった/);
    const beforeRace = await read();
    const race = await Promise.allSettled([
        commandGrowingIsland(ASSEMBLY_PROFILE, intent(beforeRace, 'saved-race-a', 'apply', west), 1000, db),
        commandGrowingIsland(ASSEMBLY_PROFILE, intent(beforeRace, 'saved-race-b', 'apply', { ...west, radius: 1.2 }), 1000, db),
    ]);
    assert.equal(race.filter(result => result.status === 'fulfilled').length, 1);
    results.push({ name: 'duplicate intent is idempotent; stale cursor rejects; concurrent same-cursor edits commit once' });

    const beforeFailure = await read(), failureIntent = intent(beforeFailure, 'saved-retry', 'apply', { ...west, entrance: 1.4 });
    const failWrite = () => { throw Error('composite diagnostic disk-full'); };
    db.islands.hook('updating', failWrite);
    try { await assert.rejects(commandGrowingIsland(ASSEMBLY_PROFILE, failureIntent, 1000, db), /disk-full/); }
    finally { db.islands.hook('updating').unsubscribe(failWrite); }
    assert.deepEqual(await read(), beforeFailure);
    record = (await commandGrowingIsland(ASSEMBLY_PROFILE, failureIntent, 1000, db)).record;
    assert.equal(record.revision, beforeFailure.revision + 1);
    results.push({ name: 'actual writer failure rolls back every saved byte; same intent retries once' });

    const beforeDepth = await read();
    const deep = intent(beforeDepth, 'saved-deeper-bay', 'apply', { ...compositeOf(beforeDepth.state)!.bay!, bayDepth: 2.4 });
    if (deep.command.type === 'place-set') deep.command.slot = 'bay';
    const deeper = (await commandGrowingIsland(ASSEMBLY_PROFILE, deep, 1000, db)).record;
    db.close(); await db.open(); assert.deepEqual(await openAssemblyTrial(db), deeper);
    assert.equal(compositeOf(deeper.state)!.bay!.bayDepth, 2.4);
    const depthUndo = await place('saved-depth-undo', 'undo');
    assert.deepEqual(compositeOf(depthUndo.state), compositeOf(beforeDepth.state));
    db.close(); await db.open(); await openAssemblyTrial(db);
    record = await place('saved-depth-redo', 'redo');
    assert.deepEqual(compositeOf(record.state), compositeOf(deeper.state));
    assert.deepEqual(geometry(record.state), geometry(deeper.state));
    assert.deepEqual(nonShapes(record.state), nonShapes(beforeDepth.state));
    results.push({ name: 'bay depth survives reload and reopened Undo/Redo, without changing owners or wallet' });
    const untouched = await read(), badDepth = intent(untouched, 'bad-depth', 'apply', { ...compositeOf(untouched.state)!.bay!, bayDepth: 5 });
    if (badDepth.command.type === 'place-set') badDepth.command.slot = 'bay';
    await assert.rejects(commandGrowingIsland(ASSEMBLY_PROFILE, badDepth, 1000, db));
    assert.deepEqual(await read(), untouched);
    const otherDb = new GrowingIslandDatabase('AssemblyDiagnosticForeignDb');
    try {
        await assert.rejects(openAssemblyTrial(otherDb));
        await assert.rejects(readGrowingIsland(ASSEMBLY_PROFILE, otherDb));
        await assert.rejects(commandGrowingIsland(ASSEMBLY_PROFILE, intent(untouched, 'wrong-db', 'apply', west), 1000, otherDb));
        assert.equal(otherDb.isOpen(), false);
    } finally { otherDb.close(); }
    await assert.rejects(readGrowingIsland('other-profile', db));
    results.push({ name: 'invalid bay depth and foreign DB/profile reject before mutation or foreign DB open' });

    const beforeCorruption = structuredClone(record), corrupt = structuredClone(record);
    (corrupt.state as SavedAssemblyState).trialPlaceSetRecipe = 'unknown' as typeof ASSEMBLY_SAVE_RECIPE;
    await db.islands.put(corrupt);
    await assert.rejects(openAssemblyTrial(db)); assert.deepEqual(await db.islands.get(ASSEMBLY_PROFILE), corrupt);
    await db.islands.put(beforeCorruption);
    const foreign = { ...structuredClone(record), profileId: 'foreign-owner' };
    await db.islands.delete(ASSEMBLY_PROFILE); await db.islands.put(foreign);
    await assert.rejects(openAssemblyTrial(db)); assert.equal(await db.islands.count(), 1); assert.equal(await db.islands.get(ASSEMBLY_PROFILE), undefined);
    results.push({ name: 'bad recipe and foreign-key record reject without fixture substitution' });
    console.log(JSON.stringify({ at: new Date().toISOString(), status: 'PASS', database: ASSEMBLY_DATABASE, recipe: ASSEMBLY_SAVE_RECIPE,
        scope: 'Fake IndexedDB actual production transaction/read/observe dependencies under the trial transform; no browser or release claim', results }, null, 2));
} finally { db.close(); await db.delete(); }
