import { SubjectKey, TriggerState, UserProfile, PeriodicTestResult, PeriodicTestState } from "../domain/types";

type SessionStats = {
    correct: number;
    total: number;
    durationSeconds: number;
    timeLimitSeconds?: number;
    timedOut?: boolean;
};

const createDefaultPeriodicTestState = (): PeriodicTestState => ({
    math: { isPending: false, lastTriggeredAt: null, reason: null },
    vocab: { isPending: false, lastTriggeredAt: null, reason: null },
});

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

