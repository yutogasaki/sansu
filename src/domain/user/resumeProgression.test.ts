import { describe, expect, it } from 'vitest';
import type { SubjectKey } from '../types';
import { createInitialProfile, syncLevelState } from './profile';
import { needsProgressionResume, resumeProgression } from './resumeProgression';
import { learningProgressView } from '../learning/progressView';

const ready = { coverageReady: true, fresh: true, recentCount: 20, recentCorrect: 20, coveredCount: 2, requiredCount: 2, missingUnitIds: [] };
describe('explicit progression recovery without skipping learning', () => {
    it.each<SubjectKey>(['math', 'vocab'])('reproduces automatic upper-level disabling and resumes only the adjacent %s level', subject => {
        const initial = createInitialProfile('はる', 2, 15, 16, 'mix');
        const p = syncLevelState(syncLevelState(initial, subject, 18), subject, 16);
        p.recentAttempts = [{ id: 'kept', timestamp: new Date().toISOString(), subject, skillId: 'kept', result: 'correct' }];
        const before = structuredClone(p);
        const expected = { profileId: p.id, mainLevel: 16 };
        expect(needsProgressionResume(p, subject)).toBe(true);
        expect(learningProgressView(p, subject, undefined, ready)).toMatchObject({ stage: 'paused', pauseReason: 'disabled' });
        const resumed = resumeProgression(p, subject, expected);
        const key = subject === 'math' ? 'mathLevels' : 'vocabLevels';
        const restored = { ...resumed, [key]: resumed[key]?.map(level => level.level === 17 ? { ...level, enabled: false } : level) };
        expect(restored).toEqual(before);
        expect(p).toEqual(before);
        expect(resumed[key]?.find(level => level.level === 18)?.enabled).toBe(false);
        expect(learningProgressView(resumed, subject, undefined, ready).stage).toBe('ready');
        expect(learningProgressView(resumed, subject).stage).toBe('unlock');
        expect(resumeProgression(resumed, subject, expected)).toBe(resumed);
        expect(resumeProgression(p, subject, { ...expected, profileId: 'another' })).toBe(p);
        expect(resumeProgression(p, subject, { ...expected, mainLevel: 15 })).toBe(p);
        const locked = { ...p, [key]: p[key]?.map(level => level.level === 17 ? { ...level, unlocked: false } : level) };
        expect(resumeProgression(locked, subject, expected)).toBe(locked);
        const inconsistent = { ...p, [subject === 'math' ? 'mathMaxUnlocked' : 'vocabMaxUnlocked']: 15 };
        expect(resumeProgression(inconsistent, subject, expected)).toBe(inconsistent);
        expect(learningProgressView(inconsistent, subject).pauseReason).toBe('inconsistent');
    });
});
