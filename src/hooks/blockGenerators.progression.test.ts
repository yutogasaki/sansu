import { afterEach, describe, expect, it, vi } from 'vitest';
import * as math from '../domain/math';
import { createInitialProfile, syncLevelState } from '../domain/user/profile';
import { getWordsByLevel } from '../domain/english/words';
import { createDefaultMemoryState } from '../domain/types';
import { evaluateMathLevel11Pilot } from '../domain/learning/evidence';
import { createMathPilotScenarios } from '../domain/learning/pilotReport';
import { getMathLevel11Practice } from '../domain/learning/unitPractice';
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
        for (const word of words) ctx.profile.vocabWords[word.id] = { ...createDefaultMemoryState(word.id, 'vocab', true), correctAnswers: 4, independentCorrectAnswers: 4, totalAnswers: 4 };
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

    it.each([3, 6, 10])('allocates backlog Due in an ordinary %s-question block without repeated reviews or plus-one', blockSize => {
        const ctx = vocabContext();
        ctx.blockSize = blockSize;
        ctx.currentReviewCount = 0;
        ctx.vocabDue = getWordsByLevel(1).slice(0, blockSize + 2).map(word => ({ id: word.id }));
        ctx.weakVocabPool = ctx.vocabDue.map(item => item.id);
        ctx.vocabLevelWeights = [{ level: 2, weight: 1 }];
        const results = [];
        for (let index = 0; index < blockSize; index += 1) {
            const result = generateSingleVocabProblem(ctx);
            const id = result.problem.categoryId;
            results.push(result);
            ctx.options.blockCounts.set(id, (ctx.options.blockCounts.get(id) ?? 0) + 1);
            ctx.pendingVocabIds.push(id);
            ctx.plusCount = result.newPlusCount;
            if (result.isReview) ctx.currentReviewCount += 1;
        }
        const reviews = results.filter(result => result.isReview);
        expect(reviews).toHaveLength(Math.floor(blockSize / 2));
        expect(new Set(reviews.map(result => result.problem.categoryId)).size).toBe(reviews.length);
        expect(results.every(result => getWordsByLevel(1).some(word => word.id === result.problem.categoryId))).toBe(true);
        expect(results.some(result => !result.isReview)).toBe(true);
        expect(Math.max(...ctx.options.blockCounts.values())).toBeLessThanOrEqual(2);
    });

    it('retains main after a short-block review and applies the session review cap', () => {
        const ctx = vocabContext();
        ctx.blockSize = 2;
        ctx.currentReviewCount = 0;
        ctx.vocabDue = [{ id: 'apple' }];
        ctx.vocabLevelWeights = [{ level: 2, weight: 1 }];
        expect(generateSingleVocabProblem(ctx)).toMatchObject({ problem: { categoryId: 'apple' }, isReview: true });
        ctx.pendingVocabIds = ['apple'];
        ctx.currentReviewCount = 1;
        ctx.options.blockCounts.set('apple', 1);
        const last = generateSingleVocabProblem(ctx);
        expect(last.isReview).toBe(false);
        expect(getWordsByLevel(1).some(word => word.id === last.problem.categoryId)).toBe(true);
        ctx.pendingVocabIds = [];
        ctx.currentReviewCount = 0;
        ctx.canAddReview = false;
        expect(generateSingleVocabProblem(ctx).isReview).toBe(false);
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
    it('generates the missing Lv11 variant selected from unit evidence', () => {
        const ctx = mathContext();
        ctx.profile = syncLevelState(ctx.profile, 'math', 11);
        const records = createMathPilotScenarios()[3].records.filter(record =>
            record.itemId !== 'sub_2d2d' || record.learningEvidence?.problem.variant === 'no-regroup');
        ctx.unitPractice = getMathLevel11Practice(evaluateMathLevel11Pilot(
            records, 'synthetic-pilot', '2026-09-08T12:00:00.000Z',
        ));
        const result = generateSingleMathProblem(ctx);
        expect(result).toMatchObject({ source: 'main', problem: {
            categoryId: 'sub_2d2d', learningContext: { variant: 'regroup' },
        } });
    });

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
