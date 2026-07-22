import { describe, expect, it } from "vitest";
import { createInitialProfile } from "../user/profile";
import { createSeededRandom } from "../../utils/random";
import { planMathProblems } from "./planner";

const createMathProfile = (mainLevel = 8, maxUnlocked = mainLevel) => {
    const profile = createInitialProfile("Planner", 1, mainLevel, 1, "math");
    profile.mathMainLevel = mainLevel;
    profile.mathMaxUnlocked = maxUnlocked;
    return profile;
};

describe("planMathProblems", () => {
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
});
