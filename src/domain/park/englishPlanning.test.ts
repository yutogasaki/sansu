import { describe, expect, it } from 'vitest';
import type { AttemptLog } from '../../db';
import { createInitialProfile, syncLevelState } from '../user/profile';
import { ENGLISH_WORDS, getWordLevel } from '../english/words';
import { planParkLearning } from './learning';

const now = new Date(2026, 8, 8, 12).getTime();
const profile = () => ({ ...syncLevelState(createInitialProfile('T', 1, 1, 1, 'vocab'), 'vocab', 2), vocabMainLevel: 1 });
const memory = (id: string, correctAnswers = 5) => ({ id, strength: 2, totalAnswers: 5, correctAnswers, independentCorrectAnswers: correctAnswers,
    incorrectAnswers: 5 - correctAnswers, skippedAnswers: 0, nextReview: '2099-01-01', updatedAt: '2026-01-01', isWeak: false });

describe('Park and Island English reservations', () => {
    it('keeps a fixed seeded reservation including rendered choices', () => {
        const p = profile();
        const first = planParkLearning(p, [], [], [], 0, 'same-reservation', now);
        expect(planParkLearning(p, [], [], [], 0, 'same-reservation', now)).toEqual(first);
    });

    it.each([[3, 2], [3, 3], [6, 3], [6, 6]])('keeps the challenge cap after a %s/%s section shortens and can introduce next-level words', (standardCount, complexCount) => {
        const p = profile();
        const seen = new Set<string>();
        for (let sequence = 0; sequence < 100; sequence += 1) {
            const result = planParkLearning(p, [], [], [], sequence, `reservation:${sequence}`, now, { standardCount, complexCount });
            expect(result.slots).toHaveLength(complexCount);
            const plus = result.slots.filter(slot => slot.source === 'plus-one');
            expect(plus.length).toBeLessThanOrEqual(1);
            plus.forEach(slot => {
                expect(getWordLevel(slot.problem.categoryId)).toBe(2);
                seen.add(slot.problem.categoryId);
            });
        }
        expect(seen.size).toBeGreaterThan(10);
    });

    it('hydrates independent success from stored memory, avoiding already successful words', () => {
        const p = profile();
        p.vocabMaxUnlocked = 1;
        const records = ENGLISH_WORDS.filter(word => word.level === 1).map(word => memory(word.id, ['apple', 'banana', 'orange'].includes(word.id) ? 0 : 5));
        const result = planParkLearning(p, [], records, [], 0, 'hydrated', now, { standardCount: 3, complexCount: 3 });
        expect(new Set(result.slots.map(slot => slot.problem.categoryId))).toEqual(new Set(['apple', 'banana', 'orange']));
    });

    it('filters disabled, unknown and three-skips-today IDs without losing Due cursor rotation', () => {
        const p = profile();
        p.vocabLevels = p.vocabLevels?.map(level => level.level === 2 ? { ...level, enabled: false } : level);
        const due = ['gone', 'head', 'apple', 'orange', 'banana'].map(id => ({ ...memory(id), nextReview: '2000-01-01' }));
        const logs: AttemptLog[] = Array.from({ length: 3 }, () => ({ profileId: p.id, itemId: 'orange', subject: 'vocab', result: 'skipped', timestamp: new Date(now).toISOString() }));
        const result = planParkLearning(p, [], due, logs, 0, 'guarded', now, { vocabDueAfterId: 'apple' });
        expect(result.slots[0].problem.categoryId).toBe('banana');
        expect(result.slots.every(slot => getWordLevel(slot.problem.categoryId) === 1 && slot.problem.categoryId !== 'orange')).toBe(true);
    });
});
