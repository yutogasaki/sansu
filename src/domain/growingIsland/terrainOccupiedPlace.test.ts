import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { architectureFixture } from './placeArchitecture.fixture';
import { derivePlaces } from './places';
import { applyIntent } from './commands';
import { editableIslandWorld } from './editableTerrainWorld';
import { commandGrowingIsland, GrowingIslandDatabase } from './repository';
import { terrainEditingRevision, terrainFootingError } from './terrainEditing';
import type { GrowingState, OccupiedPlaceTarget, TerrainCommand } from './types';

const crossing = { x: 5, z: 6 };
function occupiedIsland() {
    const state = architectureFixture(); state.plots = [];
    state.landmarks = Array.from({ length: 5 }, (_, i) => ({ id: `tree-${i}`, kind: 'sapling', cell: { x: i + 7, z: 2 }, growth: 18, maturedAt: 0 }));
    // A raised dividing ridge has one traversable opening south of the gallery.
    // Raising that opening one step cuts home access without moving the deck.
    state.terrain = { version: 1, heights: Object.fromEntries(Array.from({ length: 8 }, (_, z) => [`5,${z}`, z === 6 ? 3 : 12])), undo: [], redo: [] };
    const place = derivePlaces(state).find(place => place.ruleId === 'P02')!;
    const target = place.useTargets.find(target => target.kind === 'gallery')!;
    expect(place.stage).toBe('grown'); expect(target.route!.length).toBeGreaterThan(30);
    const snapshot: OccupiedPlaceTarget = { placeId: place.id, targetId: target.id, route: structuredClone(target.route!) };
    return { state, snapshot };
}
const apply = (state: GrowingState, command: TerrainCommand) => applyIntent(state, { id: crypto.randomUUID(), command }, 0).state;
const stores: GrowingIslandDatabase[] = [];
afterEach(async () => { await Promise.all(stores.splice(0).map(db => db.delete())); });

describe('atomic protection of occupied elevated places', () => {
    it('rejects cutting external access even when every occupied deck point keeps the same floor', () => {
        const { state, snapshot } = occupiedIsland(), original = structuredClone(state);
        const cut = apply(state, { type: 'terrain-edit', cell: crossing, delta: 1 });
        expect(derivePlaces(cut).find(place => place.id === snapshot.placeId)?.stage).toBe('connected');
        const before = editableIslandWorld(state)!, after = editableIslandWorld(cut)!;
        for (const point of snapshot.route) expect(after.floorAt(point)?.point).toEqual(before.floorAt(point)?.point);
        const actor = snapshot.route[20];
        expect(terrainFootingError(state, cut, [actor])).toBeUndefined();
        expect(() => apply(state, { type: 'terrain-edit', cell: crossing, delta: 1, actors: [actor], occupiedPlaceTargets: [snapshot] })).toThrow('上で');
        expect(state).toEqual(original);
    });

    it('allows an unrelated edit while preserving the same elevated target and full XYZ route', () => {
        const { state, snapshot } = occupiedIsland();
        const next = apply(state, { type: 'terrain-edit', cell: { x: -2, z: 6 }, delta: 1, occupiedPlaceTargets: [snapshot] });
        const route = derivePlaces(next).find(place => place.id === snapshot.placeId)!.useTargets.find(target => target.id === snapshot.targetId)!.route;
        expect(route).toEqual(snapshot.route);
        expect(next.terrain!.heights['-2,6']).toBe(1);
    });

    it('protects undo and redo too, and rejects stale or malformed snapshots without changing history', () => {
        const { state, snapshot } = occupiedIsland();
        for (const type of ['terrain-undo', 'terrain-redo'] as const) {
            const current = structuredClone(state);
            const entry = type === 'terrain-undo' ? { cell: crossing, before: 4, after: 3 } : { cell: crossing, before: 3, after: 4 };
            current.terrain![type === 'terrain-undo' ? 'undo' : 'redo'] = [entry];
            const original = structuredClone(current);
            expect(() => apply(current, { type, occupiedPlaceTargets: [snapshot] })).toThrow('上で');
            expect(current).toEqual(original);
        }
        const changed = structuredClone(snapshot); changed.route[20].y += .01;
        expect(() => apply(state, { type: 'terrain-edit', cell: { x: -2, z: 6 }, delta: 1, occupiedPlaceTargets: [changed] })).toThrow('上で');
        const corrupt = structuredClone(snapshot); corrupt.route[0].x = Number.NaN;
        expect(() => apply(state, { type: 'terrain-edit', cell: { x: -2, z: 6 }, delta: 1, occupiedPlaceTargets: [corrupt] })).toThrow('たしかめて');
    });

    it('checks the occupied target inside the latest saved command transaction and retains the complete record on refusal', async () => {
        const { state, snapshot } = occupiedIsland();
        const db = new GrowingIslandDatabase(`occupied-terrain-${crypto.randomUUID()}`); stores.push(db);
        const record = { profileId: state.seed, version: 6 as const, revision: 8, createdAt: 0, updatedAt: 0, state };
        await db.islands.put(record);
        await expect(commandGrowingIsland(state.seed, { id: 'cut-under-used-gallery', command: {
            type: 'terrain-edit', cell: crossing, delta: 1, occupiedPlaceTargets: [snapshot], expectedTerrainRevision: terrainEditingRevision(state),
        } }, 1, db)).rejects.toThrow('上で');
        expect(await db.islands.get(state.seed)).toEqual(record);
        const accepted = await commandGrowingIsland(state.seed, { id: 'unrelated', command: {
            type: 'terrain-edit', cell: { x: -2, z: 6 }, delta: 1, occupiedPlaceTargets: [snapshot],
        } }, 1, db);
        expect(accepted.record.revision).toBe(9);
        expect(accepted.record.state.terrain!.heights['-2,6']).toBe(1);
    });
});
