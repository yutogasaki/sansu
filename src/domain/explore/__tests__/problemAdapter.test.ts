import { afterEach, describe, expect, it, vi } from "vitest";
import { generateMathProblem } from "../../math";
import { getLevelForSkill, MAX_MATH_LEVEL } from "../../math/curriculum";
import { createInitialProfile } from "../../user/profile";
import { createSeededRandom } from "../../../utils/random";
import { createInitialExploreState } from "../reducer";
import {
    createExploreProblem,
    createExploreProblemPlan,
    createExploreProblemRandomKey,
    EXPLORE_MAX_PROFILE_LEVEL_DISTANCE,
    exploreProblemUsesDecimal,
    getExploreAssistCandidates,
    getExploreSkillCandidateGroups,
    isExploreProblemCompatible,
    isExploreAnswerCorrect,
} from "../problemAdapter";
import { evaluateRapidLoopEligibility } from "../rapidLoopEligibility";
import type { ExploreProblemGate } from "../types";

const createGate = (attemptCount = 0, skillId?: string): ExploreProblemGate => ({
    gateId: `gate-${attemptCount}`,
    nodeId: "node-1-0",
    actionType: "dig",
    attemptCount,
    skillId,
});

const createLightBridgeGate = (attemptCount = 0, skillId?: string): ExploreProblemGate => ({
    gateId: `light-bridge-${attemptCount}`,
    nodeId: "node-3-0",
    actionType: "bridge",
    bridgePlan: "stones",
    attemptCount,
    skillId,
});

const createRootTangleGate = (
    state: ReturnType<typeof createInitialExploreState>,
    attemptCount = 0,
    skillId?: string,
): ExploreProblemGate => {
    const node = state.nodes.find((candidate) => candidate.encounterId === "root-tangle");
    if (!node) throw new Error("Expected a generated root-tangle node");
    return {
        gateId: `root-tangle-${attemptCount}`,
        nodeId: node.id,
        actionType: "dig",
        attemptCount,
        skillId,
    };
};

describe("exploration problem adapter", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("keeps technical input compatibility separate from new-slot rapid eligibility", () => {
        const savedProblem = {
            categoryId: "add_1d_1",
            inputType: "number" as const,
            correctAnswer: "1000",
        };

        expect(isExploreProblemCompatible(savedProblem)).toBe(true);
        expect(evaluateRapidLoopEligibility(savedProblem)).toMatchObject({
            eligible: false,
            reason: "answer-over-action-budget",
        });
    });

    it("replays the same problem plan from the same run, gate, and attempt", () => {
        const state = createInitialExploreState({ seed: "replay-problem", now: 100 });
        const profile = createInitialProfile("Replay", 1, 8, 1, "math");
        profile.mathMainLevel = 11;
        const gate = createGate(2, "sub_2d1d_c");

        expect(createExploreProblemPlan(state, gate, profile))
            .toEqual(createExploreProblemPlan(state, gate, profile));
    });

    it("uses the versioned run/gate/attempt/skill tuple as the random key", () => {
        const state = createInitialExploreState({ seed: "tuple-seed", now: 100 });
        const gate = createGate(3, "add_1d_2");

        expect(JSON.parse(createExploreProblemRandomKey(state, gate, "add_1d_2"))).toEqual([
            "explore-problem-v1",
            "tuple-seed",
            gate.gateId,
            3,
            "add_1d_2",
        ]);
    });

    it("keeps a skill's generated problem isolated from earlier candidate generation", () => {
        const state = createInitialExploreState({ seed: "candidate-isolation", now: 100 });
        const profile = createInitialProfile("Isolation", 1, 8, 1, "math");
        const gate = createGate(0);
        const generateCandidate = (skillId: string) => generateMathProblem(skillId, {
            profile,
            random: createSeededRandom(createExploreProblemRandomKey(state, gate, skillId)),
        });

        const targetBefore = generateCandidate("add_1d_2_bridge");
        generateCandidate("frac_add_diff");
        generateCandidate("count_100");
        const targetAfter = generateCandidate("add_1d_2_bridge");

        expect(targetAfter).toEqual(targetBefore);
    });

    it("does not consult global Math.random while selecting exploration problems", () => {
        const state = createInitialExploreState({ seed: "no-global-random", now: 100 });
        const profile = createInitialProfile("Explicit Random", 1, 8, 1, "math");
        vi.spyOn(Math, "random").mockImplementation(() => {
            throw new Error("Unexpected global Math.random call");
        });

        for (let level = 0; level <= MAX_MATH_LEVEL; level += 1) {
            profile.mathMainLevel = level;
            expect(() => createExploreProblemPlan(state, createGate(0), profile), `level ${level}`)
                .not.toThrow();
        }
    });

    it("keeps every profile level on a nearby single-number curriculum skill", () => {
        const state = createInitialExploreState({ seed: "adapter", now: 100 });
        const profile = createInitialProfile("Adapter", 1, 7, 1, "math");

        for (let level = 0; level <= MAX_MATH_LEVEL; level += 1) {
            profile.mathMainLevel = level;
            const problem = createExploreProblem(state, createGate(), profile);
            const selectedLevel = getLevelForSkill(problem.categoryId);

            expect(problem.inputType, `level ${level}`).toBe("number");
            expect(typeof problem.correctAnswer, `level ${level}`).toBe("string");
            expect(selectedLevel, `level ${level}`).not.toBeNull();
            expect(Math.abs((selectedLevel ?? level) - level), `level ${level}`).toBeLessThanOrEqual(2);
        }
    });

    it("groups candidates by curriculum distance instead of mixing distant levels", () => {
        const groups = getExploreSkillCandidateGroups(14);
        expect(groups[0]).toEqual(expect.arrayContaining(["mul_99_6", "mul_99_rand"]));
        expect(groups[1]).toEqual(expect.arrayContaining(["mul_99_2"]));
        expect(groups).toHaveLength(5);
        expect(EXPLORE_MAX_PROFILE_LEVEL_DISTANCE).toBe(2);
    });

    it("uses a configured review fallback after repeated misses", () => {
        const state = createInitialExploreState({ seed: "assist", now: 100 });
        const profile = createInitialProfile("Assist", 1, 8, 1, "math");
        const problem = createExploreProblem(state, createGate(2, "add_1d_1"), profile);

        expect(problem.categoryId).toBe("add_1d_1_bridge");
    });

    it("turns the light-bridge encounter into an addition inside the nearest candidate level", () => {
        const state = createInitialExploreState({ seed: "light-bridge", now: 100 });
        const profile = createInitialProfile("Bridge", 1, 8, 1, "math");
        profile.mathMainLevel = 8;

        const lightBridgePlan = createExploreProblemPlan(state, createLightBridgeGate(), profile);
        expect(lightBridgePlan.problem.categoryId).toBe("add_1d_1_bridge");
        expect(lightBridgePlan.problem.questionVisual).toBeDefined();
        expect(lightBridgePlan.encounterId).toBe("light-bridge");

        profile.mathMainLevel = 14;
        const woodBridgeProblem = createExploreProblem(state, {
            ...createLightBridgeGate(),
            bridgePlan: "wood",
        }, profile);
        expect(woodBridgeProblem.categoryId).toMatch(/^mul_/);
    });

    it.each([8, 9, 11])(
        "keeps a light-bridge problem on a nearby supported visual skill at level %i",
        (level) => {
            const state = createInitialExploreState({ seed: `light-bridge-${level}`, now: 100 });
            const profile = createInitialProfile("Bridge", 1, 8, 1, "math");
            profile.mathMainLevel = level;

            const plan = createExploreProblemPlan(state, createLightBridgeGate(), profile);

            expect([
                "add_1d_1_bridge",
                "add_1d_2_bridge",
                "add_2d1d_nc_bridge",
                "add_2d1d_c_bridge",
            ]).toContain(plan.problem.categoryId);
            expect(Math.abs((getLevelForSkill(plan.problem.categoryId) ?? level) - level))
                .toBeLessThanOrEqual(2);
            expect(plan.encounterId).toBe("light-bridge");
            expect(plan.problem.questionVisual).toBeDefined();
            expect(isExploreProblemCompatible(plan.problem)).toBe(true);
        },
    );

    it("keeps level 12 exact and uses the generic bridge when no visual skill exists", () => {
        const state = createInitialExploreState({ seed: "light-bridge-12", now: 100 });
        const profile = createInitialProfile("Bridge", 1, 8, 1, "math");
        profile.mathMainLevel = 12;

        const plan = createExploreProblemPlan(state, createLightBridgeGate(), profile);

        expect(getLevelForSkill(plan.problem.categoryId)).toBe(12);
        expect(plan.encounterId).toBeUndefined();
    });

    it.each([14, 22, 28])(
        "falls back to a nearby standard problem instead of a distant addition at level %i",
        (level) => {
            const state = createInitialExploreState({ seed: `light-bridge-fallback-${level}`, now: 100 });
            const profile = createInitialProfile("Bridge", 1, 8, 1, "math");
            profile.mathMainLevel = level;

            const plan = createExploreProblemPlan(state, createLightBridgeGate(), profile);
            const selectedLevel = getLevelForSkill(plan.problem.categoryId);

            expect(plan.encounterId).toBeUndefined();
            expect(plan.problem.categoryId).not.toMatch(/^add_/);
            expect(Math.abs((selectedLevel ?? level) - level)).toBeLessThanOrEqual(2);
        },
    );

    it.each([10, 11])(
        "keeps a root-tangle problem on a nearby supported visual skill at level %i",
        (level) => {
            const state = createInitialExploreState({ seed: `root-tangle-${level}`, now: 100 });
            const profile = createInitialProfile("Roots", 1, 8, 1, "math");
            profile.mathMainLevel = level;

            const plan = createExploreProblemPlan(state, createRootTangleGate(state), profile);

            expect([
                "sub_tiny",
                "sub_1d1d_nc_bridge",
                "sub_1d1d_c_bridge",
                "sub_2d1d_nc_bridge",
                "sub_2d1d_c_bridge",
            ]).toContain(plan.problem.categoryId);
            expect(Math.abs((getLevelForSkill(plan.problem.categoryId) ?? level) - level))
                .toBeLessThanOrEqual(2);
            expect(plan.encounterId).toBe("root-tangle");
            expect(plan.problem.questionVisual).toBeDefined();
            expect(isExploreProblemCompatible(plan.problem)).toBe(true);
        },
    );

    it("keeps level 12 exact and uses the generic root gate when no visual skill exists", () => {
        const state = createInitialExploreState({ seed: "root-tangle-12", now: 100 });
        const profile = createInitialProfile("Roots", 1, 8, 1, "math");
        profile.mathMainLevel = 12;

        const plan = createExploreProblemPlan(state, createRootTangleGate(state), profile);

        expect(getLevelForSkill(plan.problem.categoryId)).toBe(12);
        expect(plan.encounterId).toBeUndefined();
    });

    it.each([14, 22, 28])(
        "falls back to a nearby standard problem instead of distant subtraction for a root tangle at level %i",
        (level) => {
            const state = createInitialExploreState({ seed: `root-tangle-fallback-${level}`, now: 100 });
            const profile = createInitialProfile("Roots", 1, 8, 1, "math");
            profile.mathMainLevel = level;

            const plan = createExploreProblemPlan(state, createRootTangleGate(state), profile);
            const selectedLevel = getLevelForSkill(plan.problem.categoryId);

            expect(plan.encounterId).toBeUndefined();
            expect(plan.problem.categoryId).not.toMatch(/^sub_/);
            expect(Math.abs((selectedLevel ?? level) - level)).toBeLessThanOrEqual(2);
        },
    );

    it.each([
        ["count_100", "count_50"],
        ["mul_2d1d", "mul_99_rand"],
        ["mul_2d2d", "mul_2d1d"],
        ["div_rem_q1", "div_99_rev"],
        ["div_3d1d_exact", "div_2d1d_exact"],
        ["dec_mul_dec", "dec_mul_int"],
        ["dec_div_dec", "dec_div_int"],
        ["scale_10x", "dec_div_int"],
    ])("uses a safe first assist prerequisite for %s", (skillId, expectedFirst) => {
        expect(getExploreAssistCandidates(skillId)[0]).toBe(expectedFirst);
    });

    it("does not invent a harder assist path when no prerequisite exists", () => {
        expect(getExploreAssistCandidates("percent_basic")).toEqual([]);
    });

    it.each([
        [27, "average_basic", "div_2d1d_exact"],
        [27, "ratio_basic", "mul_99_rand"],
        [28, "speed_basic", "mul_2d1d"],
    ])("uses a concept-safe generated assist at level %i for %s", (level, skillId, expectedCategory) => {
        const state = createInitialExploreState({ seed: `assist-${skillId}`, now: 100 });
        const profile = createInitialProfile("Assist", 1, 8, 1, "math");
        profile.mathMainLevel = level;

        const problem = createExploreProblem(state, createGate(2, skillId), profile);

        expect(problem.categoryId).toBe(expectedCategory);
    });

    it("accepts only the exact single-number answer", () => {
        const state = createInitialExploreState({ seed: "answer", now: 100 });
        const problem = createExploreProblem(state, createGate());
        const answer = problem.correctAnswer as string;

        expect(isExploreAnswerCorrect(problem, answer)).toBe(true);
        expect(isExploreAnswerCorrect(problem, `${answer}0`)).toBe(false);
    });

    it("recognizes decimal answers independently of the skill id", () => {
        const decimalProblem = {
            ...createExploreProblem(
                createInitialExploreState({ seed: "decimal", now: 100 }),
                createGate(),
            ),
            categoryId: "scale_10x",
            correctAnswer: "1.7",
        };

        expect(isExploreProblemCompatible(decimalProblem)).toBe(true);
        expect(exploreProblemUsesDecimal(decimalProblem)).toBe(true);
        expect(isExploreAnswerCorrect(decimalProblem, "1.7")).toBe(true);
    });

    it("rejects number problems whose answer needs an unsupported symbol", () => {
        const unsupportedProblem = {
            ...createExploreProblem(
                createInitialExploreState({ seed: "unsupported", now: 100 }),
                createGate(),
            ),
            correctAnswer: "-2",
        };

        expect(isExploreProblemCompatible(unsupportedProblem)).toBe(false);
    });

    it("rejects answers longer than the exploration input limit", () => {
        const longAnswerProblem = {
            ...createExploreProblem(
                createInitialExploreState({ seed: "long-answer", now: 100 }),
                createGate(),
            ),
            correctAnswer: "123456789",
        };

        expect(isExploreProblemCompatible(longAnswerProblem)).toBe(false);
    });
});
