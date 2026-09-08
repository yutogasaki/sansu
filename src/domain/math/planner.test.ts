import { describe, expect, it } from "vitest";
import { createInitialProfile } from "../user/profile";
import { createSeededRandom } from "../../utils/random";
import {
    getAvailableSkills,
    getSkillsForLevel,
    getLevelForSkill,
    isMathSkillUnlockedForProfile,
} from "./curriculum";
import { planMathProblemSlots, planMathProblems } from "./planner";
import { createDefaultMemoryState } from "../types";

const createMathProfile = (mainLevel = 8, maxUnlocked = mainLevel) => {
    const profile = createInitialProfile("Planner", 1, mainLevel, 1, "math");
    profile.mathMainLevel = mainLevel;
    profile.mathMaxUnlocked = maxUnlocked;
    return profile;
};

describe("planMathProblems", () => {
    it("introduces unseen skills before practiced skills in the current level", () => {
        const profile = createMathProfile(11);
        const unseen = "sub_2d2d";
        for (const skillId of getSkillsForLevel(11).filter(id => id !== unseen)) {
            profile.mathSkills[skillId] = createDefaultMemoryState(skillId, "math", true);
        }
        const [item] = planMathProblems({ profile, count: 1, random: () => 0 });
        expect(item).toMatchObject({ skillId: unseen, source: "main" });
    });

    it("prioritizes lower strength after introduction while preserving cooldown and diversity", () => {
        const profile = createMathProfile(11);
        const skillIds = getSkillsForLevel(11);
        for (const skillId of skillIds) {
            profile.mathSkills[skillId] = {
                ...createDefaultMemoryState(skillId, "math", true), strength: 5,
            };
        }
        const weakest = skillIds[skillIds.length - 1];
        profile.mathSkills[weakest].strength = 1;
        const plan = planMathProblems({ profile, count: 6, random: () => 0 });
        expect(plan[0]?.skillId).toBe(weakest);
        expect(new Set(plan.map(item => item.skillId)).size).toBe(6);
        const [cooled] = planMathProblems({ profile, count: 1, cooldownIds: [weakest], random: () => 0 });
        expect(cooled.skillId).not.toBe(weakest);
    });

    it("prioritizes unseen +1 skills without exceeding its existing cap", () => {
        const profile = createMathProfile(10, 11);
        const nextSkills = getSkillsForLevel(11);
        for (const skillId of nextSkills.slice(0, -1)) {
            profile.mathSkills[skillId] = createDefaultMemoryState(skillId, "math", true);
        }
        const plan = planMathProblems({ profile, count: 6, plusOneRate: 1, random: () => 0 });
        expect(plan[0]).toMatchObject({ skillId: nextSkills[nextSkills.length - 1], source: "plus-one" });
        expect(plan.filter(item => item.source === "plus-one")).toHaveLength(1);
    });

    it("covers the eligible current range before relaxing the per-skill cap", () => {
        const profile = createMathProfile(0);
        profile.mathSkills = {};
        const skillIds = getSkillsForLevel(0);
        const plan = planMathProblems({ profile, count: 13, random: () => 0 });
        expect(plan).toHaveLength(13);
        expect(new Set(plan.slice(0, 5).map(item => item.skillId)).size).toBe(5);
        const counts = skillIds.map(id => plan.filter(item => item.skillId === id).length);
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
        expect(plan.slice(0, 10).every(item => plan.slice(0, 10).filter(other => other.skillId === item.skillId).length <= 2)).toBe(true);
    });

    it.each([
        { source: "retry", options: { retrySkillIds: ["count_10"] } },
        { source: "due", options: { dueSkillIds: ["count_10"] } },
        { source: "maintenance", options: { maintenanceSkillIds: ["count_10"], maintenanceRate: 1 } },
        { source: "retired", options: { retiredSkillIds: ["count_10"], maintenanceRate: 1 } },
        { source: "weak", options: { weakSkillIds: ["count_10"], weakRate: 1 } },
    ])("respects explicitly disabled levels for $source", ({ options }) => {
        const profile = createMathProfile(8);
        profile.mathLevels = profile.mathLevels?.map(state => state.level === 3
            ? { ...state, enabled: false } : state);
        const plan = planMathProblems({ profile, count: 1, random: () => 0, ...options });
        expect(plan[0]?.source).toBe("main");
        expect(plan[0]?.skillId).not.toBe("count_10");
    });

    it("keeps disabled main, +1, and representation followups outside the plan", () => {
        const profile = createMathProfile(8, 9);
        profile.mathLevels = profile.mathLevels?.map(state => state.level === 9
            ? { ...state, enabled: false } : state);
        profile.recentAttempts = [{ subject: "math", skillId: "add_1d_2", result: "incorrect", timestamp: "2026-09-08T00:00:00.000Z" }];
        const plan = planMathProblems({ profile, count: 3, plusOneRate: 1, random: () => 0 });
        expect(plan).toHaveLength(3);
        expect(plan.every(item => item.source === "main" && getLevelForSkill(item.skillId) === 8)).toBe(true);
        profile.mathLevels = profile.mathLevels?.map(state => state.level === 8
            ? { ...state, enabled: false } : state);
        expect(planMathProblems({ profile, count: 3, plusOneRate: 1, random: () => 0 })).toEqual([]);
        delete profile.mathLevels;
        expect(planMathProblems({ profile, count: 3, plusOneRate: 1, random: () => 0 })).toHaveLength(3);
    });

    it("keeps graduated skills out of normal slots while an active current skill remains", () => {
        const items = planMathProblems({
            profile: createMathProfile(8), count: 10,
            retiredSkillIds: ["add_1d_1_bridge"], maintenanceRate: 0, random: () => 0,
        });
        expect(items).toHaveLength(10);
        expect(items.every(item => item.skillId !== "add_1d_1_bridge")).toBe(true);
        expect(items.every(item => item.source === "main")).toBe(true);
    });

    it("keeps the all-graduated range usable without injecting a different-level fallback", () => {
        const profile = createMathProfile(8);
        const graduated = ["add_1d_1_bridge", "add_1d_1"];
        const items = planMathProblems({ profile, count: 10,
            retiredSkillIds: graduated, maintenanceRate: 0, canAddReview: false, random: () => 0,
        });
        expect(items).toHaveLength(10);
        expect(items.every(item => getLevelForSkill(item.skillId) === 8)).toBe(true);
        expect(items.every(item => item.source === "main")).toBe(true);
    });

    it("retains explicit maintenance metadata for graduated skills", () => {
        const [item] = planMathProblems({ profile: createMathProfile(8), count: 1,
            retiredSkillIds: ["add_1d_1_bridge"], maintenanceRate: 1, random: () => 0,
        });
        expect(item).toMatchObject({ skillId: "add_1d_1_bridge", source: "maintenance", isMaintenanceCheck: true, countsTowardReviewCap: true });
    });

    it("keeps +1 active skills within the cap and allows final-level consolidation", () => {
        const nextSkills = getSkillsForLevel(9);
        const items = planMathProblems({ profile: createMathProfile(8, 9), count: 10,
            maintenanceSkillIds: [nextSkills[0]], plusOneRate: 1, plusOneLimit: 3,
            maintenanceRate: 0, random: () => 0,
        });
        const next = items.filter(item => item.source === "plus-one");
        expect(next).toHaveLength(3);
        expect(next.every(item => item.skillId !== nextSkills[0])).toBe(true);
        const final = planMathProblems({ profile: createMathProfile(28), count: 10,
            retiredSkillIds: getSkillsForLevel(28), canAddReview: false, random: () => 0,
        });
        expect(final).toHaveLength(10);
        expect(final.every(item => getLevelForSkill(item.skillId) === 28)).toBe(true);
    });

    it("excludes graduated automatic progression but retains remediation after an error", () => {
        const profile = createMathProfile(8);
        profile.recentAttempts = [{ subject: "math", skillId: "add_1d_1_bridge", result: "correct", timestamp: new Date().toISOString() }];
        const progressed = planMathProblems({ profile, count: 1,
            retiredSkillIds: ["add_1d_1"], maintenanceRate: 0, random: () => 0,
        });
        expect(progressed[0].skillId).toBe("add_1d_1_bridge");
        profile.recentAttempts = [{ subject: "math", skillId: "add_1d_1", result: "incorrect", timestamp: new Date().toISOString() }];
        const helped = planMathProblems({ profile, count: 1,
            retiredSkillIds: ["add_1d_1_bridge"], maintenanceRate: 0, random: () => 0,
        });
        expect(helped[0]).toMatchObject({ skillId: "add_1d_1_bridge", source: "followup" });
    });

    it("fails closed for unknown, locked, and malformed curriculum boundaries", () => {
        const unlocked = createMathProfile(3, 3);

        expect(isMathSkillUnlockedForProfile("count_10", unlocked)).toBe(true);
        expect(isMathSkillUnlockedForProfile("add_1d_1_bridge", unlocked)).toBe(false);
        expect(isMathSkillUnlockedForProfile("unknown-skill", unlocked)).toBe(false);
        expect(isMathSkillUnlockedForProfile("count_10", {
            mathMaxUnlocked: Number.NaN,
        })).toBe(false);
        expect(isMathSkillUnlockedForProfile("count_10", {
            mathMaxUnlocked: -1,
        })).toBe(false);
        expect(isMathSkillUnlockedForProfile("count_10", {
            mathMaxUnlocked: 29,
        })).toBe(false);
        expect(getAvailableSkills(Number.POSITIVE_INFINITY)).toEqual([]);
        expect(planMathProblems({
            profile: createMathProfile(8, Number.POSITIVE_INFINITY),
            count: 1,
        })).toEqual([]);
    });

    it("creates the three-question default and supports an arbitrary count", () => {
        const profile = createMathProfile(11);

        expect(planMathProblems({
            profile,
            random: createSeededRandom("default-three"),
        })).toHaveLength(3);
        expect(planMathProblems({
            profile,
            count: 7,
            random: createSeededRandom("arbitrary-seven"),
        })).toHaveLength(7);
    });

    it("is reproducible when callers inject the same seeded random stream", () => {
        const profile = createMathProfile(11, 12);
        const build = () => planMathProblems({
            profile,
            count: 6,
            plusOneRate: 0.5,
            random: createSeededRandom("run-42/segment-3"),
        });

        expect(build()).toEqual(build());
    });

    it("labels Due with review metadata", () => {
        const [item] = planMathProblems({
            profile: createMathProfile(),
            count: 1,
            dueSkillIds: ["count_10"],
            random: () => 0,
        });

        expect(item).toEqual({
            skillId: "count_10",
            source: "due",
            isReview: true,
            isMaintenanceCheck: false,
            countsTowardReviewCap: true,
        });
    });

    it("labels maintenance and weak without treating them as Due review", () => {
        const [maintenance] = planMathProblems({
            profile: createMathProfile(),
            count: 1,
            maintenanceSkillIds: ["count_10"],
            maintenanceRate: 1,
            random: () => 0,
        });
        const [weak] = planMathProblems({
            profile: createMathProfile(),
            count: 1,
            weakSkillIds: ["count_10"],
            maintenanceRate: 0,
            weakRate: 1,
            random: () => 0,
        });

        expect(maintenance).toMatchObject({
            source: "maintenance",
            isReview: false,
            isMaintenanceCheck: true,
            countsTowardReviewCap: true,
        });
        expect(weak).toMatchObject({
            source: "weak",
            isReview: false,
            isMaintenanceCheck: false,
            countsTowardReviewCap: true,
        });
    });

    it("marks a representation fallback from recent performance as followup", () => {
        const profile = createMathProfile(9);
        profile.recentAttempts = [{
            id: "symbol-miss",
            timestamp: "2026-07-19T00:00:00.000Z",
            subject: "math",
            skillId: "add_1d_2",
            result: "incorrect",
        }];

        const [item] = planMathProblems({
            profile,
            count: 1,
            canAddReview: false,
            random: () => 0,
        });

        expect(item).toMatchObject({
            skillId: "add_1d_2_bridge",
            source: "followup",
            isReview: false,
            countsTowardReviewCap: false,
        });
    });

    it("distinguishes main and +1 level sources", () => {
        const profile = createMathProfile(8, 9);
        const [main] = planMathProblems({
            profile,
            count: 1,
            plusOneRate: 0,
            random: () => 0,
        });
        const [plusOne] = planMathProblems({
            profile,
            count: 1,
            plusOneRate: 1,
            random: () => 0,
        });

        expect(main.source).toBe("main");
        expect(plusOne.source).toBe("plus-one");
        expect(plusOne.skillId).toBe("add_1d_2_bridge");
    });

    it("places one explicit retry ahead of Due and keeps it outside the review cap", () => {
        const plan = planMathProblems({
            profile: createMathProfile(),
            count: 2,
            retrySkillIds: ["add_1d_1_bridge"],
            dueSkillIds: ["count_10"],
            random: () => 0,
        });

        expect(plan[0]).toMatchObject({
            skillId: "add_1d_1_bridge",
            source: "retry",
            isReview: false,
            countsTowardReviewCap: false,
        });
        expect(plan[1]?.source).toBe("due");
    });

    it("honors review admission and the default one-per-three weak cap", () => {
        const reviewBlocked = planMathProblems({
            profile: createMathProfile(),
            count: 1,
            dueSkillIds: ["count_10"],
            weakSkillIds: ["count_dot"],
            maintenanceSkillIds: ["count_read"],
            canAddReview: () => false,
            maintenanceRate: 1,
            weakRate: 1,
            random: () => 0,
        });
        const weakCapped = planMathProblems({
            profile: createMathProfile(),
            weakSkillIds: ["count_dot", "count_read"],
            maintenanceRate: 0,
            weakRate: 1,
            random: () => 0,
        });

        expect(reviewBlocked[0]?.source).toBe("main");
        expect(weakCapped.filter(item => item.source === "weak")).toHaveLength(1);
    });

    it("excludes ineligible Due and main candidates", () => {
        const profile = createMathProfile(8);
        const [due] = planMathProblems({
            profile,
            count: 1,
            dueSkillIds: ["count_10", "count_dot"],
            isSkillEligible: (skillId) => skillId !== "count_10",
            random: () => 0,
        });
        const [main] = planMathProblems({
            profile,
            count: 1,
            plusOneRate: 0,
            isSkillEligible: (skillId) => skillId === "add_1d_1",
            random: () => 0,
        });

        expect(due).toMatchObject({
            skillId: "count_dot",
            source: "due",
        });
        expect(main).toMatchObject({
            skillId: "add_1d_1",
            source: "main",
        });
    });

    it.each([
        {
            source: "retry",
            options: { retrySkillIds: ["unknown-skill", "add_1d_1_bridge"] },
        },
        {
            source: "due",
            options: { dueSkillIds: ["unknown-skill", "add_1d_1_bridge"] },
        },
        {
            source: "maintenance",
            options: {
                maintenanceSkillIds: ["unknown-skill", "add_1d_1_bridge"],
                maintenanceRate: 1,
            },
        },
        {
            source: "retired maintenance",
            options: {
                retiredSkillIds: ["unknown-skill", "add_1d_1_bridge"],
                maintenanceRate: 1,
            },
        },
        {
            source: "weak",
            options: {
                weakSkillIds: ["unknown-skill", "add_1d_1_bridge"],
                weakRate: 1,
            },
        },
    ])("blocks unknown and locked $source candidates before falling back", ({ options }) => {
        const profile = createMathProfile(3, 3);
        const plan = planMathProblems({
            profile,
            count: 1,
            random: () => 0,
            ...options,
        });

        expect(plan).toHaveLength(1);
        expect(plan[0]?.source).toBe("main");
        expect(getLevelForSkill(plan[0]?.skillId || "")).not.toBeNull();
        expect(getLevelForSkill(plan[0]?.skillId || "")).toBeLessThanOrEqual(
            profile.mathMaxUnlocked,
        );
    });

    it("blocks locked follow-up and main candidates with the same built-in guard", () => {
        const followupProfile = createMathProfile(9, 8);
        followupProfile.recentAttempts = [{
            id: "locked-symbol-miss",
            timestamp: "2026-07-23T00:00:00.000Z",
            subject: "math",
            skillId: "add_1d_2",
            result: "incorrect",
        }];

        expect(planMathProblems({
            profile: followupProfile,
            count: 1,
            canAddReview: false,
            isSkillEligible: skillId => skillId === "add_1d_2_bridge",
            random: () => 0,
        })).toEqual([]);

        const mainProfile = createMathProfile(8, 7);
        expect(planMathProblems({
            profile: mainProfile,
            count: 1,
            canAddReview: false,
            isSkillEligible: skillId => getLevelForSkill(skillId) === 8,
            random: () => 0,
        })).toEqual([]);
    });

    it("keeps +1 inside the unlock boundary and ANDs caller eligibility", () => {
        const profile = createMathProfile(8, 9);
        const [plusOne] = planMathProblems({
            profile,
            count: 1,
            plusOneRate: 1,
            random: () => 0,
        });
        const [callerFiltered] = planMathProblems({
            profile,
            count: 1,
            plusOneRate: 1,
            isSkillEligible: skillId => getLevelForSkill(skillId) === 8,
            random: () => 0,
        });

        expect(plusOne.source).toBe("plus-one");
        expect(getLevelForSkill(plusOne.skillId)).toBeLessThanOrEqual(
            profile.mathMaxUnlocked,
        );
        expect(callerFiltered.source).toBe("main");
        expect(getLevelForSkill(callerFiltered.skillId)).toBe(8);
    });

    it("passes the current planned index to eligibility and returns a partial plan", () => {
        const seenIndexes = new Set<number>();
        const plan = planMathProblems({
            profile: createMathProfile(8),
            count: 3,
            plusOneRate: 0,
            isSkillEligible: (skillId, plannedIndex) => {
                seenIndexes.add(plannedIndex);
                if (plannedIndex === 0) return skillId === "add_1d_1_bridge";
                if (plannedIndex === 1) return skillId === "add_1d_1";
                return false;
            },
            random: () => 0,
        });

        expect(plan.map(item => item.skillId)).toEqual([
            "add_1d_1_bridge",
            "add_1d_1",
        ]);
        expect(seenIndexes).toEqual(new Set([0, 1, 2]));
        expect(plan).toHaveLength(2);
        expect(plan.some(item => item.skillId === "count_10")).toBe(false);
    });

    it("preserves an ineligible slot without discarding an eligible later position", () => {
        const slots = planMathProblemSlots({
            profile: createMathProfile(8),
            count: 3,
            plusOneRate: 0,
            isSkillEligible: (skillId, plannedIndex) => (
                plannedIndex === 1 && skillId === "add_1d_1"
            ),
            random: () => 0,
        });

        expect(slots).toEqual([
            undefined,
            expect.objectContaining({
                skillId: "add_1d_1",
                source: "main",
            }),
            undefined,
        ]);
    });

    it("reports prior empty slots to per-candidate review admission", () => {
        const observedSlotCounts: number[] = [];
        const slots = planMathProblemSlots({
            profile: createMathProfile(8),
            count: 3,
            dueSkillIds: ["add_1d_1"],
            canAddReview: (_planned, plannedSlots) => {
                observedSlotCounts.push(plannedSlots.length);
                return plannedSlots.length > 0;
            },
            plusOneRate: 0,
            isSkillEligible: (skillId, plannedIndex) => (
                plannedIndex === 1 && skillId === "add_1d_1"
            ),
            random: () => 0,
        });

        expect(slots[0]).toBeUndefined();
        expect(slots[1]).toMatchObject({
            skillId: "add_1d_1",
            source: "due",
        });
        expect(slots[2]).toBeUndefined();
        expect(observedSlotCounts).toContain(1);
    });
});
