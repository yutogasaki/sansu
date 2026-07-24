import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { MemoryState, UserProfile } from "../../types";
import { DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID } from "../openingExperience";
import type { ExploreRunState } from "../types";

Object.assign(globalThis, { indexedDB, IDBKeyRange });

const { db } = await import("../../../db");
const { createInitialProfile } = await import("../../user/profile");
const {
    createInitialExploreState,
    exploreReducer,
    getAvailableExploreNodes,
} = await import("../reducer");
const {
    commitExploreAttempt,
    saveExploreRunCheckpoint,
    startExploreRun,
} = await import("../persistenceRepository");
const { createAndReserveExploreProblemPlan } = await import("../learningPlanner");

const createProfile = (): UserProfile => {
    const profile = createInitialProfile("Explore planner", 1, 7, 1, "math");
    profile.mathMainLevel = 8;
    profile.mathMaxUnlocked = 8;
    return profile;
};

const persistProfile = async (profile: UserProfile) => {
    await db.profiles.put(profile);
    await db.appData.put({
        id: "app",
        schemaVersion: 1,
        activeProfileId: profile.id,
        profiles: { [profile.id]: profile },
    });
};

const startRun = async (
    profile: UserProfile,
    seed: string,
): Promise<{ state: ExploreRunState; revision: number }> => {
    const state = {
        ...createInitialExploreState({ seed, now: 100 }),
        profileId: profile.id,
    };
    await startExploreRun({
        runId: state.runId,
        profileId: profile.id,
        seed: state.seed,
        startedAt: state.startedAt,
    });
    const target = getAvailableExploreNodes(state)[0];
    if (!target) throw new Error("Expected an opening explore node");
    let selected = exploreReducer(state, { type: "SELECT_NODE", nodeId: target.id });
    if (selected.pendingProblem?.actionType === "bridge") {
        selected = exploreReducer(selected, { type: "CHOOSE_BRIDGE", plan: "stones" });
    }
    const receipt = await saveExploreRunCheckpoint({
        runId: state.runId,
        profileId: profile.id,
        expectedRevision: 0,
        state: selected,
        openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
        savedAt: 101,
    });
    return { state: selected, revision: receipt.checkpointRevision };
};

const addDueMemory = async (profileId: string, skillId: string) => {
    const due: MemoryState = {
        profileId,
        id: skillId,
        strength: 2,
        nextReview: "2000-01-01T00:00:00.000Z",
        totalAnswers: 3,
        correctAnswers: 2,
        incorrectAnswers: 1,
        skippedAnswers: 0,
        updatedAt: "2000-01-01T00:00:00.000Z",
        status: "active",
        isWeak: false,
    };
    await db.memoryMath.put(due);
};

beforeEach(async () => {
    await db.open();
    for (const table of db.tables) await table.clear();
});

afterAll(async () => {
    await db.delete();
});

describe("createAndReserveExploreProblemPlan", () => {
    it("prioritizes a compatible Due skill and reserves an SRS assignment", async () => {
        const profile = createProfile();
        await persistProfile(profile);
        await addDueMemory(profile.id, "add_1d_1_bridge");
        const { state, revision } = await startRun(profile, "due-reservation");
        const gate = state.pendingProblem!;

        const plan = await createAndReserveExploreProblemPlan(
            state,
            gate,
            profile,
            { expectedCheckpointRevision: revision },
        );

        expect(plan.problem.categoryId).toBe("add_1d_1_bridge");
        expect(plan.assignment).toMatchObject({
            problemId: plan.problem.id,
            categoryId: "add_1d_1_bridge",
            source: "due",
            isReview: true,
            countsTowardReviewCap: true,
            affectsSrs: true,
        });
        const storedRun = await db.exploreRuns.get(state.runId);
        expect(storedRun?.learningSegments?.["0"]?.slots).toHaveLength(3);
        expect(storedRun?.learningAssignments?.[plan.problem.id]).toEqual(plan.assignment);
    });

    it("uses a representation retry after two misses before other planner sources", async () => {
        const profile = createProfile();
        await persistProfile(profile);
        await addDueMemory(profile.id, "add_1d_1");
        const { state, revision } = await startRun(profile, "representation-retry");
        const gate = state.pendingProblem!;

        const initialPlan = await createAndReserveExploreProblemPlan(
            state,
            gate,
            profile,
            { expectedCheckpointRevision: revision },
        );
        const problemCheckpoint = await saveExploreRunCheckpoint({
            runId: state.runId,
            profileId: profile.id,
            expectedRevision: revision,
            state: exploreReducer(state, {
                type: "SET_PROBLEM",
                problem: initialPlan.problem,
                assignment: initialPlan.assignment,
                encounterId: initialPlan.encounterId,
            }),
            openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
            savedAt: 102,
        });
        let checkpoint = (await db.exploreRuns.get(state.runId))!.activeCheckpoint!;
        for (const attemptNumber of [1, 2] as const) {
            await commitExploreAttempt({
                identity: {
                    profileId: profile.id,
                    runId: state.runId,
                    gateId: gate.gateId,
                    attemptNumber,
                },
                problem: {
                    id: initialPlan.problem.id,
                    categoryId: initialPlan.problem.categoryId,
                },
                result: "incorrect",
                committedAt: 102 + attemptNumber,
                expectedCheckpointRevision: attemptNumber === 1
                    ? problemCheckpoint.checkpointRevision
                    : checkpoint.revision,
            });
            checkpoint = (await db.exploreRuns.get(state.runId))!.activeCheckpoint!;
        }
        const retryState = exploreReducer(checkpoint.state, {
            type: "ADVANCE_AFTER_INCORRECT",
        });
        const retryGate = retryState.pendingProblem!;
        const plan = await createAndReserveExploreProblemPlan(
            retryState,
            retryGate,
            profile,
            { expectedCheckpointRevision: checkpoint.revision },
        );

        expect(plan.problem.categoryId).toBe("add_1d_1_bridge");
        expect(plan.assignment).toMatchObject({
            source: "representation-retry",
            isReview: false,
            isMaintenanceCheck: false,
            countsTowardReviewCap: false,
            affectsSrs: true,
        });
    });

    it("restores the existing assignment and deterministic problem on the same problem id", async () => {
        const profile = createProfile();
        await persistProfile(profile);
        const { state, revision } = await startRun(profile, "reservation-replay");
        const gate = state.pendingProblem!;

        const first = await createAndReserveExploreProblemPlan(
            state,
            gate,
            profile,
            { expectedCheckpointRevision: revision },
        );
        const second = await createAndReserveExploreProblemPlan(
            state,
            gate,
            profile,
            { expectedCheckpointRevision: revision },
        );
        const storedRun = await db.exploreRuns.get(state.runId);

        expect(second).toEqual(first);
        expect(Object.keys(storedRun?.learningAssignments ?? {})).toHaveLength(3);
    });

    it("keeps an encounter from replacing the category already selected by Due", async () => {
        const profile = createProfile();
        await persistProfile(profile);
        await addDueMemory(profile.id, "count_10");
        const { state, revision } = await startRun(profile, "encounter-does-not-replan");
        const gate = state.pendingProblem!;

        const plan = await createAndReserveExploreProblemPlan(
            state,
            gate,
            profile,
            { expectedCheckpointRevision: revision },
        );

        expect(plan.assignment).toMatchObject({
            categoryId: "count_10",
            source: "due",
            affectsSrs: true,
        });
        expect(plan.problem.categoryId).toBe(plan.assignment.categoryId);
        expect(plan.problem.categoryId).not.toMatch(/^add_/);
        expect(plan.encounterId).toBeUndefined();
    });
});
