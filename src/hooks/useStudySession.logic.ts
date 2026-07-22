import { SubjectKey, TriggerState, UserProfile, PeriodicTestResult, PeriodicTestSet, PeriodicTestState } from "../domain/types";
import { BLOCK_SIZE } from "./blockGenerators";
import type { SessionKind } from "./blockGenerators";
import { MAX_MATH_LEVEL, MAX_VOCAB_LEVEL } from "../domain/math/curriculum";

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

export const shouldRecordLearningAttempt = (sessionKind?: SessionKind | null): boolean =>
    sessionKind !== "periodic-test" && sessionKind !== "dev";

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

    const isAutomatic = currentProfile.periodicTestState?.[subject]?.isPending === true;
    const result: PeriodicTestResult = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
        timestamp: now,
        subject,
        level,
        mode: isAutomatic ? "auto" : "manual",
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
        lastTriggeredAt: isAutomatic ? now : nextState[subject].lastTriggeredAt,
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

export const applyPendingPeriodicTestTrigger = (
    currentProfile: UserProfile,
    subject: SubjectKey,
    trigger: { isTriggered: boolean; reason: TriggerState["reason"] },
    testSet?: PeriodicTestSet,
): UserProfile | null => {
    if (!trigger.isTriggered) return null;

    const nextState = { ...(currentProfile.periodicTestState || createDefaultPeriodicTestState()) };
    if (nextState[subject].isPending) return null;

    nextState[subject] = {
        isPending: true,
        lastTriggeredAt: nextState[subject].lastTriggeredAt,
        reason: trigger.reason,
    };

    return {
        ...currentProfile,
        periodicTestState: nextState,
        periodicTestSets: testSet
            ? {
                ...(currentProfile.periodicTestSets || {}),
                [subject]: testSet,
            }
            : currentProfile.periodicTestSets,
    };
};

export const resolveSessionCompletionProfileUpdate = async ({
    currentProfile,
    sessionKind,
    sessionStats,
    now,
    focusSubject,
}: SessionCompletionOptions): Promise<UserProfile | null> => {
    if (sessionKind === "periodic-test") {
        return applyPeriodicTestCompletion(currentProfile, sessionStats, now, focusSubject);
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

// ---------------------------------------------------------------------------
// In-Session State Transition Logic
// ---------------------------------------------------------------------------

export type FeedbackState = "none" | "correct" | "incorrect" | "skipped";

/**
 * 回答の正誤を判定する。
 * Study.tsx の handleSubmit 内のロジックを純粋関数として抽出。
 */
export const checkAnswer = (
    inputType: "number" | "choice" | "multi-number",
    correctAnswer: string | string[],
    userInput: string,
    userInputs: string[],
    choiceValue?: string,
): boolean => {
    if (inputType === "choice") {
        return choiceValue === correctAnswer;
    }
    if (inputType === "multi-number") {
        const correctArr = correctAnswer as string[];
        if (correctArr.length !== userInputs.length) return false;
        return userInputs.every((val, idx) => val === correctArr[idx]);
    }
    return userInput === correctAnswer;
};

/**
 * 100問ごとの休憩画面を表示すべきか判定する（エンドレスセッション用）。
 */
export const shouldShowEndlessBreak = (
    currentIndex: number,
    isFinished: boolean,
    sessionKind?: SessionKind | null,
): boolean => {
    if (isFixedSessionKind(sessionKind)) return false;
    return currentIndex > 0 && currentIndex % 100 === 0 && !isFinished;
};

/**
 * 固定セッション（periodic-test / weak-review / check-event）が完了したか判定する。
 */
export const isFixedSessionComplete = (
    currentIndex: number,
    blockSize: number,
    sessionKind?: SessionKind | null,
    loading?: boolean,
): boolean => {
    if (!isFixedSessionKind(sessionKind)) return false;
    if (loading) return false;
    return currentIndex >= blockSize && blockSize > 0;
};

export type FixedSessionCompletionPhase = "idle" | "saving" | "error" | "saved";
export type FixedSessionCompletionPresentation = "none" | "saving" | "error";

export const resolveFixedSessionCompletionPresentation = (
    phase: FixedSessionCompletionPhase,
    completionDue: boolean,
    isFinished: boolean,
): FixedSessionCompletionPresentation => {
    if (phase === "error") return "error";
    if (
        phase === "saving"
        || (phase === "idle" && completionDue)
        || (phase === "saved" && !isFinished)
    ) return "saving";
    return "none";
};

/**
 * フィードバック表示中の入力ロック判定。
 */
export const isInputLocked = (
    feedback: FeedbackState,
    isProcessing: boolean,
): boolean => {
    return feedback !== "none" || isProcessing;
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
        if (updatedProfile.mathMainLevel < MAX_MATH_LEVEL && updatedProfile.mathMaxUnlocked === updatedProfile.mathMainLevel) {
            const canUnlock = await checkMathUnlock(updatedProfile);
            if (canUnlock) {
                const nextLevel = Math.min(MAX_MATH_LEVEL, updatedProfile.mathMaxUnlocked + 1);
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

    if (updatedProfile.vocabMainLevel < MAX_VOCAB_LEVEL && updatedProfile.vocabMaxUnlocked === updatedProfile.vocabMainLevel) {
        if (checkVocabUnlockReadiness(updatedProfile)) {
            const nextLevel = Math.min(MAX_VOCAB_LEVEL, updatedProfile.vocabMaxUnlocked + 1);
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

export const applyResolvedProgressionToLatestProfile = ({
    baseProfile,
    resolvedProfile,
    latestProfile,
    subject,
}: {
    baseProfile: UserProfile;
    resolvedProfile: UserProfile;
    latestProfile: UserProfile;
    subject: SubjectKey;
}): UserProfile => {
    let nextProfile = latestProfile;

    if (subject === "math") {
        const unlockTarget = resolvedProfile.mathMaxUnlocked > baseProfile.mathMaxUnlocked
            ? resolvedProfile.mathMaxUnlocked
            : null;
        if (unlockTarget !== null && unlockTarget > nextProfile.mathMaxUnlocked) {
            nextProfile = {
                ...nextProfile,
                mathMaxUnlocked: unlockTarget,
                mathLevels: nextProfile.mathLevels?.map(level => (
                    level.level <= unlockTarget ? { ...level, unlocked: true } : level
                )),
            };
        }

        const promotionTarget = resolvedProfile.mathMainLevel > baseProfile.mathMainLevel
            ? resolvedProfile.mathMainLevel
            : null;
        if (
            promotionTarget !== null
            && promotionTarget > nextProfile.mathMainLevel
            && promotionTarget <= nextProfile.mathMaxUnlocked
        ) {
            nextProfile = {
                ...nextProfile,
                mathMainLevel: promotionTarget,
                mathMainLevelStartedAt: resolvedProfile.mathMainLevelStartedAt,
                mathLevels: nextProfile.mathLevels
                    ? ensureMainEnabled(
                        nextProfile.mathLevels.map(level => (
                            level.level === promotionTarget
                                ? { ...level, enabled: true, recentAnswersNonReview: [] }
                                : level
                        )),
                        promotionTarget,
                    )
                    : nextProfile.mathLevels,
                pendingLevelUpNotification: resolvedProfile.pendingLevelUpNotification,
            };
        }

        return nextProfile;
    }

    const unlockTarget = resolvedProfile.vocabMaxUnlocked > baseProfile.vocabMaxUnlocked
        ? resolvedProfile.vocabMaxUnlocked
        : null;
    if (unlockTarget !== null && unlockTarget > nextProfile.vocabMaxUnlocked) {
        nextProfile = {
            ...nextProfile,
            vocabMaxUnlocked: unlockTarget,
            vocabLevels: nextProfile.vocabLevels?.map(level => (
                level.level <= unlockTarget ? { ...level, unlocked: true } : level
            )),
        };
    }

    const promotionTarget = resolvedProfile.vocabMainLevel > baseProfile.vocabMainLevel
        ? resolvedProfile.vocabMainLevel
        : null;
    if (
        promotionTarget !== null
        && promotionTarget > nextProfile.vocabMainLevel
        && promotionTarget <= nextProfile.vocabMaxUnlocked
    ) {
        nextProfile = {
            ...nextProfile,
            vocabMainLevel: promotionTarget,
            vocabMainLevelStartedAt: resolvedProfile.vocabMainLevelStartedAt,
            vocabLevels: nextProfile.vocabLevels
                ? ensureMainEnabled(
                    nextProfile.vocabLevels.map(level => (
                        level.level === promotionTarget
                            ? { ...level, enabled: true, recentAnswersNonReview: [] }
                            : level
                    )),
                    promotionTarget,
                )
                : nextProfile.vocabLevels,
            pendingLevelUpNotification: resolvedProfile.pendingLevelUpNotification,
        };
    }

    return nextProfile;
};
