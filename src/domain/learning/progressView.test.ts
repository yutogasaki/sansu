import { describe, expect, it } from 'vitest';
import { createInitialProfile } from '../user/profile';
import { learningProgressNotice, learningProgressView } from './progressView';
import { hasMathPromotionEvidence } from '../levelProgression';
import { generateMathProblem } from '../math';
import { learningEvidenceForProblem } from './attemptContext';
import { getWordsByLevel } from '../english/words';
import type { AttemptLog } from '../../db';
import type { MemoryState } from '../types';

const profile = () => createInitialProfile('はる', 2, 7, 1, 'mix');
const promotionProfile = () => {
    const p = profile();
    p.mathMaxUnlocked = 9;
    p.mathLevels = p.mathLevels?.map(l => l.level === 9 ? { ...l, unlocked: true, enabled: true } : l);
    return p;
};
describe('honest learning progress presentation', () => {
    it('does not turn a full legacy answer bar into independent progress', () => {
        const p = profile();
        p.mathLevels!.find(l => l.level === 8)!.recentAnswersNonReview = Array(20).fill(true);
        const view = learningProgressView(p, 'math');
        expect(view.stage).toBe('unlock');
        expect(view.conditions.map(c => c.met)).toEqual([false, false]);
        expect(view.conditions[0].count).toBe(0);
    });
    it('keeps quantity and accuracy separate and includes the Lv11 gate', () => {
        const p = profile(); p.mathMainLevel = 11; p.mathMaxUnlocked = 11;
        p.mathLevels!.find(l => l.level === 11)!.recentIndependentAnswersNonReview = Array(20).fill(true);
        expect(learningProgressView(p, 'math', [], [], 2).conditions.map(c => c.met)).toEqual([true, true, false]);
    });
    it('agrees with the actual math promotion evidence across supported, skipped and review answers', () => {
        const p = promotionProfile();
        const problem = { ...generateMathProblem('add_1d_2'), id: 'q', subject: 'math' as const, isReview: false };
        const logs: AttemptLog[] = Array.from({ length: 30 }, (_, index) => ({ profileId: p.id, subject: 'math', itemId: 'add_1d_2', result: 'correct',
            isReview: false, timestamp: new Date(100000 + index).toISOString(), learningEvidence: learningEvidenceForProblem(problem, 'independent') }));
        for (const count of [0, 19, 29, 30]) {
            const subset = logs.slice(0, count);
            expect(learningProgressView(p, 'math', subset).conditions.every(c => c.met)).toBe(hasMathPromotionEvidence(subset));
        }
        const supported = logs.map(log => ({ ...log, learningEvidence: learningEvidenceForProblem(problem, 'assisted') }));
        expect(learningProgressView(p, 'math', supported).conditions[1].met).toBe(false);
        const skipped = logs.map(log => ({ ...log, skipped: true }));
        expect(learningProgressView(p, 'math', skipped).conditions[0].met).toBe(false);
        expect(learningProgressView(p, 'math', logs.map(log => ({ ...log, isReview: true }))).conditions[0].count).toBe(0);
        expect(learningProgressView(p, 'math', logs.map(log => ({ ...log, profileId: 'other' }))).conditions[0].count).toBe(0);
    });
    it('counts distinct independently recalled words, not raw correct answers', () => {
        const p = profile(); p.vocabMaxUnlocked = 2;
        p.vocabLevels = p.vocabLevels?.map(l => l.level === 2 ? { ...l, unlocked: true, enabled: true } : l);
        const words = getWordsByLevel(2);
        const memory = words.map(w => ({ id: w.id, correctAnswers: 50 } as MemoryState));
        expect(learningProgressView(p, 'vocab', [], memory).conditions[0].count).toBe(0);
        const target = Math.ceil(words.length * .7);
        expect(learningProgressView(p, 'vocab', [], memory.slice(0, target).map(m => ({ ...m, independentCorrectAnswers: 1 }))).conditions[0].met).toBe(true);
    });
    it('handles parent-disabled next range and the real last math level', () => {
        const p = promotionProfile(); p.mathLevels!.find(l => l.level === 9)!.enabled = false;
        expect(learningProgressView(p, 'math').stage).toBe('paused');
        p.mathMainLevel = 28; p.mathMaxUnlocked = 28;
        expect(learningProgressView(p, 'math')).toMatchObject({ stage: 'complete', next: null, conditions: [] });
    });
    it('announces only a newly saved learning transition in the same profile and subject', () => {
        const p = profile(); const next = { ...p, mathMaxUnlocked: 9 };
        expect(learningProgressNotice(p, next, 'math')).toBeNull();
        next.recentAttempts = [{ id: 'new', timestamp: new Date().toISOString(), subject: 'math', skillId: 'add_1d_1', result: 'correct' }];
        expect(learningProgressNotice(p, next, 'math')).toContain('ひらいた');
        expect(learningProgressNotice(next, next, 'math')).toBeNull();
        expect(learningProgressNotice(p, { ...next, id: 'other' }, 'math')).toBeNull();
        expect(learningProgressNotice(p, next, 'vocab')).toBeNull();
    });
});
