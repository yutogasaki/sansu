import { SubjectKey, UserProfile, PeriodicTestResult } from "../types";

type PendingPaperTest = NonNullable<UserProfile["pendingPaperTests"]>[number];

export const upsertPendingPaperTest = (
    profile: UserProfile,
    subject: SubjectKey,
    level: number
): UserProfile => {
    const newPending: PendingPaperTest = {
        id: crypto.randomUUID(),
        subject,
        level,
        createdAt: new Date().toISOString(),
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
    const newResult: PeriodicTestResult = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        subject: pendingPaperTest.subject,
        level: pendingPaperTest.level,
        mode: "manual",
        method: "paper",
        correctCount,
        totalQuestions: 20,
        score: Math.round((correctCount / 20) * 100),
        durationSeconds: 0,
    };

    const updatedPendingTests = (profile.pendingPaperTests || []).filter(pt => pt.id !== pendingPaperTest.id);
    return {
        ...profile,
        pendingPaperTests: updatedPendingTests.length > 0 ? updatedPendingTests : undefined,
        testHistory: [...(profile.testHistory || []), newResult],
    };
};

