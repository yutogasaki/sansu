import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { MemoryState, UserProfile } from "../../types";
import type { ExploreProblemGate, ExploreRunState } from "../types";

Object.assign(globalThis, { indexedDB, IDBKeyRange });

const { db } = await import("../../../db");
const { createInitialProfile } = await import("../../user/profile");
const { createInitialExploreState } = await import("../reducer");
const { startExploreRun } = await import("../persistenceRepository");
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
): Promise<ExploreRunState> => {
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
    return state;
};

const createGate = (
    state: ExploreRunState,
    attemptCount = 0,
    skillId?: string,
): ExploreProblemGate => ({
    gateId: "gate-1",
    nodeId: state.nodes[1]?.id ?? "node-1-0",
    actionType: "dig",
    attemptCount,
    skillId,
});

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
        const state = await startRun(profile, "due-reservation");
        const gate = createGate(state);

        const plan = await createAndReserveExploreProblemPlan(state, gate, profile);

        expect(plan.problem.categoryId).toBe("add_1d_1_bridge");
        expect(plan.assignment).toMatchObject({
            problemId: plan.problem.id,
            categoryId: "add_1d_1_bridge",
            source: "due",
            isReview: true,
            countsTowardReviewCap: true,
            affectsSrs: true,
        });
        await expect(db.exploreRuns.get(state.runId)).resolves.toEqual(
            expect.objectContaining({
                learningAssignments: {
                    [plan.problem.id]: plan.assignment,
                },
            }),
        );
    });

    it("uses a representation retry after two misses before other planner sources", async () => {
        const profile = createProfile();
        await persistProfile(profile);
        await addDueMemory(profile.id, "count_10");
        const state = await startRun(profile, "representation-retry");
        const gate = createGate(state, 2, "add_1d_1");

        const plan = await createAndReserveExploreProblemPlan(state, gate, profile);

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
        const state = await startRun(profile, "reservation-replay");
        const gate = createGate(state);

        const first = await createAndReserveExploreProblemPlan(state, gate, profile);
        const second = await createAndReserveExploreProblemPlan(state, gate, profile);
        const storedRun = await db.exploreRuns.get(state.runId);

        expect(second).toEqual(first);
        expect(Object.keys(storedRun?.learningAssignments ?? {})).toEqual([
            first.problem.id,
        ]);
    });

    it("keeps an encounter from replacing the category already selected by Due", async () => {
        const profile = createProfile();
        await persistProfile(profile);
        await addDueMemory(profile.id, "count_10");
        const state = await startRun(profile, "encounter-does-not-replan");
        const gate: ExploreProblemGate = {
            gateId: "light-bridge-gate",
            nodeId: "node-3-0",
            actionType: "bridge",
            bridgePlan: "stones",
            attemptCount: 0,
        };

        const plan = await createAndReserveExploreProblemPlan(state, gate, profile);

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
