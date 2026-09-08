import { describe, expect, it } from 'vitest';
import { createInitialProfile, syncLevelState } from '../user/profile';
import { createDefaultMemoryState } from '../types';
import { createSeededRandom } from '../../utils/random';
import { getWordsByLevel } from './words';
import { planVocabProblemSlots } from './planner';
import { getEligibleVocabWords, pickVocabWordId, vocabPlusOneLimit } from './selection';

const profile = () => ({ ...syncLevelState(createInitialProfile('T', 1, 1, 1, 'vocab'), 'vocab', 2), vocabMainLevel: 1 });

describe('vocabulary learning selection', () => {
    it('respects known items, explicit enabled/unlocked states, maximum and skipped guards for all lanes', () => {
        const p = profile();
        p.vocabLevels = p.vocabLevels?.map(level => level.level === 2 ? { ...level, enabled: false } : level);
        const options = { profile: p, count: 6, dueIds: ['gone', 'head', 'apple'], weakIds: ['head', 'apple'], skippedIds: ['apple'], random: () => 0 };
        const slots = planVocabProblemSlots(options);
        expect(slots.every(slot => getWordsByLevel(1).some(word => word.id === slot.wordId))).toBe(true);
        expect(slots.some(slot => slot.wordId === 'apple')).toBe(false);
        expect(slots.every(slot => slot.source === 'main')).toBe(true);
        expect(getEligibleVocabWords({ ...p, vocabLevels: undefined }).some(word => word.level === 2)).toBe(true);
        p.vocabLevels = p.vocabLevels?.map(level => ({ ...level, enabled: false }));
        expect(() => planVocabProblemSlots({ profile: p, count: 3 })).toThrow('No vocabulary assignment');
    });

    it('revisits failed and skipped words until independent success in both main and plus-one lanes', () => {
        const p = profile();
        for (const level of [1, 2]) {
            for (const word of getWordsByLevel(level)) p.vocabWords[word.id] = { ...createDefaultMemoryState(word.id, 'vocab', false), correctAnswers: 5, independentCorrectAnswers: 5, totalAnswers: 5 };
        }
        for (const id of ['apple', 'orange_lv2']) p.vocabWords[id] = { ...createDefaultMemoryState(id, 'vocab', false), correctAnswers: 0, incorrectAnswers: 4, skippedAnswers: 3, totalAnswers: 7 };
        const slots = planVocabProblemSlots({ profile: p, count: 3, random: () => 0 });
        expect(slots[0]).toMatchObject({ wordId: 'orange_lv2', source: 'plus-one' });
        expect(slots[1]).toMatchObject({ wordId: 'apple', source: 'main' });
        expect(new Set(slots.map(slot => slot.wordId)).size).toBe(3);
    });

    it('does not inherit old-ID mastery for later same-spelling items', () => {
        const p = profile();
        p.vocabWords.orange = { ...createDefaultMemoryState('orange', 'vocab', false), correctAnswers: 20, independentCorrectAnswers: 20, totalAnswers: 20 };
        expect(pickVocabWordId(['orange', 'orange_lv2'], { random: () => 0 }, p.vocabWords)).toBe('orange_lv2');
    });

    it('does not infer independent success from legacy or assisted raw successes', () => {
        const p = profile();
        p.vocabWords.apple = { ...createDefaultMemoryState('apple', 'vocab', false), correctAnswers: 5, independentCorrectAnswers: 1 };
        for (const independentCorrectAnswers of [undefined, 0, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
            p.vocabWords.banana = { ...createDefaultMemoryState('banana', 'vocab', false), correctAnswers: 20, independentCorrectAnswers };
            expect(pickVocabWordId(['apple', 'banana'], { random: () => 0 }, p.vocabWords)).toBe('banana');
        }
    });

    it('rotates weak items away from recent prompts and marks them review', () => {
        const p = profile();
        const slots = planVocabProblemSlots({ profile: p, count: 3, weakIds: ['apple', 'banana'], cooldownIds: ['apple'], random: () => 0 });
        expect(slots[0]).toEqual({ wordId: 'banana', source: 'weak', isReview: true, countsTowardReviewCap: true });
    });

    it('preserves Due order and explicit cursor after filtering unavailable IDs', () => {
        const p = profile();
        const base = { profile: p, count: 3, dueIds: ['gone', 'apple', 'orange', 'banana'], skippedIds: ['orange'], random: () => 0.99 };
        expect(planVocabProblemSlots(base)[0].wordId).toBe('apple');
        expect(planVocabProblemSlots({ ...base, dueAfterId: 'apple' })[0].wordId).toBe('banana');
        expect(planVocabProblemSlots({ ...base, dueAfterId: 'banana' })[0].wordId).toBe('apple');
    });

    it('expands backlog review while preserving a safe three-question prefix and Due rotation', () => {
        const dueIds = getWordsByLevel(1).slice(0, 8).map(word => word.id);
        const slots = planVocabProblemSlots({
            profile: profile(), count: 6, shortestCount: 3, dueIds,
            dueAfterId: dueIds[0], random: () => 0,
        });
        const review = slots.filter(slot => slot.source === 'due');
        expect(review.map(slot => slot.wordId)).toEqual(dueIds.slice(1, 4));
        expect(slots.slice(0, 3).filter(slot => slot.isReview)).toHaveLength(1);
        expect(slots.slice(0, 3).filter(slot => slot.source === 'main')).toHaveLength(2);
        expect(slots.filter(slot => slot.source === 'main')).toHaveLength(3);
        expect(slots.some(slot => slot.source === 'plus-one')).toBe(false);
        expect(new Set(review.map(slot => slot.wordId)).size).toBe(review.length);
        expect(Math.max(...slots.map(slot => slots.filter(other => other.wordId === slot.wordId).length))).toBeLessThanOrEqual(2);
    });

    it('counts unique eligible Due items for backlog and keeps main in short sections', () => {
        const p = profile();
        p.vocabLevels = p.vocabLevels?.map(level => level.level === 2 ? { ...level, enabled: false } : level);
        const slots = planVocabProblemSlots({
            profile: p, count: 6, dueIds: ['apple', 'apple', 'banana', 'head', 'gone', 'orange'],
            skippedIds: ['orange'], random: () => 0,
        });
        expect(slots.filter(slot => slot.source === 'due')).toHaveLength(1);
        const short = planVocabProblemSlots({ profile: profile(), count: 2, dueIds: ['apple'], random: () => 0 });
        expect(short.map(slot => slot.source)).toEqual(['due', 'main']);
    });

    it.each([1, 2, 3, 6])('caps challenge questions even under constant challenge selection (%s questions)', count => {
        const slots = planVocabProblemSlots({ profile: profile(), count, random: () => 0 });
        expect(slots.filter(slot => slot.source === 'plus-one')).toHaveLength(vocabPlusOneLimit(count));
        expect(vocabPlusOneLimit(count)).toBe(count === 1 ? 0 : 1);
    });

    it('balances a sparse eligible pool after unavoidable per-ID cap exhaustion', () => {
        const p = profile();
        const skippedIds = getEligibleVocabWords(p).filter(word => !['apple', 'banana'].includes(word.id)).map(word => word.id);
        const slots = planVocabProblemSlots({ profile: p, count: 7, skippedIds, random: () => 0 });
        expect(slots.filter(slot => slot.wordId === 'apple')).toHaveLength(4);
        expect(slots.filter(slot => slot.wordId === 'banana')).toHaveLength(3);
    });

    it('is deterministic with a seeded selection source', () => {
        const make = () => planVocabProblemSlots({ profile: profile(), count: 6, random: createSeededRandom('reservation') });
        expect(make()).toEqual(make());
    });
});
