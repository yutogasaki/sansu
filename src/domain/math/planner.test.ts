import { describe, expect, it } from "vitest";
import { createInitialProfile } from "../user/profile";
import { createSeededRandom } from "../../utils/random";
import {
    getAvailableSkills,
    getLevelForSkill,
    isMathSkillUnlockedForProfile,
} from "./curriculum";
import { planMathProblemSlots, planMathProblems } from "./planner";

const createMathProfile = (mainLevel = 8, maxUnlocked = mainLevel) => {
    const profile = createInitialProfile("Planner", 1, mainLevel, 1, "math");
    profile.mathMainLevel = mainLevel;
    profile.mathMaxUnlocked = maxUnlocked;
    return profile;
};

describe("planMathProblems", () => {
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
