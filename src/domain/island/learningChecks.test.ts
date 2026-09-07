import { describe, expect, it } from 'vitest';
import { createInitialProfile } from '../user/profile';
import type { LearningSlot } from '../park/types';
import type { IslandMathCheck, IslandRecord } from './types';
import { createIsland } from './catalog';
import { assertIsland, IslandConflict } from './repository';
import { getIslandMathRemediationSkillIds, mathCheckQuestionKey, updateIslandMathChecks } from './learningChecks';

const slot = (id = 'failed', questionText = '27 + 2 =', assisted = false): LearningSlot => ({
    problem: { id, categoryId: 'add_2d1d_nc', subject: 'math', isReview: false,
        inputType: 'number', questionText, correctAnswer: questionText.startsWith('27') ? '29' : '39' },
    assisted, completed: false, source: 'main', countsTowardReviewCap: false,
});
const failed = (): IslandMathCheck[] => updateIslandMathChecks(undefined, slot(), 'needs-support', 1)!;

describe('island independent check evidence', () => {
    it('does not accept same-problem correction or a new ID with identical content as independent evidence', () => {
        const checks = failed();
        expect(updateIslandMathChecks(checks, slot(), 'correct-final', 2)).toEqual(checks);
        expect(updateIslandMathChecks(checks, slot('another-id'), 'correct-final', 2)).toEqual(checks);
        expect(updateIslandMathChecks(checks, slot('different', '37 + 2 ='), 'correct-final', 2)).toEqual([]);
    });
    it('keeps guided answers and unfinished Hissan rows outside independent confirmation', () => {
        const checks = failed();
        expect(updateIslandMathChecks(checks, slot('different', '37 + 2 =', true), 'correct-final', 2)).toEqual(checks);
        expect(updateIslandMathChecks(checks, slot('different', '37 + 2 ='), 'partial', 2)).toEqual(checks);
    });
    it('keeps a corrected new failure pending too, with at most one check per skill', () => {
        const checks = failed(), newFailure = slot('different', '37 + 2 =');
        const renewed = updateIslandMathChecks(checks, newFailure, 'needs-support', 2)!;
        expect(renewed).toHaveLength(1);
        expect(renewed[0]).toMatchObject({ failedProblemId: 'different', createdAt: 1 });
        expect(updateIslandMathChecks(renewed, newFailure, 'correct-final', 3)).toEqual(renewed);
    });
    it('uses the existing Bridge before checking the original skill independently', () => {
        const p = createInitialProfile('child', 2, 10, 1, 'math');
        const checks = failed();
        expect(getIslandMathRemediationSkillIds(checks, p)).toEqual(['add_2d1d_nc_bridge']);
        const bridge = { ...slot('bridge'), assisted: true,
            problem: { ...slot().problem, id: 'bridge', categoryId: 'add_2d1d_nc_bridge' } };
        const afterBridge = updateIslandMathChecks(checks, bridge, 'correct-final', 2)!;
        expect(afterBridge).toHaveLength(1);
        expect(afterBridge[0].stage).toBe('independent');
        expect(getIslandMathRemediationSkillIds(afterBridge, p)).toEqual(['add_2d1d_nc']);
        expect(updateIslandMathChecks(afterBridge, slot('check', '37 + 2 ='), 'correct-final', 3)).toEqual([]);
        expect(getIslandMathRemediationSkillIds(checks, { ...p, mathMaxUnlocked: 8 })).toEqual([]);
    });
    it('normalizes property order but ignores reservation IDs and choice order', () => {
        const first = slot().problem;
        const reordered = { correctAnswer: first.correctAnswer, questionText: first.questionText,
            subject: first.subject, categoryId: first.categoryId, isReview: true, inputType: first.inputType, id: 'later' };
        expect(mathCheckQuestionKey(reordered)).toBe(mathCheckQuestionKey(first));
    });
    it('reads old records and preserves optional fields in a serialized record round trip', () => {
        const old = createIsland('child', 1);
        expect(() => assertIsland(old)).not.toThrow();
        const island = { ...old, pendingMathChecks: failed(), vocabDueCursor: 'apple', mathReviewTurn: 2 };
        const copy = JSON.parse(JSON.stringify(island));
        expect(() => assertIsland(copy)).not.toThrow();
        expect(copy).toEqual(island);
    });
    it.each([
        { pendingMathChecks: [failed()[0], failed()[0]] },
        { pendingMathChecks: [{ ...failed()[0], skillId: 'unknown' }] },
        { pendingMathChecks: [{ ...failed()[0], failedQuestionKey: '' }] },
        { pendingMathChecks: [{ ...failed()[0], stage: 'finished' }] },
        { pendingMathChecks: [null] },
        { mathReviewTurn: -1 },
        { mathReviewTurn: .5 },
        { vocabDueCursor: 'unknown-word' },
    ])('rejects malformed optional learning state %j', fields => {
        expect(() => assertIsland({ ...createIsland('child', 1), ...fields } as IslandRecord)).toThrow(IslandConflict);
    });
});
