import { describe, expect, it } from 'vitest';
import type { Problem } from './types';
import { generateVocabProblem } from './english/generator';
import { ENGLISH_WORDS } from './english/words';
import { createLearningProblemContext } from './learning/context';
import { applyFinishRecoveryAttempt, createFinishRecovery, finishRecoveryPending } from './finishRecovery';

const problem = (text: string, answer: string, itemId = 'add_1d_1'): Omit<Problem, 'id' | 'subject' | 'isReview'> => ({ categoryId: itemId, questionText: text, correctAnswer: answer, inputType: 'number' });
const attempt = (p: ReturnType<typeof problem>, assistance: 'independent' | 'assisted' = 'independent') => ({ subject: 'math' as const, itemId: p.categoryId, result: 'correct' as const,
    learningEvidence: { problem: createLearningProblemContext('math', p)!, assistance, completion: 'whole-problem' as const } });

describe('targeted finish recovery', () => {
    it('keeps borrowing recovery pending through no-borrow practice and clears with new borrowing equations', () => {
        const recovery = createFinishRecovery({ subject: 'math', level: 11, problems: [problem('52 - 28 =', '24', 'sub_2d2d')], answers: { '0': false } });
        expect(recovery.items[0].variant).toBe('regroup');
        const simple = applyFinishRecoveryAttempt(recovery, attempt(problem('86 - 24 =', '62', 'sub_2d2d')));
        expect(simple).toBe(recovery);
        const once = applyFinishRecoveryAttempt(recovery, attempt(problem('61 - 37 =', '24', 'sub_2d2d')));
        expect(finishRecoveryPending(once)).toBe(true);
        const twice = applyFinishRecoveryAttempt(once, attempt(problem('74 - 38 =', '36', 'sub_2d2d')));
        expect(finishRecoveryPending(twice)).toBe(false);
    });
    it('does not use introductory noncarry arithmetic to repair a carry item', () => {
        const recovery = createFinishRecovery({ subject: 'math', level: 9, problems: [problem('8 + 7 =', '15', 'add_1d_2')], answers: { '0': false } });
        expect(applyFinishRecoveryAttempt(recovery, attempt(problem('2 + 3 =', '5', 'add_1d_2')))).toBe(recovery);
        const once = applyFinishRecoveryAttempt(recovery, attempt(problem('9 + 5 =', '14', 'add_1d_2')));
        expect(finishRecoveryPending(applyFinishRecoveryAttempt(once, attempt(problem('6 + 7 =', '13', 'add_1d_2'))))).toBe(false);
    });
    it('repairs a real vocabulary item with distinct distractor sets while ignoring order-only repeats', () => {
        const word = ENGLISH_WORDS[0];
        const generated = Array.from({ length: 12 }, (_, index) => generateVocabProblem(word.id, { random: () => (index + 1) / 13 }));
        const failed = generated[0];
        const recovery = createFinishRecovery({ subject: 'vocab', level: word.level, problems: [failed], answers: { '0': false } });
        const vocabAttempt = (p: typeof failed) => ({ subject: 'vocab' as const, itemId: word.id, result: 'correct' as const,
            learningEvidence: { problem: createLearningProblemContext('vocab', p)!, assistance: 'independent' as const, completion: 'whole-problem' as const } });
        const reordered = { ...failed, inputConfig: { ...failed.inputConfig, choices: [...failed.inputConfig!.choices!].reverse() } };
        expect(applyFinishRecoveryAttempt(recovery, vocabAttempt(reordered))).toBe(recovery);
        const repaired = generated.reduce((current, p) => applyFinishRecoveryAttempt(current, vocabAttempt(p)), recovery);
        expect(finishRecoveryPending(repaired)).toBe(false);
        expect(repaired.items[0].correctProblemKeys).toHaveLength(2);
    });

    it('retains misses and unanswered items without counting test successes as practice', () => {
        const recovery = createFinishRecovery({ subject: 'math', level: 8, problems: [problem('2 + 3 =', '5'), problem('4 + 2 =', '6'), problem('6 + 2 =', '8')], answers: { '0': true, '1': false } });
        expect(recovery.items).toHaveLength(2);
        expect(recovery.items.every(item => item.correctProblemKeys.length === 0)).toBe(true);
        expect(finishRecoveryPending(recovery)).toBe(true);
    });
    it('requires two distinct new independent whole problems and rejects shown answers, repeats and assistance', () => {
        const failed = problem('2 + 3 =', '5');
        const recovery = createFinishRecovery({ subject: 'math', level: 8, problems: [failed], answers: { '0': false } });
        expect(applyFinishRecoveryAttempt(recovery, attempt(failed))).toBe(recovery);
        const rewritten = { ...failed, inputType: 'choice' as const, inputConfig: { choices: [{ label: '5', value: '5' }, { label: '6', value: '6' }] } };
        expect(applyFinishRecoveryAttempt(recovery, attempt(rewritten))).toBe(recovery);
        expect(applyFinishRecoveryAttempt(recovery, attempt(problem('4 + 2 =', '6'), 'assisted'))).toBe(recovery);
        expect(applyFinishRecoveryAttempt(recovery, { ...attempt(problem('4 + 2 =', '6')), learningEvidence: undefined })).toBe(recovery);
        expect(applyFinishRecoveryAttempt(recovery, { ...attempt(problem('4 + 2 =', '6')), skipped: true })).toBe(recovery);
        expect(applyFinishRecoveryAttempt(recovery, { ...attempt(problem('4 + 2 =', '6')), subject: 'vocab' })).toBe(recovery);
        const once = applyFinishRecoveryAttempt(recovery, attempt(problem('4 + 2 =', '6')));
        expect(finishRecoveryPending(once)).toBe(true);
        expect(applyFinishRecoveryAttempt(once, attempt(problem('4 + 2 =', '6')))).toBe(once);
        const twice = applyFinishRecoveryAttempt(once, attempt(problem('6 + 2 =', '8')));
        expect(finishRecoveryPending(twice)).toBe(false);
    });
    it('rechecks each miss with other independently solved problems without excluding the entire finite curriculum', () => {
        const first = problem('2 + 3 =', '5'), second = problem('4 + 2 =', '6');
        const recovery = createFinishRecovery({ subject: 'math', level: 8, problems: [first, second], answers: { '0': false, '1': false } });
        const next = applyFinishRecoveryAttempt(recovery, attempt(second));
        expect(next.items.map(item => item.correctProblemKeys.length)).toEqual([1, 0]);
        const third = problem('6 + 2 =', '8');
        const confirmed = [first, third].reduce((current, p) => applyFinishRecoveryAttempt(current, attempt(p)), next);
        expect(finishRecoveryPending(confirmed)).toBe(false);
    });
});
