import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { IslandLifeDatabase } from '../islandLife/repository';
import { landQuote } from './commands';
import { legacyIslandWorld } from './legacyWorldDefinition';
import { GrowingIslandDatabase, commandGrowingIsland, readGrowingIsland, syncGrowingIsland } from './repository';
import { landBounds, landCells } from './space';

const T0 = Date.UTC(2026, 9, 15);
const stores: (GrowingIslandDatabase | IslandLifeDatabase)[] = [];
afterEach(async () => { await Promise.all(stores.splice(0).map(db => db.delete())); });

describe('S-001 learning, land purchase and reloading', () => {
    it.each(['east', 'west'] as const)('buys the first %s expansion after 60 completions and retains selectable ground on reload', async side => {
        const db = new GrowingIslandDatabase(`S-001-${crypto.randomUUID()}`);
        const old = new IslandLifeDatabase(`S-001-life-${crypto.randomUUID()}`);
        stores.push(db, old);
        await syncGrowingIsland('child', [], T0, db, old);
        const facts = Array.from({ length: 60 }, (_, i) => ({ id: `completion-${i}`, at: T0 + i + 1 }));
        const short = await syncGrowingIsland('child', facts.slice(0, 59), T0 + 60, db, old);
        expect(short.record.state.drops).toBe(118);
        expect(landQuote(short.record.state)).toEqual({ step: 1, sides: ['west', 'east'], price: 120 });
        const intent = { id: 'first-expansion', command: { type: 'expand' as const, side } };
        await expect(commandGrowingIsland('child', intent, T0 + 60, db)).rejects.toThrow('しずく');
        expect(await db.islands.get('child')).toEqual(short.record);

        const ready = await syncGrowingIsland('child', facts, T0 + 61, db, old);
        expect(ready.record.state.drops).toBe(120);
        // Learning provides materials; land is acquired only by an explicit purchase.
        expect(landCells(ready.record.state)).toHaveLength(30);
        const bought = await commandGrowingIsland('child', intent, T0 + 62, db);
        expect(bought.record.state.drops).toBe(0);
        expect(landCells(bought.record.state)).toHaveLength(45);
        db.close(); await db.open();
        const loaded = (await readGrowingIsland('child', db))!;
        expect(loaded).toEqual(bought.record);
        const outer = { x: side === 'east' ? 8 : -3, z: 2 };
        for (const curved of [false, true]) {
            const world = legacyIslandWorld(loaded.state, curved);
            expect(world.owns(outer)).toBe(true);
            const floor = world.floorAt(outer)!;
            expect(floor).toBeDefined();
            expect(world.siteAt(floor.point)?.cell).toEqual(outer);
        }
        // Re-synchronizing learning and retrying the same purchase cannot charge twice.
        const synced = await syncGrowingIsland('child', facts, T0 + 62, db, old);
        expect(synced.learned).toBe(0);
        expect(landBounds(synced.record.state)).toEqual(landBounds(loaded.state));
        const retry = await commandGrowingIsland('child', intent, T0 + 62, db);
        expect(retry.record.state.drops).toBe(0);
        expect(retry.record.state.land).toEqual(loaded.state.land);
    });
});
