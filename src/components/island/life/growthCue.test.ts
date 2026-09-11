import { describe, expect, it } from 'vitest';
import { growthSnapshot, growthTransitions } from './growthCue';

const flower = (id: string, growth: number, cell = { x: 0, z: 2 }) => ({ id, kind: 'flower' as const, growth, cell, style: 'original' as const });

describe('growthTransitions', () => {
    it('does not announce an initial or unchanged flower', () => {
        const item = flower('f', 0);
        expect(growthTransitions([item], undefined)).toEqual([]);
        expect(growthTransitions([item], growthSnapshot([item]))).toEqual([]);
    });

    it('announces each persisted stage advance once', () => {
        const before = flower('f', 0), bud = flower('f', 2), bloom = flower('f', 6);
        expect(growthTransitions([bud], growthSnapshot([before]))).toEqual([{ id: 'f', stage: 1, message: 'つぼみに なったよ' }]);
        expect(growthTransitions([bloom], growthSnapshot([bud]))).toEqual([{ id: 'f', stage: 2, message: 'さいたよ' }]);
    });

    it('ignores stored flowers, non-flowers, and a backwards correction', () => {
        const prior = { f: 1, b: 0 };
        expect(growthTransitions([flower('f', 2, undefined)], prior)).toEqual([]);
        expect(growthTransitions([{ id: 'b', kind: 'bench', growth: 0, cell: { x: 0, z: 2 }, style: 'original' }], prior)).toEqual([]);
        expect(growthTransitions([flower('f', 1)], prior)).toEqual([]);
    });
});
