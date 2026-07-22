import { describe, expect, it } from "vitest";
import type { Problem } from "../../types";
import { createAttemptIdentity, createAttemptIdentityKey } from "../attemptIdentity";
import { createExploreLearningAssignment } from "../learningAssignment";
import { createInitialExploreState, exploreReducer, getAvailableExploreNodes } from "../reducer";
import type {
    ExploreLearningAssignment,
    ExploreLearningSource,
} from "../persistenceTypes";
import type { ExploreAction, ExploreRunState } from "../types";

const bindStartedRun = (state: ExploreRunState) => exploreReducer(state, {
    type: "APPLY_STARTED_RUN",
    run: {
        runId: state.runId,
        profileId: "profile-1",
        seed: state.seed,
        status: "active",
        startedAt: state.startedAt,
        energyUsed: 0,
        problemsAnswered: 0,
        correctCount: 0,
        incorrectCount: 0,
        skippedCount: 0,
        discoveries: [],
        routeSummary: [],
        updatedAt: state.startedAt,
    },
});

const createStartedState = (
    options: Parameters<typeof createInitialExploreState>[0],
) => bindStartedRun(createInitialExploreState(options));

const TEST_PROBLEM: Problem = {
    id: "problem-1",
    subject: "math",
    categoryId: "add_1d_1",
    questionText: "1 + 1",
    inputType: "number",
    correctAnswer: "2",
    isReview: false,
};

const LIGHT_BRIDGE_PROBLEM: Problem = {
    ...TEST_PROBLEM,
    categoryId: "add_1d_1_bridge",
    questionVisual: {
        kind: "addition-items",
        groups: [
            { emoji: "✨", label: "ひかり", count: 1 },
            { emoji: "✨", label: "ひかり", count: 1 },
        ],
    },
};

const NO_VISUAL_LIGHT_BRIDGE_PROBLEM: Problem = {
    ...TEST_PROBLEM,
    categoryId: "add_1d_1_bridge",
};

const ROOT_TANGLE_PROBLEM: Problem = {
    ...TEST_PROBLEM,
    categoryId: "sub_1d1d_nc_bridge",
    questionText: "3 - 1",
    correctAnswer: "2",
    questionVisual: {
        kind: "subtraction-items",
        group: { emoji: "🌱", label: "ねっこ", count: 3 },
        takenAwayCount: 1,
    },
};

type LearningAssignmentOverrides = Partial<Pick<
    ExploreLearningAssignment,
    | "source"
    | "isReview"
    | "isMaintenanceCheck"
    | "countsTowardReviewCap"
    | "affectsSrs"
>>;

const createAssignmentForProblem = (
    state: ExploreRunState,
    problem: Problem,
    overrides: LearningAssignmentOverrides = {},
) => {
    const gate = state.pendingProblem;
    if (!gate) throw new Error("A pending gate is required");
    const affectsSrs = overrides.affectsSrs ?? false;
    const source: ExploreLearningSource = overrides.source
        ?? (affectsSrs ? "main" : "game-only-fallback");
    return createExploreLearningAssignment({
        profileId: state.profileId ?? "missing-profile",
        runId: state.runId,
        gateId: gate.gateId,
        problemId: problem.id,
        categoryId: problem.categoryId,
        source,
        isReview: overrides.isReview ?? false,
        isMaintenanceCheck: overrides.isMaintenanceCheck ?? false,
        countsTowardReviewCap: overrides.countsTowardReviewCap ?? false,
        affectsSrs,
        reservedAt: 150 + gate.attemptCount,
    });
};

const setProblem = (
    state: ExploreRunState,
    problem: Problem,
    encounterId?: Extract<ExploreAction, { type: "SET_PROBLEM" }>["encounterId"],
    overrides: LearningAssignmentOverrides = {},
) => exploreReducer(state, {
    type: "SET_PROBLEM",
    problem,
    encounterId,
    assignment: createAssignmentForProblem(state, problem, overrides),
});

const selectFirstNode = (overrides: LearningAssignmentOverrides = {}) => {
    const initial = createStartedState({ seed: "reducer", now: 100 });
    const node = getAvailableExploreNodes(initial)[0];
    const selected = exploreReducer(initial, { type: "SELECT_NODE", nodeId: node.id });
    return setProblem(selected, TEST_PROBLEM, undefined, overrides);
};

const committedAction = (
    state: ExploreRunState,
    result: "correct" | "incorrect",
): Extract<ExploreAction, { type: "APPLY_COMMITTED_ATTEMPT" }> => {
    const gate = state.pendingProblem;
    if (!gate) throw new Error("A pending gate is required");
    const assignment = gate.learningAssignment
        ?? createAssignmentForProblem(state, gate.problem ?? TEST_PROBLEM);
    const identity = createAttemptIdentity({
        profileId: state.profileId ?? "missing-profile",
        runId: state.runId,
        gateId: gate.gateId,
        attemptNumber: gate.attemptCount + 1,
    });
    return {
        type: "APPLY_COMMITTED_ATTEMPT",
        expectedResult: result,
        receipt: {
            attemptKey: createAttemptIdentityKey(identity),
            identity,
            recordedSkillId: gate.problem?.categoryId ?? TEST_PROBLEM.categoryId,
            result,
            affectsSrs: assignment.affectsSrs,
            assignmentKey: assignment.assignmentKey,
            learningSource: assignment.source,
            committedAt: 200 + identity.attemptNumber,
        },
    };
};

const applyAnswer = (
    state: ExploreRunState,
    result: "correct" | "incorrect",
) => exploreReducer(state, committedAction(state, result));

const finishRun = (
    state: ExploreRunState,
    status: "returned" | "rescued",
) => exploreReducer(state, {
    type: "APPLY_FINISHED_RUN",
    receipt: {
        runId: state.runId,
        profileId: state.profileId ?? "missing-profile",
        status,
        endedAt: 300,
    },
});

describe("exploreReducer", () => {
    it("opens a selected node, logs the attempt, and grants a discovery after a correct answer", () => {
        const selected = selectFirstNode();
        const completed = applyAnswer(selected, "correct");

        expect(selected.pendingProblem).toEqual(expect.objectContaining({
            nodeId: "node-1-0",
            actionType: "dig",
        }));
        expect(completed.currentNodeId).toBe(selected.pendingProblem?.nodeId);
        expect(completed.energy).toBe(11);
        expect(completed.temporaryFinds).toHaveLength(1);
        expect(completed.temporaryFinds[0]).toEqual(expect.objectContaining({
            nodeId: "node-1-0",
            rarity: "common",
        }));
        expect(completed.temporaryFinds[0].discoveryPageId).toBeUndefined();
        expect(completed.temporaryFinds[0].discoveryFeatureId).toBeUndefined();
        expect(completed.attempts).toEqual([
            expect.objectContaining({ skillId: "add_1d_1", result: "correct", attemptNumber: 1 }),
        ]);
        expect(completed.pendingProblem).toBeUndefined();
    });

    it("rejects answer actions until a compatible problem is set", () => {
        const initial = createStartedState({ seed: "guard", now: 100 });
        const target = getAvailableExploreNodes(initial)[0];
        const selected = exploreReducer(initial, { type: "SELECT_NODE", nodeId: target.id });

        expect(exploreReducer(selected, committedAction(selected, "correct"))).toBe(selected);
        expect(exploreReducer(selected, committedAction(selected, "incorrect"))).toBe(selected);
    });

    it("keeps the first retry on the same problem and requests assistance after the second miss", () => {
        const selected = selectFirstNode();
        const firstRetry = applyAnswer(selected, "incorrect");
        const secondRetry = applyAnswer(firstRetry, "incorrect");

        expect(firstRetry.energy).toBe(11);
        expect(firstRetry.pendingProblem?.attemptCount).toBe(1);
        expect(firstRetry.pendingProblem?.problem).toBe(TEST_PROBLEM);
        expect(firstRetry.pendingProblem?.learningAssignment).toBe(
            selected.pendingProblem?.learningAssignment,
        );
        expect(secondRetry.energy).toBe(10);
        expect(secondRetry.pendingProblem?.attemptCount).toBe(2);
        expect(secondRetry.pendingProblem?.skillId).toBe("add_1d_1");
        expect(secondRetry.pendingProblem?.problem).toBe(TEST_PROBLEM);
        expect(secondRetry.pendingProblem?.learningAssignment).toBe(
            selected.pendingProblem?.learningAssignment,
        );
        expect(secondRetry.pendingProblem?.problemRefreshPending).toBe(true);
        const advanced = exploreReducer(secondRetry, { type: "ADVANCE_AFTER_INCORRECT" });
        expect(advanced.pendingProblem?.problem).toBeUndefined();
        expect(advanced.pendingProblem?.learningAssignment).toBeUndefined();
        expect(advanced.pendingProblem?.problemRefreshPending).toBe(false);
        expect(secondRetry.attempts).toHaveLength(2);
    });

    it("rescues the player at zero energy without going negative", () => {
        const initial = createStartedState({
            seed: "rescue",
            now: 100,
            config: { maxEnergy: 1 },
        });
        const target = getAvailableExploreNodes(initial)[0];
        let selected = exploreReducer(initial, { type: "SELECT_NODE", nodeId: target.id });
        selected = exploreReducer(selected, { type: "CHOOSE_BRIDGE", plan: "wood" });
        selected = setProblem(selected, TEST_PROBLEM);
        const rescuePending = applyAnswer(selected, "incorrect");
        const rescued = finishRun(rescuePending, "rescued");
        const unchanged = exploreReducer(rescued, committedAction(selected, "incorrect"));

        expect(rescuePending.status).toBe("active");
        expect(rescuePending.rescuePending).toBe(true);
        expect(rescued.status).toBe("rescued");
        expect(rescued.energy).toBe(0);
        expect(unchanged.energy).toBe(0);
    });

    it("shows a last-energy discovery before completing rescue", () => {
        const initial = createStartedState({
            seed: "last-light",
            now: 100,
            config: { maxEnergy: 1 },
        });
        const target = getAvailableExploreNodes(initial)[0];
        let selected = exploreReducer(initial, { type: "SELECT_NODE", nodeId: target.id });
        selected = exploreReducer(selected, { type: "CHOOSE_BRIDGE", plan: "wood" });
        selected = setProblem(selected, TEST_PROBLEM);
        const discovered = applyAnswer(selected, "correct");
        const rescued = finishRun(discovered, "rescued");

        expect(discovered.status).toBe("active");
        expect(discovered.rescuePending).toBe(true);
        expect(discovered.lastEvent.type).toBe("discovery");
        expect(rescued.status).toBe("rescued");
        expect(rescued.confirmedFinds).toHaveLength(1);
    });

    it("can end voluntarily and confirms discoveries", () => {
        const selected = selectFirstNode();
        const completed = applyAnswer(selected, "correct");
        const returned = finishRun(completed, "returned");

        expect(returned.status).toBe("returned");
        expect(returned.confirmedFinds).toEqual(returned.temporaryFinds);
    });

    it("finishes the opening ecology beat, then collects three clues before the root discovery", () => {
        let state = createStartedState({ seed: "research-chain", now: 100 });
        const rootNode = state.nodes.find((node) => node.encounterId === "root-tangle");
        if (!rootNode) throw new Error("Expected a generated root-tangle node");

        while (state.steps < rootNode.depth) {
            const available = getAvailableExploreNodes(state);
            const target = state.steps + 1 === rootNode.depth
                ? available.find((node) => node.id === rootNode.id)
                : available[0];
            if (!target) throw new Error("Expected a route to the root encounter");
            state = exploreReducer(state, { type: "SELECT_NODE", nodeId: target.id });
            if (state.pendingProblem?.actionType === "bridge") {
                state = exploreReducer(state, { type: "CHOOSE_BRIDGE", plan: "wood" });
            }
            const isRootTangle = target.id === rootNode.id;
            state = setProblem(
                state,
                isRootTangle ? ROOT_TANGLE_PROBLEM : TEST_PROBLEM,
                isRootTangle ? "root-tangle" : undefined,
            );
            state = applyAnswer(state, "correct");
        }

        expect(state.temporaryFinds.slice(0, 7).map((find) => find.discoveryFeatureId)).toEqual([
            undefined,
            undefined,
            undefined,
            "discovery-feature:firefly-flower-dew-trail",
            "discovery-feature:firefly-flower-warm-bud",
            "discovery-feature:firefly-flower-ringing-petals",
            "discovery-feature:firefly-flower-light-path",
        ]);
        expect(state.temporaryFinds.at(-1)).toEqual(expect.objectContaining({
            nodeId: rootNode.id,
            rarity: "rare",
            discoveryFeatureId: "discovery-feature:firefly-flower-light-path",
            observationId: "explore-observation:root-tangle-light-path",
        }));
    });

    it("keeps a neutral Q7 payoff when the reserved skill cannot use root semantics", () => {
        let state = createStartedState({ seed: "neutral-finale", now: 100 });
        const finaleNode = state.nodes.find((node) => node.encounterId === "root-tangle");
        if (!finaleNode) throw new Error("Expected a generated finale node");

        while (state.steps < finaleNode.depth) {
            const available = getAvailableExploreNodes(state);
            const target = state.steps + 1 === finaleNode.depth
                ? available.find((node) => node.id === finaleNode.id)
                : available[0];
            if (!target) throw new Error("Expected a route to the finale");
            state = exploreReducer(state, { type: "SELECT_NODE", nodeId: target.id });
            if (state.pendingProblem?.actionType === "bridge") {
                state = exploreReducer(state, { type: "CHOOSE_BRIDGE", plan: "wood" });
            }
            state = setProblem(state, TEST_PROBLEM);
            state = applyAnswer(state, "correct");
        }

        expect(state.temporaryFinds.at(-1)).toEqual(expect.objectContaining({
            nodeId: finaleNode.id,
            rarity: "rare",
            discoveryFeatureId: "discovery-feature:firefly-flower-light-path",
        }));
        expect(state.temporaryFinds.at(-1)?.observationId).toBeUndefined();
        expect(state.attempts.at(-1)?.encounterId).toBeUndefined();
    });

    const reachBridge = () => {
        let state = createStartedState({ seed: "bridge", now: 100 });
        const bridge = state.nodes.find((node) => node.kind === "bridge");
        if (!bridge) throw new Error("Expected a generated bridge");
        const incoming = state.edges.find((edge) => edge.to === bridge.id);
        if (!incoming) throw new Error("Expected an edge into the bridge");
        state = {
            ...state,
            currentNodeId: incoming.from,
            openedNodeIds: [...state.openedNodeIds, incoming.from],
        };
        state = exploreReducer(state, { type: "SELECT_NODE", nodeId: bridge.id });
        return state;
    };

    it("requires a bridge plan before setting or answering a problem", () => {
        const state = reachBridge();
        const withoutPlan = setProblem(state, TEST_PROBLEM);
        expect(withoutPlan).toBe(state);
        expect(exploreReducer(state, committedAction(state, "correct"))).toBe(state);
    });

    it("rejects a reserved learning assignment that does not match the problem", () => {
        let state = reachBridge();
        state = exploreReducer(state, { type: "CHOOSE_BRIDGE", plan: "wood" });
        const assignment = createAssignmentForProblem(state, TEST_PROBLEM);
        const withMismatchedCategory = exploreReducer(state, {
            type: "SET_PROBLEM",
            problem: TEST_PROBLEM,
            assignment: { ...assignment, categoryId: "forged-skill" },
        });

        expect(withMismatchedCategory).toBe(state);
    });

    it("keeps only an encounter id that matches both the gate and problem", () => {
        let state = reachBridge();
        state = exploreReducer(state, { type: "CHOOSE_BRIDGE", plan: "stones" });
        const immersive = setProblem(state, LIGHT_BRIDGE_PROBLEM, "light-bridge");
        const incompatible = setProblem(
            state,
            { ...TEST_PROBLEM, categoryId: "mul_99_2" },
            "light-bridge",
        );
        const withoutVisual = setProblem(
            state,
            NO_VISUAL_LIGHT_BRIDGE_PROBLEM,
            "light-bridge",
        );

        expect(immersive.pendingProblem?.encounterId).toBe("light-bridge");
        expect(incompatible.pendingProblem?.encounterId).toBeUndefined();
        expect(withoutVisual).toBe(state);
    });

    it.each([
        ["wood", 11, "map"],
        ["stones", 10, "crystal"],
        ["detour", 11, "flower"],
    ] as const)("applies the %s bridge cost and discovery tendency", (plan, energy, discoveryKind) => {
        let state = reachBridge();
        state = exploreReducer(state, { type: "CHOOSE_BRIDGE", plan });
        state = setProblem(
            state,
            plan === "stones" ? LIGHT_BRIDGE_PROBLEM : TEST_PROBLEM,
            plan === "stones" ? "light-bridge" : undefined,
        );
        state = applyAnswer(state, "correct");

        expect(state.energy).toBe(energy);
        expect(state.temporaryFinds.at(-1)?.kind).toBe(discoveryKind);
    });

    it("normalizes invalid configuration at the state boundary", () => {
        const state = createStartedState({
            seed: "config",
            now: 100,
            config: { maxEnergy: -4, correctEnergyCost: -2.4, incorrectEnergyCost: 1.6 },
        });

        expect(state.maxEnergy).toBe(1);
        expect(state.energy).toBe(1);
        expect(state.config.correctEnergyCost).toBe(0);
        expect(state.config.incorrectEnergyCost).toBe(2);
    });

    it.each([
        ["run", (action: ReturnType<typeof committedAction>) => ({
            ...action,
            receipt: {
                ...action.receipt,
                identity: { ...action.receipt.identity, runId: "forged-run" },
            },
        })],
        ["gate", (action: ReturnType<typeof committedAction>) => ({
            ...action,
            receipt: {
                ...action.receipt,
                identity: { ...action.receipt.identity, gateId: "forged-gate" },
            },
        })],
        ["attempt number", (action: ReturnType<typeof committedAction>) => ({
            ...action,
            receipt: {
                ...action.receipt,
                identity: { ...action.receipt.identity, attemptNumber: 2 as const },
            },
        })],
        ["skill", (action: ReturnType<typeof committedAction>) => ({
            ...action,
            receipt: { ...action.receipt, recordedSkillId: "forged-skill" },
        })],
        ["result", (action: ReturnType<typeof committedAction>) => ({
            ...action,
            receipt: { ...action.receipt, result: "incorrect" as const },
        })],
        ["attempt key", (action: ReturnType<typeof committedAction>) => ({
            ...action,
            receipt: { ...action.receipt, attemptKey: "forged-key" },
        })],
        ["learning assignment key", (action: ReturnType<typeof committedAction>) => ({
            ...action,
            receipt: { ...action.receipt, assignmentKey: "forged-assignment" },
        })],
        ["learning source", (action: ReturnType<typeof committedAction>) => ({
            ...action,
            receipt: { ...action.receipt, learningSource: "weak" as const },
        })],
        ["SRS effect", (action: ReturnType<typeof committedAction>) => ({
            ...action,
            receipt: { ...action.receipt, affectsSrs: !action.receipt.affectsSrs },
        })],
    ])("rejects a receipt with mismatched %s", (_label, mutate) => {
        const selected = selectFirstNode();
        const action = committedAction(selected, "correct");

        expect(exploreReducer(selected, mutate(action) as ExploreAction)).toBe(selected);
    });

    it("ignores the same committed receipt after applying it once", () => {
        const selected = selectFirstNode();
        const action = committedAction(selected, "incorrect");
        const first = exploreReducer(selected, action);

        expect(exploreReducer(first, action)).toBe(first);
        expect(first.attempts).toHaveLength(1);
        expect(first.committedAttemptKeys).toEqual([action.receipt.attemptKey]);
    });

    it("rejects a receipt for another profile even when its attempt key is internally valid", () => {
        const selected = selectFirstNode();
        const action = committedAction(selected, "correct");
        const identity = createAttemptIdentity({
            ...action.receipt.identity,
            profileId: "profile-2",
        });
        const forged = {
            ...action,
            receipt: {
                ...action.receipt,
                identity,
                attemptKey: createAttemptIdentityKey(identity),
            },
        };

        expect(exploreReducer(selected, forged)).toBe(selected);
    });

    it("accepts an SRS-affecting receipt when it matches the reserved assignment", () => {
        const selected = selectFirstNode({ affectsSrs: true, source: "main" });
        const action = committedAction(selected, "correct");
        const completed = exploreReducer(selected, action);

        expect(action.receipt).toEqual(expect.objectContaining({
            affectsSrs: true,
            learningSource: "main",
            assignmentKey: selected.pendingProblem?.learningAssignment?.assignmentKey,
        }));
        expect(completed).not.toBe(selected);
        expect(completed.attempts).toEqual([
            expect.objectContaining({ result: "correct", skillId: TEST_PROBLEM.categoryId }),
        ]);
    });

    it("rejects a finish receipt for another run or a rescue without zero energy", () => {
        const selected = selectFirstNode();
        const otherRun = exploreReducer(selected, {
            type: "APPLY_FINISHED_RUN",
            receipt: {
                runId: "other-run",
                profileId: "profile-1",
                status: "returned",
                endedAt: 300,
            },
        });
        const forgedRescue = finishRun(selected, "rescued");
        const otherProfile = exploreReducer(selected, {
            type: "APPLY_FINISHED_RUN",
            receipt: {
                runId: selected.runId,
                profileId: "profile-2",
                status: "returned",
                endedAt: 300,
            },
        });

        expect(otherRun).toBe(selected);
        expect(otherProfile).toBe(selected);
        expect(forgedRescue).toBe(selected);
    });

    it("does not accept a voluntary return while a problem is pending", () => {
        const selected = selectFirstNode();

        expect(finishRun(selected, "returned")).toBe(selected);
    });
});
