import { describe, expect, it } from 'vitest';
import { createInitialProfile } from '../user/profile';
import { learningProgressNotice, learningProgressView } from './progressView';

const ready = { coverageReady: true, fresh: true, recentCount: 20, recentCorrect: 17, missingUnitIds: [], coveredCount: 1, requiredCount: 1 };
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
        expect(learningProgressView(p, 'math', 2).conditions.map(c => c.met)).toEqual([true, true, false]);
    });
    it('uses current range readiness even when a legacy next range is open', () => {
        const p = promotionProfile();
        p.mathLevels!.find(l => l.level === 8)!.recentIndependentAnswersNonReview = [...Array(17).fill(true), ...Array(3).fill(false)];
        expect(learningProgressView(p, 'math', undefined, ready)).toMatchObject({ stage: 'ready', main: 8, next: 9 });
        p.mathLevels!.find(l => l.level === 8)!.recentIndependentAnswersNonReview = [...Array(16).fill(true), ...Array(4).fill(false)];
        expect(learningProgressView(p, 'math', undefined, { ...ready, recentCorrect: 16 }).stage).toBe('unlock');
    });
    it('does not substitute word memory counts for the current independent answer window', () => {
        const p = profile();
        expect(learningProgressView(p, 'vocab').conditions[0].count).toBe(0);
        p.vocabLevels!.find(l => l.level === 1)!.recentIndependentAnswersNonReview = Array(20).fill(true);
        expect(learningProgressView(p, 'vocab').stage).toBe('unlock');
        expect(learningProgressView(p, 'vocab', undefined, ready).stage).toBe('ready');
    });
    it('handles parent-disabled next range and the real last math level', () => {
        const p = promotionProfile(); p.mathLevels!.find(l => l.level === 9)!.enabled = false;
        expect(learningProgressView(p, 'math').stage).toBe('paused');
        const paused = learningProgressView(p, 'math', undefined, { ...ready, recentCount: 8, recentCorrect: 6, coveredCount: 0, coverageReady: false, fresh: false });
        expect(paused.conditions[0].count).toBe(8);
        expect(paused.conditions[1].detail).toContain('6問 ひとりでできた');
        expect(paused.conditions[2].count).toBe(0);
        expect(paused.message).toContain('現在オフ');
        expect(paused.message).toContain('選び直し');
        expect(paused.pauseReason).toBe('disabled');
        p.mathLevels = p.mathLevels!.filter(level => level.level !== 9);
        expect(learningProgressView(p, 'math', undefined, ready).message).toContain('設定を たしかめて');
        p.mathMainLevel = 28; p.mathMaxUnlocked = 28;
        expect(learningProgressView(p, 'math')).toMatchObject({ stage: 'complete', next: null, conditions: [] });
    });
    it('announces readiness only on a newly saved answer', () => {
        const p = profile();
        const after = structuredClone(p);
        after.mathLevels!.find(l => l.level === 8)!.recentIndependentAnswersNonReview = Array(20).fill(true);
        expect(learningProgressNotice(p, after, 'math')).toBeNull();
        after.recentAttempts = [{ id: 'ready', timestamp: new Date().toISOString(), subject: 'math', skillId: 'add_1d_1', result: 'correct' }];
        expect(learningProgressNotice(p, after, 'math', { beforeReady: false, afterReady: true })).toContain('しあげ');
        expect(learningProgressNotice(after, after, 'math')).toBeNull();
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
