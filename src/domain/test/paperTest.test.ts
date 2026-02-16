import { describe, expect, it, vi } from "vitest";
import { createInitialProfile } from "../user/profile";
import { recordPaperTestScore, upsertPendingPaperTest } from "./paperTest";

describe("paperTest helpers", () => {
    it("upsertPendingPaperTest replaces existing pending test for same subject", () => {
        const profile = createInitialProfile("T", 1, 1, 1, "mix");
        profile.pendingPaperTests = [
            { id: "old-math", subject: "math", level: 2, createdAt: "2026-02-10T00:00:00.000Z" },
            { id: "old-vocab", subject: "vocab", level: 1, createdAt: "2026-02-11T00:00:00.000Z" },
        ];

        const next = upsertPendingPaperTest(profile, "math", 5);

        expect(next.pendingPaperTests).toBeDefined();
        expect(next.pendingPaperTests?.length).toBe(2);
        expect(next.pendingPaperTests?.some(t => t.id === "old-math")).toBe(false);
        expect(next.pendingPaperTests?.some(t => t.id === "old-vocab")).toBe(true);
        expect(next.pendingPaperTests?.find(t => t.subject === "math")?.level).toBe(5);
    });

    it("recordPaperTestScore appends history with paper method and removes pending id", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-02-16T12:00:00.000Z"));

        const profile = createInitialProfile("T", 1, 1, 1, "mix");
        profile.pendingPaperTests = [
            { id: "p-1", subject: "math", level: 3, createdAt: "2026-02-15T00:00:00.000Z" },
        ];
        profile.testHistory = [];

        const next = recordPaperTestScore(profile, { id: "p-1", subject: "math", level: 3 }, 17);
        const history = next.testHistory || [];

        expect(history.length).toBe(1);
        expect(history[0].subject).toBe("math");
        expect(history[0].method).toBe("paper");
        expect(history[0].mode).toBe("manual");
        expect(history[0].score).toBe(85);
        expect(next.pendingPaperTests).toBeUndefined();
    });

    it("recordPaperTestScore keeps other pending tests and rounds score", () => {
        const profile = createInitialProfile("T", 1, 1, 1, "mix");
        profile.pendingPaperTests = [
            { id: "p-1", subject: "math", level: 3, createdAt: "2026-02-15T00:00:00.000Z" },
            { id: "p-2", subject: "vocab", level: 4, createdAt: "2026-02-15T00:00:00.000Z" },
        ];
        profile.testHistory = [];

        const next = recordPaperTestScore(profile, { id: "p-1", subject: "math", level: 3 }, 13);
        const history = next.testHistory || [];

        expect(history[0].score).toBe(65);
        expect(next.pendingPaperTests?.length).toBe(1);
        expect(next.pendingPaperTests?.[0].id).toBe("p-2");
    });

    it("recordPaperTestScore clamps out-of-range correctCount to 0..20", () => {
        const profile = createInitialProfile("T", 1, 1, 1, "mix");
        profile.pendingPaperTests = [
            { id: "p-1", subject: "math", level: 3, createdAt: "2026-02-15T00:00:00.000Z" },
        ];
        profile.testHistory = [];

        const over = recordPaperTestScore(profile, { id: "p-1", subject: "math", level: 3 }, 25);
        const overResult = (over.testHistory || [])[0];
        expect(overResult.correctCount).toBe(20);
        expect(overResult.score).toBe(100);

        const underProfile = createInitialProfile("T", 1, 1, 1, "mix");
        underProfile.pendingPaperTests = [
            { id: "p-2", subject: "math", level: 3, createdAt: "2026-02-15T00:00:00.000Z" },
        ];
        underProfile.testHistory = [];
        const under = recordPaperTestScore(underProfile, { id: "p-2", subject: "math", level: 3 }, -3);
        const underResult = (under.testHistory || [])[0];
        expect(underResult.correctCount).toBe(0);
        expect(underResult.score).toBe(0);
    });
});
