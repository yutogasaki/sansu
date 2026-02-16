import { describe, expect, it, vi } from "vitest";
import { createInitialProfile } from "../domain/user/profile";
import { applyNormalSessionMathTrigger, applyPeriodicTestCompletion } from "./useStudySession.logic";

describe("useStudySession.logic", () => {
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

