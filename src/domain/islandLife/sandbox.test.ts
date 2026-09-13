import { describe, expect, it } from 'vitest';
import { HOUR, learningDay, newLife } from './model';
import { prepareEconomyMigration } from './economyMigration';
import { prepareTourMigration } from './tourMigration';
import { commandLife, replayLife, advanceLifeState } from './simulation';
import { evaluateDiscovery } from './discovery';
import { districts, pathToActivity } from './space';
import { planPlayTourDepartures, playTourMembers } from './playTours';
async function source() {
    const record = newLife('sandbox', 0); record.credits = Array.from({ length: 40 }, (_, i) => ({ id: `qa-${i}`, at: 0, day: learningDay(0) }));
    return prepareTourMigration(await prepareEconomyMigration(record, []));
}
describe('sandbox ownership and two-role activity', () => {
    it('keeps old receipts and land when adding version 9, rejects altered/missing/downgraded receipts and refunds nine', async () => {
        let record = commandLife(await source(), { type: 'buy', kind: 'pinwheel', cell: { x: 0, z: 2 } }, 'wind', 0);
        const old = structuredClone(record.actions); record = commandLife(record, { type: 'buy', kind: 'sandbox', cell: { x: 4, z: 2 } }, 'sand', 0);
        expect(record.version).toBe(9); expect(record.actions.slice(0, 1)).toEqual(old);
        expect(record.actions[1].purchaseReceipt).toMatchObject({ priceVersion: 'life-v3-sandbox-v1', actualPaidDrops: 18 });
        expect(commandLife(record, { type: 'buy', kind: 'sandbox', cell: { x: 4, z: 2 } }, 'sand', 1)).toBe(record);
        expect(() => replayLife({ ...record, version: 8 })).toThrow();
        const missing = structuredClone(record); delete missing.actions[1].purchaseReceipt; expect(() => replayLife(missing)).toThrow();
        const wrong = structuredClone(record); wrong.actions[1].purchaseReceipt!.actualPaidDrops = 1; expect(() => replayLife(wrong)).toThrow();
        record = commandLife(record, { type: 'expand', side: 'east' }, 'land', 0); expect(record.version).toBe(9); expect(replayLife(record).drops).toBe(38);
        expect(replayLife(commandLife(record, { type: 'remove', itemId: 'sand' }, 'remove', 0)).drops).toBe(47);
    });
    it('reserves two opposite approaches, lets only one use a one-sided placement, and replays split time identically', async () => {
        const record = commandLife(await source(), { type: 'buy', kind: 'sandbox', cell: { x: 4, z: 2 } }, 'sand', 0);
        const state = replayLife(record), users = state.residents.filter(r => r.visit?.itemId === 'sand');
        expect(users).toHaveLength(2); expect(new Set(users.map(r => r.visit!.path.at(-1)!.z)).size).toBe(2);
        expect(users.map(r => r.visit!.path.at(-1)!.z).sort()).toEqual([1, 3]);
        expect(pathToActivity(state, { x: 5, z: 2 }, state.items[0], users.map(r => r.visit!.path.at(-1)!))).toBeUndefined();
        const split = replayLife(record); for (const at of [5000, HOUR, 3 * HOUR]) advanceLifeState(split, at); expect(split).toEqual(replayLife(record, 3 * HOUR));
        const single = replayLife(commandLife(await source(), { type: 'buy', kind: 'sandbox', cell: { x: 4, z: 0 } }, 'single', 0));
        expect(single.residents.filter(r => r.visit?.itemId === 'single')).toHaveLength(1);
    });
    it('joins mixed GP2/GP3 and R3, and allows two different touring roles at a sandbox', async () => {
        let record = await source();
        for (const [kind, x] of [['sandbox', 0], ['swing', 1], ['swing', 2]] as const) record = commandLife(record, { type: 'buy', kind, cell: { x, z: 2 } }, `play-${x}`, 0);
        record = commandLife(record, { type: 'buy', kind: 'bench', cell: { x: 3, z: 3 } }, 'bench', 0);
        const split = replayLife(record); for (const at of [8000, 25000, HOUR, 3 * HOUR]) advanceLifeState(split, at);
        expect(split).toEqual(replayLife(record, 3 * HOUR));
        const state = replayLife(record);
        expect(districts(state).find(d => d.kind === 'play')!.ids).toHaveLength(3); expect(playTourMembers(state, 'play-0')).toHaveLength(3);
        expect(evaluateDiscovery(state, 'p').some(r => r.ruleId === 'GP3' && r.participantIds.includes('play-0'))).toBe(true);
        expect(evaluateDiscovery(state, 'p').some(r => r.ruleId === 'R3' && r.participantIds.includes('play-0'))).toBe(true);
        state.residents.forEach((r, i) => { r.visit = undefined; r.playTour = undefined; r.cell = { x: i, z: 3 }; });
        state.residents[2].visit = { itemId: 'play-1', from: { x: 1, z: 3 }, path: [{ x: 1, z: 3 }], start: 0, end: 10000 };
        const memberIds = playTourMembers(state, 'play-0')!;
        const planned = planPlayTourDepartures(state, state.residents.slice(0, 2).map(r => ({ residentId: r.id, cursor: { memberIds, lastItemId: 'play-2', visitedIds: ['play-1', 'play-2'] } })));
        expect(planned.departures).toHaveLength(2); expect(planned.departures.every(d => d.itemId === 'play-0')).toBe(true);
        expect(new Set(planned.departures.map(d => d.path.at(-1)!.z)).size).toBe(2);
    });
});
