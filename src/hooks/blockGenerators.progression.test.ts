import { afterEach, describe, expect, it, vi } from 'vitest';
import * as math from '../domain/math';
import { createInitialProfile, syncLevelState } from '../domain/user/profile';
import { getWordsByLevel } from '../domain/english/words';
import { createDefaultMemoryState } from '../domain/types';
import { buildVocabLevelWeights, generateSingleMathProblem, generateSingleVocabProblem, type MathGeneratorContext, type VocabGeneratorContext } from './blockGenerators';

const vocabContext = (): VocabGeneratorContext => ({
    profile: { ...syncLevelState(createInitialProfile('T', 1, 1, 1, 'vocab'), 'vocab', 2), vocabMainLevel: 1 },
    vocabDue: [], vocabLevelWeights: [{ level: 1, weight: 1 }],
    options: { blockCounts: new Map(), cooldownIds: [], skippedTodayIds: [], recentIds: [] },
    canAddReview: true, forceReviewBlock: false, weakVocabPool: [], currentWeakCount: 0,
    pendingVocabIds: [], buildCooldownIds: () => [], random: () => 0,
});
const mathContext = (): MathGeneratorContext => ({
    profile: createInitialProfile('T', 1, 0, 1, 'math'), mathDue: [], weakMathPool: [], maintenanceMathIds: [], retiredMathIds: [],
    options: { blockCounts: new Map(), cooldownIds: [], skippedTodayIds: [], recentIds: [] },
    canAddReview: false, currentWeakCount: 0, plusCount: 0, plusLimit: 0, random: () => 0,
});
afterEach(() => vi.restoreAllMocks());

describe('Study vocabulary coverage and eligibility', () => {
    it.each([1, 2])('prioritizes missed or skipped words over already successful items at level %s', level => {
        const ctx = vocabContext();
        ctx.vocabLevelWeights = [{ level, weight: 1 }];
        const words = getWordsByLevel(level);
        for (const word of words) ctx.profile.vocabWords[word.id] = { ...createDefaultMemoryState(word.id, 'vocab', true), correctAnswers: 4, totalAnswers: 4 };
        const target = words[words.length - 1].id;
        ctx.profile.vocabWords[target] = { ...createDefaultMemoryState(target, 'vocab', false), totalAnswers: 5, correctAnswers: 0, skippedAnswers: 3 };
        expect(generateSingleVocabProblem(ctx).problem.categoryId).toBe(target);
    });

    it('filters unknown, disabled, over-max and skipped Due/weak candidates', () => {
        const ctx = vocabContext();
        ctx.profile.vocabLevels = ctx.profile.vocabLevels?.map(level => level.level === 2 ? { ...level, enabled: false } : level);
        ctx.vocabDue = ['gone', 'head', 'house', 'apple'].map(id => ({ id }));
        ctx.weakVocabPool = ['gone', 'head', 'house', 'apple'];
        ctx.options.skippedTodayIds = ['apple'];
        ctx.forceReviewBlock = true;
        const result = generateSingleVocabProblem(ctx);
        expect(result.isReview).toBe(false);
        expect(getWordsByLevel(1).some(word => word.id === result.problem.categoryId)).toBe(true);
        expect(result.problem.categoryId).not.toBe('apple');
    });

    it('rotates weak items and marks weak success as review', () => {
        const ctx = vocabContext();
        ctx.weakVocabPool = ['apple', 'banana'];
        ctx.options.cooldownIds = ['apple'];
        expect(generateSingleVocabProblem(ctx)).toMatchObject({ problem: { categoryId: 'banana' }, isReview: true, countsTowardReviewCap: true });
    });

    it('uses available lower levels before a sparse weighted main level exceeds two repeats', () => {
        const ctx = vocabContext();
        ctx.profile.vocabMainLevel = 2;
        ctx.vocabLevelWeights = buildVocabLevelWeights(ctx.profile);
        ctx.options.skippedTodayIds = getWordsByLevel(2).filter(word => word.id !== 'head').map(word => word.id);
        const ids: string[] = [];
        for (let index = 0; index < 10; index += 1) {
            const id = generateSingleVocabProblem(ctx).problem.categoryId;
            ids.push(id);
            ctx.options.blockCounts.set(id, (ctx.options.blockCounts.get(id) ?? 0) + 1);
            ctx.pendingVocabIds.push(id);
        }
        expect(ids.filter(id => id === 'head')).toHaveLength(2);
        expect(ids.filter(id => getWordsByLevel(1).some(word => word.id === id)).length).toBe(8);
        expect(Math.max(...ctx.options.blockCounts.values())).toBeLessThanOrEqual(2);
    });

    it('does not bypass challenge limits or an entirely stopped pool with a fallback word', () => {
        const ctx = vocabContext();
        ctx.vocabLevelWeights = [{ level: 2, weight: 1 }];
        ctx.plusLimit = 0;
        expect(getWordsByLevel(1).some(word => word.id === generateSingleVocabProblem(ctx).problem.categoryId)).toBe(true);
        ctx.options.skippedTodayIds = getWordsByLevel(1).map(word => word.id);
        expect(() => generateSingleVocabProblem(ctx)).toThrow('No vocabulary assignment');
    });
});

describe('Study math generation preserves reserved eligibility', () => {
    it('does not substitute count_10 when no enabled assignment is available', () => {
        const ctx = mathContext();
        ctx.profile.mathLevels = ctx.profile.mathLevels.map(level => ({ ...level, enabled: false }));
        expect(() => generateSingleMathProblem(ctx)).toThrow('No math assignment available');
    });

    it('surfaces the actual generator error without silently substituting another skill', () => {
        const generator = vi.spyOn(math, 'generateMathProblem').mockImplementation(() => { throw new Error('reserved generator failed'); });
        expect(() => generateSingleMathProblem(mathContext())).toThrow('reserved generator failed');
        expect(generator).toHaveBeenCalledTimes(1);
    });
});
