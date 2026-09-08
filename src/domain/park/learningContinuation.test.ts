import { describe, expect, it } from 'vitest';
import { createInitialProfile } from '../user/profile';
import { getSkillsForLevel } from '../math/curriculum';
import { ENGLISH_WORDS } from '../english/words';
import type { MemoryState } from '../types';
import { planParkLearning } from './learning';

const memory = (id: string, due = false): MemoryState => ({ id, nextReview: due ? '2000-01-01' : '2099-01-01', strength: 1,
    totalAnswers: 1, correctAnswers: 1, independentCorrectAnswers: 1, incorrectAnswers: 0, skippedAnswers: 0, updatedAt: '2026-01-01' });

describe('short content continuation inside existing learning guards', () => {
    it.each(['math', 'vocab'] as const)('keeps %s Due first and includes a fresh normal problem for the continued main item', subject => {
        const profile = { ...createInitialProfile('test', 2, 1, 1, 'mix'), hissanModeEnabled: false };
        const ids = subject === 'math' ? getSkillsForLevel(profile.mathMainLevel)
            : ENGLISH_WORDS.filter(word => word.level === profile.vocabMainLevel).map(word => word.id);
        const records = ids.map((id, index) => memory(id, index === 0));
        const result = planParkLearning(profile, subject === 'math' ? records : [], subject === 'vocab' ? records : [], [], 0,
            'continuing', Date.now(), { subject, standardCount: 6, complexCount: 3, practiceItemIds: [ids[1]] });
        expect(result.subject).toBe(subject);
        expect(result.slots[0]).toMatchObject({ source: 'due', problem: { categoryId: ids[0], isReview: true } });
        expect(result.slots.some(slot => slot.source === 'main' && slot.problem.categoryId === ids[1] && !slot.problem.isReview)).toBe(true);
        expect(result.slots.every(slot => slot.problem.id.startsWith('continuing:slot-'))).toBe(true);
        expect(new Set(result.slots.map(slot => slot.problem.id)).size).toBe(result.slots.length);
    });

    it('does not allow a continuation to bypass locked, out-of-main or stopped content', () => {
        const profile = { ...createInitialProfile('test', 2, 1, 1, 'mix'), hissanModeEnabled: false };
        const now = Date.now(), id = getSkillsForLevel(profile.mathMainLevel)[0];
        const logs = [0, 1, 2].map(index => ({ profileId: profile.id, subject: 'math' as const, itemId: id,
            result: 'skipped' as const, isReview: false, timestamp: new Date(now - 1000 + index).toISOString() }));
        const invalid = [id, 'unknown', getSkillsForLevel(29)[0]];
        const result = planParkLearning(profile, [], [], logs, 0, 'guarded', now,
            { subject: 'math', practiceItemIds: invalid, standardCount: 6, complexCount: 3 });
        expect(result.slots.some(slot => invalid.includes(slot.problem.categoryId))).toBe(false);
    });
});
