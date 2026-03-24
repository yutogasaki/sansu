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
});
