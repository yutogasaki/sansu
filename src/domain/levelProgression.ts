import type { AttemptLog } from '../db';
import { MAX_MATH_LEVEL, MAX_VOCAB_LEVEL } from './math/curriculum';
import type { SubjectKey, UserProfile } from './types';

/** Only the adjacent, enabled learning range can become the new main level. */
export function getNextPromotionLevel(profile: UserProfile, subject: SubjectKey): number | null {
    const main = subject === 'math' ? profile.mathMainLevel : profile.vocabMainLevel;
    const max = subject === 'math' ? profile.mathMaxUnlocked : profile.vocabMaxUnlocked;
    const limit = subject === 'math' ? MAX_MATH_LEVEL : MAX_VOCAB_LEVEL;
    const levels = subject === 'math' ? profile.mathLevels : profile.vocabLevels;
    if (!Number.isSafeInteger(main) || !Number.isSafeInteger(max)
        || main < (subject === 'math' ? 0 : 1) || max > limit || main + 1 > max) return null;
    const next = main + 1;
    if (levels) {
        const target = levels.find(level => level.level === next);
        if (!target?.unlocked || !target.enabled) return null;
    }
    return next;
}

/** Exposure alone cannot advance a learner; skips still count in recent accuracy. */
export function hasMathPromotionEvidence(logs: readonly AttemptLog[]): boolean {
    const normal = logs.filter(log => !log.isReview);
    if (normal.filter(log => log.result !== 'skipped' && !log.skipped).length < 30) return false;
    const recent = [...normal].sort((a, b) => a.timestamp.localeCompare(b.timestamp)
        || (a.id ?? 0) - (b.id ?? 0)).slice(-20);
    return recent.length === 20 && recent.filter(log => log.result === 'correct' && !log.skipped).length >= 17;
}
