import type { AttemptLog } from '../db';
import type { FinishRecovery, PeriodicTestSet } from './types';
import { createLearningProblemContext, validateLearningEvidenceContext } from './learning/context';
import { semanticFinishProblemKey, semanticFinishEvidenceKey, isRepresentativeMathContent } from './finishCoverage';
import { isIndependentCorrect } from './learning/independentProgress';

const REQUIRED_NEW_PROBLEMS = 2;
type RecoveryReservation = Pick<PeriodicTestSet, 'subject' | 'level' | 'problems'> & { answers?: Record<string, boolean> };
type RecoveryAttempt = Pick<AttemptLog, 'subject' | 'itemId' | 'result' | 'skipped' | 'learningEvidence'>;

/** Test misses stay in finish recovery; they are never fabricated as SRS attempts. */
export function createFinishRecovery(reservation: RecoveryReservation): FinishRecovery {
    const items: FinishRecovery['items'] = [];
    reservation.problems.forEach((problem, index) => {
        if (reservation.answers?.[String(index)] === true) return;
        const key = semanticFinishProblemKey(reservation.subject, problem);
        const failedProblemKey = key;
        const variant = createLearningProblemContext(reservation.subject, problem)?.variant;
        if (items.some(item => item.itemId === problem.categoryId && item.failedProblemKey === failedProblemKey)) return;
        items.push({ itemId: problem.categoryId, variant, failedProblemKey, correctProblemKeys: [] });
    });
    return { subject: reservation.subject, level: reservation.level, items };
}

export function finishRecoveryPending(recovery?: FinishRecovery): boolean {
    return Boolean(recovery?.items.some(item => !item.failedProblemKey
        || new Set(item.correctProblemKeys.filter(key => key && key !== item.failedProblemKey)).size < REQUIRED_NEW_PROBLEMS));
}

/** Only a real, independently completed new whole problem clears a recovery item. */
export function applyFinishRecoveryAttempt(recovery: FinishRecovery, attempt: RecoveryAttempt): FinishRecovery {
    if (attempt.subject !== recovery.subject || !isIndependentCorrect(attempt)) return recovery;
    const evidence = validateLearningEvidenceContext(attempt.learningEvidence, attempt.subject, attempt.itemId);
    if (!evidence || evidence.problem.variant === 'unknown') return recovery;
    const content = JSON.parse(evidence.problem.problemKey);
    if (attempt.subject === 'math' && !isRepresentativeMathContent(attempt.itemId, content.question)) return recovery;
    const problemKey = semanticFinishEvidenceKey(evidence.problem.problemKey);
    if (!problemKey) return recovery;
    const failures = recovery.items.filter(item => item.itemId === attempt.itemId);
    if (!failures.length) return recovery;
    let changed = false;
    const items = recovery.items.map(item => {
        if (item.itemId !== attempt.itemId || !item.failedProblemKey || item.failedProblemKey === problemKey
            || item.variant && item.variant !== 'unknown' && item.variant !== evidence.problem.variant
            || item.correctProblemKeys.includes(problemKey)
            || new Set(item.correctProblemKeys).size >= REQUIRED_NEW_PROBLEMS) return item;
        changed = true;
        return { ...item, correctProblemKeys: [...item.correctProblemKeys, problemKey] };
    });
    return changed ? { ...recovery, items } : recovery;
}
