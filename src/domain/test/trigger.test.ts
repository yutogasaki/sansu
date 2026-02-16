import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialProfile } from "../user/profile";
import { MemoryState } from "../types";

const { mockMemoryMathBulkGet, mockMemoryVocabBulkGet } = vi.hoisted(() => ({
    mockMemoryMathBulkGet: vi.fn(),
    mockMemoryVocabBulkGet: vi.fn(),
}));

vi.mock("../math/curriculum", () => ({
    getSkillsForLevel: vi.fn(() => [
        "m1", "m2", "m3", "m4", "m5",
        "m6", "m7", "m8", "m9", "m10",
    ]),
}));

vi.mock("../english/words", () => ({
    ENGLISH_WORDS: [
        { id: "v1", level: 1 },
        { id: "v2", level: 1 },
        { id: "v3", level: 1 },
        { id: "v4", level: 1 },
    ],
}));

vi.mock("../../db", () => ({
    db: {
        memoryMath: { bulkGet: mockMemoryMathBulkGet },
        memoryVocab: { bulkGet: mockMemoryVocabBulkGet },
    },
}));

import { checkPeriodTestTrigger } from "./trigger";

const makeMemory = (id: string, strength: number, totalAnswers = 0): MemoryState => ({
    id,
    strength,
    nextReview: "2026-02-16T00:00:00.000Z",
    totalAnswers,
    correctAnswers: 0,
    incorrectAnswers: 0,
    skippedAnswers: 0,
    updatedAt: "2026-02-16T00:00:00.000Z",
});

describe("checkPeriodTestTrigger", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-02-16T12:00:00.000Z"));
        mockMemoryMathBulkGet.mockReset();
        mockMemoryVocabBulkGet.mockReset();
    });

    it("returns not triggered when pending flag is true", async () => {
        const profile = createInitialProfile("T", 1, 1, 1, "mix");
        profile.periodicTestState = {
            math: { isPending: true, lastTriggeredAt: null, reason: null },
            vocab: { isPending: false, lastTriggeredAt: null, reason: null },
        };

        const result = await checkPeriodTestTrigger(profile, "math");

        expect(result).toEqual({ isTriggered: false, reason: null });
        expect(mockMemoryMathBulkGet).not.toHaveBeenCalled();
    });

    it("returns not triggered during cooldown window", async () => {
        const profile = createInitialProfile("T", 1, 1, 1, "mix");
        profile.periodicTestState = {
            math: { isPending: false, lastTriggeredAt: Date.now() - 3 * 24 * 60 * 60 * 1000, reason: "slow" },
            vocab: { isPending: false, lastTriggeredAt: null, reason: null },
        };

        const result = await checkPeriodTestTrigger(profile, "math");

        expect(result).toEqual({ isTriggered: false, reason: null });
        expect(mockMemoryMathBulkGet).not.toHaveBeenCalled();
    });

    it("triggers pre-levelup for math when completion rate is >= 90%", async () => {
        const profile = createInitialProfile("T", 1, 1, 1, "mix");
        mockMemoryMathBulkGet.mockResolvedValue([
            makeMemory("m1", 4), makeMemory("m2", 4), makeMemory("m3", 4), makeMemory("m4", 4), makeMemory("m5", 4),
            makeMemory("m6", 4), makeMemory("m7", 4), makeMemory("m8", 4), makeMemory("m9", 4), makeMemory("m10", 1),
        ]);

        const result = await checkPeriodTestTrigger(profile, "math");

        expect(result).toEqual({ isTriggered: true, reason: "pre-levelup" });
    });

    it("does not trigger pre-levelup for math at 80% completion", async () => {
        const profile = createInitialProfile("T", 1, 1, 1, "mix");
        profile.mathMainLevelStartedAt = new Date("2026-02-15T00:00:00.000Z").toISOString();
        mockMemoryMathBulkGet.mockResolvedValue([
            makeMemory("m1", 4), makeMemory("m2", 4), makeMemory("m3", 4), makeMemory("m4", 4), makeMemory("m5", 4),
            makeMemory("m6", 4), makeMemory("m7", 4), makeMemory("m8", 4), makeMemory("m9", 1), makeMemory("m10", 1),
        ]);

        const result = await checkPeriodTestTrigger(profile, "math");

        expect(result.isTriggered).toBe(false);
    });

    it("triggers slow for math when days in level exceed threshold", async () => {
        const profile = createInitialProfile("T", 1, 1, 1, "mix");
        profile.mathMainLevelStartedAt = new Date("2026-01-30T00:00:00.000Z").toISOString();
        mockMemoryMathBulkGet.mockResolvedValue([
            makeMemory("m1", 1, 1), makeMemory("m2", 1, 1), makeMemory("m3", 1, 1), makeMemory("m4", 1, 1), makeMemory("m5", 1, 1),
            makeMemory("m6", 1, 1), makeMemory("m7", 1, 1), makeMemory("m8", 1, 1), makeMemory("m9", 1, 1), makeMemory("m10", 1, 1),
        ]);

        const result = await checkPeriodTestTrigger(profile, "math");

        expect(result).toEqual({ isTriggered: true, reason: "slow" });
    });

    it("triggers struggle for math with high recent volume and low accuracy", async () => {
        const profile = createInitialProfile("T", 1, 1, 1, "mix");
        profile.mathMainLevelStartedAt = new Date("2026-02-15T00:00:00.000Z").toISOString();
        profile.recentAttempts = Array.from({ length: 120 }, (_, idx) => ({
            id: `a-${idx}`,
            timestamp: new Date("2026-02-15T12:00:00.000Z").toISOString(),
            subject: "math" as const,
            skillId: "m1",
            result: idx < 60 ? "correct" as const : "incorrect" as const,
        }));
        mockMemoryMathBulkGet.mockResolvedValue([
            makeMemory("m1", 1, 5), makeMemory("m2", 1, 5), makeMemory("m3", 1, 5), makeMemory("m4", 1, 5), makeMemory("m5", 1, 5),
            makeMemory("m6", 1, 5), makeMemory("m7", 1, 5), makeMemory("m8", 1, 5), makeMemory("m9", 1, 5), makeMemory("m10", 1, 5),
        ]);

        const result = await checkPeriodTestTrigger(profile, "math");

        expect(result).toEqual({ isTriggered: true, reason: "struggle" });
    });

    it("triggers pre-levelup for vocab when completion rate is >= 85%", async () => {
        const profile = createInitialProfile("T", 1, 1, 1, "mix");
        mockMemoryVocabBulkGet.mockResolvedValue([
            makeMemory("v1", 4),
            makeMemory("v2", 4),
            makeMemory("v3", 4),
            makeMemory("v4", 4),
        ]);

        const result = await checkPeriodTestTrigger(profile, "vocab");

        expect(result).toEqual({ isTriggered: true, reason: "pre-levelup" });
    });

    it("triggers slow for vocab when total count in level exceeds threshold", async () => {
        const profile = createInitialProfile("T", 1, 1, 1, "mix");
        profile.vocabMainLevelStartedAt = new Date("2026-02-16T00:00:00.000Z").toISOString();
        mockMemoryVocabBulkGet.mockResolvedValue([
            makeMemory("v1", 1, 40),
            makeMemory("v2", 1, 40),
            makeMemory("v3", 1, 40),
            makeMemory("v4", 1, 40),
        ]);

        const result = await checkPeriodTestTrigger(profile, "vocab");

        expect(result).toEqual({ isTriggered: true, reason: "slow" });
    });
});
