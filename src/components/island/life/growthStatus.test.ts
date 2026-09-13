import { HOUR } from '../../../domain/islandLife/model';
import { ECONOMY_V3_VERSION } from '../../../domain/islandLife/economyRules';
import { describe, expect, it } from 'vitest';
import { LIFE_RULES } from '../../../domain/islandLife/model';
import { lifeGrowthStatus } from './growthStatus';

describe('lifeGrowthStatus', () => {
    it('shows the first flower stage and time to the bud', () => {
        const status = lifeGrowthStatus({ kind: 'flower', growth: .5, cell: { x: 0, z: 2 } });
        expect(status).toMatchObject({ stage: 0, label: 'めが でた', nextLabel: 'つぼみ', remainingHours: 2, progress: .5 / LIFE_RULES.bloomHours });
    });

    it('shows the bloom countdown and caps a mature flower', () => {
        expect(lifeGrowthStatus({ kind: 'flower', growth: LIFE_RULES.budHours, cell: { x: 0, z: 2 } })).toMatchObject({ stage: 1, nextLabel: 'さいた', remainingHours: 4 });
        expect(lifeGrowthStatus({ kind: 'flower', growth: LIFE_RULES.bloomHours + 4, cell: { x: 0, z: 2 } })).toMatchObject({ stage: 2, label: 'さいた', progress: 1 });
    });

    it('does not promise time growth for stored flowers or fixed furniture', () => {
        expect(lifeGrowthStatus({ kind: 'flower', growth: 0, cell: undefined }).remainingHours).toBeUndefined();
        expect(lifeGrowthStatus({ kind: 'bench', growth: 0, cell: { x: 0, z: 2 } })).toMatchObject({ stage: 2, label: 'おいてある', progress: 1 });
    });
    it('shows real elapsed hours including rolling learning expiry for migrated worlds', () => {
        const state = { now: 20 * HOUR, economy: { version: ECONOMY_V3_VERSION, completionTimes: Array(6).fill(0) as number[], lightRemainingBudget: 0 } };
        expect(lifeGrowthStatus({ kind: 'flower', growth: 2, cell: { x: 0, z: 2 } }, state).remainingHours).toBe(4);
        state.now = 23 * HOUR;
        expect(lifeGrowthStatus({ kind: 'flower', growth: 2, cell: { x: 0, z: 2 } }, state).remainingHours).toBe(7);
        state.economy.completionTimes = [];
        expect(lifeGrowthStatus({ kind: 'flower', growth: 0, cell: { x: 0, z: 2 } }, state).remainingHours).toBe(4);
        expect(lifeGrowthStatus({ kind: 'flower', growth: 0, cell: undefined }, state).remainingHours).toBeUndefined();
    });

});
