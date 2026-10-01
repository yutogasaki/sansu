import type { FinishRecovery } from './types';
import { generateMathProblem } from './math';
import { isRepresentativeMathContent, semanticFinishProblemKey } from './finishCoverage';
import type { RandomSource } from '../utils/random';

/** Target the failed variant, rather than asking easy introductory questions that cannot clear it. */
export function generateMathFinishRecoveryProblem(recovery: FinishRecovery | undefined, itemId: string,
    offset: number, random: RandomSource = Math.random) {
    const pending = recovery?.subject === 'math' ? recovery.items.filter(item => item.itemId === itemId
        && new Set(item.correctProblemKeys).size < 2) : [];
    if (!pending.length) return undefined;
    const target = pending[offset % pending.length];
    const used = new Set([target.failedProblemKey, ...target.correctProblemKeys]);
    for (let attempt = 0; attempt < 80; attempt++) {
        const problem = generateMathProblem(itemId, { random,
            preferredLearningVariant: target.variant === 'unknown' ? undefined : target.variant });
        if (isRepresentativeMathContent(itemId, problem.questionText)
            && !used.has(semanticFinishProblemKey('math', problem))) return problem;
    }
    throw new Error('再確認の問題を準備できませんでした。');
}
