import { describe, expect, it } from 'vitest';
import { learningBeat, normalizedLearningProgress, reconcileLearningProgress, sampleLearningReaction } from './learningReaction';
import { sampleResidentInterest } from './residentInterest';

describe('learning reactions run independently from answers', () => {
    it('shares normalized interest with a 1200ms visit while keeping the original 350+550ms reply', () => {
        for (const phase of [0, .25, .44, .66, .85, 1]) {
            const reply = sampleLearningReaction('correct', 350 + phase * 550, false);
            expect(reply.reply).toBeCloseTo(phase);
            for (const species of ['otter', 'rabbit', 'fox'] as const) {
                expect(sampleResidentInterest(species, reply.reply, false)).toEqual(sampleResidentInterest(species, phase, false));
            }
            expect(reply.duration).toBe(900);
        }
        expect(sampleLearningReaction('correct', 349, false).reply).toBe(0);
        expect(sampleLearningReaction('correct', 900, false).moving).toBe(false);
        expect(sampleLearningReaction('correct', 0, true)).toMatchObject({ reply: 1, moving: false, phase: 'settled' });
    });
    it('delivers light at350ms and settles the grounded response at900ms', () => {
        expect(sampleLearningReaction('correct', 349, false).phase).toBe('travel');
        expect(sampleLearningReaction('correct', 350, false)).toMatchObject({ phase: 'contact', arrived: true, earnedLight: true });
        expect(sampleLearningReaction('correct', 625, false).paw).toBeGreaterThan(.9);
        expect(sampleLearningReaction('correct', 900, false)).toMatchObject({ phase: 'settled', moving: false, paw: 0 });
    });
    it.each(['retry', 'support'] as const)('keeps %s neutral with no earnedlight or paw celebration', kind => {
        expect(sampleLearningReaction(kind, 200, false)).toMatchObject({ phase: 'contact', earnedLight: false, paw: 0 });
        expect(sampleLearningReaction(kind, 550, false).moving).toBe(false);
    });
    it('retains a static understandable reducedmotion pose without travel', () => {
        expect(sampleLearningReaction('correct', 0, true)).toMatchObject({ phase: 'settled', arrived: true, moving: false });
        expect(sampleLearningReaction('correct', 0, true).paw).toBeGreaterThan(0);
        expect(sampleLearningReaction('support', 0, true)).toMatchObject({ earnedLight: false, paw: 0, moving: false });
    });
    it.each([3, 6])('uses the saved %sproblem section for halfway andfinal beats', total => {
        const halfway = Math.ceil(total / 2);
        const at = (completed: number) => ({ sectionId: 'saved', completed, total });
        expect(learningBeat(at(halfway), at(halfway - 1))).toBe('halfway');
        expect(learningBeat(at(total), at(total - 1))).toBe('complete');
        expect(learningBeat(at(halfway), at(halfway))).toBe('step');
    });
    it('restores saved progress directly and resets only the new section accent', () => {
        expect(normalizedLearningProgress({ sectionId: 'resume', completed: 4, total: 6 })).toEqual({ sectionId: 'resume', completed: 4, total: 6 });
        expect(normalizedLearningProgress({ sectionId: 'next', completed: 0, total: 3 })?.completed).toBe(0);
        expect(learningBeat({ sectionId: 'next', completed: 1, total: 3 }, { sectionId: 'old', completed: 6, total: 6 })).toBe('step');
    });
    it('keeps earned progress pending until contact even if the parent renders again', () => {
        const before = { sectionId: 'one', completed: 0, total: 6 }, after = { ...before, completed: 1 };
        const first = reconcileLearningProgress(before, undefined, after, 'correct');
        expect(first).toEqual({ displayed: before, pending: after });
        expect(reconcileLearningProgress(first.displayed, first.pending, after)).toEqual(first);
    });
    it('drops an old pending light on a new section or leaving the saved section', () => {
        const before = { sectionId: 'old', completed: 5, total: 6 }, pending = { ...before, completed: 6 };
        const next = { sectionId: 'next', completed: 0, total: 3 };
        expect(reconcileLearningProgress(before, pending, next)).toEqual({ displayed: next, pending: undefined });
        expect(reconcileLearningProgress(before, pending, undefined)).toEqual({ displayed: undefined, pending: undefined });
    });
    it.each(['retry', 'support'] as const)('retains the prior saved answer if %s arrives before its light', kind => {
        const before = { sectionId: 'one', completed: 0, total: 6 }, earned = { ...before, completed: 1 };
        expect(reconcileLearningProgress(before, earned, earned, kind)).toEqual({ displayed: earned, pending: undefined });
    });
});
