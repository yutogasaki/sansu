import type { PeriodicTestResult, PeriodicTestSet, SubjectKey, UserProfile } from './types';
import type { FinishReadiness, FinishReadinessSnapshot } from './finishCoverage';
import { createFinishRecovery, finishRecoveryPending } from './finishRecovery';
import { MAX_MATH_LEVEL, MAX_VOCAB_LEVEL } from './math/curriculum';

export type FinishTestReservation = PeriodicTestSet & { id: string; profileId: string; targetLevel: number; answers?: Record<string, boolean>; readiness?: FinishReadinessSnapshot };
export type FinishTestResult = { passed: boolean; subject: SubjectKey; level: number; newLevel?: number; correctCount: number; totalQuestions: number; recoveryItemIds?: string[] };

export function finishEligibility(profile: UserProfile, subject: SubjectKey, missingUnits?: readonly unknown[], readiness?: FinishReadiness) {
    const mainLevel = subject === 'math' ? profile.mathMainLevel : profile.vocabMainLevel;
    const max = subject === 'math' ? profile.mathMaxUnlocked : profile.vocabMaxUnlocked;
    const levels = subject === 'math' ? profile.mathLevels : profile.vocabLevels;
    const limit = subject === 'math' ? MAX_MATH_LEVEL : MAX_VOCAB_LEVEL;
    const recent = levels?.find(level => level.level === mainLevel)?.recentIndependentAnswersNonReview?.slice(-20) ?? [];
    const count = readiness?.recentCount ?? recent.length;
    const correct = readiness?.recentCorrect ?? recent.filter(answer => answer === true).length;
    const nextLevel = mainLevel + 1;
    const target = levels?.find(level => level.level === nextLevel);
    const unitReady = subject !== 'math' || mainLevel !== 11 || missingUnits?.length === 0;
    const saved = profile.finishTestSets?.[subject];
    const snapshot = saved?.profileId === profile.id && saved.level === mainLevel && saved.targetLevel === nextLevel
        && saved.problems.length === 20 && (!saved.readiness || saved.readiness.version === 1 && saved.readiness.coverageReady
        && saved.readiness.fresh && saved.readiness.recentCount === 20 && saved.readiness.recentCorrect >= 17);
    const recovery = profile.finishRecovery?.[subject];
    const recovering = recovery?.level === mainLevel && finishRecoveryPending(recovery);
    const admitted = snapshot || Boolean(readiness?.coverageReady && readiness.fresh);
    const status = mainLevel >= limit ? 'complete'
        : !Number.isSafeInteger(mainLevel) || !Number.isSafeInteger(max) || max < mainLevel || max > limit || mainLevel < (subject === 'math' ? 0 : 1)
            || (levels && !target) || (max >= nextLevel && target && (!target.unlocked || !target.enabled)) ? 'paused'
        : !recovering && admitted && (snapshot || count === 20 && correct >= 17 && unitReady) ? 'ready' : 'practicing';
    return { status, mainLevel, nextLevel, count: snapshot ? 20 : count, correct: snapshot ? saved?.readiness?.recentCorrect ?? correct : correct, needed: snapshot ? 0 : Math.max(0, 20 - count), coverageReady: snapshot || readiness?.coverageReady === true, fresh: snapshot || readiness?.fresh === true, recovering } as const;
}

/** Pure transition; caller owns transaction and revalidates Lv11 coverage there. */
export function applyFinishTestCompletion(profile: UserProfile, reservation: FinishTestReservation,
    stats: { correct: number; total: number; durationSeconds: number; timedOut?: boolean }, now: number,
    missingUnits?: readonly unknown[], readiness?: FinishReadiness): { profile: UserProfile; result: FinishTestResult | null } {
    const previous = profile.testHistory?.find(item => item.id === reservation.id && item.kind === 'finish');
    if (profile.id === reservation.profileId && previous?.subject === reservation.subject && previous.level === reservation.level) {
        return { profile, result: { passed: previous.passed === true, subject: previous.subject, level: previous.level,
            newLevel: previous.newLevel, correctCount: previous.correctCount, totalQuestions: previous.totalQuestions,
            recoveryItemIds: profile.finishRecovery?.[reservation.subject]?.items.map(item => item.itemId) } };
    }
    const saved = profile.finishTestSets?.[reservation.subject];
    const eligibility = finishEligibility(profile, reservation.subject, missingUnits, readiness);
    if (profile.id !== reservation.profileId || saved?.id !== reservation.id
        || saved.level !== reservation.level || saved.targetLevel !== reservation.targetLevel
        || eligibility.mainLevel !== reservation.level || eligibility.nextLevel !== reservation.targetLevel
        || eligibility.status !== 'ready') return { profile, result: null };
    if (stats.total !== 20 || !Number.isInteger(stats.correct) || stats.correct < 0 || stats.correct > 20
        || !Number.isFinite(stats.durationSeconds) || stats.durationSeconds < 0) return { profile, result: null };
    const passed = stats.correct === 20 && !stats.timedOut;
    const recovery = passed ? undefined : createFinishRecovery(saved);
    const recoveries = { ...profile.finishRecovery };
    if (passed) delete recoveries[reservation.subject];
    else recoveries[reservation.subject] = recovery;
    const result: FinishTestResult = { passed, subject: reservation.subject, level: reservation.level,
        newLevel: passed ? reservation.targetLevel : undefined, correctCount: stats.correct, totalQuestions: stats.total, recoveryItemIds: recovery?.items.map(item => item.itemId) };
    const history: PeriodicTestResult = { ...result, id: reservation.id, timestamp: now, kind: 'finish',
        mode: 'manual', method: 'online', score: Math.round(stats.correct / 20 * 100),
        durationSeconds: stats.durationSeconds, timedOut: stats.timedOut };
    const sets = { ...profile.finishTestSets };
    delete sets[reservation.subject];
    let updated: UserProfile = { ...profile, finishTestSets: sets, finishRecovery: recoveries, testHistory: [...(profile.testHistory ?? []), history] };
    if (passed) {
        const nowIso = new Date(now).toISOString();
        const levelsKey = reservation.subject === 'math' ? 'mathLevels' : 'vocabLevels';
        updated = { ...updated, [levelsKey]: profile[levelsKey]?.map(level => level.level === reservation.targetLevel
            ? { ...level, unlocked: true, enabled: true } : level),
            [reservation.subject === 'math' ? 'mathMainLevel' : 'vocabMainLevel']: reservation.targetLevel,
            [reservation.subject === 'math' ? 'mathMaxUnlocked' : 'vocabMaxUnlocked']: Math.max(reservation.targetLevel,
                reservation.subject === 'math' ? profile.mathMaxUnlocked : profile.vocabMaxUnlocked),
            [reservation.subject === 'math' ? 'mathMainLevelStartedAt' : 'vocabMainLevelStartedAt']: nowIso,
            pendingLevelUpNotification: { subject: reservation.subject, newLevel: reservation.targetLevel, achievedAt: nowIso } };
    }
    return { profile: updated, result };
}
