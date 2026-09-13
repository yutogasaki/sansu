import { describe, it, expect } from 'vitest';
import { newLife, learningDay, HOUR, type LifeState } from './model';
import { prepareEconomyMigration } from './economyMigration';
import { prepareTourMigration } from './tourMigration';
import { commandLife, replayLife, advanceLifeState } from './simulation';
import { route, vacant, pathToActivity } from './space';
import { evaluateDiscovery } from './discovery';
async function source() {
    const old = newLife('wind-arch', 0); old.credits = Array.from({ length: 40 }, (_, i) => ({ id: `c${i}`, at: 0, day: learningDay(0) }));
    return prepareTourMigration(await prepareEconomyMigration(old, []));
}
describe('wind and arch ownership, occupied land and passable ground', () => {
    it('preserves land, picnic and plant receipts across version 8 and rejects tampering or downgrade', async () => {
        let record = commandLife(await source(), { type: 'expand', side: 'east' }, 'land', 0);
        record = commandLife(record, { type: 'buy', kind: 'picnic-table', cell: { x: 4, z: 2 } }, 'table', 0);
        record = commandLife(record, { type: 'buy', kind: 'sapling', cell: { x: 5, z: 2 } }, 'tree', 0);
        const old = structuredClone(record.actions);
        for (const [kind, x] of [['pinwheel', 0], ['flower-arch', 1]] as const) record = commandLife(record, { type: 'buy', kind, cell: { x, z: 2 } }, kind, 0);
        expect(record.version).toBe(8); expect(record.actions.slice(0, 3)).toEqual(old); expect(replayLife(record).drops).toBe(32);
        expect(record.actions.slice(3).every(a => a.purchaseReceipt?.priceVersion === 'life-v3-wind-arch-v1' && a.purchaseReceipt.actualPaidDrops === 12)).toBe(true);
        expect(() => replayLife({ ...record, version: 7 })).toThrow();
        const missing = structuredClone(record); delete missing.actions[3].purchaseReceipt; expect(() => replayLife(missing)).toThrow();
        const wrong = structuredClone(record); wrong.actions[4].purchaseReceipt!.actualPaidDrops = 2; expect(() => replayLife(wrong)).toThrow();
        expect(commandLife(record, { type: 'buy', kind: 'pinwheel', cell: { x: 0, z: 2 } }, 'pinwheel', 10)).toBe(record);
        expect(replayLife(commandLife(record, { type: 'remove', itemId: 'pinwheel' }, 'remove', 0)).drops).toBe(38);
    });
    it('reserves the arch cell for placement while all four cardinal walking lines remain open', async () => {
        const state = replayLife(commandLife(await source(), { type: 'buy', kind: 'flower-arch', cell: { x: 2, z: 2 } }, 'arch', 0));
        expect(vacant(state, { x: 2, z: 2 })).toBe(false);
        for (const [from, to] of [[{ x: 1, z: 2 }, { x: 3, z: 2 }], [{ x: 2, z: 1 }, { x: 2, z: 3 }]]) {
            expect(route(state, from, to)).toEqual([from, { x: 2, z: 2 }, to]); expect(route(state, to, from)).toEqual([to, { x: 2, z: 2 }, from]);
        }
        const path = pathToActivity(state, { x: 1, z: 2 }, state.items[0])!;
        expect(path).toContainEqual({ x: 2, z: 2 }); expect(path.at(-1)).not.toEqual({ x: 2, z: 2 });
        expect(evaluateDiscovery(state, 'p')).toEqual([]);
    });
    it('passes through once, pays no use reward, and keeps split replay deterministic', async () => {
        const record = commandLife(await source(), { type: 'buy', kind: 'flower-arch', cell: { x: 1, z: 2 } }, 'arch', 0);
        const start = replayLife(record), users = start.residents.filter(r => r.visit?.itemId === 'arch'); expect(users).toHaveLength(1);
        const end = users[0].visit!.end, after = replayLife(record, end + 100);
        expect(after.residents.find(r => r.id === users[0].id)?.archCooldownUntil).toBeGreaterThan(end);
        expect(after.light).toBe(start.light); expect(after.residents.every(r => r.enjoyed === 0)).toBe(true);
        const split = replayLife(record); for (const at of [1000, end + 100, HOUR, 3 * HOUR]) advanceLifeState(split, at);
        expect(split).toEqual(replayLife(record, 3 * HOUR));
    });
    it('treats a pinwheel as scenery with no occupied activity slot', async () => {
        const record = commandLife(await source(), { type: 'buy', kind: 'pinwheel', cell: { x: 1, z: 2 } }, 'wind', 0);
        const state: LifeState = replayLife(record, HOUR);
        expect(state.residents.some(r => r.visit?.itemId === 'wind')).toBe(false); expect(state.light).toBe(0);
        expect(() => commandLife(record, { type: 'visit', itemId: 'wind' }, 'visit', HOUR)).toThrow();
        expect(evaluateDiscovery(state, 'p')).toEqual([]);
    });
});
