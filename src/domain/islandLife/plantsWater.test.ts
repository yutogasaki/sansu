import { describe, expect, it } from 'vitest';
import { HOUR, growthStage, learningDay, newLife } from './model';
import { commandLife, replayLife } from './simulation';
import { prepareEconomyMigration } from './economyMigration';
import { prepareTourMigration } from './tourMigration';
import { evaluateDiscovery, plantGatherings } from './discovery';
import { createDiscoveryScene } from './discoveryJournal';
import { discoveryTitle } from './discoveryRecall';
import { lifeGrowthStatus } from '../../components/island/life/growthStatus';
async function source() {
    const old = newLife('plants', 0); old.credits = Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, at: 0, day: learningDay(0) }));
    return prepareTourMigration(await prepareEconomyMigration(old, []));
}
describe('plants and water additions preserve the existing economy', () => {
    it('requires receipts for the two new goods, upgrades the reader boundary and keeps old receipts verbatim', async () => {
        let record = await source(); record = commandLife(record, { type: 'buy', kind: 'flower', cell: { x: 0, z: 2 } }, 'flower', 0);
        const before = structuredClone(record.actions[0]);
        for (const [kind, x] of [['sapling', 1], ['water-bowl', 2]] as const) record = commandLife(record, { type: 'buy', kind, cell: { x, z: 2 } }, kind, 0);
        expect(record.version).toBe(6); expect(record.actions[0]).toEqual(before);
        expect(record.actions.slice(1).map(a => a.purchaseReceipt?.actualPaidDrops)).toEqual([4, 4]);
        expect(replayLife(record).drops).toBe(30);
        expect(commandLife(record, { type: 'buy', kind: 'sapling', cell: { x: 1, z: 2 } }, 'sapling', 1)).toBe(record);
        expect(() => replayLife({ ...record, version: 5 })).toThrow();
        const missing = structuredClone(record); delete missing.actions[1].purchaseReceipt;
        expect(() => replayLife(missing)).toThrow();
        const wrong = structuredClone(record); wrong.actions[1].purchaseReceipt!.actualPaidDrops = 2;
        expect(() => replayLife(wrong)).toThrow();
        record = commandLife(record, { type: 'remove', itemId: 'sapling' }, 'remove', 0);
        expect(replayLife(record).drops).toBe(32);
    });
    it('uses 6/18 effective hours for trees, stops in storage and preserves refresh partitions', async () => {
        const bought = commandLife(await source(), { type: 'buy', kind: 'sapling', cell: { x: 0, z: 2 } }, 'tree', 0);
        expect(growthStage(replayLife(bought, 5 * HOUR).items[0])).toBe(0);
        expect(growthStage(replayLife(bought, 6 * HOUR).items[0])).toBe(1);
        expect(growthStage(replayLife(bought, 18 * HOUR).items[0])).toBe(2);
        const stored = commandLife(bought, { type: 'store', itemId: 'tree' }, 'store', 3 * HOUR);
        expect(replayLife(stored, 30 * HOUR).items[0].growth).toBe(3);
        const restored = commandLife(stored, { type: 'move', itemId: 'tree', cell: { x: 1, z: 2 } }, 'restore', 30 * HOUR);
        expect(replayLife(restored, 36 * HOUR).items[0].growth).toBe(6);
        const { advanceLifeState } = await import('./simulation'); const state = replayLife(bought, HOUR);
        for (const hour of [2, 7, 12, 19]) advanceLifeState(state, hour * HOUR);
        expect(state).toEqual(replayLife(bought, 19 * HOUR));
    });
    it('forecasts slow growth across the 24h expiry and does not count furniture as plants', async () => {
        const record = commandLife(await source(), { type: 'buy', kind: 'sapling', cell: { x: 0, z: 2 } }, 'tree', 20 * HOUR);
        const state = replayLife(record);
        expect(lifeGrowthStatus(state.items[0], state).remainingHours).toBe(8);
        expect(growthStage(replayLife(record, 28 * HOUR).items[0])).toBe(1);
        expect(lifeGrowthStatus({ kind: 'water-bowl', growth: 0 }).progress).toBe(1);
    });
    it('names mature tree magic as leaves rather than flower petals', async () => {
        const record = commandLife(await source(), { type: 'buy', kind: 'sapling', cell: { x: 0, z: 2 } }, 'tree', 0);
        const state = replayLife(record, 18 * HOUR), rule = evaluateDiscovery(state, 'plants').find(r => r.ruleId === 'M2')!;
        const event = await createDiscoveryScene('plants', state, rule, 'current-context-test', 'tree-magic', 18 * HOUR);
        expect(discoveryTitle(event)).toBe('はっぱが うえへ');
    });
    it('groups only matching plant families and permits leaf magic on each tree', async () => {
        let record = await source();
        for (const [id, kind, cell] of [
            ['t0', 'sapling', { x: 0, z: 2 }], ['t1', 'sapling', { x: 1, z: 2 }], ['f', 'flower', { x: 2, z: 2 }],
        ] as const) record = commandLife(record, { type: 'buy', kind, cell }, id, 0);
        expect(plantGatherings(replayLife(record))).toEqual([]);
        record = commandLife(record, { type: 'buy', kind: 'sapling', cell: { x: 0, z: 3 } }, 't2', 0);
        const state = replayLife(record), rules = evaluateDiscovery(state, 'plants');
        expect(plantGatherings(state)[0].map(i => i.kind)).toEqual(['sapling', 'sapling', 'sapling']);
        expect(rules.find(r => r.ruleId === 'G0')?.participantIds).toHaveLength(3);
        expect(rules.filter(r => r.ruleId === 'M2')).toHaveLength(4);
        expect(rules.some(r => r.ruleId === 'GF3')).toBe(false);
    });
});
