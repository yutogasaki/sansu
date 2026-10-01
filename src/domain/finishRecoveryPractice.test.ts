import { describe, expect, it } from 'vitest';
import { generateMathFinishRecoveryProblem } from './finishRecoveryPractice';
import { createFinishRecovery } from './finishRecovery';
import { createLearningProblemContext } from './learning/context';
import { createSeededRandom } from '../utils/random';
import { semanticFinishProblemKey } from './finishCoverage';

it('targets actual borrowing rather than no-borrow questions and avoids the failed content', () => {
    const failed = { categoryId: 'sub_2d2d', questionText: '52 - 28 =', correctAnswer: '24', inputType: 'number' as const };
    const recovery = createFinishRecovery({ subject: 'math', level: 11, problems: [failed], answers: { '0': false } });
    const random = createSeededRandom('recovery-borrow');
    for (let n = 0; n < 30; n++) {
        const next = generateMathFinishRecoveryProblem(recovery, failed.categoryId, n, random)!;
        expect(createLearningProblemContext('math', next)?.variant).toBe('regroup');
        expect(semanticFinishProblemKey('math', next)).not.toBe(recovery.items[0].failedProblemKey);
    }
});
describe('representative finish recovery practice', () => {
    it('gives carry practice without depending on introductory profile counters', () => {
        const recovery = createFinishRecovery({ subject: 'math', level: 9, answers: {}, problems: [{ categoryId: 'add_1d_2',
            questionText: '8 + 7 =', correctAnswer: '15', inputType: 'number' }] });
        const random = createSeededRandom('carry-recovery');
        for (let n = 0; n < 30; n++) {
            const next = generateMathFinishRecoveryProblem(recovery, 'add_1d_2', n, random)!;
            expect(Number(next.correctAnswer)).toBeGreaterThanOrEqual(10);
        }
        expect(generateMathFinishRecoveryProblem(undefined, 'add_1d_2', 0)).toBeUndefined();
    });
});

it('can recover a small counting pool even when four of its five counts were missed', async () => {
    const { generateMathProblem } = await import('./math');
    const { applyFinishRecoveryAttempt, finishRecoveryPending } = await import('./finishRecovery');
    const random = createSeededRandom('finite-counting-recovery');
    const samples = new Map<string, ReturnType<typeof generateMathProblem>>();
    for (let n = 0; n < 100; n++) {
        const p = generateMathProblem('count_5', { random });
        samples.set(String(p.correctAnswer), p);
    }
    expect(samples.size).toBe(5);
    let recovery = createFinishRecovery({ subject: 'math', level: 0, problems: [...samples.values()].slice(0, 4), answers: {} });
    for (let n = 0; n < 30 && finishRecoveryPending(recovery); n++) {
        const next = generateMathFinishRecoveryProblem(recovery, 'count_5', n, random)!;
        recovery = applyFinishRecoveryAttempt(recovery, { subject: 'math', itemId: 'count_5', result: 'correct',
            learningEvidence: { problem: createLearningProblemContext('math', next)!, assistance: 'independent', completion: 'whole-problem' } });
    }
    expect(finishRecoveryPending(recovery)).toBe(false);
    for (const item of recovery.items) expect(item.correctProblemKeys).not.toContain(item.failedProblemKey);
});
