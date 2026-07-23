import { describe, expect, it } from "vitest";
import type { Problem } from "../../types";
import { createAttemptIdentity, createAttemptIdentityKey } from "../attemptIdentity";
import { createExploreLearningAssignment } from "../learningAssignment";
import type {
    ExploreProblemAnsweredEventRecord,
    ExploreRunRecord,
} from "../persistenceTypes";
import { createInitialExploreState, exploreReducer, getAvailableExploreNodes } from "../reducer";
import {
    assertExploreActiveCheckpointForRun,
    assertExploreCheckpointMatchesRunAggregates,
    createExploreActiveCheckpoint,
    ExploreCheckpointConflictError,
    foldExploreAnswerTail,
} from "../runCheckpoint";

const createPendingFixture = () => {
    const initial = {
        ...createInitialExploreState({ seed: "checkpoint", now: 100 }),
        profileId: "profile-1",
    };
    const node = getAvailableExploreNodes(initial)[0];
    const selected = exploreReducer(initial, { type: "SELECT_NODE", nodeId: node.id });
    const gate = selected.pendingProblem!;
    const problem: Problem = {
        id: `${gate.gateId}:attempt-0`,
        subject: "math",
        categoryId: "add_1d_1",
        questionText: "1 + 1",
        inputType: "number",
        correctAnswer: "2",
        isReview: false,
    };
    const assignment = createExploreLearningAssignment({
        profileId: initial.profileId,
        runId: initial.runId,
        gateId: gate.gateId,
        problemId: problem.id,
        categoryId: problem.categoryId,
        source: "game-only-fallback",
        isReview: false,
        isMaintenanceCheck: false,
        countsTowardReviewCap: false,
        affectsSrs: false,
        reservedAt: 120,
    });
    const state = exploreReducer(selected, {
        type: "SET_PROBLEM",
        problem,
        assignment,
        encounterId: undefined,
    });
    const checkpoint = createExploreActiveCheckpoint({
        state,
        openingExperienceId: "classic-v1",
        updatedAt: 130,
    });
    const run: ExploreRunRecord = {
        runId: state.runId,
        profileId: initial.profileId,
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
        learningAssignments: { [problem.id]: assignment },
        activeCheckpoint: checkpoint,
        updatedAt: 130,
    };
    const identity = createAttemptIdentity({
        profileId: initial.profileId,
        runId: state.runId,
        gateId: gate.gateId,
        attemptNumber: 1,
    });
    const event: ExploreProblemAnsweredEventRecord = {
        type: "problem_answered",
        profileId: initial.profileId,
        runId: state.runId,
        attemptKey: createAttemptIdentityKey(identity),
        timestamp: 200,
        gateId: gate.gateId,
        attemptNumber: identity.attemptNumber,
        recordedSkillId: problem.categoryId,
        result: "correct",
        affectsSrs: false,
        assignmentKey: assignment.assignmentKey,
        learningSource: assignment.source,
        isReview: false,
        isMaintenanceCheck: false,
        payload: null,
    };
    return { checkpoint, event, run, state };
};

describe("active exploration checkpoint", () => {
    it("validates a full pending problem against its stored assignment", () => {
        const { checkpoint, run } = createPendingFixture();

        expect(() => assertExploreActiveCheckpointForRun(checkpoint, run)).not.toThrow();
        expect(() => assertExploreCheckpointMatchesRunAggregates(checkpoint, run)).not.toThrow();
    });

    it("rejects a checkpoint whose learning policy differs from the stored assignment", () => {
        const { checkpoint, run, state } = createPendingFixture();
        const assignment = state.pendingProblem!.learningAssignment!;
        const mismatchedCheckpoint = createExploreActiveCheckpoint({
            state: {
                ...state,
                pendingProblem: {
                    ...state.pendingProblem!,
                    learningAssignment: {
                        ...assignment,
                        source: "main",
                        affectsSrs: true,
                    },
                },
            },
            openingExperienceId: checkpoint.openingExperienceId,
            updatedAt: checkpoint.updatedAt,
        });

        expect(() => assertExploreActiveCheckpointForRun(mismatchedCheckpoint, run))
            .toThrow(ExploreCheckpointConflictError);
    });

    it("folds one durable answer through the reducer and ignores the same tail twice", () => {
        const { checkpoint, event, run } = createPendingFixture();

        const folded = foldExploreAnswerTail({ checkpoint, event });
        const advancedRun = {
            ...run,
            problemsAnswered: 1,
            correctCount: 1,
            activeCheckpoint: folded,
        };

        expect(folded.revision).toBe(1);
        expect(folded.state.steps).toBe(1);
        expect(folded.state.temporaryFinds).toHaveLength(1);
        expect(folded.state.committedAttemptKeys).toEqual([event.attemptKey]);
        expect(foldExploreAnswerTail({ checkpoint: folded, event })).toBe(folded);
        expect(() => assertExploreCheckpointMatchesRunAggregates(folded, advancedRun))
            .not.toThrow();
    });

    it("rejects a tail from another attempt boundary", () => {
        const { checkpoint, event } = createPendingFixture();
        const mismatched = { ...event, gateId: "another-gate" };

        expect(() => foldExploreAnswerTail({ checkpoint, event: mismatched }))
            .toThrow(ExploreCheckpointConflictError);
    });

    it("does not allow a discovery cursor outside the saved finds", () => {
        const { state } = createPendingFixture();

        expect(() => createExploreActiveCheckpoint({
            state,
            acknowledgedDiscoveryId: "missing-discovery",
        })).toThrow(ExploreCheckpointConflictError);
    });

    it("rejects duplicate attempt rows even when the committed key list is unique", () => {
        const { checkpoint, event, run } = createPendingFixture();
        const folded = foldExploreAnswerTail({ checkpoint, event });
        const attempt = folded.state.attempts[0];
        const corrupted = createExploreActiveCheckpoint({
            state: {
                ...folded.state,
                attempts: [attempt, attempt],
                committedAttemptKeys: [attempt.attemptKey, "another-attempt"],
            },
            openingExperienceId: folded.openingExperienceId,
            revision: folded.revision,
            updatedAt: folded.updatedAt,
        });

        expect(() => assertExploreActiveCheckpointForRun(corrupted, {
            ...run,
            activeCheckpoint: corrupted,
            updatedAt: corrupted.updatedAt,
        })).toThrow(ExploreCheckpointConflictError);
    });
});
