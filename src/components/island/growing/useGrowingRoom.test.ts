import { describe, expect, it } from 'vitest';
import { todayLearned } from './useGrowingRoom';

describe("Pokomoko's desk", () => {
    it('lists what was answered on the child\'s own today, math skills first', () => {
        const now = new Date(2026, 9, 1, 18);
        const today = new Date(2026, 9, 1, 9).toISOString(), yesterday = new Date(2026, 8, 30, 9).toISOString();
        expect(todayLearned({ apple: { strength: 2, lastIndependentCorrectAt: today }, dog: { strength: 3, lastIndependentCorrectAt: yesterday } },
            { add_5: { strength: 2, lastIndependentCorrectAt: today } }, now)).toEqual(['5までのたしざん', 'apple']);
    });
});
