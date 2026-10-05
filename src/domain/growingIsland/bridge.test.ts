import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { applyIntent } from './commands';
import { newIsland } from './island';
import { GrowingIslandDatabase, commandGrowingIsland } from './repository';
import { HOME_CELL, bridgeAnchor, bridgeEnd, bridgeSite, key, landBounds, occupant, walkableCells } from './space';
import { walkRoute } from '../../components/island/growing/walkers';
import type { GrowingState } from './types';

const databases: GrowingIslandDatabase[] = [];
afterEach(async () => { await Promise.all(databases.splice(0).map(db => db.delete())); });
const island = (id = 'child') => {
    const state = newIsland(id, 1_000);
    state.villagers.push({ id: 'friend', species: 'rabbit', variant: { color: 0, accessory: 0, sparkle: false }, trait: 'lively', home: 'pokomoko', arrivedAt: 0 });
    return state;
};
const intent = (state: GrowingState, id: string, command: Parameters<typeof applyIntent>[1]['command']) => applyIntent(state, { id, command }).state;

describe('saved lookout bridge', () => {
    it('adds a real connected walk to the lookout, protects its shore, and removes cleanly', () => {
        const original = island();
        expect(original.bridge).toBeUndefined();
        const x = bridgeSite(original)!;
        const built = intent(original, 'build', { type: 'bridge-build', x });
        expect(original.bridge).toBeUndefined();
        expect(built.bridge).toEqual({ x });
        const route = walkRoute(walkableCells(built), HOME_CELL, bridgeEnd(built));
        expect(route?.map(key)).toContain(key({ x, z: landBounds(built).depth }));
        expect(route?.at(-1)).toEqual(bridgeEnd(built));
        expect(occupant(built, bridgeAnchor(built))).toEqual({ type: 'bridge' });
        expect(() => intent(built, 'place', { type: 'place', kind: 'flower', cell: bridgeAnchor(built) })).toThrow('ものが ある');
        expect(intent(built, 'build', { type: 'bridge-build', x })).toEqual(built);
        expect(() => intent(built, 'other-build', { type: 'bridge-build', x })).toThrow('もう ある');
        const removed = intent(built, 'remove', { type: 'bridge-remove' });
        expect(removed.bridge).toBeUndefined();
        expect(walkRoute(walkableCells(removed), HOME_CELL, bridgeEnd(built))).toBeUndefined();
        expect(intent(removed, 'remove', { type: 'bridge-remove' })).toEqual(removed);
    });

    it('requires a resident and an open reachable shore, and carries the bridge to expanded land', () => {
        const empty = newIsland('empty', 1_000);
        expect(() => intent(empty, 'too-early', { type: 'bridge-build', x: 2 })).toThrow('なかま');
        let state = island();
        state.landmarks.push({ id: 'shore-object', kind: 'bench', cell: { x: 2, z: 4 }, growth: 0 });
        expect(() => intent(state, 'collision', { type: 'bridge-build', x: 2 })).toThrow('ばしょ');
        expect(bridgeSite(state)).not.toBe(2);
        state.landmarks.pop();
        state = intent(state, 'build', { type: 'bridge-build', x: 2 });
        state.land = { expanded: 'west', extra: ['east'], capes: [] };
        state.drops = 1000;
        const expanded = intent(state, 'expand', { type: 'expand', side: 'south' });
        expect(expanded.bridge).toEqual({ x: 2 });
        expect(bridgeAnchor(expanded).z).toBe(7);
        expect(walkRoute(walkableCells(expanded), HOME_CELL, bridgeEnd(expanded))?.at(-1)).toEqual({ x: 2, z: 9 });
    });

    it('rejects later furniture that would cut off the saved bridge', () => {
        let state = intent(island(), 'build', { type: 'bridge-build', x: 2 });
        state.drops = 100;
        state = intent(state, 'left', { type: 'place', kind: 'bench', cell: { x: 1, z: 4 } });
        state = intent(state, 'right', { type: 'place', kind: 'bench', cell: { x: 3, z: 4 } });
        expect(() => intent(state, 'last-gap', { type: 'place', kind: 'bench', cell: { x: 2, z: 3 } })).toThrow('はしまで');
        expect(walkRoute(walkableCells(state), HOME_CELL, bridgeEnd(state))).toBeDefined();
    });

    it('persists independently for two profiles and survives reopening an old optional-field record', async () => {
        const db = new GrowingIslandDatabase(`bridge-test-${crypto.randomUUID()}`); databases.push(db);
        for (const id of ['one', 'two']) await db.islands.put({ profileId: id, version: 3, revision: 0, createdAt: 1_000, updatedAt: 1_000, state: island(id) });
        const before = await db.islands.get('one');
        expect(before?.state.bridge).toBeUndefined();
        await commandGrowingIsland('one', { id: 'build-once', command: { type: 'bridge-build', x: 2 } }, 2_000, db);
        db.close(); await db.open();
        expect((await db.islands.get('one'))?.state.bridge).toEqual({ x: 2 });
        expect((await db.islands.get('two'))?.state.bridge).toBeUndefined();
        const again = await commandGrowingIsland('one', { id: 'build-once', command: { type: 'bridge-build', x: 2 } }, 3_000, db);
        expect(again.record.revision).toBe(1);
        await commandGrowingIsland('one', { id: 'remove', command: { type: 'bridge-remove' } }, 4_000, db);
        expect((await db.islands.get('one'))?.state.bridge).toBeUndefined();
        expect((await db.islands.get('two'))?.state.villagers).toHaveLength(1);
    });
});
