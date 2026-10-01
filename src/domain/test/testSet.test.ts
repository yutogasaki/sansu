import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../db";
import { saveProfile } from "../user/repository";
import { createInitialProfile } from "../user/profile";
import { buildPeriodicTestSet, ensurePeriodicTestSet } from "./testSet";
import { getMathSkillFamily, getSkillsForLevel } from "../math/curriculum";



describe("ensurePeriodicTestSet", () => {
    beforeEach(async () => {
        await db.appData.clear();
        await db.profiles.clear();
    });

    it("uses level 0 math skills when the profile is on level 0 and spreads early families", async () => {
        const profile = createInitialProfile("T", 1, 0, 1, "math");
        profile.mathMainLevel = 0;
        profile.mathMaxUnlocked = 0;
        profile.periodicTestSets = {};

        await saveProfile(profile);
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

        await saveProfile(profile);
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

    it.each(Array.from({ length: 29 }, (_, level) => level))('prepares a complete representative frozen assessment for math Lv%s', level => {
        const profile = { ...createInitialProfile('T', 1, level, 1, 'math'), mathMainLevel: level, mathMaxUnlocked: level };
        const set = buildPeriodicTestSet(profile, 'math');
        expect(set.problems).toHaveLength(20);
        expect(set.problems.every(problem => problem.studyPresentation?.version === 1 && problem.learningContext)).toBe(true);
        if (level === 11) expect(new Set(set.problems.filter(problem => problem.categoryId === 'sub_2d2d').map(problem => problem.learningContext?.variant)))
            .toEqual(new Set(['no-regroup', 'regroup']));
    });
    it('measures representative carry content instead of a profile-frozen introductory equation', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        const profile = createInitialProfile('T', 1, 8, 1, 'math');
        profile.mathSkills = Object.fromEntries(['add_1d_2_bridge', 'add_1d_2'].map(id => [id, { id, strength: 0, nextReview: '', totalAnswers: 10, correctAnswers: 10, incorrectAnswers: 0, skippedAnswers: 0, independentCorrectAnswers: 10, updatedAt: '' }]));
        const set = buildPeriodicTestSet(profile, 'math');
        expect(set.problems).toHaveLength(20);
        const equations = set.problems.map(problem => problem.questionText!);
        expect(new Set(equations).size).toBeGreaterThan(10);
        expect(equations.every(equation => { const numbers = equation.match(/\d+/g)!.map(Number); return numbers[0] + numbers[1] >= 10; })).toBe(true);
        vi.restoreAllMocks();
    });
    it('freezes fresh written mode and evidence before storing and preserves it on settings changes', async () => {
        const profile = createInitialProfile('T', 1, 10, 1, 'math');
        profile.hissanModeEnabled = true;
        await saveProfile(profile);
        const first = await ensurePeriodicTestSet(profile, 'math');
        expect(first.problems.some(problem => problem.studyPresentation?.hissan === true && problem.inputType === 'hissan'
            && problem.learningContext?.representation === 'algorithm')).toBe(true);
        await saveProfile({ ...profile, hissanModeEnabled: false, periodicTestSets: { math: first } });
        const resumed = await ensurePeriodicTestSet(profile, 'math');
        expect(resumed).toEqual(first);
    });
    it("preserves the triggered level snapshot after the main level advances", async () => {
        const profile = createInitialProfile("T", 1, 8, 1, "math");
        profile.mathMainLevel = 8;
        profile.mathMaxUnlocked = 8;
        profile.periodicTestSets = {};
        await saveProfile(profile);
        const triggeredSet = await ensurePeriodicTestSet(profile, "math");

        profile.mathMainLevel = 9;
        profile.mathMaxUnlocked = 9;
        profile.periodicTestState = {
            math: { isPending: true, lastTriggeredAt: null, reason: "pre-levelup" },
            vocab: { isPending: false, lastTriggeredAt: null, reason: null },
        };
        profile.periodicTestSets = { math: triggeredSet };

        await saveProfile(profile);
        const preserved = await ensurePeriodicTestSet(profile, "math");

        expect(preserved).toEqual(triggeredSet);
        expect(preserved.level).toBe(8);
    });
});
