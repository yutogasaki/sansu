import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialProfile } from "../user/profile";
import { ensurePeriodicTestSet } from "./testSet";
import { getMathSkillFamily, getSkillsForLevel } from "../math/curriculum";

vi.mock("../user/repository", () => ({
    saveProfile: vi.fn().mockResolvedValue(undefined),
}));

describe("ensurePeriodicTestSet", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("uses level 0 math skills when the profile is on level 0 and spreads early families", async () => {
        const profile = createInitialProfile("T", 1, 0, 1, "math");
        profile.mathMainLevel = 0;
        profile.mathMaxUnlocked = 0;
        profile.periodicTestSets = {};

        const set = await ensurePeriodicTestSet(profile, "math");
        const level0Skills = new Set(getSkillsForLevel(0));

        expect(set.level).toBe(0);
        expect(set.problems).toHaveLength(20);
        expect(set.problems.every(problem => level0Skills.has(problem.categoryId))).toBe(true);
        expect(getMathSkillFamily(set.problems[0]?.categoryId || "")).not.toBe(
            getMathSkillFamily(set.problems[1]?.categoryId || "")
        );
    });

    it("keeps a 20-question test balanced when the level has only two skills", async () => {
        const profile = createInitialProfile("T", 1, 8, 1, "math");
        profile.mathMainLevel = 8;
        profile.mathMaxUnlocked = 8;
        profile.periodicTestSets = {};

        const set = await ensurePeriodicTestSet(profile, "math");
        const counts = new Map<string, number>();
        set.problems.forEach(problem => {
            counts.set(problem.categoryId, (counts.get(problem.categoryId) || 0) + 1);
        });
        const frequencies = [...counts.values()];

        expect(set.problems).toHaveLength(20);
        expect(counts.size).toBe(2);
        expect(Math.max(...frequencies) - Math.min(...frequencies)).toBeLessThanOrEqual(1);
    });

    it("preserves the triggered level snapshot after the main level advances", async () => {
        const profile = createInitialProfile("T", 1, 8, 1, "math");
        profile.mathMainLevel = 8;
        profile.mathMaxUnlocked = 8;
        profile.periodicTestSets = {};
        const triggeredSet = await ensurePeriodicTestSet(profile, "math");

        profile.mathMainLevel = 9;
        profile.mathMaxUnlocked = 9;
        profile.periodicTestState = {
            math: { isPending: true, lastTriggeredAt: null, reason: "pre-levelup" },
            vocab: { isPending: false, lastTriggeredAt: null, reason: null },
        };
        profile.periodicTestSets = { math: triggeredSet };

        const preserved = await ensurePeriodicTestSet(profile, "math");

        expect(preserved).toBe(triggeredSet);
        expect(preserved.level).toBe(8);
    });
});
