import { SubjectKey, TriggerState, UserProfile, PeriodicTestResult, PeriodicTestState } from "../domain/types";
import { BLOCK_SIZE } from "./blockGenerators";
import type { SessionKind } from "./blockGenerators";

type SessionStats = {
    correct: number;
    total: number;
    durationSeconds: number;
    timeLimitSeconds?: number;
    timedOut?: boolean;
};

type SessionCompletionOptions = {
    currentProfile: UserProfile;
    sessionKind: SessionKind;
    sessionStats: SessionStats;
    now: number;
    focusSubject?: SubjectKey;
    checkMathTrigger?: (profile: UserProfile) => Promise<{ isTriggered: boolean; reason: TriggerState["reason"] }>;
};

type AttemptProgressionOptions = {
    currentProfile: UserProfile;
    subject: SubjectKey;
    nowIso: string;
    checkMathUnlock: (profile: UserProfile) => Promise<boolean>;
    checkMathPromotion: (profile: UserProfile, targetLevel: number) => Promise<boolean>;
    checkVocabUnlockReadiness: (profile: UserProfile) => boolean;
    checkVocabPromotion: (profile: UserProfile) => Promise<boolean>;
};

const createDefaultPeriodicTestState = (): PeriodicTestState => ({
    math: { isPending: false, lastTriggeredAt: null, reason: null },
    vocab: { isPending: false, lastTriggeredAt: null, reason: null },
});

export const isFixedSessionKind = (sessionKind?: SessionKind | null): boolean =>
    sessionKind === "periodic-test" || sessionKind === "weak-review" || sessionKind === "check-event";

export const resolveSessionBlockSize = (sessionKind?: SessionKind | null): number => {
    if (sessionKind === "periodic-test" || sessionKind === "check-event") {
        return 20;
    }
    return BLOCK_SIZE;
};

export const shouldPrefetchNextBlock = ({
    currentIndex,
    loading,
    queueLength,
    sessionKind,
}: {
    currentIndex: number;
    loading: boolean;
    queueLength: number;
    sessionKind?: SessionKind | null;
}): boolean => {
    if (loading || isFixedSessionKind(sessionKind)) {
        return false;
    }

    return queueLength - currentIndex < 3;
};

export const applyPeriodicTestCompletion = (
    currentProfile: UserProfile,
    sessionStats: SessionStats,
    now: number,
    focusSubject?: SubjectKey
): UserProfile => {
    const subject: SubjectKey =
        focusSubject || (currentProfile.subjectMode === "vocab" ? "vocab" : "math");
    const testSet = currentProfile.periodicTestSets?.[subject];
    const level = testSet?.level ?? (subject === "math" ? currentProfile.mathMainLevel : currentProfile.vocabMainLevel);
    const safeTotal = Math.max(1, sessionStats.total);
    const safeCorrect = Math.max(0, Math.min(safeTotal, sessionStats.correct));

    const result: PeriodicTestResult = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
        timestamp: now,
        subject,
        level,
        mode: currentProfile.periodicTestState?.[subject]?.isPending ? "auto" : "manual",
        method: "online",
        correctCount: safeCorrect,
        totalQuestions: safeTotal,
        score: Math.round((safeCorrect / safeTotal) * 100),
        durationSeconds: sessionStats.durationSeconds,
        timeLimitSeconds: sessionStats.timeLimitSeconds,
        timedOut: sessionStats.timedOut,
    };

    const nextState = { ...(currentProfile.periodicTestState || createDefaultPeriodicTestState()) };
    nextState[subject] = {
        isPending: false,
        lastTriggeredAt: now,
        reason: null,
    };

    const nextSets = { ...(currentProfile.periodicTestSets || {}) };
    delete nextSets[subject];

    return {
        ...currentProfile,
        testHistory: [...(currentProfile.testHistory || []), result],
        periodicTestState: nextState,
        periodicTestSets: nextSets,
    };
};

export const applyNormalSessionMathTrigger = (
    currentProfile: UserProfile,
    mathTrigger: { isTriggered: boolean; reason: TriggerState["reason"] }
): UserProfile | null => {
    if (!mathTrigger.isTriggered) return null;

    const nextState = { ...(currentProfile.periodicTestState || createDefaultPeriodicTestState()) };
    if (nextState.math.isPending) return null;

    nextState.math = {
        isPending: true,
        lastTriggeredAt: nextState.math.lastTriggeredAt,
        reason: mathTrigger.reason,
    };

    return {
        ...currentProfile,
        periodicTestState: nextState,
    };
};

export const resolveSessionCompletionProfileUpdate = async ({
    currentProfile,
    sessionKind,
    sessionStats,
    now,
    focusSubject,
    checkMathTrigger,
}: SessionCompletionOptions): Promise<UserProfile | null> => {
    if (sessionKind === "periodic-test") {
        return applyPeriodicTestCompletion(currentProfile, sessionStats, now, focusSubject);
    }

    if (sessionKind === "normal" || sessionKind === "review") {
        if (!checkMathTrigger) {
            return null;
        }

        const mathTrigger = await checkMathTrigger(currentProfile);
        return applyNormalSessionMathTrigger(currentProfile, mathTrigger);
    }

    return null;
};

const ensureMainEnabled = (
    levels: UserProfile["mathLevels"] | UserProfile["vocabLevels"],
    mainLevel: number
) => {
    if (!levels) return levels;
    const hasEnabled = levels.some(level => level.enabled);
    if (hasEnabled) return levels;
    return levels.map(level => (level.level === mainLevel ? { ...level, enabled: true } : level));
};

export const resolveProfileProgressionAfterAttempt = async ({
    currentProfile,
    subject,
    nowIso,
    checkMathUnlock,
    checkMathPromotion,
    checkVocabUnlockReadiness,
    checkVocabPromotion,
}: AttemptProgressionOptions): Promise<UserProfile> => {
    let updatedProfile = currentProfile;

    if (subject === "math") {
        if (updatedProfile.mathMainLevel < 20 && updatedProfile.mathMaxUnlocked === updatedProfile.mathMainLevel) {
            const canUnlock = await checkMathUnlock(updatedProfile);
            if (canUnlock) {
                const nextLevel = Math.min(20, updatedProfile.mathMaxUnlocked + 1);
                const mathLevels = updatedProfile.mathLevels
                    ? updatedProfile.mathLevels.map(level => (level.level <= nextLevel ? { ...level, unlocked: true } : level))
                    : updatedProfile.mathLevels;
                updatedProfile = { ...updatedProfile, mathMaxUnlocked: nextLevel, mathLevels };
            }
        }

        if (updatedProfile.mathMaxUnlocked > updatedProfile.mathMainLevel) {
            const nextMain = updatedProfile.mathMaxUnlocked;
            const canPromote = await checkMathPromotion(updatedProfile, nextMain);
            if (canPromote) {
                const mathLevels = updatedProfile.mathLevels
                    ? ensureMainEnabled(
                        updatedProfile.mathLevels.map(level =>
                            level.level === nextMain
                                ? { ...level, enabled: true, recentAnswersNonReview: [] }
                                : level
                        ),
                        nextMain
                    )
                    : updatedProfile.mathLevels;
                updatedProfile = {
                    ...updatedProfile,
                    mathMainLevel: nextMain,
                    mathMainLevelStartedAt: nowIso,
                    mathLevels,
                    pendingLevelUpNotification: {
                        subject: "math",
                        newLevel: nextMain,
                        achievedAt: nowIso,
                    },
                };
            }
        }

        return updatedProfile;
    }

    if (updatedProfile.vocabMainLevel < 20 && updatedProfile.vocabMaxUnlocked === updatedProfile.vocabMainLevel) {
        if (checkVocabUnlockReadiness(updatedProfile)) {
            const nextLevel = Math.min(20, updatedProfile.vocabMaxUnlocked + 1);
            const vocabLevels = updatedProfile.vocabLevels
                ? updatedProfile.vocabLevels.map(level => (level.level <= nextLevel ? { ...level, unlocked: true } : level))
                : updatedProfile.vocabLevels;
            updatedProfile = { ...updatedProfile, vocabMaxUnlocked: nextLevel, vocabLevels };
        }
    }

    if (updatedProfile.vocabMaxUnlocked > updatedProfile.vocabMainLevel) {
        const nextMain = updatedProfile.vocabMaxUnlocked;
        const canPromote = await checkVocabPromotion(updatedProfile);
        if (canPromote) {
            const vocabLevels = updatedProfile.vocabLevels
                ? ensureMainEnabled(
                    updatedProfile.vocabLevels.map(level =>
                        level.level === nextMain
                            ? { ...level, enabled: true, recentAnswersNonReview: [] }
                            : level
                    ),
                    nextMain
                )
                : updatedProfile.vocabLevels;
            updatedProfile = {
                ...updatedProfile,
                vocabMainLevel: nextMain,
                vocabMainLevelStartedAt: nowIso,
                vocabLevels,
                pendingLevelUpNotification: {
                    subject: "vocab",
                    newLevel: nextMain,
                    achievedAt: nowIso,
                },
            };
        }
    }

    return updatedProfile;
};
