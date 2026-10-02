import type { SubjectKey, UserProfile } from '../types';
import { MAX_MATH_LEVEL, MAX_VOCAB_LEVEL } from '../math/curriculum';

export function needsProgressionResume(profile: UserProfile, subject: SubjectKey): boolean {
    const main = subject === 'math' ? profile.mathMainLevel : profile.vocabMainLevel;
    const max = subject === 'math' ? profile.mathMaxUnlocked : profile.vocabMaxUnlocked;
    const limit = subject === 'math' ? MAX_MATH_LEVEL : MAX_VOCAB_LEVEL;
    const levels = subject === 'math' ? profile.mathLevels : profile.vocabLevels;
    if (!Number.isSafeInteger(main) || !Number.isSafeInteger(max) || main < (subject === 'math' ? 0 : 1)
        || main >= limit || max < main + 1 || max > limit) return false;
    const target = levels?.find(level => level.level === main + 1);
    return target?.unlocked === true && target.enabled === false;
}

/** Explicit guarded action; revalidate latest owner/range and preserve earned evidence. */
export function resumeProgression(profile: UserProfile, subject: SubjectKey, expected: { profileId: string; mainLevel: number }): UserProfile {
    const main = subject === 'math' ? profile.mathMainLevel : profile.vocabMainLevel;
    if (profile.id !== expected.profileId || main !== expected.mainLevel || !needsProgressionResume(profile, subject)) return profile;
    const key = subject === 'math' ? 'mathLevels' : 'vocabLevels';
    return { ...profile, [key]: profile[key]?.map(level => level.level === main + 1 ? { ...level, enabled: true } : level) };
}
