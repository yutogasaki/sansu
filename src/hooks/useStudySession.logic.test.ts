import { describe, expect, it, vi } from "vitest";
import { createInitialProfile } from "../domain/user/profile";
import {
    applyNormalSessionMathTrigger,
    applyPeriodicTestCompletion,
    resolveProfileProgressionAfterAttempt,
    resolveSessionCompletionProfileUpdate,
} from "./useStudySession.logic";

describe("useStudySession.logic", () => {
    it("resolveSessionCompletionProfileUpdate completes periodic tests without trigger checks", async () => {
        const now = new Date("2026-02-16T12:00:00.000Z").getTime();
        const profile = createInitialProfile("T", 1, 3, 2, "math");
        profile.periodicTestState = {
            math: { isPending: true, lastTriggeredAt: null, reason: "slow" },
            vocab: { isPending: false, lastTriggeredAt: null, reason: null },
        };
        profile.periodicTestSets = {
            math: { subject: "math", level: 4, createdAt: "2026-02-16", problems: [] },
        };

        const checkMathTrigger = vi.fn();
        const updated = await resolveSessionCompletionProfileUpdate({
            currentProfile: profile,
            sessionKind: "periodic-test",
            sessionStats: { correct: 14, total: 20, durationSeconds: 240 },
            now,
            focusSubject: "math",
            checkMathTrigger,
        });

        expect(checkMathTrigger).not.toHaveBeenCalled();
        expect(updated?.testHistory?.at(-1)?.mode).toBe("auto");
        expect(updated?.periodicTestState?.math.isPending).toBe(false);
    });

    it("resolveSessionCompletionProfileUpdate checks math trigger for normal sessions", async () => {
        const profile = createInitialProfile("T", 1, 1, 1, "mix");
        profile.periodicTestState = {
            math: { isPending: false, lastTriggeredAt: 123, reason: null },
            vocab: { isPending: false, lastTriggeredAt: null, reason: null },
        };

        const checkMathTrigger = vi.fn().mockResolvedValue({ isTriggered: true, reason: "struggle" });
        const updated = await resolveSessionCompletionProfileUpdate({
            currentProfile: profile,
            sessionKind: "normal",
            sessionStats: { correct: 10, total: 12, durationSeconds: 90 },
            now: Date.now(),
            checkMathTrigger,
        });

        expect(checkMathTrigger).toHaveBeenCalledWith(profile);
        expect(updated?.periodicTestState?.math.isPending).toBe(true);
        expect(updated?.periodicTestState?.math.reason).toBe("struggle");
    });

    it("resolveSessionCompletionProfileUpdate also checks math trigger for review sessions", async () => {
        const profile = createInitialProfile("T", 1, 1, 1, "mix");
        profile.periodicTestState = {
            math: { isPending: false, lastTriggeredAt: null, reason: null },
            vocab: { isPending: false, lastTriggeredAt: null, reason: null },
        };

        const checkMathTrigger = vi.fn().mockResolvedValue({ isTriggered: false, reason: null });
        const updated = await resolveSessionCompletionProfileUpdate({
            currentProfile: profile,
            sessionKind: "review",
            sessionStats: { correct: 5, total: 5, durationSeconds: 60 },
            now: Date.now(),
            checkMathTrigger,
        });

        expect(checkMathTrigger).toHaveBeenCalledWith(profile);
        expect(updated).toBeNull();
    });

    it("resolveSessionCompletionProfileUpdate ignores non-completing session kinds", async () => {
        const profile = createInitialProfile("T", 1, 1, 1, "mix");
        const checkMathTrigger = vi.fn();

        const updated = await resolveSessionCompletionProfileUpdate({
            currentProfile: profile,
            sessionKind: "check-event",
            sessionStats: { correct: 20, total: 20, durationSeconds: 180 },
            now: Date.now(),
            checkMathTrigger,
        });

        expect(checkMathTrigger).not.toHaveBeenCalled();
        expect(updated).toBeNull();
    });

    it("resolveProfileProgressionAfterAttempt unlocks and promotes math levels", async () => {
        const profile = createInitialProfile("T", 1, 1, 1, "mix");
        profile.mathLevels = profile.mathLevels?.map(level =>
            level.level === 3
                ? { ...level, recentAnswersNonReview: [true, false] }
                : level
        );

        const checkMathUnlock = vi.fn().mockResolvedValue(true);
        const checkMathPromotion = vi.fn().mockResolvedValue(true);
        const checkVocabPromotion = vi.fn();
        const updated = await resolveProfileProgressionAfterAttempt({
            currentProfile: profile,
            subject: "math",
            nowIso: "2026-03-17T00:00:00.000Z",
            checkMathUnlock,
            checkMathPromotion,
            checkVocabUnlockReadiness: vi.fn(),
            checkVocabPromotion,
        });

        expect(checkMathUnlock).toHaveBeenCalledWith(profile);
        expect(checkMathPromotion).toHaveBeenCalledWith(expect.objectContaining({ mathMaxUnlocked: 3 }), 3);
        expect(checkVocabPromotion).not.toHaveBeenCalled();
        expect(updated.mathMaxUnlocked).toBe(3);
        expect(updated.mathMainLevel).toBe(3);
        expect(updated.mathMainLevelStartedAt).toBe("2026-03-17T00:00:00.000Z");
        expect(updated.pendingLevelUpNotification).toEqual({
            subject: "math",
            newLevel: 3,
            achievedAt: "2026-03-17T00:00:00.000Z",
        });
        expect(updated.mathLevels?.find(level => level.level === 3)).toEqual(expect.objectContaining({
            unlocked: true,
            enabled: true,
            recentAnswersNonReview: [],
        }));
    });

    it("resolveProfileProgressionAfterAttempt unlocks vocab without promotion when only readiness passes", async () => {
        const profile = createInitialProfile("T", 1, 1, 1, "vocab");
        const checkVocabUnlockReadiness = vi.fn().mockReturnValue(true);
        const checkVocabPromotion = vi.fn().mockResolvedValue(false);

        const updated = await resolveProfileProgressionAfterAttempt({
            currentProfile: profile,
            subject: "vocab",
            nowIso: "2026-03-17T00:00:00.000Z",
            checkMathUnlock: vi.fn(),
            checkMathPromotion: vi.fn(),
            checkVocabUnlockReadiness,
            checkVocabPromotion,
        });

        expect(checkVocabUnlockReadiness).toHaveBeenCalledWith(profile);
        expect(checkVocabPromotion).toHaveBeenCalledWith(expect.objectContaining({ vocabMaxUnlocked: 2 }));
        expect(updated.vocabMaxUnlocked).toBe(2);
        expect(updated.vocabMainLevel).toBe(1);
        expect(updated.pendingLevelUpNotification).toBeUndefined();
        expect(updated.vocabLevels?.find(level => level.level === 2)).toEqual(expect.objectContaining({
            unlocked: true,
            enabled: false,
        }));
    });

    it("resolveProfileProgressionAfterAttempt promotes an already unlocked vocab level", async () => {
        const profile = createInitialProfile("T", 1, 1, 1, "vocab");
        profile.vocabMaxUnlocked = 2;
        profile.vocabLevels = profile.vocabLevels?.map(level => {
            if (level.level === 2) {
                return {
                    ...level,
                    unlocked: true,
                    enabled: false,
                    recentAnswersNonReview: [true, false, true],
                };
            }
            return level;
        });

        const checkVocabPromotion = vi.fn().mockResolvedValue(true);
        const updated = await resolveProfileProgressionAfterAttempt({
            currentProfile: profile,
            subject: "vocab",
            nowIso: "2026-03-17T00:00:00.000Z",
            checkMathUnlock: vi.fn(),
            checkMathPromotion: vi.fn(),
            checkVocabUnlockReadiness: vi.fn(),
            checkVocabPromotion,
        });

        expect(checkVocabPromotion).toHaveBeenCalledWith(profile);
        expect(updated.vocabMainLevel).toBe(2);
        expect(updated.vocabMainLevelStartedAt).toBe("2026-03-17T00:00:00.000Z");
        expect(updated.pendingLevelUpNotification).toEqual({
            subject: "vocab",
            newLevel: 2,
            achievedAt: "2026-03-17T00:00:00.000Z",
        });
        expect(updated.vocabLevels?.find(level => level.level === 2)).toEqual(expect.objectContaining({
            unlocked: true,
            enabled: true,
            recentAnswersNonReview: [],
        }));
    });

    it("resolveProfileProgressionAfterAttempt returns the same profile when no progression check passes", async () => {
        const profile = createInitialProfile("T", 1, 1, 1, "mix");
        const updated = await resolveProfileProgressionAfterAttempt({
            currentProfile: profile,
            subject: "math",
            nowIso: "2026-03-17T00:00:00.000Z",
            checkMathUnlock: vi.fn().mockResolvedValue(false),
            checkMathPromotion: vi.fn(),
            checkVocabUnlockReadiness: vi.fn(),
            checkVocabPromotion: vi.fn(),
        });

        expect(updated).toBe(profile);
    });

    it("applyPeriodicTestCompletion appends result and clears pending/set", () => {
        vi.useFakeTimers();
        const now = new Date("2026-02-16T12:00:00.000Z").getTime();
        vi.setSystemTime(now);

        const profile = createInitialProfile("T", 1, 3, 2, "math");
        profile.periodicTestState = {
            math: { isPending: true, lastTriggeredAt: null, reason: "slow" },
            vocab: { isPending: false, lastTriggeredAt: null, reason: null },
        };
        profile.periodicTestSets = {
            math: { subject: "math", level: 4, createdAt: "2026-02-16", problems: [] },
        };
        profile.testHistory = [];

        const updated = applyPeriodicTestCompletion(profile, { correct: 15, total: 20, durationSeconds: 240 }, now, "math");

        expect(updated.testHistory?.length).toBe(1);
        expect(updated.testHistory?.[0].mode).toBe("auto");
        expect(updated.testHistory?.[0].score).toBe(75);
        expect(updated.periodicTestState?.math.isPending).toBe(false);
        expect(updated.periodicTestState?.math.lastTriggeredAt).toBe(now);
        expect(updated.periodicTestSets?.math).toBeUndefined();
    });

    it("applyPeriodicTestCompletion uses manual mode when subject is not pending", () => {
        const now = new Date("2026-02-16T12:00:00.000Z").getTime();
        const profile = createInitialProfile("T", 1, 3, 2, "vocab");
        profile.periodicTestState = {
            math: { isPending: false, lastTriggeredAt: null, reason: null },
            vocab: { isPending: false, lastTriggeredAt: null, reason: null },
        };
        profile.testHistory = [];

        const updated = applyPeriodicTestCompletion(profile, { correct: 8, total: 10, durationSeconds: 100 }, now);
        expect(updated.testHistory?.[0].subject).toBe("vocab");
        expect(updated.testHistory?.[0].mode).toBe("manual");
        expect(updated.testHistory?.[0].score).toBe(80);
    });

    it("applyNormalSessionMathTrigger returns updated profile when triggered and not pending", () => {
        const profile = createInitialProfile("T", 1, 1, 1, "mix");
        profile.periodicTestState = {
            math: { isPending: false, lastTriggeredAt: 123, reason: null },
            vocab: { isPending: false, lastTriggeredAt: null, reason: null },
        };

        const updated = applyNormalSessionMathTrigger(profile, { isTriggered: true, reason: "struggle" });

        expect(updated).not.toBeNull();
        expect(updated?.periodicTestState?.math.isPending).toBe(true);
        expect(updated?.periodicTestState?.math.reason).toBe("struggle");
        expect(updated?.periodicTestState?.math.lastTriggeredAt).toBe(123);
    });

    it("applyNormalSessionMathTrigger returns null when not triggered or already pending", () => {
        const profile = createInitialProfile("T", 1, 1, 1, "mix");
        profile.periodicTestState = {
            math: { isPending: true, lastTriggeredAt: 123, reason: null },
            vocab: { isPending: false, lastTriggeredAt: null, reason: null },
        };

        expect(applyNormalSessionMathTrigger(profile, { isTriggered: false, reason: null })).toBeNull();
        expect(applyNormalSessionMathTrigger(profile, { isTriggered: true, reason: "slow" })).toBeNull();
    });
});
