import type { AttemptLog } from '../../db';
import type { MemoryState } from '../types';
import { validateLearningEvidenceContext } from './context';

export function independentCorrectCount(memory: Pick<MemoryState, 'independentCorrectAnswers'> | undefined): number {
    const value = memory?.independentCorrectAnswers;
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function hasKnownWholeAttempt(log: Pick<AttemptLog, 'subject' | 'itemId' | 'learningEvidence'>): boolean {
    const evidence = validateLearningEvidenceContext(log.learningEvidence, log.subject, log.itemId);
    return Boolean(evidence && evidence.assistance !== 'unknown' && evidence.completion === 'whole-problem');
}

export function isIndependentCorrect(log: Pick<AttemptLog, 'subject' | 'itemId' | 'learningEvidence' | 'result' | 'skipped'>): boolean {
    if (log.result !== 'correct' || log.skipped) return false;
    const evidence = validateLearningEvidenceContext(log.learningEvidence, log.subject, log.itemId);
    return evidence?.assistance === 'independent' && evidence.completion === 'whole-problem';
}
