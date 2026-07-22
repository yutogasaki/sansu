import { describe, expect, it, vi } from "vitest";
import type { Problem } from "../../types";
import { createAttemptIdentity, createAttemptIdentityKey } from "../attemptIdentity";
import { createExploreLearningAssignment } from "../learningAssignment";
import {
    projectRapidLoopAfterCorrectCommit,
    settleRapidLoopPrefetchWithin,
} from "../rapidLoop";
import {
    createInitialExploreState,
    exploreReducer,
    getAvailableExploreNodes,
} from "../reducer";
import type { ExploreAction, ExploreRunState } from "../types";

const TEST_PROBLEM: Problem = {
    id: "rapid-loop-problem-1",
    subject: "math",
    categoryId: "add_1d_1",
    questionText: "1 + 1",
    inputType: "number",
    correctAnswer: "2",
    isReview: false,
};

const createReadyState = (): ExploreRunState => {
    const initial = createInitialExploreState({ seed: "reducer", now: 100 });
    const started = exploreReducer(initial, {
        type: "APPLY_STARTED_RUN",
        run: {
            runId: initial.runId,
            profileId: "profile-1",
            seed: initial.seed,
            status: "active",
            startedAt: initial.startedAt,
            energyUsed: 0,
            problemsAnswered: 0,
            correctCount: 0,
            incorrectCount: 0,
            skippedCount: 0,
            discoveries: [],
            routeSummary: [],
            updatedAt: initial.startedAt,
        },
    });
    const target = getAvailableExploreNodes(started)[0];
    const selected = exploreReducer(started, { type: "SELECT_NODE", nodeId: target.id });
    const gate = selected.pendingProblem;
    if (!gate || !selected.profileId) throw new Error("Test gate was not created");
    const assignment = createExploreLearningAssignment({
        profileId: selected.profileId,
        runId: selected.runId,
        gateId: gate.gateId,
        problemId: TEST_PROBLEM.id,
        categoryId: TEST_PROBLEM.categoryId,
        source: "game-only-fallback",
        isReview: false,
        isMaintenanceCheck: false,
        countsTowardReviewCap: false,
        affectsSrs: false,
        reservedAt: 150,
    });
    return exploreReducer(selected, {
        type: "SET_PROBLEM",
        problem: TEST_PROBLEM,
        assignment,
    });
};

const createCommitAction = (
    state: ExploreRunState,
    result: "correct" | "incorrect",
): Extract<ExploreAction, { type: "APPLY_COMMITTED_ATTEMPT" }> => {
    const gate = state.pendingProblem;
    const assignment = gate?.learningAssignment;
    if (!gate?.problem || !assignment || !state.profileId) {
        throw new Error("Test problem was not prepared");
    }
    const identity = createAttemptIdentity({
        profileId: state.profileId,
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
            recordedSkillId: gate.problem.categoryId,
            result,
            affectsSrs: assignment.affectsSrs,
            assignmentKey: assignment.assignmentKey,
            learningSource: assignment.source,
            committedAt: 200,
        },
    };
};

describe("rapid-loop correct projection", () => {
    it("projects a valid zero-tap gate without mutating the visible state", () => {
        const state = createReadyState();
        const projection = projectRapidLoopAfterCorrectCommit(
            state,
            createCommitAction(state, "correct"),
        );

        expect(state.steps).toBe(0);
        expect(state.pendingProblem?.problem).toBe(TEST_PROBLEM);
        expect(projection?.committedState.steps).toBe(1);
        expect(projection?.routeActions[0]?.type).toBe("SELECT_NODE");
        expect(projection?.nextGate.problem).toBeUndefined();
        expect(projection?.nextGate.nodeId).not.toBe(state.pendingProblem?.nodeId);
        if (projection?.nextGate.actionType === "bridge") {
            expect(projection.nextGate.bridgePlan).toBe("stones");
        }
    });

    it("never routes from an incorrect receipt", () => {
        const state = createReadyState();
        expect(projectRapidLoopAfterCorrectCommit(
            state,
            createCommitAction(state, "incorrect"),
        )).toBeUndefined();
    });
});

describe("rapid-loop bounded prefetch", () => {
    it("returns ready work immediately", async () => {
        await expect(settleRapidLoopPrefetchWithin(
            Promise.resolve("next-problem"),
            20,
        )).resolves.toEqual({ status: "ready", value: "next-problem" });
    });

    it("turns rejection into a local fallback result", async () => {
        await expect(settleRapidLoopPrefetchWithin(
            Promise.reject(new Error("planner failed")),
            20,
        )).resolves.toEqual({ status: "error" });
    });

    it("cuts off work at the interaction deadline", async () => {
        vi.useFakeTimers();
        try {
            const pending = new Promise<string>(() => undefined);
            const result = settleRapidLoopPrefetchWithin(pending, 25);
            await vi.advanceTimersByTimeAsync(25);
            await expect(result).resolves.toEqual({ status: "timeout" });
        } finally {
            vi.useRealTimers();
        }
    });

    it("does not allocate a timeout when no prefetch exists", async () => {
        await expect(settleRapidLoopPrefetchWithin(undefined, 20))
            .resolves.toEqual({ status: "none" });
    });
});
