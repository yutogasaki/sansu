import { SubjectKey, UserProfile, PeriodicTestResult, PeriodicTestSet } from "../types";

type PendingPaperTest = NonNullable<UserProfile["pendingPaperTests"]>[number];

export const upsertPendingPaperTest = (
    profile: UserProfile,
    subject: SubjectKey,
    level: number,
    testSet?: PeriodicTestSet,
): UserProfile => {
    const newPending: PendingPaperTest = {
        id: crypto.randomUUID(),
        subject,
        level,
        createdAt: new Date().toISOString(),
        ...(testSet ? { testSet: structuredClone(testSet) } : {}),
        mode: profile.periodicTestState?.[subject]?.isPending ? "auto" : "manual",
    };

    const nextPending = [
        ...(profile.pendingPaperTests || []).filter(t => t.subject !== subject),
        newPending,
    ];

    return {
        ...profile,
        pendingPaperTests: nextPending,
    };
};

export const recordPaperTestScore = (
    profile: UserProfile,
    pendingPaperTest: Pick<PendingPaperTest, "id" | "subject" | "level">,
    correctCount: number
): UserProfile => {
    const ownedPending = profile.pendingPaperTests?.find(test => test.id === pendingPaperTest.id);
    // Already scored/cancelled, stale modal, or a paper owned by another profile.
    if (!ownedPending || ownedPending.subject !== pendingPaperTest.subject
        || ownedPending.level !== pendingPaperTest.level) return profile;
    if (!Number.isFinite(correctCount)) throw new Error("正解数を確認してください。");
    const normalizedCorrectCount = Math.max(0, Math.min(20, Math.round(correctCount)));

    const newResult: PeriodicTestResult = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        subject: pendingPaperTest.subject,
        level: pendingPaperTest.level,
        mode: ownedPending.mode ?? "manual",
        method: "paper",
        correctCount: normalizedCorrectCount,
        totalQuestions: 20,
        score: Math.round((normalizedCorrectCount / 20) * 100),
        durationSeconds: 0,
    };

    const updatedPendingTests = (profile.pendingPaperTests || []).filter(pt => pt.id !== pendingPaperTest.id);
    const currentSet = profile.periodicTestSets?.[ownedPending.subject];
    const matchesCurrentSet = ownedPending.testSet && currentSet
        && JSON.stringify(ownedPending.testSet) === JSON.stringify(currentSet);
    const completesAutomatic = matchesCurrentSet && ownedPending.mode === "auto"
        && profile.periodicTestState?.[ownedPending.subject]?.isPending;
    const canReleaseSet = matchesCurrentSet
        && (completesAutomatic || !profile.periodicTestState?.[ownedPending.subject]?.isPending);
    const nextSets = { ...profile.periodicTestSets };
    if (canReleaseSet) delete nextSets[ownedPending.subject];
    return {
        ...profile,
        pendingPaperTests: updatedPendingTests.length > 0 ? updatedPendingTests : undefined,
        testHistory: [...(profile.testHistory || []), newResult],
        ...(canReleaseSet ? { periodicTestSets: nextSets } : {}),
        ...(completesAutomatic ? {
            periodicTestState: {
                ...profile.periodicTestState!,
                [ownedPending.subject]: { isPending: false, reason: null, lastTriggeredAt: Date.now() },
            },
        } : {}),
    };
};

export const cancelPendingPaperTest = (profile: UserProfile, paperId: string): UserProfile => {
    if (!profile.pendingPaperTests?.some(test => test.id === paperId)) return profile;
    const remaining = profile.pendingPaperTests.filter(test => test.id !== paperId);
    return { ...profile, pendingPaperTests: remaining.length ? remaining : undefined };
};
